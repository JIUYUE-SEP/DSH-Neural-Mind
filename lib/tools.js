/**
 * 拉通道三工具(§4.3):memory_recall / memory_remember / memory_forget。
 * 原始 JSON-Schema 注册(不经 defineTool),入参自行校验;返回值是 canonical JSON,
 * output.render 映射成模型可读文本。工具内失败一律给模型可行动的报错文案。
 */
import { applyReinforce, computeExpiresAt, freshReinforceTs, renewStateExpiry } from './rank.js'
import { findDuplicate, withMemoryWrite } from './dedupe.js'
import { detectInjection, detectSecret, looksImperative, makeExcerpt, normalizeEntity, tokenize } from './text.js'
import { sourceTier, userQuoteMatches } from './provenance.js'
import { eventsToTurnParts, mergeToolCalls } from './turns.js'
import { bestEffort, embedAfterWrite, fireAndForget, newId, nowIso, parseTimeWindow, truncateChars } from './util.js'
import { createMemoryOps } from './ops.js'
import { isWorkspaceDisabled } from './workspace.js'

/** recall 列表单条的渲染预算(渲染取舍,非部署旋钮)。 */
const RECALL_ITEM_CHARS = 1200
const ID_RE = /^(m|hb)_[0-9a-f-]{36}$/

/** R13a:recall 显式 limit 的默认/上限;forget 同 entity 关联条目的回显上限。 */
const RECALL_LIMIT_DEFAULT = 10
const RECALL_LIMIT_MAX = 20
const FORGET_RELATED_MAX = 10

/** R13b:来源档位的可读标签(工具回显口径;界面标签见 lib/client/i18n/memories.js)。 */
const SOURCE_LABEL = {
  user: '用户说的',
  assistant: '助手记下的',
  confirmed: '你确认过',
  unknown: '来源查不清',
  code: '代码里看到的',
  tool: '工具查到的',
  quote: '用户转贴的资料',
}

/** R13b:来源档位 → 标签;confirmedByUser 优先于 source(界面确认是工具之外的可信信号)。 */
function sourceLabelOf(record) {
  return SOURCE_LABEL[sourceTier(record)] ?? SOURCE_LABEL.assistant
}

const JSON_OBJECT = { type: 'object' }

function textOutput(args, value) {
  return [{ type: 'text', text: typeof value?.text === 'string' ? value.text : JSON.stringify(value) }]
}

