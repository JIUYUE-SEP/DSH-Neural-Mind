/**
 * 注入日志(v1.15,§4.2 可观测性):记录最近若干条「注入发生了什么」——成功注入、
 * 常驻块、开场动态,以及**为什么没注入**。只服务记忆页「总览 / 召回」的实时诊断。
 *
 * 纪律:
 *  - **进程内环形缓冲,不落盘**:它是调试信息,不是审计(审计仍走 audit 存储)。
 *  - **绝不记录注入正文或用户查询文本**:只记 id 列表(≤10)、条数、字符数、
 *    会话短 id、工作区短名与原因码。记忆正文经 /neural-mind/api 按需单独读取。
 *  - 写入失败绝不影响注入主流程(调用方包 try/catch)。
 */
import { nowIso } from './util.js'

const MODES = new Set(['inject', 'resident', 'digest', 'skip'])

/** reason 码 → 面板展示用的稳定标识(客户端按这些码映射人话)。 */
export const SKIP_REASONS = [
  'workspace-disabled',
  'auto-recall-off',
  'no-query',
  'pressure',
  'inline-timeout',
  'search-unavailable',
  'no-hits',
  'subagent',
  'inject-error',
]

const clampInt = (value, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(max, Math.floor(n))
}

/**
 * @param options.max - 环形缓冲上限(默认 60)
 */
export function createInjectionLog({ max = 60 } = {}) {
  const limit = Math.max(1, clampInt(max, 500) || 60)
  const rows = []
  const counts = { inject: 0, resident: 0, digest: 0, skip: 0, chars: 0, records: 0 }

  function record(entry = {}) {
    const mode = MODES.has(entry.mode) ? entry.mode : 'skip'
    const row = {
      ts: typeof entry.ts === 'string' && entry.ts !== '' ? entry.ts : nowIso(),
      mode,
      reason: mode === 'skip' && typeof entry.reason === 'string' && entry.reason !== '' ? entry.reason : null,
      records: clampInt(entry.records, 10_000),
      chars: clampInt(entry.chars, 10_000_000),
      sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : '',
      workspaceLabel: typeof entry.workspaceLabel === 'string' ? entry.workspaceLabel : '',
      resident: clampInt(entry.resident, 1000),
      digest: clampInt(entry.digest, 1000),
      hitIds: Array.isArray(entry.hitIds) ? entry.hitIds.filter((id) => typeof id === 'string').slice(0, 10) : [],
    }
    rows.unshift(row)
    if (rows.length > limit) rows.length = limit
    counts[mode] += 1
    counts.chars += row.chars
    counts.records += row.records
    return row
  }

  function list(n = 20) {
    return rows.slice(0, Math.max(1, clampInt(n, 200) || 20))
  }

  function summary() {
    return { ...counts }
  }

  function size() {
    return rows.length
  }

  /** 测试用:清空(运行时无调用点)。 */
  function reset() {
    rows.length = 0
    for (const key of Object.keys(counts)) counts[key] = 0
  }

  return { record, list, summary, size, reset }
}
