/**
 * §14 使用观测(0.6.7,R3/R9):把"插件自己干了什么"落成可跨重启读的遥测。
 *
 * 纪律:
 *  - **只存元数据**:计数、注入条数/字符数、记忆 id、相关度/可信度分量;不存正文、不存查询原文。
 *  - **不阻塞热路径**:`record*()` 只改内存 + 置 dirty,落盘走 debounce;失败重试,不影响注入/记忆。
 *  - **坏了不绊倒人**:独立域打开失败或 `usageLog=false` 时整体退化为"不可用",页面显示未落盘。
 *  - **只读统计**(poolStats):不 update/delete/写审计;结果内存缓存 60s。
 *
 * 保留纪律:日汇总默认 30 天(`usageRetentionDays`),明细 7 天 + 2000 条硬上限。
 * 观测数据是遥测,不含记忆正文,按保留期清理不属于 DESIGN §9.9 的"记忆不物理删除"。
 */
import { bestEffort, nowIso } from './util.js'

/** 明细保留天数(与 NEXT_STEPS §1.1 的"跨重启观测 ≥7 天"对齐)。 */
export const USAGE_RECENT_DAYS = 7
/** 明细条数硬上限:正常一周 350–700 条;更大只可能是异常高频,防爆。 */
export const USAGE_RECENT_MAX = 2000
/** `no-hits` 每天最多写几条明细(它太常见,全记会挤掉异常)。 */
export const USAGE_RECENT_NO_HITS_DAILY_MAX = 20
/** 落盘节流窗口:合并同一轮里的多次事件;崩溃最多丢这么久。 */
export const USAGE_FLUSH_DEBOUNCE_MS = 3000
/** 清理定时:启动一次 + 每 6 小时。 */
export const USAGE_TRIM_INTERVAL_MS = 6 * 60 * 60 * 1000
/** `pool` 统计缓存(TTL)。 */
export const USAGE_QUERY_CACHE_MS = 60_000
/** 体积估算/重复扫描的硬上限:超过即停并标 partial,避免大池子卡住页面。 */
export const USAGE_POOL_SCAN_MAX = 50_000

/** 环境类跳过:只进日汇总,不写明细(§14.3 分层)。 */
const ENV_SKIP_REASONS = new Set(['workspace-disabled', 'auto-recall-off', 'subagent'])
/** 低可信来源(面板分档用,只影响展示与计数,不影响注入选择)。 */
const LOW_TRUST_SOURCES = new Set(['assistant', 'unknown', 'quote'])

const round2 = (n) => Math.round(Number(n) * 100) / 100
const dayMs = 86_400_000

/** 本地日期 `YYYY-MM-DD`(用户看"今天",不用 UTC)。 */
export function localDay(ms = Date.now()) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const dayId = (date) => `u_${date}`
/** 明细 id 用 13 位毫秒时间戳保证字典序=时间序,trim 时可直接按序删最旧。 */
const recentId = (ms, seq) => `r_${String(ms).padStart(13, '0')}_${seq}`

/** 某条注入的质量分档判定(只用于展示与计数,§14.3)。 */
export function isLowTrust(item) {
  if (item === null || item === undefined) return false
  if (LOW_TRUST_SOURCES.has(item.src)) return true
  if (Number(item.c) < 0.5) return true
  if (Number(item.e) < 0) return true
  return false
}

/** 由逐条分量算聚合 `quality`(注入路径与测试共用)。 */
export function summarizeQuality(items) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return undefined
  let rSum = 0
  let rMin = Infinity
  let sSum = 0
  let cSum = 0
  let cMin = Infinity
  let eSum = 0
  let lowTrust = 0
  let unverified = 0
  for (const it of list) {
    const r = Number(it.r) || 0
    const s = Number(it.s) || 0
    const c = Number(it.c) || 0
    const e = Number(it.e) || 0
    rSum += r
    sSum += s
    cSum += c
    eSum += e
    if (r < rMin) rMin = r
    if (c < cMin) cMin = c
    if (isLowTrust(it)) lowTrust += 1
    if (it.v === false) unverified += 1
  }
  const n = list.length
  return {
    n,
    rAvg: round2(rSum / n),
    rMin: round2(rMin),
    sAvg: round2(sSum / n),
    cAvg: round2(cSum / n),
    cMin: round2(cMin),
    eAvg: round2(eSum / n),
    lowTrust,
    unverified,
  }
}

