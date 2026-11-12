/**
 * §4.4「节奏:信号 → 周回顾」纯函数契约(lib/soulreview.js)。
 *
 * 这一层决定"什么时候允许产出 SOUL 提议",规则一旦漂移(间隔失效、不跨天也算重复、
 * prompt 里没有写死的判据),提议就会重新变成每天都能刷的东西。所以这里逐条钉住:
 * 间隔、保留期、跨天计数、历史截断、prompt 块的三条规则字样与 1200 字符上限。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DAY_MS, buildReviewBlock, collectSignals, isReviewDue, lastReviewTs, signalSpanDays,
} from '../lib/soulreview.js'
import { memoryTable } from './helpers.mjs'

/** 固定在 UTC 正午:减几分钟不会跨日,"同一天"用例才稳定。 */
const BASE = Date.parse('2026-11-12T12:00:00.000Z')
const isoOf = (ms) => new Date(ms).toISOString()

/** 造一条信号(字段与 §4.4 的 soul_signals 记录一致)。 */
function signal(id, ms, quote, extra = {}) {
  return { id, ts: isoOf(ms), sessionId: 's-review', quote, status: 'open', ...extra }
}

test('isReviewDue:没有上次回顾立即到期;间隔内不到期,满间隔到期', () => {
  const intervalDays = 7
  assert.equal(isReviewDue({ lastRunTs: '', nowMs: BASE, intervalDays }), true, '从未回顾 → 到期')
  assert.equal(isReviewDue({ lastRunTs: undefined, nowMs: BASE, intervalDays }), true, '缺字段 → 到期')
  const last = isoOf(BASE - 3 * DAY_MS)
  assert.equal(isReviewDue({ lastRunTs: last, nowMs: BASE, intervalDays }), false, '3 天前刚回顾 → 未到期')
  assert.equal(isReviewDue({ lastRunTs: isoOf(BASE - 7 * DAY_MS), nowMs: BASE, intervalDays }), true, '满 7 天 → 到期')
  assert.equal(isReviewDue({ lastRunTs: isoOf(BASE - 8 * DAY_MS), nowMs: BASE, intervalDays }), true, '超过 7 天 → 到期')
  // 坏时间戳不能把机制永久锁死:按"没有上次记录"处理
  assert.equal(isReviewDue({ lastRunTs: 'not-a-time', nowMs: BASE, intervalDays }), true)
  // 配置防线:非正间隔 = 每次都可回顾(不静默变成永不触发)
  assert.equal(isReviewDue({ lastRunTs: isoOf(BASE), nowMs: BASE, intervalDays: 0 }), true)
})

test('lastReviewTs:扫 audit 里 soul-review-run 的最大 ts,别的审计不算', () => {
  const store = { audit: memoryTable() }
  assert.equal(lastReviewTs(store), '', '空审计 → 空串')
  store.audit.put('a1', { id: 'a1', ts: isoOf(BASE - 10 * DAY_MS), kind: 'soul-review-run', detail: '' })
  store.audit.put('a2', { id: 'a2', ts: isoOf(BASE - 1 * DAY_MS), kind: 'soul-review-run', detail: '' })
  // 更晚但不是回顾:不能推进间隔
  store.audit.put('a3', { id: 'a3', ts: isoOf(BASE + DAY_MS), kind: 'extract-batch-done', detail: '' })
  assert.equal(lastReviewTs(store), isoOf(BASE - DAY_MS))
  assert.equal(lastReviewTs({}), '', '没有 audit 表也不能炸')
})

test('collectSignals:只收保留期内的,按 ts 升序;0 天 = 不按时间裁剪', () => {
  const store = { soulSignals: memoryTable() }
  store.soulSignals.put('s_new', signal('s_new', BASE, '别总给我列表'))
  store.soulSignals.put('s_old', signal('s_old', BASE - 40 * DAY_MS, '说人话'))
  store.soulSignals.put('s_mid', signal('s_mid', BASE - 2 * DAY_MS, '先给结论'))
  store.soulSignals.put('s_mid2', signal('s_mid2', BASE - 5 * DAY_MS, '别奉承'))

  const retained = collectSignals(store, { nowMs: BASE, retentionDays: 30 })
  assert.deepEqual(retained.map((row) => row.id), ['s_mid2', 's_mid', 's_new'], '老的被裁、按 ts 升序')
  assert.deepEqual(collectSignals(store, { nowMs: BASE, retentionDays: 0 }).map((row) => row.id).sort(),
    ['s_mid', 's_mid2', 's_new', 's_old'], '0 = 不清理(全部返回)')
  assert.deepEqual(collectSignals({}, { nowMs: BASE, retentionDays: 30 }), [], '没有表也不能炸')
})

