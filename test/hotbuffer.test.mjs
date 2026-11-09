import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHotBuffer, renderOriginal } from '../lib/hotbuffer.js'
import { memoryTable, testConfig } from './helpers.mjs'
import { DAY_MS } from '../lib/util.js'

function makeBuffer(overrides = {}, { restoreCheck } = {}) {
  const table = memoryTable()
  const cfg = testConfig({
    hotBufferTtlHours: 48,
    hotBufferRetainDays: 7,
    hotBufferMaxEntries: 1,
    ...overrides,
  })
  let fuse = 0
  const audits = []
  const logs = []
  const buffer = createHotBuffer({
    store: { hotbuffer: table },
    search: { upsertHot: () => {}, removeHot: () => {} },
    cfg,
    embedder: { available: async () => false, model: 'none' },
    audit: { write: async (kind, detail, sessionId) => { audits.push({ kind, detail, sessionId }) } },
    logger: { info: (m) => logs.push(String(m)), warn: (m) => logs.push(`warn:${m}`) },
    onFuse: () => { fuse += 1 },
    restoreCheck,
  })
  return { buffer, table, cfg, fuse: () => fuse, audits, logs }
}

test('A9:sweep 不得删除 hidden L0(hidden 是遗忘区间的唯一元数据)', async () => {
  const { buffer, table } = makeBuffer()
  const now = Date.now()
  const old = new Date(now - 8 * DAY_MS).toISOString()
  const base = {
    sessionId: 's', workspaceId: '/x', turn: 1, startSeq: 1, endSeq: 2,
    content: 'x', digested: true, createdAt: old,
  }
  await table.put('hb_visible', { ...base, id: 'hb_visible' })
  await table.put('hb_hidden', { ...base, id: 'hb_hidden', hidden: true })
  await table.put('hb_hidden_dead', { ...base, id: 'hb_hidden_dead', hidden: true, deadLettered: true })

  await buffer.sweep(now)

  assert.equal(table.get('hb_visible'), undefined, '普通 digested L0 按 retainDays 删除')
  assert.ok(table.get('hb_hidden') !== undefined, 'hidden digested L0 必须保留')
  assert.ok(table.get('hb_hidden_dead') !== undefined, 'hidden 死信也不能删')
})

test('A9:hidden L0 不计入热缓冲保险丝的未消化计数', async () => {
  const { buffer, table, fuse } = makeBuffer({ hotBufferMaxEntries: 1 })
  const now = new Date().toISOString()
  const base = {
    sessionId: 's', workspaceId: '/x', startSeq: 1, endSeq: 2,
    content: 'hidden', digested: false, hidden: true, createdAt: now,
  }
  await table.put('hb_h1', { ...base, id: 'hb_h1', turn: 1 })
  await table.put('hb_h2', { ...base, id: 'hb_h2', turn: 2 })

  await buffer.writeTurn({
    sessionId: 's', turn: 3, startSeq: 3, endSeq: 4, cwd: '/x',
    userTexts: ['hello'], assistantTexts: ['world'], toolCalls: [], thinkingTexts: [], truncated: false,
  }, { id: '/x', label: 'x' })

  assert.equal(fuse(), 0, '只有 1 条真正未消化的新 L0,不应触发保险丝')
})

test('R8a(0.6.6):工具输出上限只对显式传参生效——整理输入瘦身,recall 展开原文仍是全文', () => {
  // 背景(docs/legacy/REVIEW.md R8):renderOriginal 同时供后台整理与 memory_recall 展开原文使用,
  // 全局截断会把"展开原文"一并破坏。所以上限只能由调用方显式传 opts 打开。
  const cfg = testConfig(undefined)
  const okBody = `${'ok-log-line\n'.repeat(2000)}OK-LOG-TAIL`
  const errBody = `${'e'.repeat(20000)}ERROR-SIGNATURE-AT-END`
  const pkg = {
    userTexts: ['跑一下构建'],
    assistantTexts: ['构建失败了,我先看日志'],
    thinkingTexts: [],
    truncated: false,
    toolCalls: [
      { callId: 'c1', name: 'bash', args: '{"cmd":"build"}', output: okBody, isError: false },
      { callId: 'c2', name: 'bash', args: '{"cmd":"install"}', output: errBody, isError: true },
    ],
  }
  // 不传 opts = 工具层 expandOriginal 的老口径:一个字都不截
  const full = renderOriginal(pkg, cfg)
  assert.ok(full.includes('OK-LOG-TAIL') && full.includes('ERROR-SIGNATURE-AT-END'), '默认不截工具输出')

  const slim = renderOriginal(pkg, cfg, { toolOutputMaxChars: 8000 })
  assert.ok(slim.length < 20_000, `整理输入应显著变短,实际 ${slim.length} / 全文 ${full.length}`)
  assert.ok(!slim.includes('OK-LOG-TAIL'), '成功输出按头部截短(结论/摘要在前)')
  assert.match(slim, /\[截断,原 \d+ 字符\]/, '截断要留标记,不能静默丢')
  assert.ok(slim.includes('跑一下构建') && slim.includes('构建失败了'), '用户/助手正文不截')
  assert.ok(slim.includes('ERROR-SIGNATURE-AT-END'), '失败调用的报错特征(常在日志尾部)要保留')
})