/**
 * @param {object} options
 * @param {object} options.store - openStore 的返回值(需 `usage.days` / `usage.recent` 两张表)
 * @param {object} options.cfg - 纯值配置(`usageLog` / `usageRetentionDays`)
 * @param {object} [options.audit] - 审计写入器(清理时留痕;缺失则不留痕)
 * @param {object} [options.health] - 插件健康快照(`warnings` 数组会追加观测告警)
 * @param {object} [options.logger]
 * @param {function} [options.now] - 时钟(测试注入)
 */
export function createUsage({ store, cfg, audit, health, logger, now = () => Date.now() }) {
  const log = (msg) => logger?.info?.(`memory: ${msg}`)
  /** 域不存在或配置关掉 → 整体不可用(页面显示"未落盘")。 */
  const available = store?.usagePersisted === true && cfg?.usageLog !== false
  const retentionDays = Number.isFinite(cfg?.usageRetentionDays) ? Math.max(0, Math.trunc(cfg.usageRetentionDays)) : 30

  /** 日计数内存镜像:date → counters。 */
  const days = new Map()
  /** 自上次成功落盘以来的增量:date → counters(避免 read-merge-write 重复累加)。 */
  const delta = new Map()
  /** 明细内存镜像:新→旧。 */
  const recent = []
  /** 待落盘明细。 */
  let pendingRecent = []
  /** `no-hits` 当天已写明细数(采样上限)。 */
  const noHitsWritten = new Map()
  let seq = 0
  let flushTimer = null
  let trimTimer = null
  let flushing = null
  let closed = false
  let lastFlushAt = ''
  let lastPrunedAt = ''
  let lastError = ''
  let warned = false
  let opened = false
  let poolCache = { at: 0, value: null }

  const dayOf = (ms) => localDay(ms)
  const countersOf = (date) => {
    let counters = days.get(date)
    if (counters === undefined) {
      counters = {}
      days.set(date, counters)
    }
    return counters
  }
  const deltaOf = (date) => {
    let counters = delta.get(date)
    if (counters === undefined) {
      counters = {}
      delta.set(date, counters)
    }
    return counters
  }
  const bump = (counters, key, by = 1) => {
    counters[key] = (counters[key] ?? 0) + by
  }

  function warnOnce(message) {
    if (warned) return
    warned = true
    lastError = String(message)
    try {
      process.stderr.write(`[memory] ${message}\n`)
    } catch {
      // stderr 不可写(极端环境)不影响观测主流程。
    }
    if (Array.isArray(health?.warnings) && !health.warnings.includes(message)) health.warnings.push(message)
  }

  function scheduleFlush() {
    if (!available || closed || flushTimer !== null) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      fireFlush()
    }, USAGE_FLUSH_DEBOUNCE_MS)
    flushTimer.unref?.()
  }

  function fireFlush() {
    bestEffort(flush())
  }

  /** 启动装配:读回已有遥测(只读镜像),再跑一次保留期裁剪。 */
  async function open() {
    if (!available) return
    try {
      for (const [, value] of store.usage.days.entries()) {
        if (value === null || typeof value !== 'object' || typeof value.date !== 'string') continue
        days.set(value.date, { ...(value.counters ?? {}) })
      }
      const loaded = []
      for (const [, value] of store.usage.recent.entries()) {
        if (value === null || typeof value !== 'object' || typeof value.ts !== 'string') continue
        loaded.push(value)
      }
      loaded.sort((a, b) => (a.ts < b.ts ? 1 : -1))
      recent.length = 0
      recent.push(...loaded.slice(0, USAGE_RECENT_MAX))
      opened = true
      await trim({ auditDeletion: false })
    } catch (error) {
      warnOnce(`使用观测读取失败,本次进程仅内存计数: ${error?.message ?? error}`)
    }
  }

  /**
   * 计数入口:注入/跳过。
   * @param {object} row - injectionlog 的 record 行(含可选的 items / quality)
   */
  function recordInjection(row) {
    if (!available || row === null || typeof row !== 'object') return
    const ms = Number.isFinite(Date.parse(row.ts)) ? Date.parse(row.ts) : now()
    const date = dayOf(ms)
    const counters = countersOf(date)
    const patch = deltaOf(date)
    const bumpBoth = (key, by = 1) => {
      bump(counters, key, by)
      bump(patch, key, by)
    }
    const mode = String(row.mode ?? 'skip')
    if (mode === 'skip') {
      const reason = String(row.reason ?? 'unknown')
      bumpBoth(`skip.${reason}`)
      // 环境类跳过只进日汇总;其余进明细(no-hits 另有每日采样上限)。
      if (ENV_SKIP_REASONS.has(reason)) {
        scheduleFlush()
        return
      }
      if (reason === 'no-hits') {
        const written = noHitsWritten.get(date) ?? 0
        if (written >= USAGE_RECENT_NO_HITS_DAILY_MAX) {
          scheduleFlush()
          return
        }
        noHitsWritten.set(date, written + 1)
      }
    } else {
      bumpBoth(`inject.${mode}`)
      bumpBoth('inject.records', Number(row.records) || 0)
      bumpBoth('inject.chars', Number(row.chars) || 0)
      for (const item of Array.isArray(row.items) ? row.items : []) {
        bumpBoth('inject.relevanceSum', Number(item.r) || 0)
        bumpBoth('inject.relevanceCount')
        bumpBoth('inject.confSum', Number(item.c) || 0)
        bumpBoth('inject.confCount')
        if (isLowTrust(item)) bumpBoth('inject.lowTrust')
        if (item.v === false) bumpBoth('inject.unverified')
      }
    }
    pushRecent(row, ms)
    scheduleFlush()
  }

  /** 通用计数入口(提炼 / 召回):`{ 'extract.ok': 1, 'recall.calls': 1 }`。 */
  function recordCounters(patch) {
    if (!available || patch === null || typeof patch !== 'object') return
    const date = dayOf(now())
    const counters = countersOf(date)
    const diff = deltaOf(date)
    for (const [key, value] of Object.entries(patch)) {
      const by = Number(value)
      if (!Number.isFinite(by) || by === 0) continue
      bump(counters, key, by)
      bump(diff, key, by)
    }
    scheduleFlush()
  }

  /** 明细记录(调用方已按 §14.3 分层判定;这里只做形状与上限)。 */
  function pushRecent(row, ms) {
    const record = {
      id: recentId(ms, ++seq),
      ts: typeof row.ts === 'string' ? row.ts : new Date(ms).toISOString(),
      mode: String(row.mode ?? 'skip'),
      ...(row.reason !== undefined && row.reason !== null ? { reason: String(row.reason) } : {}),
      records: Math.max(0, Math.trunc(Number(row.records) || 0)),
      chars: Math.max(0, Math.trunc(Number(row.chars) || 0)),
      sessionId: String(row.sessionId ?? ''),
      ...(typeof row.workspaceLabel === 'string' && row.workspaceLabel !== '' ? { workspaceLabel: row.workspaceLabel } : {}),
      ...(Array.isArray(row.hitIds) && row.hitIds.length > 0 ? { hitIds: row.hitIds.filter((id) => typeof id === 'string').slice(0, 10) } : {}),
      ...(Array.isArray(row.items) && row.items.length > 0
        ? {
            items: row.items.slice(0, 10).map((it) => ({
              id: String(it.id ?? ''),
              r: round2(Number(it.r) || 0),
              s: round2(Number(it.s) || 0),
              c: round2(Number(it.c) || 0),
              e: round2(Number(it.e) || 0),
              src: String(it.src ?? 'unknown'),
              k: String(it.k ?? 'fact'),
              ...(it.v === true || it.v === false ? { v: it.v } : {}),
            })),
          }
        : {}),
      ...(row.quality !== undefined && row.quality !== null ? { quality: row.quality } : {}),
    }
    // 注入口只负责给逐条分量;聚合在这里补(调用方不必重复实现)。
    if (record.quality === undefined && Array.isArray(record.items) && record.items.length > 0) {
      record.quality = summarizeQuality(record.items)
    }
    recent.unshift(record)
    if (recent.length > USAGE_RECENT_MAX) recent.length = USAGE_RECENT_MAX
    pendingRecent.push(record)
    if (pendingRecent.length > USAGE_RECENT_MAX) pendingRecent = pendingRecent.slice(-USAGE_RECENT_MAX)
  }

  /** 落盘:先写日增量(read-merge-write),再写明细;成功后清增量,失败保留重试。 */
  async function flush() {
    if (!available) return
    if (flushing !== null) {
      await flushing
      return
    }
    flushing = (async () => {
      const dates = [...delta.keys()]
      const writtenDays = []
      try {
        for (const date of dates) {
          const patch = delta.get(date) ?? {}
          if (Object.keys(patch).length === 0) continue
          const key = dayId(date)
          const existing = await store.usage.days.get(key)
          const merged = { ...(existing?.counters ?? {}) }
          for (const [name, by] of Object.entries(patch)) merged[name] = (merged[name] ?? 0) + by
          await store.usage.days.put(key, { id: key, date, counters: merged, updatedAt: nowIso() })
          writtenDays.push(date)
        }
        for (const date of writtenDays) delta.delete(date)
        const pending = pendingRecent
        pendingRecent = []
        for (const record of pending) await store.usage.recent.put(record.id, record)
        lastFlushAt = nowIso()
        await trim({ auditDeletion: true })
      } catch (error) {
        warnOnce(`使用观测落盘失败(下轮重试): ${error?.message ?? error}`)
      }
    })()
    try {
      await flushing
    } finally {
      flushing = null
    }
  }

  /**
   * 保留期裁剪:先删超龄,再删超量;有实际删除才留一条 `usage-pruned` 审计。
   * 同时裁剪内存镜像(页面读的是内存)。
   */
  async function trim({ auditDeletion = true } = {}) {
    if (!available) return { days: 0, recent: 0 }
    const ms = now()
    let prunedDays = 0
    let prunedRecent = 0
    try {
      if (retentionDays > 0) {
        const cutoff = dayOf(ms - retentionDays * dayMs)
        for (const [id, value] of store.usage.days.entries()) {
          const date = String(value?.date ?? '')
          if (date !== '' && date < cutoff) {
            await store.usage.days.delete(id)
            days.delete(date)
            delta.delete(date)
            prunedDays += 1
          }
        }
      }
      const recentCutoff = new Date(ms - USAGE_RECENT_DAYS * dayMs).toISOString()
      const rows = []
      for (const [id, value] of store.usage.recent.entries()) rows.push([id, value])
      rows.sort((a, b) => (String(a[1]?.ts ?? '') < String(b[1]?.ts ?? '') ? -1 : 1))
      const excess = rows.length > USAGE_RECENT_MAX ? rows.length - USAGE_RECENT_MAX : 0
      for (let i = 0; i < rows.length; i += 1) {
        const [id, value] = rows[i]
        const ts = String(value?.ts ?? '')
        if (i < excess || (ts !== '' && ts < recentCutoff)) {
          await store.usage.recent.delete(id)
          prunedRecent += 1
        }
      }
      // 内存镜像按同一口径裁剪(明细已是最新在前)。
      const mirrorCutoff = new Date(ms - USAGE_RECENT_DAYS * dayMs).toISOString()
      const kept = recent.filter((r) => r.ts >= mirrorCutoff)
      recent.length = 0
      recent.push(...kept.slice(0, USAGE_RECENT_MAX))
      if (retentionDays > 0) {
        const cutoff = dayOf(ms - retentionDays * dayMs)
        for (const date of [...days.keys()]) if (date < cutoff) days.delete(date)
      }
    } catch (error) {
      warnOnce(`使用观测清理失败(下次重试): ${error?.message ?? error}`)
      return { days: 0, recent: 0 }
    }
    const pruned = { days: prunedDays, recent: prunedRecent }
    if (auditDeletion && (prunedDays > 0 || prunedRecent > 0)) {
      lastPrunedAt = nowIso()
      await bestEffort(audit?.write?.('usage-pruned', `日汇总删 ${prunedDays} 条 / 明细删 ${prunedRecent} 条(保留 ${retentionDays} 天 / ${USAGE_RECENT_DAYS} 天)`) ?? Promise.resolve())
    }
    return pruned
  }

  /** 页面读取:日汇总(倒序)+ 合计 + 明细(新→旧)。全部来自内存镜像,不查磁盘。 */
  function snapshot({ days: dayLimit = 14, recent: recentLimit = 20 } = {}) {
    const nDays = Math.min(90, Math.max(1, Math.trunc(Number(dayLimit) || 14)))
    const nRecent = Math.min(100, Math.max(1, Math.trunc(Number(recentLimit) || 20)))
    const totals = {}
    for (const counters of days.values()) {
      for (const [key, value] of Object.entries(counters)) bump(totals, key, Number(value) || 0)
    }
    const relevanceCount = totals['inject.relevanceCount'] ?? 0
    const confCount = totals['inject.confCount'] ?? 0
    const quality = relevanceCount > 0 || confCount > 0
      ? {
          rAvg: relevanceCount > 0 ? round2((totals['inject.relevanceSum'] ?? 0) / relevanceCount) : 0,
          cAvg: confCount > 0 ? round2((totals['inject.confSum'] ?? 0) / confCount) : 0,
          lowTrust: totals['inject.lowTrust'] ?? 0,
          unverified: totals['inject.unverified'] ?? 0,
        }
      : null
    const dayRows = [...days.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, nDays)
      .map(([date, counters]) => ({ date, counters: { ...counters } }))
    return {
      available,
      days: dayRows,
      totals: { counters: totals, quality },
      // 旧记录(或从盘读回、上游没带 quality 的)按 items 现场补聚合,读侧形状始终完整
      recent: recent.slice(0, nRecent).map((r) => ({
        ...r,
        ...(r.quality === undefined && Array.isArray(r.items) && r.items.length > 0
          ? { quality: summarizeQuality(r.items) }
          : {}),
      })),
      retention: { days: retentionDays, recentDays: USAGE_RECENT_DAYS, recentMax: USAGE_RECENT_MAX },
      lastFlushAt,
      lastPrunedAt,
      error: lastError === '' ? null : lastError,
    }
  }

  /**
   * R9 只读统计(§14.7):条数 / 体积估算 / 重复候选 / 过期候选 / 队列健康。
   * 只读、不写审计;结果缓存 `USAGE_QUERY_CACHE_MS`。
   */
  function poolStats({ refresh = false } = {}) {
    const ms = now()
    if (!refresh && poolCache.value !== null && ms - poolCache.at < USAGE_QUERY_CACHE_MS) return poolCache.value
    const value = computePoolStats(ms)
    poolCache = { at: ms, value }
    return value
  }

  function computePoolStats(ms) {
    const counts = { active: 0, staged: 0, archived: 0, hidden: 0, fact: 0, lesson: 0, episode: 0 }
    const duplicateGroups = new Map()
    const expired = { states: 0, validUntil: 0 }
    const volume = {}
    let scanned = 0
    let partial = false
    const bumpVolume = (table, value) => {
      volume[table] = (volume[table] ?? 0) + Buffer.byteLength(JSON.stringify(value), 'utf8')
    }
    const expireGraceMs = 7 * dayMs
    for (const [, m] of store.memories.entries()) {
      if (scanned >= USAGE_POOL_SCAN_MAX) {
        partial = true
        break
      }
      scanned += 1
      bumpVolume('memories', m)
      if (m.status === 'staged') counts.staged += 1
      else if (m.status === 'archived') counts.archived += 1
      else counts.active += 1
      if (m.hidden === true) counts.hidden += 1
      if (counts[m.kind] !== undefined) counts[m.kind] += 1
      const entity = typeof m.entity === 'string' ? m.entity.trim().toLowerCase() : ''
      const head = typeof m.content === 'string' ? m.content.slice(0, 40) : ''
      const key = `${m.kind}|${entity}|${head}`
      duplicateGroups.set(key, (duplicateGroups.get(key) ?? 0) + 1)
      if (typeof m.expiresAt === 'string' && Date.parse(m.expiresAt) + 2 * expireGraceMs < ms) expired.states += 1
      if (typeof m.validUntil === 'string' && Date.parse(m.validUntil) + expireGraceMs < ms) expired.validUntil += 1
    }
    let hotUndigested = 0
    let hotTotal = 0
    for (const [, h] of store.hotbuffer.entries()) {
      if (hotTotal + hotUndigested >= USAGE_POOL_SCAN_MAX) {
        partial = true
        break
      }
      hotTotal += 1
      if (!h.digested) hotUndigested += 1
      bumpVolume('hotbuffer', h)
    }
    let outboxPending = 0
    let outboxDead = 0
    let oldestPendingAgeDays = 0
    for (const [, o] of store.outbox.entries()) {
      bumpVolume('outbox', o)
      if (o.status === 'dead') outboxDead += 1
      else if (o.status === 'pending' || o.status === 'extracting') {
        outboxPending += 1
        const age = (ms - Date.parse(o.createdAt)) / dayMs
        if (Number.isFinite(age) && age > oldestPendingAgeDays) oldestPendingAgeDays = Math.round(age * 10) / 10
      }
    }
    let auditTotal = 0
    let auditOldest = ''
    for (const [, a] of store.audit.entries()) {
      auditTotal += 1
      bumpVolume('audit', a)
      if (typeof a.ts === 'string' && (auditOldest === '' || a.ts < auditOldest)) auditOldest = a.ts
    }
    for (const [name, table] of [['usageDays', store.usage?.days], ['usageRecent', store.usage?.recent]]) {
      if (table === undefined) continue
      for (const [, v] of table.entries()) bumpVolume(name, v)
    }
    let groups = 0
    let maxGroup = 0
    for (const size of duplicateGroups.values()) {
      if (size < 2) continue
      groups += 1
      if (size > maxGroup) maxGroup = size
    }
    const totalBytes = Object.values(volume).reduce((a, b) => a + b, 0)
    return {
      ok: true,
      partial,
      generatedAt: new Date(ms).toISOString(),
      counts: { ...counts, hotTotal, hotUndigested, outboxPending, outboxDead, auditTotal },
      volume: { ...volume, totalBytes },
      duplicates: { groups, maxGroup },
      expired,
      queue: { outboxPending, outboxDead, oldestPendingAgeDays, hotUndigested },
      audit: { total: auditTotal, oldest: auditOldest === '' ? null : auditOldest },
      cacheTtlMs: USAGE_QUERY_CACHE_MS,
    }
  }

  /** 进程退出/热重建:停定时器,补一次落盘(不阻塞退出)。 */
  async function dispose() {
    closed = true
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (trimTimer !== null) {
      clearInterval(trimTimer)
      trimTimer = null
    }
    await bestEffort(flush())
  }

  /** boot 时启用:读回镜像 + 起清理定时器(测试可跳过定时器)。 */
  async function start({ scheduleTrim = true } = {}) {
    if (!available) {
      log('使用观测不可用(storageDomain 缺席或 usageLog=false):用量不落盘')
      return
    }
    await open()
    if (scheduleTrim && trimTimer === null) {
      trimTimer = setInterval(() => bestEffort(trim({ auditDeletion: true })), USAGE_TRIM_INTERVAL_MS)
      trimTimer.unref?.()
    }
  }

  return {
    constants: {
      RECENT_DAYS: USAGE_RECENT_DAYS,
      RECENT_MAX: USAGE_RECENT_MAX,
      NO_HITS_DAILY_MAX: USAGE_RECENT_NO_HITS_DAILY_MAX,
      FLUSH_DEBOUNCE_MS: USAGE_FLUSH_DEBOUNCE_MS,
      TRIM_INTERVAL_MS: USAGE_TRIM_INTERVAL_MS,
      QUERY_CACHE_MS: USAGE_QUERY_CACHE_MS,
    },
    available,
    isOpen: () => opened,
    start,
    open,
    recordInjection,
    recordCounters,
    flush,
    trim,
    snapshot,
    poolStats,
    dispose,
    status: () => ({
      available,
      persisted: store?.usagePersisted === true,
      lastFlushAt,
      lastPrunedAt,
      error: lastError === '' ? null : lastError,
    }),
  }
}
