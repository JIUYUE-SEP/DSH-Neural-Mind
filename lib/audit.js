/**
 * 审计(§8):写插件自有 storageDomain 审计表,不碰会话日志。
 * 拦截、降级、死信、展开失败、配额降级等全在这里,可人工翻案。
 */
import { bestEffort, newId, nowIso, truncateChars } from './util.js'

const AUDIT_MAX_ENTRIES = 2000

export function createAudit({ store, logger }) {
  let sincePrune = 0

  async function write(kind, detail, sessionId) {
    const entry = {
      id: newId('au'),
      ts: nowIso(),
      kind,
      detail: truncateChars(String(detail), 500),
      ...(sessionId !== undefined ? { sessionId: String(sessionId) } : {}),
    }
    try {
      await store.audit.put(entry.id, entry)
      sincePrune += 1
      if (sincePrune >= 100) {
        sincePrune = 0
        await prune()
      }
    } catch (error) {
      logger.info(`memory: 审计写入失败(已忽略): ${error?.message ?? error}`)
    }
  }

  /** 有界:超上限删最老。 */
  async function prune() {
    const all = [...store.audit.entries()]
    if (all.length <= AUDIT_MAX_ENTRIES) return
    all.sort((a, b) => (a[1].ts < b[1].ts ? -1 : 1))
    for (const [id] of all.slice(0, all.length - AUDIT_MAX_ENTRIES)) {
      await bestEffort(store.audit.delete(id))
    }
  }

  return {
    write,
    prune,
    list: () => [...store.audit.entries()].map(([, v]) => v),
  }
}
