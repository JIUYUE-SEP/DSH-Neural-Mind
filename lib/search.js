/**
 * 混合检索(§5):BM25(常开)+ 向量(可选,150ms 份额)+ RRF 融合,刻意不做 LLM 重排。
 * 单路及格线 + topK 截断,不设全局 minScore;排序由系数主导(§5.6 刻意如此)。
 *
 * 检索池:未消化 L0 + active/staged L2;hidden 全域不可见,archived 仅 recall 可见,
 * 消化后 L0 退出检索池(§1)。硬过滤(§5.4):privateWorkspaces / sensitive 不跨域 /
 * 本会话 L0 排除(仅 inject 用途)。检索固定 global;workspace 只参与排序与边界判断。
 */
import { Bm25Index } from './bm25.js'
import { cosine } from './embed.js'
import { computeFinalScore, evidenceCoefficient, reconcileArchiveState, rrfFuse, shouldArchive } from './rank.js'
import { makeExcerpt, normalizeEntity, tokenize } from './text.js'
import { DAY_MS } from './util.js'
import { isPrivateWorkspace, normalizeWorkspacePath } from './workspace.js'

/** 诊断输出的分数保留 4 位小数(与 eval/面板展示同口径)。 */
const round4 = (value) => Math.round(value * 10_000) / 10_000

/** L0 条目参与排序时的归一化(无证据、无分类,按新鲜 episode 计)。 */
function hotAsRankable(entry) {  return {
    evidence: [],
    temporal: 'episode',
    importance: 5,
    createdAt: entry.createdAt,
    workspaceId: entry.workspaceId,
    status: 'active',
  }
}

/**
 * @param deps { cfg: 完整配置, rankCfg: decay+scoring 合并, embedder, logger }
 */
