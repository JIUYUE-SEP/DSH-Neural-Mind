/**
 * 记忆写操作与来源展开(§4.3,v1.26 R1a)。
 *
 * 为什么单独一层:控制台(`/neural-mind/api`)与记忆工具(`memory_forget` / `memory_recall`)
 * 必须共用同一套状态变更与级联口径——否则「彻底隐藏」在页面点一次、在对话里点一次,
 * 可能一边级联了 L0/终止了待提炼任务、另一边没有,用户看到的就是"同一件事两个结果"。
 *
 * 共用范围:
 *  - `archive` / `restore` / `setSensitive`:控制台按钮(工具侧不提供这三个);
 *  - `hardForget`:控制台「彻底隐藏」 = 工具 `memory_forget(hard=true)`;
 *  - `expandOriginal`:控制台「展开来源轮次」 = 工具 `memory_recall(id)` 的原文展开。
 *
 * 纪律:不升存储格式、不物理删除;所有变更都写操作记录;恢复/停用只改 `status`,
 * 恢复时清 `negativeSince` 并给 `state` 续期(否则下一次清扫会立刻把它归档回去)。
 */
import { renewStateExpiry } from './rank.js'
import { makeExcerpt } from './text.js'
import { eventsToTurnParts } from './turns.js'
import { bestEffort, nowIso, truncateChars } from './util.js'
import { renderOriginal } from './hotbuffer.js'

