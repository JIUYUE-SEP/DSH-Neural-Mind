/**
 * L0 热缓冲(§3.1):全文 + 代码块折叠 + 工具摘要制/失败例外 + 思考块仅回忆
 * + sensitive 关键词初筛。立即可检索;被慢速通道吸收后退出检索池。
 * 过期纪律:未被消化不过期(但用户主动关掉提炼后有上限,R16);TTL 只清死信;
 * 已消化条目保留 hotBufferRetainDays 后物理删除
 * (§9.9 的例外:它是会话日志的副本,原文永在;删前必须确认读得回)。
 */
import { bestEffort, fireAndForget, newId, nowIso, truncateChars } from './util.js'
import { foldCodeBlocks, makeExcerpt, prescreenSensitive, summarizeToolCall } from './text.js'
import { toolCallsOf } from './turns.js'

/**
 * 撞过输出上限的回合在正文里留一行显式标记(§3.0 裁决):
 * 注入、recall、提炼三处都读得到,免得"半句结论"被当成最终结论。
 * 放在正文里而不是新字段,是为了不动记录格式(§1 版本纪律:加字段要升 domain 版本)。
 */
export const TRUNCATION_NOTE = '[本轮回复撞到输出上限,可能被截断:引用结尾时按"未完成"处理]'

/** 回合包 → 热缓冲正文(分流:代码折叠、工具摘要、失败截断)。 */
export function renderHotContent(pkg, cfg) {
  const sections = []
  for (const text of pkg.userTexts) sections.push(`[用户]\n${text}`)
  for (const text of pkg.assistantTexts) sections.push(`[助手]\n${foldCodeBlocks(text)}`)
  for (const call of toolCallsOf(pkg)) {
    const mode = cfg.toolOutputOverrides[call.name] ?? cfg.toolOutputStorage
    sections.push(`[工具] ${summarizeToolCall(call.name, call.args, call.isError !== true, call.output ?? '', mode, cfg.failedToolOutputChars)}`)
  }
  if (pkg.truncated === true) sections.push(TRUNCATION_NOTE)
  return truncateChars(sections.join('\n\n'), cfg.hotBufferTurnMaxChars)
}

/**
 * 回合包 → 提炼输入用的完整原文(代码不折叠,工具输出默认全文;思考块可配)。
 *
 * `opts.toolOutputMaxChars`(R8a,0.6.6)只给"送去后台整理"这一条路径用:单个工具输出
 * 超限就截短——成功输出留头部(结论/摘要通常在前),失败输出留头留尾(报错签名常在日志尾部)。
 * 不传 `opts` 的调用方(工具层 `memory_recall` 按 id 展开原文,lib/tools.js)照旧拿全文,
 * 否则"展开原文"会被整理用的瘦身上限误伤(docs/legacy/REVIEW.md R8 的关键约束)。
 */
export function renderOriginal(pkg, cfg, opts = {}) {
  const toolOutputMaxChars = typeof opts.toolOutputMaxChars === 'number' && Number.isFinite(opts.toolOutputMaxChars)
    ? opts.toolOutputMaxChars
    : Number.POSITIVE_INFINITY
  const sections = []
  for (const text of pkg.userTexts) sections.push(`[用户]\n${text}`)
  for (const text of pkg.assistantTexts) sections.push(`[助手]\n${text}`)
  for (const call of toolCallsOf(pkg)) {
    const raw = call.output ?? ''
    const output = call.isError === true
      ? makeExcerpt(raw, [], toolOutputMaxChars)
      : truncateChars(raw, toolOutputMaxChars)
    sections.push(`[工具 ${call.name}(${call.args})]${call.isError === true ? '(失败)' : ''}\n${output}`)
  }
  if (cfg.extractIncludeThinking) {
    for (const text of pkg.thinkingTexts) sections.push(`[思考]\n${text}`)
  }
  if (pkg.truncated === true) sections.push(TRUNCATION_NOTE)
  return sections.join('\n\n')
}