export function createSearch({ cfg, rankCfg, embedder, logger, turns, onVectorMismatch }) {
  const bm25Main = new Bm25Index(cfg.bm25)
  const bm25Thinking = new Bm25Index(cfg.bm25)
  /** @type Map<string, { ref: 'mem' | 'hot', record: object }> */
  const corpus = new Map()

  // 维度防呆(§5):库中向量维度与当前端点不符时的告警与自愈节流。
  // 发现即记账(复用 embed-degraded)并触发一次重嵌入;日志/kick 5 分钟内不重复刷
  // (重嵌入自身有 running 闸,kick 只是"有人需要他跑"的信号)。
  const DIM_MISMATCH_LOG_MS = 300_000
  let lastDimMismatchMs = 0
  function reportDimMismatch(count) {
    embedder.noteDegraded?.('dim-mismatch')
    const now = Date.now()
    if (now - lastDimMismatchMs < DIM_MISMATCH_LOG_MS) return
    lastDimMismatchMs = now
    logger?.info?.(`memory: 库中向量维度与当前端点不符(${count} 段),已跳过并记账;触发重嵌入自愈(若端点换了模型,请同步 modelId)`)
    onVectorMismatch?.()
  }

  // ── 语料维护 ──────────────────────────────────────────────────────────────

  function upsertMemory(record) {
    corpus.set(record.id, { ref: 'mem', record })
    bm25Main.add(record.id, tokenize(record.content))
  }

  function removeMemory(id) {
    corpus.delete(id)
    bm25Main.remove(id)
    bm25Thinking.remove(id)
  }

  function upsertHot(entry) {
    if (entry.digested || entry.hidden === true) {
      removeHot(entry.id)
      return
    }
    corpus.set(entry.id, { ref: 'hot', record: entry })
    bm25Main.add(entry.id, tokenize(entry.content))
    if (typeof entry.thinking === 'string' && entry.thinking !== '') {
      bm25Thinking.add(entry.id, tokenize(entry.thinking))
    }
  }

  function removeHot(id) {
    corpus.delete(id)
    bm25Main.remove(id)
    bm25Thinking.remove(id)
  }

  function rebuild(memories, hotEntries) {
    bm25Main.clear()
    bm25Thinking.clear()
    corpus.clear()
    for (const record of memories) upsertMemory(record)
    for (const entry of hotEntries) upsertHot(entry)
  }

  /** 本会话 L0 被压缩 shadow 的事件 seq 集(§4.2 解禁):compaction/* 事件经 inject 侧写入;按会话数封顶。 */
  const shadowedBySession = new Map()
  function markShadowed(sessionId, seqs) {
    let set = shadowedBySession.get(sessionId)
    if (set === undefined) {
      if (shadowedBySession.size >= 50) shadowedBySession.delete(shadowedBySession.keys().next().value)
      set = new Set()
      shadowedBySession.set(sessionId, set)
    }
    for (const s of seqs) set.add(s)
  }

  /** 本会话 L0 条目是否已被压缩 shadow(解禁依据):起止 seq 都落在 shadow 集内即视为已折叠。 */
  function hotIsShadowed(entry, sessionId) {
    const set = shadowedBySession.get(sessionId)
    return set !== undefined && set.has(entry.startSeq) && set.has(entry.endSeq)
  }

  // ── 候选资格(硬过滤)──────────────────────────────────────────────────────

  /** 当前 workspace 是否已知且与记录同域;空/`(unknown)` 不得当成通配符。 */
  function sameKnownWorkspace(record, current) {
    const wid = current?.workspaceId ?? ''
    if (wid === '' || wid === '(unknown)') return false
    return normalizeWorkspacePath(record.workspaceId) === normalizeWorkspacePath(wid)
  }

  /** 排序/冷启动用的同域判断:`(unknown)` 可以与自己相等,但不用于隐私授权。 */
  function sameRankingWorkspace(record, current) {
    const wid = current?.workspaceId ?? ''
    if (wid === '') return false
    return normalizeWorkspacePath(record.workspaceId) === normalizeWorkspacePath(wid)
  }

  function eligible(item, { current, purpose, timeWindow, sessionFilter, includeArchived, ownerView = false }) {
    const { ref, record } = item
    if (ownerView) return true // owner 管理视图:全池可见(含 hidden/archived)
    if (record.hidden === true) return false // 全域不可见(§4.2)
    if (ref === 'mem') {
      if (record.status === 'archived' && !includeArchived) return false
      if (purpose === 'relation' && record.status !== 'active' && record.status !== 'staged') return false
    }
    if (ref === 'hot' && record.digested) return false
    if (purpose === 'relation' && ref !== 'mem') return false // 关系候选集只取既有记忆(§3.2)
    // 本会话 L0 排除(§4.2)——但该轮已被压缩 shadow 的解禁:从视野消失的不算"已告知"(§4.2 压缩联动)
    if (purpose === 'inject' && ref === 'hot' && record.sessionId === current.sessionId && !hotIsShadowed(record, current.sessionId)) return false
    const sameWs = sameKnownWorkspace(record, current)
    if (isPrivateWorkspace(record.workspaceId, cfg.privateWorkspaces) && !sameWs) return false
    if (cfg.sensitiveNoCross && record.sensitive === true && !sameWs) return false
    if (sessionFilter !== undefined && record.sessionId !== sessionFilter) return false
    if (timeWindow !== undefined && timeWindow !== null) {
      const t = Date.parse(record.eventTime ?? record.createdAt)
      if (Number.isNaN(t) || t < timeWindow.from || t > timeWindow.to) return false
    }
    return true
  }

  /**
   * 工具/渲染用的访问判断:只回答“这条记录在当前域能否被看到”,不参与检索排序。
   * ID 直达、related 枚举和二次引用共用它;digested L0 仍可由 ID recall(存续语义),
   * 因此这里不套用检索池的 digested 排除。
   */
  function canAccess(record, ref, { current = { workspaceId: '', sessionId: '' }, includeArchived = true } = {}) {
    if (record.hidden === true) return false
    if (ref === 'mem' && record.status === 'archived' && !includeArchived) return false
    const sameWs = sameKnownWorkspace(record, current)
    if (isPrivateWorkspace(record.workspaceId, cfg.privateWorkspaces) && !sameWs) return false
    if (cfg.sensitiveNoCross && record.sensitive === true && !sameWs) return false
    return true
  }

  // ── 检索 ──────────────────────────────────────────────────────────────────

  /**
   * 检索主体:正常返回 `[{ id, ref, record, score, relevance, parts, hitChunkText? }]` 降序。
   * **抛错语义由外层 `search()` 负责**(收敛成 null)——这里不要自己吞异常。
   */
  async function searchInner({
    query,
    nowMs = Date.now(),
    current = { workspaceId: '', sessionId: '' },
    purpose = 'inject',
    timeWindow = null,
    sessionFilter = undefined,
    includeArchived = false,
    limit = cfg.injectMaxItems,
    diagnostics = false,
  }) {
    const ownerView = purpose === 'owner'
    const queryTokens = tokenize(query)
    const ctxOpts = { current, purpose, timeWindow, sessionFilter, includeArchived, ownerView }
    const laneLimit = Math.max(1, Math.floor(cfg.candidateMultiplier * limit))

    // entity 加权(§5.4):entity 与当前 cwd 子路径重合,或本会话近 entityWindowTurns 轮消息
    // 直接提及(归一化子串)→ ×entityBoost。归一化口径与提炼侧同一函数(text.normalizeEntity)。
    // 注意这两个系数在 scoring 子对象里,要走 rankCfg(decay+scoring 合并),不是顶层 cfg(踩过)。
    const recentEntityText = (turns !== undefined && rankCfg.entityWindowTurns > 0 && current.sessionId !== '')
      ? turns.recentTexts(current.sessionId, rankCfg.entityWindowTurns).join('\n').toLowerCase()
      : ''
    const entityHitOf = (record) => {
      const e = normalizeEntity(record.entity)
      if (e === '') return false
      return current.workspaceId.toLowerCase().includes(e)
        || (recentEntityText !== '' && recentEntityText.includes(e))
    }

    // 冷启动收紧(§2/§5.4):本地 active 不足 coldStartMinLocal 时,异地及格线 ×2、
    // 异地系数 ×0.625——只管制异地准入,本地/异地相对序不变不倒挂;本地池达标自动恢复。
    let localActive = 0
    if (!ownerView && cfg.coldStartMinLocal > 0) {
      for (const item of corpus.values()) {
        const { ref, record } = item
        if (ref === 'mem' && sameRankingWorkspace(record, current) && record.status === 'active' && record.hidden !== true) localActive += 1
      }
    }
    const coldStart = !ownerView && cfg.coldStartMinLocal > 0 && localActive < cfg.coldStartMinLocal
    const remoteTighten = (record) => coldStart && !sameRankingWorkspace(record, current)
    const rankCfgHere = coldStart ? { ...rankCfg, remoteFactor: rankCfg.remoteFactor * 0.625 } : rankCfg

    // 绝对相关性闸门(§5 v1.9;v1.13 起默认开):保留每路的**原始分**做注入前的准入判断。
    // 三条纪律写死:① 只作用于注入路径(recall 是用户主动问,保持宽松);
    // ② 混合路(向量路真的跑起来)用共识线/单路线;纯 BM25(未配 embedding / 服务降级)
    //    用 `bm25OnlyMin` 单路门槛——旧行为是"纯 BM25 时整条闸门不生效",没有向量路的
    //    用户会被弱词面命中铺满注入预算(2026-11-07 用户反馈:注入过多 + 错误注入);
    // ③ 判据是"两路互相印证(共识线)或单路信号足够强(单路线)",不做路级交集。
    const gate = cfg.relevanceGate ?? {}
    const gateWanted = gate.enabled === true && purpose === 'inject'

    // 关键词路(始终开启);开了闸门就多取一些,免得原始分够格却被 top-N 截掉
    let bm25Hits = bm25Main.search(queryTokens, gateWanted ? Math.max(laneLimit * 4, 64) : laneLimit * 4)
    /** 原始分索引(闸门用;不参与排序) */
    const bm25RawOf = new Map(bm25Hits.map((h) => [h.id, h.score]))
    if (purpose === 'recall') {
      // 思考块仅 recall 可查(§3.1):并入关键词路,同 id 取高分
      const thinkingHits = bm25Thinking.search(queryTokens, laneLimit * 4)
      const best = new Map(bm25Hits.map((h) => [h.id, h.score]))
      for (const hit of thinkingHits) {
        best.set(hit.id, Math.max(best.get(hit.id) ?? 0, hit.score))
      }
      bm25Hits = [...best.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score)
    }
    // 单路及格线:绝对线;相对线开启时取较严者(§5.1);冷启动收紧期异地 ×2(§2)
    let bm25Line = cfg.bm25.minScore
    if (bm25Hits.length > 0 && cfg.bm25.minScoreTopRatio > 0) {
      bm25Line = Math.max(bm25Line, bm25Hits[0].score * cfg.bm25.minScoreTopRatio)
    }
    bm25Hits = bm25Hits.filter((h) => {
      const item = corpus.get(h.id)
      if (item === undefined || !eligible(item, ctxOpts)) return false
      return h.score >= (remoteTighten(item.record) ? bm25Line * 2 : bm25Line)
    }).slice(0, laneLimit)

    // 向量路(配置后开启;超时/失败/指纹不符 → 该路缺席;库中向量维度不符 → 跳过并自愈)
    let vectorHits = []
    const cosOf = new Map()
    let vectorRan = false
    if ((await embedder.available()) && query.trim() !== '') {
      const queryVec = await embedder.embedQuery(query)
      if (Array.isArray(queryVec) && queryVec.length > 0) {
        vectorRan = true
        const queryDim = queryVec.length
        let dimMismatch = 0
        for (const item of corpus.values()) {
          if (!eligible(item, ctxOpts)) continue
          const { record } = item
          if (record.embeddingModel !== embedder.model || !Array.isArray(record.chunks)) continue
          let best = 0
          let bestChunk
          for (const chunk of record.chunks) {
            // 维度防呆:绝不让"旧模型维度"的向量参与打分——cosine() 对不等长会静默返回 0,
            // 表现只是"这条记忆用向量永远搜不到",所以必须显式跳过并记账(不是找错维度硬算)。
            if (!Array.isArray(chunk?.embedding) || chunk.embedding.length !== queryDim) {
              dimMismatch += 1
              continue
            }
            const score = cosine(queryVec, chunk.embedding)
            if (score > best) {
              best = score
              bestChunk = chunk.text
            }
          }
          cosOf.set(record.id, best)
          const vNeed = remoteTighten(record) ? cfg.vectorMinScore * 2 : cfg.vectorMinScore
          if (best >= vNeed) {
            vectorHits.push({ id: record.id, score: best, hitChunkText: bestChunk })
          }
        }
        if (dimMismatch > 0) reportDimMismatch(dimMismatch)
        vectorHits.sort((a, b) => b.score - a.score)
        vectorHits = vectorHits.slice(0, laneLimit)
      }
    }

    // 闸门施加点:**用两路的原始分**判定,通过者才进融合(口径与 tools/gate-sweep.mjs 一致)。
    // 混合路判据:两路都过**共识线** → 放行;只有一路命中 → 该路必须过**单路线**。
    // 纯 BM25 判据(v1.13):向量路没跑起来时没有第二路可印证,只能按关键词路的**绝对分**
    //   `bm25OnlyMin` 准入——这是"没有 embedding 的用户也要能拒掉无关查询"的兜底。
    // 读代码时别猜错这两点:
    //   ① BM25 侧取的是**未施加单路及格线之前**的原始分(minScore / 相对线都还没过滤),
    //      所以"过共识线"不蕴含"已过单路及格线"——被及格线切掉的条目若在向量路命中,仍可能靠共识线放行。
    //      这是有意的:共识线是"两路都在场"的低门槛互相印证,强信号由单路线负责。
    //   ② 两路各自都要先过 eligible()(硬过滤),被排除的条目根本进不了候选。
    if (gateWanted && vectorRan) {
      const allow = (bm25Raw, cos) => (
        (bm25Raw >= gate.consensusBm25 && cos >= gate.consensusCos)
        || cos >= gate.soloCos
        || bm25Raw >= gate.soloBm25
      )
      bm25Hits = bm25Hits.filter((h) => allow(h.score, cosOf.get(h.id) ?? 0))
      vectorHits = vectorHits.filter((h) => allow(bm25RawOf.get(h.id) ?? 0, h.score))
    } else if (gateWanted) {
      // 纯 BM25:单路绝对分门槛(与混合路的 soloBm25 分开,那档是给"有点向量信号"的场景定的)。
      // 池子太小不启用:绝对分随语料规模漂移,几十条以内误杀风险大过噪声风险(§5.6 同一条漂移纪律)。
      if (corpus.size >= (gate.bm25OnlyMinPoolSize ?? 0)) {
        const line = gate.bm25OnlyMin ?? 0
        bm25Hits = bm25Hits.filter((h) => h.score >= line)
      }
    }

    // RRF 融合 → 系数排序
    const fused = rrfFuse([bm25Hits, vectorHits], cfg.rrfK)
    const chunkOf = new Map(vectorHits.map((h) => [h.id, h.hitChunkText]))
    const out = []
    for (const [id, relevance] of fused) {
      const item = corpus.get(id)
      if (item === undefined || !eligible(item, ctxOpts)) continue
      const rankable = item.ref === 'hot' ? hotAsRankable(item.record) : item.record
      const { score, parts } = computeFinalScore({
        relevance,
        record: rankable,
        nowMs,
        cfg: rankCfgHere,
        currentWorkspaceId: ownerView ? rankable.workspaceId : current.workspaceId,
        entityHit: ownerView ? false : entityHitOf(rankable),
      })
      out.push({
        id,
        ref: item.ref,
        record: item.record,
        score,
        relevance,
        parts,
        hitChunkText: chunkOf.get(id),
      })
    }
    out.sort((a, b) => b.score - a.score)
    const hits = out.slice(0, limit)
    if (diagnostics) {
      // 诊断额外带上两路原始分与闸门参数(v1.15 召回试验台用):
      // 命中行只有融合后的 score,而"为什么被放行/被拦"要看闸门判据的两个原始值。
      return {
        hits,
        bm25Ids: bm25Hits.map((h) => h.id),
        vectorIds: vectorHits.map((h) => h.id),
        bm25Raw: Object.fromEntries([...bm25RawOf.entries()].map(([id, value]) => [id, round4(value)])),
        cos: Object.fromEntries([...cosOf.entries()].map(([id, value]) => [id, round4(value)])),
        vectorRan,
        coldStart,
        poolSize: corpus.size,
        gate: gateWanted ? { ...gate } : null,
      }
    }
    return hits
  }

  /**
   * 检索入口:自身抛错 → 返回 **null**(不是空数组)。
   * 区分"没想起事"(空数组,照常继续)与"检索坏了"(null,调用方渲染
   * "记忆检索暂时不可用"——§4.2 诚实提示,不伪装)。此前只有 JSDoc 这么写,
   * 实现里没有 try/catch,于是 inject/tools 两侧的判空分支是死代码、真实失败被静默吞掉。
   */
  async function search(opts) {
    try {
      return await searchInner(opts)
    } catch (error) {
      logger?.info?.(`memory: 检索失败(诚实降级为 null): ${error?.message ?? error}`)
      return null
    }
  }

  /** 评估用:返回最终 hits 与两路候选集(只读诊断,不改变线上检索路径)。 */
  async function diagnose(opts) {
    try {
      return await searchInner({ ...opts, diagnostics: true })
    } catch (error) {
      logger?.info?.(`memory: 检索诊断失败(降级为 null): ${error?.message ?? error}`)
      return null
    }
  }

  /** filter-only recall(纯 time/session):按 eligible 枚举语料,按时间/重要度排序。 */
  async function list({ current = { workspaceId: '', sessionId: '' }, timeWindow = null, sessionFilter = undefined, includeArchived = false, limit = cfg.injectMaxItems } = {}) {
    try {
      const out = []
      for (const [id, item] of corpus.entries()) {
        if (!eligible(item, { current, purpose: 'recall', timeWindow, sessionFilter, includeArchived })) continue
        out.push({ id, ref: item.ref, record: item.record, score: 0, relevance: 0, parts: {} })
      }
      out.sort((a, b) => {
        const at = Date.parse(a.record.eventTime ?? a.record.createdAt)
        const bt = Date.parse(b.record.eventTime ?? b.record.createdAt)
        return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at)
          || (b.record.importance ?? 0) - (a.record.importance ?? 0)
      })
      return out.slice(0, limit)
    } catch (error) {
      logger?.info?.(`memory: filter-only 检索失败(诚实降级为 null): ${error?.message ?? error}`)
      return null
    }
  }

  /** 渲染用片段(§4.2):分段命中段直出;未分段长条目仍裁到 excerptChars。 */
  function excerptFor(hit, queryTokens) {
    // 只有真正被滑动窗切成多段的长文本,命中段才是“段级片段”;
    // 单 chunk(≤chunkPlainMaxChars)的 hitChunkText 其实就是全文,不能拿它绕过 excerptChars。
    if (typeof hit.hitChunkText === 'string'
      && Array.isArray(hit.record?.chunks)
      && hit.record.chunks.length > 1) {
      return hit.hitChunkText
    }
    const text = hit.record.content
    if (text.length <= cfg.excerptChars) return text
    return makeExcerpt(text, queryTokens, cfg.excerptChars)
  }

  /**
   * 常驻 lesson 选择器(§4.2 常驻区块):候选 = 本地 kind=lesson 且 temporal=pattern 优先,
   * entity='user' 的异地 lesson 补位(落实"用户偏好天然跨项目");按 证据系数 × importance
   * 降序取 limit,同分取最近。只读;硬过滤与惰性归档口径同注入路径。
   */
  function residentLessons({ current, nowMs, rankCfg, limit }) {
    if (limit <= 0) return []
    const local = []
    const userLevel = []
    for (const item of corpus.values()) {
      const { ref, record } = item
      if (ref !== 'mem') continue
      if (record.kind !== 'lesson' || record.temporal !== 'pattern') continue
      if (record.entity === 'soul') continue // SOUL 提议走记忆页采纳通道(§9-17):审阅前不进常驻曝光
      if (record.supersededBy !== undefined) continue // 已取代的旧约定不得再当“一直在场”
      if (typeof record.validUntil === 'string' && record.todo !== true && nowMs > Date.parse(record.validUntil)) continue
      if (!eligible(item, { current, purpose: 'inject', timeWindow: undefined, sessionFilter: undefined, includeArchived: false })) continue
      const clearPatch = reconcileArchiveState(record, nowMs, rankCfg)
      const live = clearPatch === null ? record : { ...record, ...clearPatch }
      if (shouldArchive(live, nowMs, rankCfg) !== null) continue
      const entry = { record, weight: evidenceCoefficient(live, nowMs, rankCfg) * record.importance }
      if (sameKnownWorkspace(record, current)) local.push(entry)
      else if (record.entity === 'user') userLevel.push(entry)
    }
    const byWeightDesc = (a, b) => b.weight - a.weight
      || Date.parse(b.record.eventTime ?? b.record.createdAt) - Date.parse(a.record.eventTime ?? a.record.createdAt)
    local.sort(byWeightDesc)
    userLevel.sort(byWeightDesc)
    return [...local, ...userLevel].slice(0, limit).map((x) => x.record)
  }

  /**
   * 开场动态选择器(§4.2 openingDigest):零有效命中时的"主动记挂"。只选本地条目(与冷启动
   * 解耦);近 days 天 state/episode,eventTime 近者优先、同近比 importance;已过 validUntil
   * 的非 todo 不入选(进"过去的事"区);本地条目 <3 条不启用。只读。
   */
  function openingDigest({ current, nowMs, days, limit }) {
    const fromMs = nowMs - days * DAY_MS
    let localActive = 0
    const items = []
    for (const item of corpus.values()) {
      const { ref, record } = item
      if (ref !== 'mem') continue
      // 本地动态只看已知同域;'(unknown)' 不是可共享的真实域(A1)。
      if (!sameKnownWorkspace(record, current)) continue
      if (!eligible(item, { current, purpose: 'inject', timeWindow: undefined, sessionFilter: undefined, includeArchived: false })) continue
      if (record.status !== 'active' && record.status !== 'staged') continue
      localActive += 1
      if (record.temporal !== 'state' && record.temporal !== 'episode') continue
      if (record.supersededBy !== undefined) continue
      const clearPatch = reconcileArchiveState(record, nowMs, rankCfg)
      const live = clearPatch === null ? record : { ...record, ...clearPatch }
      if (shouldArchive(live, nowMs, rankCfg) !== null) continue
      const t = Date.parse(record.eventTime ?? record.createdAt)
      if (Number.isNaN(t) || t < fromMs) continue
      if (typeof record.validUntil === 'string' && record.todo !== true && nowMs > Date.parse(record.validUntil)) continue
      // 过期 state / 超过“过去的事”窗口的 episode 不再当作“近期动态”。
      if (record.temporal === 'state' && typeof record.expiresAt === 'string' && nowMs > Date.parse(record.expiresAt)) continue
      const ageDays = (nowMs - t) / DAY_MS
      if (record.temporal === 'state' && ageDays > cfg.pastStateDays) continue
      if (record.temporal === 'episode' && ageDays > cfg.pastEpisodeDays) continue
      items.push(record)
    }
    if (localActive < 3) return []
    items.sort((a, b) => Date.parse(b.eventTime ?? b.createdAt) - Date.parse(a.eventTime ?? a.createdAt)
      || b.importance - a.importance)
    return items.slice(0, limit)
  }

  return {
    upsertMemory,
    removeMemory,
    upsertHot,
    removeHot,
    rebuild,
    search,
    diagnose,
    list,
    canAccess,
    excerptFor,
    residentLessons,
    openingDigest,
    markShadowed,
    get: (id) => corpus.get(id),
    has: (id) => corpus.has(id),
    get size() {
      return corpus.size
    },
  }
}