export function createMemoryOps({ ctx, cfg, rankCfg, store, search, hotbuffer, audit, turns, workspace, logger }) {
  // ── hard forget 的隐藏面(hard = 全域不可见;原文仍在会话日志,§9.9)────────────────

  /** 收集某会话的 hard-forget 隐藏区间/内容,供 trajectory/expandOriginal 过滤。 */
  function hiddenInfoFor(sessionId) {
    const ranges = []
    const needles = []
    for (const [, entry] of store.hotbuffer?.entries?.() ?? []) {
      if (entry.sessionId !== sessionId || entry.hidden !== true) continue
      if (Number.isFinite(entry.startSeq) && Number.isFinite(entry.endSeq)) ranges.push([entry.startSeq, entry.endSeq])
      if (typeof entry.content === 'string' && entry.content !== '') needles.push(entry.content)
    }
    for (const [, record] of store.memories?.entries?.() ?? []) {
      if (record.sessionId !== sessionId || record.hidden !== true) continue
      if (record.sourceRange !== undefined) ranges.push([record.sourceRange.startSeq, record.sourceRange.endSeq])
      if (typeof record.content === 'string' && record.content !== '') needles.push(record.content)
    }
    return { ranges, needles }
  }

  const seqHidden = (seq, ranges) => ranges.some(([from, to]) => seq >= from && seq <= to)
  const textHidden = (text, needles) => needles.some((needle) => text.includes(needle))

  /** hard forget 后终止同源 outbox,并从 TurnTracker 丢掉对应回合缓存。 */
  async function skipOutboxFor({ sessionId, turn, startSeq, endSeq, content }) {
    let skipped = 0
    for (const [id, item] of store.outbox?.entries?.() ?? []) {
      if (item.sessionId !== sessionId || item.status === 'dead' || item.status === 'skipped') continue
      let match = false
      if (typeof turn === 'number' && item.turn === turn) match = true
      if (!match && Number.isFinite(startSeq) && Number.isFinite(endSeq)) {
        match = item.startSeq <= endSeq && item.endSeq >= startSeq
      }
      if (!match && typeof content === 'string' && content.trim() !== '') {
        const hot = hotbuffer.findByTurn(item.sessionId, item.turn)
        match = hot !== undefined && hot.entry.content.includes(content.trim())
      }
      if (!match) continue
      await bestEffort(store.outbox.update(id, (cur) => ({ ...cur, status: 'skipped' })))
      skipped += 1
    }
    if (skipped > 0) await audit.write('forget-hard-outbox-skipped', `终止 ${skipped} 条待提炼 outbox`, sessionId)
    if (typeof turn === 'number') turns?.dropTurn?.(sessionId, turn)
    if (Number.isFinite(startSeq) && Number.isFinite(endSeq)) turns?.dropTurns?.(sessionId, startSeq, endSeq)
    if (typeof content === 'string') turns?.dropTurnsByContent?.(sessionId, content)
  }

  /**
   * hard 屏蔽后,把审计里承载该记忆正文的记录打码。
   * 保留"何时、对哪条、做了什么"的操作记录(可翻案),只去掉正文摘要——
   * 否则 hidden 之后正文仍以摘要形式留在审计表里(审查 M5)。
   */
  async function redactAudit(memoryId, content, sessionId) {
    const needle = truncateChars(content, 120)
    let redacted = 0
    for (const [key, row] of [...store.audit.entries()]) {
      const carriesId = String(row.detail).includes(memoryId)
      const carriesText = needle !== '' && String(row.detail).includes(needle)
      if (!carriesId && !carriesText) continue
      await bestEffort(store.audit.update(key, (cur) => ({
        ...cur,
        detail: `(正文已按 hard 屏蔽打码)[${memoryId}] ${cur.kind}`,
      })))
      redacted += 1
    }
    if (redacted > 0) await audit.write('forget-hard-redacted', `${memoryId}: 打码 ${redacted} 条审计正文`, sessionId)
    return redacted
  }

  /**
   * 彻底隐藏(控制台「彻底隐藏」与工具 `memory_forget(hard=true)` 共用):
   *  - 长期记忆:archived + hidden,级联同源 L0 副本,终止同源待提炼任务,审计正文打码;
   *  - L0 条目:直接 hidden(没有 archived 态),移出检索,终止 outbox,审计打码。
   * @returns {{ok:boolean, record?:object, error?:string}}
   */
  async function hardForget(id) {
    const memory = store.memories.get(id)
    if (memory !== undefined) {
      if (memory.hidden === true) return { ok: false, error: '这条记忆已经彻底隐藏了' }
      const updated = await bestEffort(store.memories.update(id, (cur) => ({
        ...cur,
        status: 'archived',
        hidden: true,
      })))
      if (updated === undefined) return { ok: false, error: `记忆 ${id} 更新失败` }
      // hard 屏蔽级联对应 L0 热缓冲副本(§4.3);原文仍在 DSH 会话日志(§9.9 坦白)
      const cascaded = await hotbuffer.cascadeHidden(memory.sessionId, memory.sourceRange, memory.content)
      if (memory.sourceRange === undefined && (cascaded ?? 0) === 0) {
        await audit.write('forget-hard-no-cascade', `${id}: 无 sourceRange 且未匹配到 L0,未扩大隐藏面`, memory.sessionId)
      }
      await skipOutboxFor({
        sessionId: memory.sessionId,
        startSeq: memory.sourceRange?.startSeq,
        endSeq: memory.sourceRange?.endSeq,
        content: memory.content,
      })
      // 审计里那条正文摘要也要打码:否则"抹掉"之后它还以摘要形式留在审计表里
      await redactAudit(id, memory.content, memory.sessionId)
      search.upsertMemory(updated)
      await audit.write('forget-hard', `${id}(正文不打码进审计,共 ${memory.content.length} 字符)`, memory.sessionId)
      return { ok: true, record: updated }
    }
    const hot = store.hotbuffer.get(id)
    if (hot !== undefined) {
      if (hot.hidden === true) return { ok: false, error: '这条热缓冲记录已经彻底隐藏了' }
      const updated = await bestEffort(store.hotbuffer.update(id, (cur) => ({ ...cur, hidden: true })))
      if (updated === undefined) return { ok: false, error: `热缓冲 ${id} 更新失败` }
      search.removeHot(id)
      await skipOutboxFor({
        sessionId: hot.sessionId,
        turn: hot.turn,
        startSeq: hot.startSeq,
        endSeq: hot.endSeq,
        content: hot.content,
      })
      await redactAudit(id, hot.content, hot.sessionId)
      await audit.write('forget-hard', `热缓冲 ${id}(直接 hidden,正文不打码进审计,共 ${hot.content.length} 字符)`, hot.sessionId)
      return { ok: true, record: updated, hot: true }
    }
    return { ok: false, error: `没有找到 id 为 ${id} 的记忆` }
  }

  // ── 状态与标记(控制台)──────────────────────────────────────────────────────

  /** 停用(archived):立即退出注入与自动召回,可再恢复;不物理删除。 */
  async function archive(id) {
    const memory = store.memories.get(id)
    if (memory === undefined) return { ok: false, error: '记忆不存在' }
    if (memory.hidden === true) return { ok: false, error: '这条记忆已彻底隐藏,不能再停用/恢复' }
    if (memory.status === 'archived') return { ok: true, record: memory, unchanged: true }
    const updated = await bestEffort(store.memories.update(id, (cur) => ({ ...cur, status: 'archived' })))
    if (updated === undefined) return { ok: false, error: '更新失败' }
    search.upsertMemory(updated)
    await audit.write('memory-archived', `${id}: ${truncateChars(memory.content, 120)}`, memory.sessionId)
    return { ok: true, record: updated }
  }

  /**
   * 恢复(archived → active)。用户显式恢复 = 不再按旧的质疑计时自动归档,
   * 所以清 `negativeSince`;`state` 类顺带续期,否则下一次清扫会立刻按过期规则再归档回去。
   */
  async function restore(id) {
    const memory = store.memories.get(id)
    if (memory === undefined) return { ok: false, error: '记忆不存在' }
    if (memory.hidden === true) return { ok: false, error: '这条记忆已彻底隐藏,不能恢复' }
    if (memory.status !== 'archived') return { ok: true, record: memory, unchanged: true }
    const now = nowIso()
    const updated = await bestEffort(store.memories.update(id, (cur) => {
      const next = { ...cur, status: 'active' }
      delete next.negativeSince
      if (next.temporal === 'state') {
        const expiresAt = renewStateExpiry(next, now, rankCfg)
        if (expiresAt !== undefined) next.expiresAt = expiresAt
      }
      return next
    }))
    if (updated === undefined) return { ok: false, error: '更新失败' }
    search.upsertMemory(updated)
    await audit.write('memory-restored', `${id}: 用户恢复(清旧质疑计时;state 续期)`, memory.sessionId)
    return { ok: true, record: updated }
  }

  /** 手动改敏感标记(R4 之后纯手动):为 true 打标,sensitiveNoCross 打开时参与跨工作区拦截。 */
  async function setSensitive(id, sensitive) {
    if (typeof sensitive !== 'boolean') return { ok: false, error: 'sensitive 参数必须是布尔值' }
    const memory = store.memories.get(id)
    if (memory === undefined) return { ok: false, error: '记忆不存在' }
    if (memory.hidden === true) return { ok: false, error: '这条记忆已彻底隐藏,不能再改标记' }
    const updated = await bestEffort(store.memories.update(id, (cur) => {
      const next = { ...cur }
      if (sensitive) next.sensitive = true
      else delete next.sensitive
      return next
    }))
    if (updated === undefined) return { ok: false, error: '更新失败' }
    search.upsertMemory(updated)
    await audit.write('memory-sensitive-set', `${id}: sensitive=${sensitive}`, memory.sessionId)
    return { ok: true, record: updated }
  }

  // ── 来源展开(控制台「展开来源轮次」/ 工具 memory_recall 按 id)────────────────

  /**
   * 按 `sourceRange` 读回会话原文并渲染(旧内容,以当前为准)。
   * @param options.queryTokens 超长时按 token 取摘录;
   * @param options.current 工具侧传入时启用"同工作区才展开"的跨域闸门;控制台(owner 页面)不传。
   * @returns 原文文本 | undefined(管道缺席/读不回/区间为空/全部被 hard forget)
   */
  async function expandOriginal(sessionId, sourceRange, { queryTokens, current } = {}) {
    const sessionQuery = ctx.get('sessionQuery')
    if (sessionQuery === undefined || sourceRange === undefined) return undefined
    try {
      const snapshot = await sessionQuery.readSession(sessionId)
      if (current !== undefined) {
        const targetCwd = snapshot?.session?.cwd ?? snapshot?.header?.cwd
        if (typeof targetCwd !== 'string'
          || current.workspaceId === '' || current.workspaceId === '(unknown)') return undefined
        const targetWs = await workspace.resolve(targetCwd)
        if (targetWs.id !== current.workspaceId) return undefined
      }
      const hidden = hiddenInfoFor(sessionId)
      const events = (snapshot.events ?? []).filter(
        (e) => e.seq >= sourceRange.startSeq && e.seq <= sourceRange.endSeq && !seqHidden(e.seq, hidden.ranges),
      )
      if (events.length === 0) return undefined
      const original = renderOriginal(eventsToTurnParts(events), { ...cfg, extractIncludeThinking: true })
      if (textHidden(original, hidden.needles)) return undefined
      if (original.trim() === '') return undefined
      return original.length <= cfg.recallFullMaxChars
        ? original
        : makeExcerpt(original, queryTokens ?? [], cfg.recallFullMaxChars)
    } catch (error) {
      // 会话管道缺席 / 读盘失败:返回 undefined,由调用方渲染"(原文已不可考)"并记审计
      logger?.info?.(`memory: 来源展开失败(已降级): ${error?.message ?? error}`)
      return undefined
    }
  }

  return { archive, restore, setSensitive, hardForget, expandOriginal, hiddenInfoFor }
}
