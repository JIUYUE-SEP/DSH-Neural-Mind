/**
 * D2a:关系安全护栏。
 *
 * 只回答“这对 created/target 是否允许写入某种关系”，不做语义判断、
 * 不调相似度、不替 LLM 决定 same/update/conflict——LLM 仍负责关系类型，
 * 但明显跨主体/跨域/跨时间的关系在这里被确定性拒绝。
 */
import { normalizeEntity } from './text.js'
import { normalizeWorkspacePath } from './workspace.js'
import { DAY_MS } from './util.js'

/** 无 entity 的调试假设链例外窗口:同 session/source,且新旧在 14 天内。 */
export const HYPOTHESIS_WINDOW_MS = 14 * DAY_MS

const timeOf = (record) => Date.parse(record.eventTime ?? record.createdAt)
const sameWorkspace = (a, b) => normalizeWorkspacePath(a.workspaceId) === normalizeWorkspacePath(b.workspaceId)

function expiredState(record) {
  return record.temporal === 'state'
    && typeof record.expiresAt === 'string'
    && Date.now() > Date.parse(record.expiresAt)
}

function fileOverlap(created, target) {
  if (!Array.isArray(created.filePaths) || !Array.isArray(target.filePaths)) return false
  if (created.filePaths.length === 0 || target.filePaths.length === 0) return false
  return created.filePaths.some((path) => target.filePaths.includes(path))
}

/**
 * @returns {{ok: boolean, channel?: string, reason?: string}}
 */
export function relationCompatibility(created, target, type) {
  if (created === undefined || target === undefined) return { ok: false, reason: 'missing' }
  if (type === 'unrelated') return { ok: true, channel: 'noop' }

  const createdEntity = normalizeEntity(created.entity)
  const targetEntity = normalizeEntity(target.entity)
  const sameEntity = createdEntity !== '' && createdEntity === targetEntity
  const userLevel = createdEntity === 'user' && targetEntity === 'user'
  const sameWs = sameWorkspace(created, target)

  // 跨 workspace:只有 user 级偏好的 reinforce 例外;取代/争议一律不跨域。
  if (!sameWs) {
    if (!(type === 'reinforce' && userLevel)) return { ok: false, reason: 'cross-workspace' }
  }

  // 过期 state 不再被强化/取代/争议;它已经该走归档。
  if (expiredState(target)) return { ok: false, reason: 'target-expired-state' }

  // 时间语义必须相容;不同 temporal 不直接写关系。
  if (created.temporal !== target.temporal) return { ok: false, reason: 'temporal-mismatch' }
  if ((created.validUntil ?? null) !== (target.validUntil ?? null)) {
    return { ok: false, reason: 'validity-mismatch' }
  }

  const tNew = timeOf(created)
  const tOld = timeOf(target)
  const timeOrdered = !Number.isNaN(tNew) && !Number.isNaN(tOld) && tNew >= tOld

  if (sameEntity) {
    if (type === 'contradict' && !timeOrdered) return { ok: false, reason: 'newer-target' }
    return { ok: true, channel: 'entity' }
  }

  // 以下仅 contradict 可以考虑“无 entity”的例外;reinforce/dispute 必须有同主体。
  if (type !== 'contradict') {
    return {
      ok: false,
      reason: createdEntity === '' || targetEntity === '' ? 'entity-missing' : 'subject-mismatch',
    }
  }

  // 调试假设链:同 session、同 source、双方都无 entity、新不早于旧、14 天内。
  if (createdEntity === '' && targetEntity === ''
    && created.sessionId === target.sessionId
    && created.source === target.source
    && timeOrdered
    && tNew - tOld <= HYPOTHESIS_WINDOW_MS) {
    return { ok: true, channel: 'hypothesis' }
  }

  // 代码锚:双方 filePaths 有交集、同 workspace、新不早于旧;用于无 entity 的代码事实更新。
  if (fileOverlap(created, target) && timeOrdered) return { ok: true, channel: 'file-anchor' }

  return { ok: false, reason: 'subject-mismatch' }
}
