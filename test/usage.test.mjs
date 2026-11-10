/**
 * §14 使用观测核心(0.6.7,S12a):计数 / 明细分层 / 落盘 read-merge-write /
 * 保留期裁剪 / 快照 / R9 只读统计 / 不可用降级。全部用注入时钟,不 sleep。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { memoryTable } from './helpers.mjs'
import {
  createUsage, localDay, isLowTrust, summarizeQuality,
  USAGE_RECENT_DAYS, USAGE_RECENT_MAX, USAGE_RECENT_NO_HITS_DAILY_MAX,
} from '../lib/usage.js'

const DAY = 86_400_000
const NOW = Date.parse('2026-11-10T12:00:00.000Z')
const iso = (ms) => new Date(ms).toISOString()
const today = () => localDay(NOW)

function makeStore({ persisted = true, days, recent, memories, hotbuffer, outbox, audit } = {}) {
  return {
    usage: { days: days ?? memoryTable(), recent: recent ?? memoryTable() },
    usagePersisted: persisted,
    memories: memories ?? memoryTable(),
    hotbuffer: hotbuffer ?? memoryTable(),
    outbox: outbox ?? memoryTable(),
    audit: audit ?? memoryTable(),
  }
}

function makeUsage(store, { cfg = {}, auditLog = [], now = () => NOW } = {}) {
  const audit = { write: async (kind, detail) => auditLog.push([kind, detail]) }
  return { usage: createUsage({ store, cfg, audit, now, logger: { info: () => {} } }), auditLog }
}

function injectRow(overrides = {}) {
  return {
    ts: iso(NOW), mode: 'inject', records: 3, chars: 420, sessionId: 'sess-1', workspaceLabel: 'proj',
    ...overrides,
  }
}

test('使用观测:注入成功累加计数、写明细并带质量聚合', async () => {
  const store = makeStore()
  const { usage } = makeUsage(store)
  await usage.start({ scheduleTrim: false })
  const items = [
    { id: 'm_1', r: 0.72, s: 0.41, c: 0.8, e: 1.3, src: 'user', k: 'fact', v: true },
    { id: 'm_2', r: 0.3, s: 0.2, c: 0.4, e: -0.5, src: 'assistant', k: 'lesson' },
    { id: 'm_3', r: 0.55, s: 0.3, c: 0.7, e: 0.2, src: 'code', k: 'fact', v: false },
  ]
  usage.recordInjection(injectRow({ hitIds: ['m_1', 'm_2', 'm_3'], items, quality: summarizeQuality(items) }))
  const snap = usage.snapshot()
  const counters = snap.totals.counters
  assert.equal(counters['inject.inject'], 1)
  assert.equal(counters['inject.records'], 3)
  assert.equal(counters['inject.chars'], 420)
  assert.equal(counters['inject.relevanceCount'], 3)
  assert.equal(counters['inject.confCount'], 3)
  assert.equal(counters['inject.lowTrust'], 1, 'assistant 来源 / c<0.5 / e<0 任一条即低可信')
  assert.equal(counters['inject.unverified'], 1, 'v=false 计一次未核验')
  assert.equal(snap.totals.quality.rAvg, 0.52)
  assert.equal(snap.totals.quality.cAvg, 0.63)
  assert.equal(snap.recent.length, 1)
  assert.equal(snap.recent[0].quality.n, 3)
  assert.equal(snap.recent[0].items.length, 3)
  assert.equal(snap.recent[0].hitIds.length, 3)
  await usage.dispose()
})

test('使用观测:环境类跳过只进日汇总不写明细,no-hits 走每日采样上限', async () => {
  const store = makeStore()
  const { usage } = makeUsage(store)
  await usage.start({ scheduleTrim: false })
  for (const reason of ['workspace-disabled', 'workspace-disabled', 'auto-recall-off', 'subagent']) {
    usage.recordInjection(injectRow({ mode: 'skip', reason, records: 0, chars: 0 }))
  }
  assert.equal(usage.snapshot().recent.length, 0, '环境类跳过不产生明细')
  for (let i = 0; i < USAGE_RECENT_NO_HITS_DAILY_MAX + 5; i += 1) {
    usage.recordInjection(injectRow({ mode: 'skip', reason: 'no-hits', records: 0, chars: 0 }))
  }
  const snap = usage.snapshot()
  assert.equal(snap.totals.counters['skip.workspace-disabled'], 2)
  assert.equal(snap.totals.counters['skip.auto-recall-off'], 1)
  assert.equal(snap.totals.counters['skip.subagent'], 1)
  assert.equal(snap.totals.counters['skip.no-hits'], USAGE_RECENT_NO_HITS_DAILY_MAX + 5, '日汇总记全量')
  assert.equal(snap.recent.length, USAGE_RECENT_NO_HITS_DAILY_MAX, '明细只留采样上限')
  await usage.dispose()
})

test('使用观测:落盘 read-merge-write(不重复累加)且明细写入独立域', async () => {
  const days = memoryTable()
  // 上一次运行已经写过今天:5 次 no-hits
  await days.put(`u_${today()}`, { id: `u_${today()}`, date: today(), counters: { 'skip.no-hits': 5 }, updatedAt: iso(NOW - 1000) })
  const store = makeStore({ days })
  const { usage } = makeUsage(store)
  await usage.start({ scheduleTrim: false })
  assert.equal(usage.snapshot().totals.counters['skip.no-hits'], 5, '启动时读回已有计数')
  usage.recordInjection(injectRow({ mode: 'skip', reason: 'no-hits', records: 0, chars: 0 }))
  await usage.flush()
  const stored = await days.get(`u_${today()}`)
  assert.equal(stored.counters['skip.no-hits'], 6, 'read-merge-write: 5 + 1,不重复累加')
  assert.equal(store.usage.recent.size, 1, 'no-hits 明细写入 recent 表')
  await usage.flush()
  assert.equal((await days.get(`u_${today()}`)).counters['skip.no-hits'], 6, '无新事件时重复 flush 不改变计数')
  await usage.dispose()
})

test('使用观测:保留期裁剪(日汇总按配置天数、明细按 7 天),删除后写 usage-pruned', async () => {
  const days = memoryTable()
  const recent = memoryTable()
  const oldDay = localDay(NOW - 40 * DAY)
  await days.put(`u_${oldDay}`, { id: `u_${oldDay}`, date: oldDay, counters: { 'inject.inject': 2 }, updatedAt: iso(NOW - 40 * DAY) })
  await recent.put('r_old', { id: 'r_old', ts: iso(NOW - (USAGE_RECENT_DAYS + 1) * DAY), mode: 'inject', records: 1, chars: 10, sessionId: 's' })
  const store = makeStore({ days, recent })
  const auditLog = []
  const { usage } = makeUsage(store, { auditLog, cfg: { usageRetentionDays: 30 } })
  const pruned = await usage.trim()
  assert.deepEqual(pruned, { days: 1, recent: 1 })
  assert.equal(days.size, 0, '超过 30 天的日汇总被删')
  assert.equal(recent.size, 0, '超过 7 天的明细被删')
  assert.equal(auditLog.length, 1)
  assert.equal(auditLog[0][0], 'usage-pruned')
})

test('使用观测:明细超过 2000 条硬上限时删最旧,且日汇总 0 表示不清理', async () => {
  const days = memoryTable()
  const recent = memoryTable()
  for (let i = 0; i < USAGE_RECENT_MAX + 5; i += 1) {
    const id = `r_${String(i).padStart(6, '0')}`
    await recent.put(id, { id, ts: iso(NOW - i * 1000), mode: 'inject', records: 1, chars: 5, sessionId: 's' })
  }
  const oldDay = localDay(NOW - 100 * DAY)
  await days.put(`u_${oldDay}`, { id: `u_${oldDay}`, date: oldDay, counters: {}, updatedAt: iso(NOW - 100 * DAY) })
  const store = makeStore({ days, recent })
  const { usage } = makeUsage(store, { cfg: { usageRetentionDays: 0 } })
  await usage.trim()
  assert.equal(recent.size, USAGE_RECENT_MAX, '明细保留硬上限条数')
  assert.equal(days.size, 1, 'usageRetentionDays=0 时不删日汇总')
  await usage.dispose()
})

test('使用观测:不可用降级(域未持久化 / usageLog=false)时只读为空、不写盘', async () => {
  for (const [store, cfg] of [[makeStore({ persisted: false }), {}], [makeStore(), { usageLog: false }]]) {
    const { usage } = makeUsage(store, { cfg })
    assert.equal(usage.available, false)
    await usage.start({ scheduleTrim: false })
    usage.recordInjection(injectRow())
    usage.recordCounters({ 'extract.ok': 1 })
    await usage.flush()
    assert.equal(store.usage.days.size, 0)
    assert.equal(store.usage.recent.size, 0)
    const snap = usage.snapshot()
    assert.equal(snap.available, false)
    assert.equal(snap.recent.length, 0)
    await usage.dispose()
  }
})

test('使用观测:R9 只读统计(条数/重复/过期/队列/体积)与 60s 缓存', async () => {
  const memories = memoryTable()
  const hotbuffer = memoryTable()
  const outbox = memoryTable()
  const audit = memoryTable()
  await memories.put('m_1', {
    id: 'm_1', kind: 'fact', entity: 'Dsh', content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1',
    status: 'active', expiresAt: iso(NOW - 30 * DAY), workspaceId: 'w', sessionId: 's', evidence: [],
  })
  await memories.put('m_2', {
    id: 'm_2', kind: 'fact', entity: 'dsh', content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2',
    status: 'active', validUntil: iso(NOW - 30 * DAY), workspaceId: 'w', sessionId: 's', evidence: [],
  })
  await memories.put('m_3', { id: 'm_3', kind: 'lesson', content: 'bbb', status: 'staged', workspaceId: 'w', sessionId: 's', evidence: [] })
  await memories.put('m_4', { id: 'm_4', kind: 'episode', content: 'ccc', status: 'archived', hidden: true, workspaceId: 'w', sessionId: 's', evidence: [] })
  await hotbuffer.put('hb_1', { id: 'hb_1', digested: false, content: 'x' })
  await outbox.put('o_1', { id: 'o_1', status: 'pending', createdAt: iso(NOW - 2 * DAY) })
  await outbox.put('o_2', { id: 'o_2', status: 'dead', createdAt: iso(NOW - 5 * DAY) })
  await audit.put('a_1', { id: 'a_1', ts: iso(NOW - 3 * DAY), kind: 'x', detail: 'y' })
  const store = makeStore({ memories, hotbuffer, outbox, audit })
  const { usage } = makeUsage(store)
  const stats = usage.poolStats()
  assert.equal(stats.ok, true)
  assert.equal(stats.partial, false)
  assert.equal(stats.counts.active, 2)
  assert.equal(stats.counts.staged, 1)
  assert.equal(stats.counts.archived, 1)
  assert.equal(stats.counts.hidden, 1)
  assert.equal(stats.counts.hotUndigested, 1)
  assert.equal(stats.counts.outboxPending, 1)
  assert.equal(stats.counts.outboxDead, 1)
  assert.equal(stats.duplicates.groups, 1, '同 kind+entity(规范化)+正文前 40 字符 = 重复候选组')
  assert.equal(stats.duplicates.maxGroup, 2)
  assert.equal(stats.expired.states, 1)
  assert.equal(stats.expired.validUntil, 1)
  assert.equal(stats.queue.oldestPendingAgeDays, 2)
  assert.equal(stats.audit.total, 1)
  assert.ok(stats.volume.totalBytes > 0)
  assert.equal(stats.cacheTtlMs, 60_000)
  // 缓存:数据变了但 TTL 内仍返回旧值;refresh 绕过缓存
  await memories.put('m_5', { id: 'm_5', kind: 'fact', content: 'ddd', status: 'active', workspaceId: 'w', sessionId: 's', evidence: [] })
  assert.equal(usage.poolStats().counts.active, 2, 'TTL 内走缓存')
  assert.equal(usage.poolStats({ refresh: true }).counts.active, 3, 'refresh 重新计算')
})

test('使用观测:质量分档与聚合函数的边界', () => {
  assert.equal(isLowTrust({ src: 'assistant', c: 0.9, e: 1 }), true)
  assert.equal(isLowTrust({ src: 'user', c: 0.8, e: 1 }), false)
  assert.equal(isLowTrust({ src: 'user', c: 0.4, e: 1 }), true)
  assert.equal(isLowTrust({ src: 'user', c: 0.9, e: -0.1 }), true)
  assert.equal(isLowTrust(null), false)
  assert.equal(summarizeQuality([]), undefined)
  const q = summarizeQuality([
    { r: 0.5, s: 0.3, c: 0.7, e: 1, src: 'user', k: 'fact', v: true },
    { r: 0.2, s: 0.1, c: 0.3, e: -0.2, src: 'quote', k: 'lesson', v: false },
  ])
  assert.equal(q.n, 2)
  assert.equal(q.rAvg, 0.35)
  assert.equal(q.rMin, 0.2)
  assert.equal(q.cAvg, 0.5)
  assert.equal(q.cMin, 0.3)
  assert.equal(q.eAvg, 0.4)
  assert.equal(q.lowTrust, 1)
  assert.equal(q.unverified, 1)
})
