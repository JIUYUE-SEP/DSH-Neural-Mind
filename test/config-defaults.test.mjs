/**
 * 配置默认值回归:默认值本身就是用户可见行为,改默认值必须改这里。
 *
 * R4(0.6.6,2026-11-08 决定,见 docs/legacy/REVIEW.md R4):个人单人使用场景下不做敏感自动标记——
 * `sensitiveKeywords` 默认空、`sensitiveNoCross` 默认关;字段、开关与手动标记保留。
 * 理由是实测 5/5 条 L0 被"包含就算"的初筛误标(emo⊂memory、NDA⊂standard、诊断⊂诊断卡),
 * 而 sensitive 唯一效果是不跨 workspace 注入——对单人本机没有价值,误伤却是实打实的。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config } from '../lib/config.js'
import { resolveConfig } from '../lib/compat.js'
import { DEFAULT_SENSITIVE_KEYWORDS, prescreenSensitive } from '../lib/text.js'

const defaults = () => resolveConfig(Config['~standard'].validate(undefined).value)

test('默认值:敏感自动标记关闭(sensitiveNoCross=false、sensitiveKeywords=[])', () => {
  const cfg = defaults()
  assert.equal(cfg.sensitiveNoCross, false, 'R4:sensitive 默认不跨域拦截(开关默认关)')
  assert.deepEqual(cfg.sensitiveKeywords, [], 'R4:默认词表为空,不做关键词初筛')
})

test('默认值:预设敏感词表仍保留,供用户手动开启时参考', () => {
  assert.ok(DEFAULT_SENSITIVE_KEYWORDS.length >= 40, '预设清单保留(不随默认值删除)')
  assert.ok(DEFAULT_SENSITIVE_KEYWORDS.includes('诊断'), '预设清单仍是原来那套类目')
  // 词表为空 = 初筛恒不命中:技术文本不再被误标(默认行为)
  assert.equal(prescreenSensitive('memory standard 诊断卡 NDA', []), false, '空词表不误标技术文本')
  // 机制本身还在:显式传入词表时照常命中(用户打开开关后可用)
  assert.equal(prescreenSensitive('memory standard 诊断卡', ['诊断']), true, '显式词表仍生效')
})

test('默认值可被用户显式覆盖(打开开关 + 自填词表)', () => {
  const cfg = resolveConfig(Config['~standard'].validate({
    sensitiveNoCross: true,
    sensitiveKeywords: ['诊断', '薪酬'],
  }).value)
  assert.equal(cfg.sensitiveNoCross, true, '显式打开开关生效')
  assert.deepEqual(cfg.sensitiveKeywords, ['诊断', '薪酬'], '显式词表生效')
})

test('默认值:R18 纯 BM25 相关性门槛(默认 10;池子门槛 30 保留)', () => {
  const cfg = defaults()
  assert.equal(cfg.relevanceGate.enabled, true, '闸门默认开(v1.13)')
  assert.equal(cfg.relevanceGate.bm25OnlyMin, 10, 'R18:2 → 10(未配 embedding 的默认档)')
  assert.equal(cfg.relevanceGate.bm25OnlyMinPoolSize, 30, '小池子保护保留(误杀风险 > 噪声风险)')
})
