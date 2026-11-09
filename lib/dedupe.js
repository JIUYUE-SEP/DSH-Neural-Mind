/**
 * D1:写入幂等的保守去重。
 *
 * 只做“同 workspace + 同 entity(或双方都空) + 规范化内容相同”的精确匹配;
 * 不删标点/否定词,不做大小写忽略,不做语义合并(留给 D2)。
 * 索引不是持久唯一键:当前用内存表全扫描 + 进程内串行队列,先保证正确性。
 */
import { normalizeEntity, normalizeContent } from './text.js'
import { normalizeWorkspacePath } from './workspace.js'

/** 判断 candidate 是否与既有 record 是同一事实。caller 负责 hidden/archived 策略。 */
export function isDuplicate(candidate, record) {
  if (record === undefined || record === null) return false
  const content = normalizeContent(candidate.content)
  if (content === '' || content !== normalizeContent(record.content)) return false

  const workspace = normalizeWorkspacePath(candidate.workspaceId)
  if (workspace !== normalizeWorkspacePath(record.workspaceId)) return false

  const entity = normalizeEntity(candidate.entity)
  const recordEntity = normalizeEntity(record.entity)
  if (entity !== recordEntity) return false
  // kind/temporal/有效期不一致时保留独立记录;staged→confirm 的 status 例外由 caller 处理。
  if (candidate.kind !== record.kind || candidate.temporal !== record.temporal) return false
  if ((candidate.validUntil ?? null) !== (record.validUntil ?? null)) return false

  // '(unknown)' / 空 workspace 不是可共享的真实域:要求同 session,避免跨会话误合并。
  if ((workspace === '' || workspace === '(unknown)') && candidate.sessionId !== record.sessionId) return false
  return true
}

/** 在 store.memories 里找第一个同事实记录。O(n),先保正确性;C 阶段再谈索引。 */
export function findDuplicate(store, candidate) {
  for (const [, record] of store.memories.entries()) {
    if (isDuplicate(candidate, record)) return record
  }
  return undefined
}

let writeTail = Promise.resolve()

/**
 * 进程内“查重 + 写入”串行队列。
 * remember 与 extract 都走这里,避免两个并发请求同时查不到后双写。
 * fn 必须是短临界区:只包查重/put/必要更新,不要把 LLM 或 embedding 放进来。
 */
export function withMemoryWrite(fn) {
  const result = writeTail.then(fn)
  writeTail = result.then(() => {}, () => {})
  return result
}
