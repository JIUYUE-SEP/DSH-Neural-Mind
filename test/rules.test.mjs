/**
 * §15 项目规则托管块原语测试（草稿阶段：纯函数，不碰文件系统）。
 * 覆盖：插入 / 替换 / 删除 / 无变化、结构异常拒绝、规范化与上限、CRLF 保持。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  RULES_BLOCK_START,
  RULES_BLOCK_END,
  RULES_MAX_CHARS,
  RULES_MAX_COUNT,
  normalizeRule,
  validateRules,
  renderRulesBlock,
  locateRulesBlock,
  parseRulesBlock,
  mergeRulesBlock,
} from '../lib/rules.js'

test('§15 托管块：空文件插入块，规则逐行渲染', () => {
  const result = mergeRulesBlock('', ['发版前必须用户确认', '推送前先跑门禁'])
  assert.equal(result.ok, true)
  assert.equal(result.action, 'inserted')
  assert.equal(result.after, `${RULES_BLOCK_START}\n- 发版前必须用户确认\n- 推送前先跑门禁\n${RULES_BLOCK_END}\n`)
})

test('§15 托管块：已有内容时追加到末尾，原文一字不动', () => {
  const before = '# 项目规则\n\n已有内容\n'
  const result = mergeRulesBlock(before, ['先看方案再执行'])
  assert.equal(result.ok, true)
  assert.equal(result.action, 'inserted')
  assert.ok(result.after.startsWith(before), '原有内容必须原样保留')
  assert.ok(result.after.includes('- 先看方案再执行'))
})

test('§15 托管块：原文没有结尾换行时补空行分隔', () => {
  const result = mergeRulesBlock('已有内容', ['规则一'])
  assert.equal(result.ok, true)
  assert.ok(result.after.startsWith('已有内容\n\n'), '应以空行分隔，避免规则粘在正文末尾')
})

test('§15 托管块：替换已有块，块外内容不动', () => {
  const before = `前文\n${RULES_BLOCK_START}\n- 旧规则\n${RULES_BLOCK_END}\n后文\n`
  const result = mergeRulesBlock(before, ['新规则'])
  assert.equal(result.ok, true)
  assert.equal(result.action, 'replaced')
  assert.ok(result.after.startsWith('前文\n'))
  assert.ok(result.after.endsWith('后文\n'))
  assert.ok(result.after.includes('- 新规则'))
  assert.ok(!result.after.includes('旧规则'))
})

test('§15 托管块：规则没变时返回 unchanged（不产生无意义写入）', () => {
  const text = renderRulesBlock(['规则一', '规则二'])
  const result = mergeRulesBlock(text, ['规则一', '规则二'])
  assert.equal(result.ok, true)
  assert.equal(result.action, 'unchanged')
  assert.equal(result.after, text)
})

test('§15 托管块：规则清空时删除托管块，保留块外内容', () => {
  const before = `前文\n${RULES_BLOCK_START}\n- 规则\n${RULES_BLOCK_END}\n后文\n`
  const result = mergeRulesBlock(before, [])
  assert.equal(result.ok, true)
  assert.equal(result.action, 'removed')
  assert.equal(result.after, '前文\n后文\n')
})

test('§15 托管块：多个块 / 标记不成对 / 标记不在独立行都拒绝写入', () => {
  const twoBlocks = `${renderRulesBlock(['a'])}${renderRulesBlock(['b'])}`
  assert.equal(mergeRulesBlock(twoBlocks, ['c']).ok, false)
  assert.equal(mergeRulesBlock(`${RULES_BLOCK_START}\n- a\n`, ['b']).ok, false, '缺 end 必须拒绝')
  assert.equal(mergeRulesBlock(`正文 ${RULES_BLOCK_START} 同行\n${RULES_BLOCK_END}\n`, ['b']).ok, false, '标记不在行首必须拒绝')
})

test('§15 托管块：parseRulesBlock 能读回规则（忽略空行）', () => {
  assert.deepEqual(parseRulesBlock('\n- 规则一\n\n- 规则二\n'), ['规则一', '规则二'])
})

test('§15 规则规范化：去项目符号 / 编号、折叠空白、拒绝空与超长', () => {
  assert.equal(normalizeRule('-   发版前   先确认 '), '发版前 先确认')
  assert.equal(normalizeRule('1. 第一条规则'), '第一条规则')
  assert.equal(normalizeRule('   '), null)
  assert.equal(normalizeRule('x'.repeat(RULES_MAX_CHARS + 1)), null)
  assert.equal(normalizeRule(42), null)
})

test('§15 规则校验：大小写折叠去重 + 保留原顺序', () => {
  const checked = validateRules(['规则 A', '规则 a', '规则 B'])
  assert.equal(checked.ok, true)
  assert.deepEqual(checked.rules, ['规则 A', '规则 B'])
})

test('§15 规则校验：超条数上限报错，不静默截断', () => {
  const many = Array.from({ length: RULES_MAX_COUNT + 1 }, (_, i) => `规则 ${i}`)
  const checked = validateRules(many)
  assert.equal(checked.ok, false)
  assert.ok(checked.errors.some((e) => e.includes('上限')))
})

test('§15 托管块：CRLF 文件用 CRLF 渲染，不混行尾', () => {
  const before = `前文\r\n${RULES_BLOCK_START}\r\n- 旧规则\r\n${RULES_BLOCK_END}\r\n后文\r\n`
  const result = mergeRulesBlock(before, ['新规则'])
  assert.equal(result.ok, true)
  assert.equal(result.action, 'replaced')
  assert.ok(result.after.includes('\r\n- 新规则\r\n'), '替换块应沿用原文件的 CRLF')
  assert.ok(!result.after.includes('\n- 旧规则'), '旧规则必须被替换')
})

test('§15 托管块：规则非法时整体拒绝，不做部分写入', () => {
  const result = mergeRulesBlock('', ['合法规则', ''])
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((e) => e.includes('无效规则')))
})