/**
 * @param restoreCheck R16:删"未消化"L0 副本前的复查回调——返回原文是否还能从会话日志
 *   读回。不给/返回 false 时一律保留并告警(那时 L0 可能是唯一副本,§9.9)。
 */
export function createHotBuffer({ store, search, cfg, embedder, audit, logger, onFuse, restoreCheck }) {
  /** 本轮进程里已告警过的"读不回"条目(R16):同一进程不反复刷审计/日志。 */
  const warnedUnrestorable = new Set()
  /** 合格的回合 → 落盘 + 立即可检索 + 顺手 embed(fire-and-forget,失败静默)。 */
  async function writeTurn(pkg, ws) {
    const content = renderHotContent(pkg, cfg)
    if (content.trim() === '') return null
    const thinking = pkg.thinkingTexts.join('\n\n')
    const entry = {
      id: newId('hb'),
      sessionId: pkg.sessionId,
      workspaceId: ws.id,
      workspaceLabel: ws.label,
      turn: pkg.turn,
      startSeq: pkg.startSeq,
      endSeq: pkg.endSeq,
      content,
      ...(thinking.trim() !== '' ? { thinking: truncateChars(thinking, cfg.hotBufferTurnMaxChars) } : {}),
      // L0 落盘可选初筛:词表默认空(R4 起不做敏感自动标记),恒不命中;用户自己
      // 打开 sensitiveKeywords 后恢复。初筛输入含 thinking——它不进自动注入池但
      // recall 可查,漏筛就等于敏感内容绕过 §5.4 的"不跨域"硬过滤(2026-09-17 复核补)。
      ...(prescreenSensitive(`${content}\n${thinking}`, cfg.sensitiveKeywords) ? { sensitive: true } : {}),
      digested: false,
      createdAt: nowIso(),
    }
    await store.hotbuffer.put(entry.id, entry)
    search.upsertHot(entry)
    if ((await embedder.available()) && ws.isPrivate !== true) {
      fireAndForget(
        embedder.embedChunks(entry.content).then(async (chunks) => {
          if (chunks === undefined) return
          const updated = await bestEffort(store.hotbuffer
            .update(entry.id, (cur) => ({ ...cur, chunks, embeddingModel: embedder.model })))
          if (updated !== undefined) search.upsertHot(updated)
        }),
        logger,
        'memory: 热缓冲 embed',
      )
    }
    // 条数保险丝:超限触发一次强制提炼——只加速消化,不丢内容(§3.1)。
    // hidden 是 hard forget 的元数据,不是待提炼内容,不能把保险丝挤爆。
    let undigested = 0
    for (const [, e] of store.hotbuffer.entries()) if (!e.digested && e.hidden !== true) undigested += 1
    if (undigested > cfg.hotBufferMaxEntries) onFuse(pkg.sessionId)
    return entry
  }

  /** 慢速通道吸收:标已消化并退出检索池(§1)。 */
  async function markDigested(ids) {
    for (const id of ids) {
      const updated = await bestEffort(store.hotbuffer
        .update(id, (cur) => ({ ...cur, digested: true })))
      if (updated !== undefined) search.removeHot(id)
    }
  }

  /** outbox 死信联动:标死信,TTL 清扫才过期(§3.1)。 */
  async function markDeadLettered(id) {
    await bestEffort(store.hotbuffer.update(id, (cur) => ({ ...cur, deadLettered: true })))
  }

  /** 按 (sessionId, turn) 找热缓冲条目(outbox 对账/消化标记用)。 */
  function findByTurn(sessionId, turn) {
    for (const [id, entry] of store.hotbuffer.entries()) {
      if (entry.sessionId === sessionId && entry.turn === turn) return { id, entry }
    }
    return undefined
  }

  /**
   * 周期清扫:
   *  - 死信且超 hotBufferTtlHours → 删除
   *  - 已消化且超 hotBufferRetainDays → 物理删除(§9.9 例外)
   *  - **hidden 永不按 TTL 删**:它是 trajectory/expandOriginal 过滤已遗忘区间的唯一元数据;
   *    删掉就会让原文重新可见(A9)。hidden 行很小,清理由显式管理动作负责。
   *  - **R16:用户主动关掉提炼时,未消化的 L0 副本超 hotBufferUndigestedTtlHours → 删**
   *    (0=关掉该上限)。删前必须确认原文能从会话日志读回;读不回就保留并告警——
   *    此时它可能是唯一副本,§9.9"不物理删除"的例外不能扩到这一格。
   * LLM 缺席期/服务临时降级(extractEnabled 仍为 true)的未消化条目**不过期**。
   */
  async function sweep(nowMs = Date.now()) {
    const ttlMs = cfg.hotBufferTtlHours * 3_600_000
    const retainMs = cfg.hotBufferRetainDays * 86_400_000
    const undigestedTtlMs = cfg.hotBufferUndigestedTtlHours * 3_600_000
    const dropUndigested = cfg.extractEnabled !== true && cfg.hotBufferUndigestedTtlHours > 0
    for (const [id, entry] of [...store.hotbuffer.entries()]) {
      if (entry.hidden === true) continue
      const age = nowMs - Date.parse(entry.createdAt)
      if (entry.deadLettered === true && age > ttlMs) {
        await bestEffort(store.hotbuffer.delete(id))
        search.removeHot(id)
      } else if (entry.digested && age > retainMs) {
        await bestEffort(store.hotbuffer.delete(id))
      } else if (dropUndigested && entry.digested !== true && entry.deadLettered !== true && age > undigestedTtlMs) {
        const restorable = typeof restoreCheck === 'function' ? await restoreCheck(entry) : false
        if (restorable === true) {
          await bestEffort(store.hotbuffer.delete(id))
          search.removeHot(id)
          warnedUnrestorable.delete(id)
          await audit.write('hot-dropped-undigested', `L0 ${id}(会话 ${entry.sessionId} 回合 ${entry.turn}) 超 ${cfg.hotBufferUndigestedTtlHours}h 且提炼已关闭,原文可从会话日志读回 → 删除副本`, entry.sessionId)
        } else if (!warnedUnrestorable.has(id)) {
          // 只告警一次/进程:周期清扫每 30 分钟一轮,不设这道闸会把审计与日志刷满。
          warnedUnrestorable.add(id)
          await audit.write('hot-retained-undigested', `L0 ${id}(会话 ${entry.sessionId}) 超 ${cfg.hotBufferUndigestedTtlHours}h 但原文读不回,保留(可能是唯一副本)`, entry.sessionId)
          logger.warn(`memory: L0 ${id} 超期但原文读不回,保留并告警(会话 ${entry.sessionId};确认会话日志恢复后可再清扫)`)
        }
      }
    }
  }

  /**
   * forget --hard 级联:只屏蔽“对应”的 L0 副本(§4.3)。
   * 有 sourceRange 时按提炼批次 seq 区间;无范围时按同会话内容匹配,匹配不到就不级联——
   * 不再用“整会话所有 L0”兜底(那会误伤无关回合,A6)。
   * @returns 实际隐藏的条数
   */
  async function cascadeHidden(sessionId, sourceRange, content) {
    const needle = typeof content === 'string' ? content.trim() : ''
    let hidden = 0
    for (const [id, entry] of [...store.hotbuffer.entries()]) {
      if (entry.sessionId !== sessionId) continue
      let match = false
      if (sourceRange !== undefined) {
        match = Number.isFinite(entry.startSeq) && Number.isFinite(entry.endSeq)
          && entry.startSeq <= sourceRange.endSeq && entry.endSeq >= sourceRange.startSeq
      } else if (needle !== '') {
        match = entry.content.includes(needle)
      }
      if (!match) continue
      const updated = await bestEffort(store.hotbuffer.update(id, (cur) => ({ ...cur, hidden: true })))
      if (updated !== undefined) {
        search.removeHot(id)
        hidden += 1
      }
    }
    return hidden
  }

  return { writeTurn, markDigested, markDeadLettered, findByTurn, sweep, cascadeHidden }
}