export function registerTools({ ctx, cfg, rankCfg, search, store, hotbuffer, workspace, audit, embedder, logger, soul, turns, usage, ops: providedOps }) {
  // tools 是宿主注册表;一次性探测落空会静默丢掉全部记忆工具 → 晚到时用 ctx.inject 补注册
  const tools = ctx.get('tools')
  // R1a:写操作/来源展开与控制台共用 lib/ops.js;测试或单独装配时允许缺省,从这里补一个。
  const ops = providedOps ?? createMemoryOps({ ctx, cfg, rankCfg, store, search, hotbuffer, audit, turns, workspace, logger })

  // 工作区停用(v1.14):该工作区完全不介入。工具给模型可行动的说明,不静默成功。
  const disabledText = '该工作区已停用记忆插件(主侧栏「记忆」→ 配置 → 工作区):本次不做记忆读写。如需使用,请在配置里启用该工作区。'
  const isDisabledHere = (ws) => isWorkspaceDisabled(ws.id, cfg.disabledWorkspaces)

  // ── memory_recall ─────────────────────────────────────────────────────────

  async function resolveCurrent(exec) {
    const session = exec?.agent?.session
    const sessionId = session !== undefined ? String(session.id) : ''
    const ws = await workspace.resolve(session?.header?.cwd)
    return { current: { workspaceId: ws.id, sessionId }, ws, session }
  }

  // hard-forget 的隐藏面 / 来源展开由 lib/ops.js 统一实现(控制台与工具共用,§4.3 v1.26):
  // 工具侧只是多一道"同工作区才展开"的跨域闸门(见 expandOriginal 的 current 参数)。
  // trajectory 过滤仍需要这两行谓词。
  const seqHidden = (seq, ranges) => ranges.some(([from, to]) => seq >= from && seq <= to)
  const textHidden = (text, needles) => needles.some((needle) => text.includes(needle))

  /** trajectory 回放(§4.3):按会话日志行动链复盘(turn 边界 × 工具调用);回放日志不计条目召回续期。 */
  async function trajectoryExecute(args, exec) {
    const sessionQuery = ctx.get('sessionQuery')
    if (sessionQuery === undefined) return { text: '会话日志管道缺席(sessionQuery 不可用),无法回放。' }
    const sessionId = typeof args?.session === 'string' && args.session.trim() !== ''
      ? args.session.trim()
      : String(exec?.agent?.session?.id ?? '')
    if (sessionId === '') return { text: '请用 session 参数指定要回放的会话。' }
    let snapshot
    try {
      snapshot = await sessionQuery.readSession(sessionId)
    } catch {
      // 会话已删/读盘失败:如实告知"不可考",不伪装成空会话(与 §4.3 展开失败的降级同款)
      return { text: `会话 ${sessionId} 的日志已不可考。` }
    }
    // 跨域纪律(2026-09-19 用户裁决):trajectory 只回放当前会话或同 workspace 的会话——
    // 回放原文不走 eligible 过滤,这是唯一不把会话内容跨域搬运的闸门
    const currentSid = String(exec?.agent?.session?.id ?? '')
    if (sessionId !== currentSid) {
      // §8 v2.0 接缝:0.1.6 的 readSession 返回 `{ header, events }`,0.2.0 返回
      // `{ session, inheritedEventCount, events }`(header 改挂在 `session` 下)。
      // 两个键都认,免得跨版本各半句。
      const targetCwd = snapshot?.session?.cwd ?? snapshot?.header?.cwd
      const currentCwd = exec?.agent?.session?.header?.cwd
      if (typeof targetCwd !== 'string' || typeof currentCwd !== 'string') {
        return { text: `无法确认会话 ${sessionId} 与当前会话同工作区,trajectory 不回放它。可回到该会话里再回放。` }
      }
      const [wsT, wsC] = await Promise.all([workspace.resolve(targetCwd), workspace.resolve(currentCwd)])
      if (wsT.id !== wsC.id) {
        return { text: `会话 ${sessionId} 不在当前工作区,trajectory 只回放当前或同工作区的会话。` }
      }
    }
    const hidden = ops.hiddenInfoFor(sessionId)
    const turns = []
    let current = null
    for (const event of snapshot.events ?? []) {
      if (seqHidden(event.seq, hidden.ranges)) continue
      if (event.type === 'turn/start') {
        current = { turn: event.data?.turn ?? turns.length + 1, user: [], assistant: [], toolCalls: new Map() }
        turns.push(current)
        continue
      }
      if (current === null) continue
      const parts = eventsToTurnParts([event])
      current.user.push(...parts.userTexts)
      current.assistant.push(...parts.assistantTexts)
      mergeToolCalls(current.toolCalls, parts.toolCalls)
    }
    const visibleTurns = turns.filter((t) => {
      const text = [...t.user, ...t.assistant, ...[...t.toolCalls.values()].map((c) => c.output ?? '')].join('\n')
      if (textHidden(text, hidden.needles)) return false
      return t.user.length > 0 || t.assistant.length > 0 || t.toolCalls.size > 0
    })
    if (visibleTurns.length === 0) return { text: `会话 ${sessionId} 没有可回放的回合(可能已 hard forget)。` }
    const lines = [`会话行动链(共 ${visibleTurns.length} 轮;旧内容,以当前为准):`]
    for (const t of visibleTurns) {
      const q = truncateChars(t.user.join(' '), 80)
      const calls = [...t.toolCalls.values()]
      const names = [...new Set(calls.map((c) => c.name))].join(' / ')
      const failed = calls.filter((c) => c.isError === true).length
      const a = truncateChars(t.assistant.join(' '), 120)
      lines.push(`第 ${t.turn} 轮:${q === '' ? '(无用户文本)' : ` ${q}`}`)
      if (names !== '') lines.push(`  调用: ${names}${failed > 0 ? `(${failed} 个失败)` : ''}`)
      if (a !== '') lines.push(`  回复: ${a}`)
    }
    return { text: truncateChars(lines.join('\n'), cfg.recallFullMaxChars) }
  }

  async function recallExecute(args, exec) {
    usage?.recordCounters({ 'recall.calls': 1 })
    const sessionWs = await workspace.resolve(exec?.agent?.session?.header?.cwd)
    if (isDisabledHere(sessionWs)) return { text: disabledText }
    const mode = typeof args?.mode === 'string' ? args.mode : 'default'
    if (mode === 'trajectory') return trajectoryExecute(args, exec)
    const { current } = await resolveCurrent(exec)
    const query = typeof args?.query === 'string' ? args.query.trim() : ''
    const timeWindow = parseTimeWindow(args?.time)
    if (typeof args?.time === 'string' && args.time.trim() !== '' && timeWindow === null) {
      return { text: `时间参数无法解析:「${args.time}」。支持 "2026-09-01"、"2026-09-01..2026-09-10"、"7d"、"24h"。` }
    }
    const sessionFilter = typeof args?.session === 'string' && args.session !== '' ? args.session : undefined
    const queryTokens = tokenize(query)

    // 按 id 整条展开(§4.3;上限 recallFullMaxChars,不限代码块)
    if (ID_RE.test(query)) {
      const found = search.get(query) ?? undefined
      const record = found?.record ?? store.memories.get(query) ?? store.hotbuffer.get(query)
      if (record === undefined) return { text: `没有找到 id 为 ${query} 的记忆。` }
      // 硬屏蔽 = 全域不可见(§4.2):**id 直达也必须守**。上面两条取值路径都不过 eligible()
      // ——`search.get` 是裸语料查询,`store.*.get` 是原表——漏了这一步,`memory_forget({hard:true})`
      // 之后用 id 问一句就能把正文整条拉回来(DESIGN §4.2 写死的合同就破了)。
      if (record.hidden === true) {
        await audit.write('recall-hidden-blocked', `id=${record.id}`, record.sessionId)
        return { text: `该记忆已被硬屏蔽(hidden),不可访问:${record.id}。` }
      }
      const ref = found?.ref ?? (String(query).startsWith('hb_') ? 'hot' : 'mem')
      if (!search.canAccess(record, ref, { current, includeArchived: true })) {
        await audit.write('recall-out-of-scope', `id=${record.id}`, record.sessionId)
        return { text: `没有找到 id 为 ${query} 的记忆。` }
      }
      const archived = record.status === 'archived'
      usage?.recordCounters({ 'recall.expanded': 1 })
      const full = truncateChars(record.content, cfg.recallFullMaxChars)
      const parts = [`[${record.id}] ${archived ? '(已归档) ' : ''}${full}`, '旧内容,以当前为准。']
      if (typeof record.thinking === 'string' && record.thinking !== '') {
        parts.push(`思考(仅 recall 可查):\n${truncateChars(record.thinking, cfg.recallFullMaxChars)}`)
      }
      const original = await ops.expandOriginal(
        record.sessionId,
        record.sourceRange ?? { startSeq: record.startSeq, endSeq: record.endSeq },
        { queryTokens, current },
      )
      if (original !== undefined) parts.push(`原文:\n${original}`)
      else if (record.sourceRange !== undefined || record.startSeq !== undefined) {
        // 展开失败:管道缺席不是记忆的错——记审计、不记 challenge(§4.3)
        await audit.write('recall-expand-failed', `id=${record.id} session=${record.sessionId}`, record.sessionId)
        parts.push('(原文已不可考)')
      }
      await countRecall([record])
      return { text: parts.join('\n\n') }
    }

    if (query === '' && timeWindow === null && sessionFilter === undefined) {
      return { text: '请提供 query、time 或 session 至少一个条件。' }
    }
    // R13a:limit 显式可见(1–20,默认 10),多取 1 条判断"后面还有没有"——
    // 旧实现按 injectMaxItems*2 静默截断,模型不知道还有更多,也不会去收窄条件。
    const limit = Number.isInteger(args?.limit)
      ? Math.min(RECALL_LIMIT_MAX, Math.max(1, args.limit))
      : RECALL_LIMIT_DEFAULT
    const fetchLimit = limit + 1
    const hits = query === ''
      ? await search.list({ current, timeWindow, sessionFilter, includeArchived: true, limit: fetchLimit })
      : await search.search({
        query,
        purpose: 'recall',
        current,
        timeWindow,
        sessionFilter,
        includeArchived: true,
        limit: fetchLimit,
      })
    if (hits === null) return { text: '记忆检索暂时不可用。' }
    if (hits.length === 0) return { text: '没有匹配的记忆。' }
    const hasMore = hits.length > limit
    const shown = hasMore ? hits.slice(0, limit) : hits

    const lines = []
    for (const hit of shown) {
      const r = hit.record
      const archived = r.status === 'archived' ? '(已归档) ' : ''
      const staged = r.status === 'staged' ? '(待确认) ' : ''
      const label = r.workspaceLabel ?? r.workspaceId
      const content = r.content.length <= RECALL_ITEM_CHARS
        ? r.content
        : makeExcerpt(r.content, queryTokens, RECALL_ITEM_CHARS)
      lines.push(`[${r.id}] ${archived}${staged}(${r.kind ?? 'hot'}/${sourceLabelOf(r)} · ${label} · ${(r.eventTime ?? r.createdAt).slice(0, 10)})\n${content}`)
      // 命中 Archive 引用 → 按 sourceRange 展开查询相关片段(§4.3)
      if (r.sourceRange !== undefined && query !== '') {
        const original = await ops.expandOriginal(r.sessionId, r.sourceRange, { queryTokens, current })
        if (original !== undefined) {
          lines.push(`  原文片段: ${makeExcerpt(original, queryTokens, Math.min(2000, cfg.recallFullMaxChars))}`)
        }
      }
    }
    await countRecall(shown.map((h) => h.record))
    const text = lines.join('\n\n')
    return {
      text: hasMore
        ? `${text}\n\n(共显示前 ${shown.length} 条,还有更多;可用 time / session / 更具体的 query 收窄,或调大 limit)`
        : text,
    }
  }

  /** 召回即续期(§6):recall 命中(默认/展开模式)计召回;state 类续期 expiresAt。 */
  async function countRecall(records) {
    for (const record of records) {
      if (record.temporal !== 'state' || record.status === 'archived') continue
      fireAndForget(
        store.memories.update(record.id, (cur) => ({ ...cur, expiresAt: renewStateExpiry(cur, nowIso(), rankCfg) }))
          .then((u) => u !== undefined && search.upsertMemory(u)),
        logger,
        'memory: recall 续期',
      )
    }
  }

  // ── memory_remember ───────────────────────────────────────────────────────

  /**
   * R13b(0.6.6):校验模型给的"用户原话引用"是否真的出现在本会话的用户消息里。
   * 规范化(NFKC + 空白折叠)后做子串比对;管道缺席 / 读盘失败 / 引用太短 = 不通过
   * ——不通过一律按"助手说的"记,不猜(模型可以挑一句真实原话,但造不出来)。
   */
  async function verifyUserQuote(quote, sessionId) {
    if (typeof quote !== 'string' || quote.trim() === '') return false
    const sessionQuery = ctx.get('sessionQuery')
    if (sessionQuery === undefined) return false
    try {
      const snapshot = await sessionQuery.readSession(sessionId)
      const userTexts = eventsToTurnParts(snapshot?.events ?? []).userTexts
      return userQuoteMatches(quote, userTexts)
    } catch {
      return false // 读盘失败 = 验证不了:保守记"助手说的"
    }
  }

  async function rememberExecute(args, exec) {
    const content = typeof args?.content === 'string' ? args.content.trim() : ''
    if (content === '') return { text: 'content 不能为空。' }
    const session = exec.agent?.session
    const sessionId = session !== undefined ? String(session.id) : '(unknown)'
    const sessionWs = await workspace.resolve(session?.header?.cwd)
    if (isDisabledHere(sessionWs)) return { text: disabledText }
    const confirm = args?.confirm === true
    // stagedBy 通道字段(§3.3):confirm=true = user-explicit;其余 = model-auto
    const stagedBy = confirm ? 'user' : 'model'
    // R13b:来源不听模型自报——只有 userQuote 经本会话用户消息核对通过才记"用户说的"。
    // 这段核对发生在写库前,且与 confirm 无关(confirm 是模型可填参数,不能当证据)。
    const quoteVerified = await verifyUserQuote(args?.userQuote, sessionId)

    const secretHit = detectSecret(content)
    if (secretHit !== null) {
      await audit.write('secret-refused', `remember 密钥形态(${secretHit})拒绝落盘`, sessionId)
      return { text: '这段内容像密钥/令牌,按隐私纪律不落盘。如需记录,请改写为不含秘密值的描述。' }
    }
    let suspect = false
    if (cfg.injectionGuard.enabled) {
      const hit = detectInjection(content, cfg.injectionGuard.extraPatterns)
      if (hit !== null || looksImperative(content)) {
        if (stagedBy === 'model') {
          // model-auto 严检:拒收 + 审计(§3.3)
          await audit.write('injection-rejected', `remember(model-auto)命中 ${hit ?? 'imperative'}: ${truncateChars(content, 120)}`, sessionId)
          return { text: '该内容命中注入防御特征,未落盘(已记审计,可由用户确认后改用 confirm=true 重试)。' }
        }
        suspect = true // user-explicit 永不硬拦,仅挂软标记(§3.3)
      }
    }

    const ws = await workspace.resolve(session?.header?.cwd)
    const kind = ['fact', 'lesson', 'episode'].includes(args?.kind) ? args.kind : 'fact'
    // 用户明确要记的东西不该拿到最短生命周期(§3.3):默认 pattern
    const temporal = ['pattern', 'state', 'episode'].includes(args?.temporal) ? args.temporal : 'pattern'
    const entity = normalizeEntity(args?.entity)
    const candidate = { content, workspaceId: ws.id, entity, kind, temporal, sessionId }

    const outcome = await withMemoryWrite(async () => {
      const existing = findDuplicate(store, candidate)
      if (existing !== undefined) {
        await audit.write('dedupe-hit', `${existing.id}: ${existing.status}${existing.hidden === true ? '/hidden' : ''}`, sessionId)
        if (existing.hidden === true) {
          return { text: `已存在同一内容,但处于屏蔽状态(${existing.id});未恢复、未覆盖。` }
        }
        if (existing.status === 'archived') {
          return { text: `已存在同一内容,但已归档(${existing.id});未自动恢复。` }
        }
        if (existing.status === 'staged' && confirm) {
          const updated = await store.memories.update(existing.id, (cur) => ({
            ...cur,
            status: 'active',
            stagedBy: 'user',
            confidence: Math.max(cur.confidence ?? 0, 0.9),
            // R13b:用户权重只给"原话核对通过"的确认;confirm 本身是模型可填参数,只能记系统权重。
            evidence: [...(cur.evidence ?? []), {
              ts: nowIso(),
              weight: quoteVerified ? rankCfg.evidenceWeights.user : rankCfg.evidenceWeights.system,
              kind: 'reinforce',
            }].slice(-rankCfg.evidenceMaxEntries),
          }))
          if (updated !== undefined) search.upsertMemory(updated)
          return { text: `已确认既有暂存记忆(${existing.id}),未重复写入。` }
        }
        if (existing.status === 'active') {
          // R14(0.6.6):再次要求记住同一内容 = 一次印证,不再只是"跳过"。记**系统权重**
          // 而非用户权重:这个工具能被模型反复调用;用户权重(1)只给界面确认(R1c)与
          // userQuote 核对通过的 remember(R13b),否则一个爱重复的模型可以自己刷分。
          const reinforced = await store.memories.update(existing.id,
            (cur) => applyReinforce(cur, freshReinforceTs(cur), Date.now(), rankCfg))
          if (reinforced !== undefined) search.upsertMemory(reinforced)
          const count = (reinforced?.evidence ?? existing.evidence ?? []).filter((ev) => ev.kind === 'reinforce').length
          return { text: `已印证(第 ${count} 次,未重复写入;${existing.id})` }
        }
        return { text: `已存在同一记忆(${existing.id}),未重复写入。` }
      }

      const record = {
        id: newId('m'),
        content,
        kind,
        // R13b:user 只给"用户原话核对通过"的那一次;其余(含 confirm=true)都是助手记下的。
        source: quoteVerified ? 'user' : 'assistant',
        stagedBy,
        ...(entity === '' ? {} : { entity }),
        importance: 6,
        confidence: confirm ? 0.9 : 0.7,
        temporal,
        eventTime: nowIso(),
        workspaceId: ws.id,
        workspaceLabel: ws.label,
        sessionId,
        evidence: confirm
          // 用户显式证据权重只给"原话核对通过"的确认;confirm 是模型可填参数 → 系统权重(§5.3,§3.3)
          ? [{ ts: nowIso(), weight: quoteVerified ? rankCfg.evidenceWeights.user : rankCfg.evidenceWeights.system, kind: 'reinforce' }]
          : [], // staged 证据恒从 0 起步(§3.3)
        status: confirm ? 'active' : 'staged', // confirm 当场转正(MVP 最小转正口)
        createdAt: nowIso(),
        ...(suspect ? { suspect: true } : {}),
      }
      const expiresAt = computeExpiresAt({ temporal, content, validUntil: undefined, nowIso: record.createdAt }, rankCfg)
      if (expiresAt !== undefined) record.expiresAt = expiresAt // confirm 转正后继承 TTL(§3.3)

      await store.memories.put(record.id, record)
      search.upsertMemory(record)
      return { record }
    })

    if (outcome.record !== undefined) {
      await embedAfterWrite({ embedder, store, search, logger, skip: ws.isPrivate === true }, outcome.record, content, 'memory: remember embed')
      return {
        text: confirm
          ? `已记住(${outcome.record.id})${suspect ? ',内容命中注入特征,已挂"可疑待确认"标记' : ''}。`
          : `已写入暂存区(${outcome.record.id}),渲染带"待确认"措辞;印证或确认后转正。`,
      }
    }
    return { text: outcome.text }
  }

  // ── memory_forget ─────────────────────────────────────────────────────────

  async function forgetExecute(args, exec) {
    const { current, ws: sessionWs } = await resolveCurrent(exec)
    if (isDisabledHere(sessionWs)) return { text: disabledText }
    const hard = args?.hard === true
    const id = typeof args?.id === 'string' ? args.id.trim() : ''
    const query = typeof args?.query === 'string' ? args.query.trim() : ''

    if (id !== '') {
      const memory = store.memories.get(id)
      if (memory !== undefined) {
        if (memory.hidden === true) return { text: `该记忆已被屏蔽(hidden):${id}。` }
        if (!search.canAccess(memory, 'mem', { current, includeArchived: true })) {
          await audit.write('forget-out-of-scope', `id=${id}`, memory.sessionId)
          return { text: `没有找到 id 为 ${id} 的记忆。` }
        }
        if (hard) {
          // R1a:hard 的真实处理(级联 L0 / 终止 outbox / 审计打码)与控制台「彻底隐藏」共用一套实现
          const result = await ops.hardForget(id)
          if (result.ok !== true) return { text: `屏蔽 ${id} 失败:${result.error}。` }
          return { text: `已屏蔽(hidden,级联热缓冲副本): ${truncateChars(memory.content, 120)}` }
        }
        // 直接置 archived,立即退出注入(§4.3;不物理删除,可审计)
        const updated = await bestEffort(store.memories.update(id, (cur) => ({ ...cur, status: 'archived' })))
        if (updated === undefined) return { text: `记忆 ${id} 更新失败。` }
        search.upsertMemory(updated)
        await audit.write('forget', `${id}: ${truncateChars(memory.content, 120)}`, memory.sessionId)
        return { text: `已归档(archived): ${truncateChars(memory.content, 120)}` }
      }
      const hot = store.hotbuffer.get(id)
      if (hot !== undefined) {
        if (hot.hidden === true) return { text: `该热缓冲条目已被屏蔽(hidden):${id}。` }
        if (!search.canAccess(hot, 'hot', { current, includeArchived: true })) {
          await audit.write('forget-out-of-scope', `id=${id}`, hot.sessionId)
          return { text: `没有找到 id 为 ${id} 的记忆。` }
        }
        if (hard) {
          const result = await ops.hardForget(id)
          if (result.ok !== true) return { text: `屏蔽热缓冲条目 ${id} 失败:${result.error}。` }
          return { text: `已屏蔽热缓冲条目 ${id}。` }
        }
        // L0 条目没有 archived 态(§4.3):hidden 是它唯一能"立即退出一切通道"的状态,
        // 所以软 forget 也走 hidden;但审计必须如实——记成 forget-hard 会让"谁被彻底屏蔽过"
        // 这件事失真,打码也只该发生在 hard(2026-09-17 一致性复核修正)。
        await bestEffort(store.hotbuffer.update(id, (cur) => ({ ...cur, hidden: true })))
        search.removeHot(id)
        await audit.write('forget', `热缓冲 ${id}(L0 无 archived 态,直接 hidden): ${truncateChars(hot.content, 120)}`, hot.sessionId)
        return { text: `已屏蔽热缓冲条目 ${id}(L0 无归档态,按屏蔽处理)。` }
      }
      return { text: `没有找到 id 为 ${id} 的记忆。` }
    }

    if (query === '') return { text: '请提供 id 或 query。' }
    // query 模式:先回显内容、列出同 entity 相关记忆供批量确认,确认后以 id 执行(§4.3)
    const found = await search.search({ query, purpose: 'recall', current, includeArchived: false, limit: 5 })
    if (found === null) return { text: '记忆检索暂时不可用。' }
    if (found.length === 0) return { text: '没有匹配的记忆。' }
    const related = new Map()
    for (const hit of found) {
      const entity = hit.record.entity
      if (entity === undefined) continue
      for (const [mid, m] of store.memories.entries()) {
        if (m.entity !== entity || m.id === hit.id || m.status === 'archived') continue
        if (!search.canAccess(m, 'mem', { current, includeArchived: false })) continue
        related.set(mid, m)
      }
    }
    const lines = found.map((h) => `[${h.id}] ${truncateChars(h.record.content, 120)}`)
    // R13a:关联条目回显上限——记忆库越大,一次 forget 的回显越不能无限涨(总数照给)
    if (related.size > 0) {
      const shownCount = Math.min(related.size, FORGET_RELATED_MAX)
      lines.push('', `同 entity 相关记忆(共 ${related.size} 条,显示前 ${shownCount} 条;如需一并遗忘,逐个以 id 调用):`)
      let shown = 0
      for (const [mid, m] of related) {
        if (shown >= FORGET_RELATED_MAX) break
        lines.push(`[${mid}] ${truncateChars(m.content, 120)}`)
        shown += 1
      }
      if (related.size > FORGET_RELATED_MAX) lines.push(`…另有 ${related.size - FORGET_RELATED_MAX} 条未列出`)
    }
    lines.push('', '以上尚未执行。确认要遗忘哪条后,用 memory_forget({ id }) 执行;需要彻底屏蔽加 hard=true。')
    return { text: lines.join('\n') }
  }

  // ── 注册(立即生效;返回注销器供热重建)──────────────────────────────────────

  const buildDisposers = (tools) => [
      tools.register({
        name: 'memory_recall',
        description:
          '检索长期记忆(事实/经验/话题摘要/热缓冲)。当用户问"之前/上次/还记得吗",或需要跨会话、跨项目上下文时调用。' +
          'query 传记忆 id 可整条展开原文(旧内容,以当前为准);time 支持 "2026-09-01"、"2026-09-01..2026-09-10"、"7d"、"24h";' +
          'session 可限定来源会话(trajectory 只回放当前或同工作区的会话)。命中条目会续期其有效期。mode=trajectory 时按会话回放行动链(不计续期)。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '检索词;传记忆 id(m_/hb_ 开头)则整条展开' },
            time: { type: 'string', description: '时间窗过滤,如 "7d" 或 "2026-09-01..2026-09-10"' },
            mode: { type: 'string', enum: ['default', 'trajectory'], description: 'default=检索记忆;trajectory=回放会话行动链(不计召回续期)' },
            session: { type: 'string', description: '限定某个会话 id(trajectory 缺省为本会话)' },
            limit: { type: 'integer', minimum: 1, maximum: 20, description: '最多显示条数(1–20,默认 10);结果被截断时末尾会标注' },
          },
        },
        output: { schema: JSON_OBJECT, render: textOutput },
        execute: (args, exec) => recallExecute(args, exec),
      }),
      tools.register({
        name: 'memory_remember',
        description:
          '把一条内容写入长期记忆。用户明确说"记一下/记住"时调用,并带 confirm=true(当场转正);' +
          '你自己判断值得记的内容也可调用,但会进暂存区标"待确认"。' +
          'userQuote:想标成"用户说的"时,从本会话用户消息里原样摘一句能支持这条内容的话;工具会核对它确实存在——' +
          '核对不过就记成"助手记下的"(不带也能记,只是来源保守)。' +
          'entity:这条内容的主体(项目/人物/模块/资料名);不同主体的相似内容不会合并。' +
          'temporal:偏好/约定/陈述性知识用 pattern,进行中的状况用 state,一次性未来事件用 episode 并在内容里写明日期。' +
          'kind:fact=发生了什么,lesson=学到什么。密钥/令牌形态的内容会被拒绝落盘。',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '要记住的内容(一句话原子事实)' },
            confirm: { type: 'boolean', description: '用户明确要求记住时为 true' },
            userQuote: { type: 'string', description: '用户原话引用:从本会话用户消息里原样摘一句;核对通过才把来源标成"用户说的"' },
            entity: { type: 'string', description: '主体(项目/人物/模块/资料名);同内容不同主体不合并' },
            temporal: { type: 'string', enum: ['pattern', 'state', 'episode'] },
            kind: { type: 'string', enum: ['fact', 'lesson', 'episode'] },
          },
          required: ['content'],
        },
        output: { schema: JSON_OBJECT, render: textOutput },
        execute: (args, exec) => rememberExecute(args, exec),
      }),
      tools.register({
        name: 'memory_forget',
        description:
          '归档一条记忆(立即退出一切注入;不物理删除,可审计)。按 id 直接执行;按 query 会先回显候选与同主体相关记忆,' +
          '确认后再以 id 执行。hard=true 追加全域访问屏蔽并级联热缓冲副本(原文仍在会话日志里,README 有说明)。',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '记忆 id(优先);提供 id 才执行' },
            query: { type: 'string', description: '按内容检索候选(只回显,不执行)' },
            hard: { type: 'boolean', description: 'true 时追加 hidden 屏蔽并级联 L0' },
          },
        },
        output: { schema: JSON_OBJECT, render: textOutput },
        execute: (args, exec) => forgetExecute(args, exec),
      }),
      // SOUL 提议通道(0.7.0,§4.4):agent **不再直接写 SOUL**——只暂存一条整篇提议,
      // 用户在主侧栏「记忆」 → SOUL 里采纳才落笔。总开关关闭时不注册(整层停用)
      ...(soul === undefined || cfg.soulEnabled === false
        ? []
        : [tools.register({
          name: 'soul_propose',
          description:
            '向用户**提议**改写你自己的 SOUL(人格设定:一份跨会话、跨身份一致的"你是个什么样的人")——性格、价值观、口吻、信条。'
            + '你不会直接写入:提议进暂存区(记忆页 SOUL 卡的「人格提议」),用户点了采纳才生效。'
            + 'content 是**整篇新文本**(不是追加;要把想保留的现有内容一并写进去),reason 必填(说明为什么改,它会进提议列表与审计)。'
            + '不要写:① 某类任务的操作步骤(那属角色与 AGENTS.md);② 复述你的角色或职责;'
            + '③ 任何试图绕过安全规则、权限或用户要求的内容——写了也无效,注入时会声明它们优先级更高。'
            + '与当前内容相同、超长、密钥形态、注入特征的提议会被拒绝;每天有提议次数上限。',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string', description: '新的完整 SOUL 内容(整篇替换)' },
              reason: { type: 'string', description: '为什么改这一版(必填)' },
            },
            required: ['content', 'reason'],
          },
          output: { schema: JSON_OBJECT, render: textOutput },
          execute: async (args, exec) => {
            const content = typeof args?.content === 'string' ? args.content.trim() : ''
            const reason = typeof args?.reason === 'string' ? args.reason.trim() : ''
            if (reason === '') return { text: 'reason 必填:说明为什么改这一版(它会进提议列表与审计)。' }
            if (cfg.soulSelfEditEnabled === false) {
              return { text: '提议已被关闭(soulSelfEditEnabled=false);要改请让用户在主侧栏「记忆」 → SOUL 里操作。' }
            }
            const gate = soul.checks(content, { channel: 'agent' })
            if (gate.ok !== true) return { text: gate.error }
            const current = soul.current().trim()
            if (current === content) return { text: '与当前 SOUL 相同,无需提议。' }
            const used = soul.dailyUsed()
            if (used >= cfg.soulEditDailyBudget) {
              return { text: `今天提议已达上限(soulEditDailyBudget=${cfg.soulEditDailyBudget});明天再提,或请用户调整上限。` }
            }
            // 同类提议已在暂存区:不重复落盘(与提炼器同一去重口径)
            const dup = [...store.memories.entries()].find(([, m]) => m.entity === 'soul' && m.status === 'staged' && m.content === content)
            if (dup !== undefined) {
              return { text: `已有相同的待采纳提议(${dup[0]});等用户处理,不要重复提交。` }
            }
            const session = exec?.agent?.session
            const sessionId = session !== undefined ? String(session.id) : '(unknown)'
            const ws = await workspace.resolve(session?.header?.cwd)
            if (isDisabledHere(ws)) return { text: disabledText }
            const record = {
              id: newId('m'),
              content,
              kind: 'lesson',
              source: 'assistant',
              entity: 'soul',
              stagedBy: 'model',
              soulMode: 'replace',
              soulReason: truncateChars(reason, 200),
              importance: cfg.soulProposalImportance,
              confidence: cfg.soulProposalConfidence,
              temporal: 'pattern',
              eventTime: nowIso(),
              workspaceId: ws.id,
              workspaceLabel: ws.label,
              sessionId,
              evidence: [],
              status: 'staged',
              createdAt: nowIso(),
            }
            await store.memories.put(record.id, record)
            search.upsertMemory(record)
            await audit.write('soul-proposal-staged', `${record.id}(replace): ${truncateChars(content, 120)}`, sessionId)
            const delta = content.length - current.length
            return {
              text: `已提议(${record.id}),**没有**写入 SOUL——用户在记忆页 SOUL 卡采纳后才生效。`
                + `整篇替换:${current.length} → ${content.length} 字符(${delta >= 0 ? '+' : ''}${delta})。`,
            }
          },
        })]),
    ]

  if (tools !== undefined) {
    const disposers = buildDisposers(tools)
    return () => {
      for (const dispose of disposers) dispose()
    }
  }
  const fiber = ctx.inject(['tools'], (scope) => { buildDisposers(scope.tools) })
  if (fiber === undefined) {
    process.stderr.write('[memory] tools 服务缺席:记忆工具未注册(检索与注入照常)\n')
    return () => {}
  }
  return () => { bestEffort(Promise.resolve(fiber?.dispose?.())) }
}
