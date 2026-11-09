/**
 * 慢速通道 outbox(§3.0/§3.2):
 *  - 顺序纪律:先写 outbox(登记引用),再写热缓冲——防崩溃窗口漏提炼
 *  - 幂等键 = (sessionId, startSeq, endSeq):落盘前查重,防重复提炼
 *  - 至少一次投递 + 启动对账;失败重试耗尽进 dead-letter(MVP 仅日志,V2 记忆页重放)
 */
import { bestEffort, newId, nowIso } from './util.js'

/** 重试退避:1m / 5m / 15m / 1h / 3h。 */
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 10_800_000]

export function createOutbox({ store, cfg, audit, logger }) {
  /** 登记引用;幂等键命中则跳过(防重复提炼)。返回是否新登记。 */
  async function register(pkg, ws) {
    for (const [, item] of store.outbox.entries()) {
      if (
        item.sessionId === pkg.sessionId
        && item.startSeq === pkg.startSeq
        && item.endSeq === pkg.endSeq
        && (item.status === 'pending' || item.status === 'extracting')
      ) {
        return false
      }
    }
    const id = newId('ob')
    await store.outbox.put(id, {
      id,
      sessionId: pkg.sessionId,
      workspaceId: ws.id,
      ...(ws.label !== undefined ? { workspaceLabel: ws.label } : {}),
      ...(ws.gitRoot !== undefined ? { gitRoot: ws.gitRoot } : {}),
      turn: pkg.turn,
      startSeq: pkg.startSeq,
      endSeq: pkg.endSeq,
      status: 'pending',
      retries: 0,
      createdAt: nowIso(),
    })
    return true
  }

  function pendingFor(sessionId) {
    const out = []
    for (const [id, item] of store.outbox.entries()) {
      if (item.sessionId === sessionId && item.status === 'pending') {
        // 退避中未到点的不取
        if (item.nextRetryAt !== undefined && Date.parse(item.nextRetryAt) > Date.now()) continue
        out.push({ id, item })
      }
    }
    out.sort((a, b) => a.item.startSeq - b.item.startSeq)
    return out
  }

  function pendingCount(sessionId) {
    let n = 0
    for (const [, item] of store.outbox.entries()) {
      if (item.sessionId === sessionId && item.status === 'pending') n += 1
    }
    return n
  }

  /**
   * 下一次该醒来的时间(epoch ms):取该会话所有 pending 里最早的 nextRetryAt。
   * 没有 nextRetryAt 的 pending 按“现在”算;没有 pending 返回 undefined。
   * 调度器只读这里,不再自己硬编码 60s。
   */
  function nextDueAt(sessionId) {
    let next
    for (const [, item] of store.outbox.entries()) {
      if (item.sessionId !== sessionId || item.status !== 'pending') continue
      const parsed = item.nextRetryAt === undefined ? Date.now() : Date.parse(item.nextRetryAt)
      const at = Number.isNaN(parsed) ? Date.now() : parsed
      if (next === undefined || at < next) next = at
    }
    return next
  }

  /** 实际进入提炼输入的回合才标完成(§3.2);完成即删除(outbox 对账容忍引用悬空)。 */
  async function markDone(ids) {
    for (const id of ids) await bestEffort(store.outbox.delete(id))
  }

  async function markExtracting(ids) {
    for (const id of ids) {
      await bestEffort(store.outbox.update(id, (cur) => ({ ...cur, status: 'extracting' })))
    }
  }

  /** 失败:重试耗尽 → dead-letter + 审计;否则回 pending 带退避。 */
  async function markFailure(ids, error) {
    const message = error?.message ?? String(error)
    for (const id of ids) {
      const item = store.outbox.get(id)
      if (item === undefined) continue
      const retries = item.retries + 1
      if (retries >= cfg.outboxMaxRetries) {
        await bestEffort(store.outbox
          .update(id, (cur) => ({ ...cur, status: 'dead', retries, lastError: message })))
        await audit.write('outbox-dead-letter', `回合 ${item.sessionId}#${item.turn} 提炼重试耗尽: ${message}`, item.sessionId)
        logger.info(`memory: outbox 死信 ${item.sessionId}#${item.turn}(重试 ${retries} 次)`)
      } else {
        const backoff = RETRY_BACKOFF_MS[Math.min(retries - 1, RETRY_BACKOFF_MS.length - 1)]
        await bestEffort(store.outbox
          .update(id, (cur) => ({
            ...cur,
            status: 'pending',
            retries,
            lastError: message,
            nextRetryAt: new Date(Date.now() + backoff).toISOString(),
          })))
      }
    }
  }

  /**
   * 启动对账(§3.0):pending/extracting 条目引用悬空(热缓冲副本缺失)→ 标记跳过;
   * extracting 半成品(崩溃窗口)→ 回 pending 重提。
   */
  async function reconcile(hotbuffer) {
    for (const [id, item] of [...store.outbox.entries()]) {
      if (item.status === 'dead' || item.status === 'skipped') continue
      const found = hotbuffer.findByTurn(item.sessionId, item.turn)
      if (found === undefined) {
        await bestEffort(store.outbox.update(id, (cur) => ({ ...cur, status: 'skipped' })))
        await audit.write('outbox-dangling', `引用悬空,标记跳过: ${item.sessionId}#${item.turn}`, item.sessionId)
      } else if (item.status === 'extracting') {
        await bestEffort(store.outbox.update(id, (cur) => ({ ...cur, status: 'pending', nextRetryAt: undefined })))
      } else if (item.status === 'pending' && item.nextRetryAt !== undefined) {
        // 重启后不能因为上次的退避时间而永远不重试:清掉时间戳,flushAll 立即安排一次。
        await bestEffort(store.outbox.update(id, (cur) => ({ ...cur, nextRetryAt: undefined })))
      }
    }
  }

  /**
   * R16b(0.6.6,2026-11-09 用户裁决"选 C"):重新打开提炼后,**补提炼**关掉期间写下的回合。
   *
   * 关掉提炼时 `handleTurn` 只写 L0、不登记 outbox,那些回合永远进不了提炼。重新打开时把
   * "未消化、没有任何 outbox 引用"的 L0 副本补登记进队列,让它们按正常攒批节奏补一次提炼
   * ——不丢这段对话,代价是补提炼要花模型调用。
   *
   * 纪律:
   *  - 只处理未消化且非 hidden/死信、字段完整的条目;已有 outbox 行(**任何状态,含 dead/skipped**)
   *    的不重复登记——重试/放弃语义归 outbox 自己,补登记不能把死信重新拉活。
   *  - `skip(entry)`(如工作区已停用)与 `wsFor(entry)`(解析籍贯/gitRoot)由调用方给;
   *    `wsFor` 返回 `null` 表示跳过该条。
   *  - 积压规模由 R16 的 `hotBufferUndigestedTtlHours`(默认 168h)兜底:关掉期间更老的副本
   *    已被清扫掉,所以补提炼最多约一周的回合。
   * @returns 补登记条数(0 不写审计,避免每次启动刷一条)
   */
  async function registerOrphans(hotbuffer, { skip, wsFor } = {}) {
    const keyOf = (x) => `${x.sessionId}\u0000${x.turn}\u0000${x.startSeq}\u0000${x.endSeq}`
    const known = new Set([...store.outbox.entries()].map(([, item]) => keyOf(item)))
    const orphans = []
    for (const [, entry] of store.hotbuffer.entries()) {
      if (entry.digested === true || entry.hidden === true || entry.deadLettered === true) continue
      if (typeof entry.sessionId !== 'string' || !Number.isFinite(entry.turn)) continue
      if (!Number.isFinite(entry.startSeq) || !Number.isFinite(entry.endSeq)) continue
      if (known.has(keyOf(entry))) continue
      if (skip !== undefined && skip(entry) === true) continue
      orphans.push(entry)
    }
    orphans.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    let registered = 0
    for (const entry of orphans) {
      const ws = wsFor === undefined
        ? { id: entry.workspaceId ?? '(unknown)', label: entry.workspaceLabel }
        : await wsFor(entry)
      if (ws === null) continue
      const ok = await register(
        { sessionId: entry.sessionId, turn: entry.turn, startSeq: entry.startSeq, endSeq: entry.endSeq },
        ws,
      )
      if (ok) registered += 1
    }
    if (registered > 0) {
      await audit.write('hot-orphans-backfilled', `补登记 ${registered} 个"关掉提炼期间写下"的未消化 L0 副本,按正常节奏补做提炼`)
      logger.info(`memory: 补登记 ${registered} 个未消化 L0 副本(先前关掉了提炼),开始补提炼`)
    }
    return registered
  }

  return { register, pendingFor, pendingCount, nextDueAt, markDone, markExtracting, markFailure, reconcile, registerOrphans }
}