test('signalSpanDays:按 UTC 日期去重计数(跨天证据的硬前提)', () => {
  assert.equal(signalSpanDays([]), 0)
  const sameDay = [
    signal('s1', BASE, 'a'),
    signal('s2', BASE - 60_000, '同一天的另一个说法'),
  ]
  assert.equal(signalSpanDays(sameDay), 1, '同一天说两遍只算 1 天')
  const crossDay = [...sameDay, signal('s3', BASE - DAY_MS, 'b')]
  assert.equal(signalSpanDays(crossDay), 2, '跨一天 → 2 天')
  assert.equal(signalSpanDays([{ ts: 'bad' }]), 0, '坏时间戳不计入')
})

test('buildReviewBlock:写明周回顾 + 三条写死的规则 + 信号/历史/当前 SOUL', () => {
  const text = buildReviewBlock({
    signals: [signal('s1', BASE - DAY_MS, '别总给我列表,先给结论')],
    history: [{ ts: isoOf(BASE - 3 * DAY_MS), status: '已忽略(太啰嗦)', content: '我说话要简短' }],
    soulText: '我先算最坏的那条路。',
  })
  assert.ok(text.includes('周回顾'), '说清这一轮是周回顾,不是普通提炼')
  assert.ok(text.includes('不是普通提炼'), '与常态提炼区分')
  // 规则①:跨天 ≥2 次才算重复
  assert.ok(text.includes('跨天') && text.includes('≥2 次'), '跨天重复判据在 prompt 里')
  // 规则②:判断形态,不是情形规则
  assert.ok(text.includes('判断'), '要求写成判断')
  assert.ok(text.includes('冲突时选哪边') && text.includes('什么时候会害我'), '判断 = 选边 + 依据 + 失效条件')
  assert.ok(text.includes('遇到 X 就做 Y'), '明确排除情形规则')
  // 规则③:宁缺毋滥
  assert.ok(text.includes('null'), '没有新东西就给 null')
  // 材料:日期 + 原话 / 过去结局 / 当前 SOUL 摘要
  assert.ok(text.includes('2026-11-11'), '信号带 UTC 日期')
  assert.ok(text.includes('别总给我列表,先给结论'), '信号带用户原话')
  assert.ok(text.includes('已忽略(太啰嗦)') && text.includes('我说话要简短'), '过去提议的结局进 prompt')
  assert.ok(text.includes('我先算最坏的那条路'), '当前 SOUL 摘要进 prompt(防重复提议)')
  assert.ok(text.length <= 1200, `块长度 ${text.length} 应 ≤1200`)
})

test('buildReviewBlock:信号最多 12 条、历史最多 5 条;超预算也不超 1200 字符且规则不丢', () => {
  const signals = Array.from({ length: 40 }, (_, i) => signal(`s${i}`, BASE - i * 3600_000, `第${i}条原话`))
  const history = Array.from({ length: 12 }, (_, i) => ({ ts: isoOf(BASE - i * DAY_MS), status: '待采纳', content: `提议${i}` }))
  const text = buildReviewBlock({ signals, history, soulText: '人'.repeat(2000) })

  assert.ok(text.length <= 1200, `块长度 ${text.length} 应 ≤1200`)
  const signalLines = text.split('\n').filter((line) => /^- \d{4}-\d{2}-\d{2}: /u.test(line))
  assert.ok(signalLines.length <= 12, `信号行 ≤12,实际 ${signalLines.length}`)
  assert.ok(signalLines.length >= 2, `信号是证据,预算再紧也要留最近 2 条,实际 ${signalLines.length}`)
  const historyLines = text.split('\n').filter((line) => /^- \d{4}-\d{2}-\d{2} \[/u.test(line))
  assert.ok(historyLines.length <= 5, `历史行 ≤5,实际 ${historyLines.length}`)
  // 超预算时先腾辅助材料,但说明与规则必须完整保留
  assert.ok(text.includes('规则(写死)') && text.includes('③ 没有新东西就给 null'), '固定规则不被截掉')
})

test('buildReviewBlock:材料长到把 SOUL 摘要挤空也不死循环(clip 到底必须有栅栏)', () => {
  // 回归:clip(x, 0) 返回 "…" 而不是空串,旧写法会在这里无限循环。
  const signals = Array.from({ length: 12 }, (_, i) =>
    signal(`s${i}`, BASE - i * 3600_000, '这是一句很长的用户原话'.repeat(12)))
  const history = Array.from({ length: 5 }, (_, i) => ({
    ts: isoOf(BASE - i * DAY_MS), status: '已忽略(理由也写得很长很长很长很长很长很长)', content: '提议'.repeat(40),
  }))
  const text = buildReviewBlock({ signals, history, soulText: '人'.repeat(400) })

  assert.ok(text.length <= 1200, `块长度 ${text.length} 应 ≤1200`)
  assert.ok(text.includes('规则(写死)'), '固定规则不被截掉')
  assert.ok(text.includes('本周人格信号'), '结构仍在(不是被截成半句)')
})