// ── R16(0.6.6):用户主动关掉提炼后,未消化 L0 副本要有上限 ─────────────────────

/** 一条超期的未消化 L0 副本(createdAt 200 小时前)。 */
async function putOldUndigested(table, id, nowMs = Date.now()) {
  const entry = {
    id, sessionId: 's', workspaceId: '/x', turn: 1, startSeq: 1, endSeq: 2,
    content: '旧回合原文', digested: false,
    createdAt: new Date(nowMs - 200 * 3_600_000).toISOString(),
  }
  await table.put(id, entry)
  return entry
}

test('R16(0.6.6):提炼关闭 + 未消化超期 + 会话日志可读回 → 删副本并留审计', async () => {
  const now = Date.now()
  const { buffer, table, audits } = makeBuffer(
    { extractEnabled: false, hotBufferUndigestedTtlHours: 168 },
    { restoreCheck: async () => true },
  )
  await putOldUndigested(table, 'hb_old', now)
  await buffer.sweep(now)
  assert.equal(table.get('hb_old'), undefined, '超期未消化副本删除(原文在会话日志里)')
  const dropped = audits.filter((a) => a.kind === 'hot-dropped-undigested')
  assert.equal(dropped.length, 1, JSON.stringify(audits))
  assert.match(dropped[0].detail, /提炼已关闭/, '审计要写明原因')
})

test('R16(0.6.6):会话日志读不回 → 保留并告警(可能是唯一副本)', async () => {
  const now = Date.now()
  const { buffer, table, audits, logs } = makeBuffer(
    { extractEnabled: false, hotBufferUndigestedTtlHours: 168 },
    { restoreCheck: async () => false },
  )
  await putOldUndigested(table, 'hb_keep', now)
  await buffer.sweep(now)
  assert.ok(table.get('hb_keep') !== undefined, '读不回必须保留,不能默认真删')
  assert.equal(audits.filter((a) => a.kind === 'hot-retained-undigested').length, 1, '保留要留审计')
  assert.equal(logs.filter((l) => l.startsWith('warn:')).length, 1, '要告警一行')
  // 周期清扫每 30 分钟一轮:同一进程内不反复刷审计/日志
  await buffer.sweep(now)
  assert.equal(audits.filter((a) => a.kind === 'hot-retained-undigested').length, 1, '只告警一次')
  assert.equal(logs.filter((l) => l.startsWith('warn:')).length, 1)
})

test('R16(0.6.6):提炼没关(服务临时降级)时,未消化超期也不删', async () => {
  const now = Date.now()
  const { buffer, table, audits } = makeBuffer(
    { extractEnabled: true, hotBufferUndigestedTtlHours: 168 },
    { restoreCheck: async () => true },
  )
  await putOldUndigested(table, 'hb_live', now)
  await buffer.sweep(now)
  assert.ok(table.get('hb_live') !== undefined, '服务降级期间不过期(提炼恢复后继续消化)')
  assert.equal(audits.length, 0, '不产生丢弃/保留审计(不是用户关掉提炼)')
})

test('R16(0.6.6):hotBufferUndigestedTtlHours=0 表示关掉该上限', async () => {
  const now = Date.now()
  const { buffer, table } = makeBuffer(
    { extractEnabled: false, hotBufferUndigestedTtlHours: 0 },
    { restoreCheck: async () => true },
  )
  await putOldUndigested(table, 'hb_nolimit', now)
  await buffer.sweep(now)
  assert.ok(table.get('hb_nolimit') !== undefined, '0 = 不删(维持旧行为)')
})
