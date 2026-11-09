/**
 * R13b(0.6.6):来源判定的纯函数层——"这条是谁说的"只能按会话原文角色判定,
 * 不采信模型自报(confirm / stagedBy / raw.source 都是模型可填参数)。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  batchRoleOf,
  resolveExtractedSource,
  rolesOfSessionRange,
  sourceTier,
  turnRoleOfParts,
  turnRoleOfText,
  userQuoteMatches,
} from '../lib/provenance.js'

const t = Date.now()
const userMsg = (text, seq = 1) => ({ type: 'user/message', seq, time: t, data: { id: `u${seq}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } } })
const assistantMsg = (text, seq = 2, turn = 1) => ({ type: 'assistant/message', seq, time: t, data: { turn, step: 1, message: { id: `a${seq}`, role: 'assistant', content: [{ type: 'text', text }], source: { kind: 'model', provider: 'p', model: 'm' } } } })
const toolResult = (text, seq = 3, turn = 1) => ({ type: 'tool/result', seq, time: t, data: { turn, step: 1, message: { id: `tr${seq}`, role: 'tool', toolCallId: 'tc1', source: { kind: 'tool', callId: 'tc1' }, content: [{ type: 'text', text }], isError: false } } })

test('R13b:回合角色——只有用户正文 = user;助手/工具 = assistant;两者都有 = mixed', () => {
  assert.equal(turnRoleOfParts({ userTexts: ['问题'], assistantTexts: [], toolCalls: [] }), 'user')
  assert.equal(turnRoleOfParts({ userTexts: [], assistantTexts: ['回答'], toolCalls: [] }), 'assistant')
  assert.equal(turnRoleOfParts({ userTexts: [], assistantTexts: [], toolCalls: [{ name: 'bash', args: '{}', output: 'x' }] }), 'assistant')
  assert.equal(turnRoleOfParts({ userTexts: ['问题'], assistantTexts: ['回答'], toolCalls: [] }), 'mixed')
  assert.equal(turnRoleOfParts({ userTexts: [], assistantTexts: [], toolCalls: [] }), 'empty')
  // 退化路径只给渲染文本:按标题行判断(正文里同形字样不算)
  assert.equal(turnRoleOfText('[用户]\n帮我记一下 A'), 'user')
  assert.equal(turnRoleOfText('[助手]\n好的\n[工具 bash({})]\n输出'), 'assistant')
  assert.equal(turnRoleOfText('[用户]\n问\n\n[助手]\n答'), 'mixed')
  assert.equal(turnRoleOfText('正文里提到 [用户] 三个字但不在行首'), 'empty')
})

test('R13b:整批角色——只有全部回合都是 user 才记 user,混合/判不清一律 assistant', () => {
  assert.equal(batchRoleOf(['user', 'user']), 'user')
  assert.equal(batchRoleOf(['user', 'mixed']), 'assistant')
  assert.equal(batchRoleOf(['assistant']), 'assistant')
  assert.equal(batchRoleOf(['mixed', 'assistant']), 'assistant')
  assert.equal(batchRoleOf([]), 'assistant')
  assert.equal(batchRoleOf(undefined), 'assistant')
})

test('R13b:整理来源——user/assistant 轴由原文角色决定,code/tool/quote 保留内容分类', () => {
  assert.equal(resolveExtractedSource('user', 'assistant'), 'assistant', '模型自称用户也要看原文角色')
  assert.equal(resolveExtractedSource('user', 'user'), 'user')
  assert.equal(resolveExtractedSource('assistant', 'user'), 'user', '角色可升级:全用户原文就该记 user')
  assert.equal(resolveExtractedSource(undefined, 'assistant'), 'assistant', '缺省不再默认 user')
  assert.equal(resolveExtractedSource('胡说', 'assistant'), 'assistant')
  for (const claim of ['code', 'tool', 'quote']) {
    assert.equal(resolveExtractedSource(claim, 'assistant'), claim, `${claim} 是内容分类,不该被角色覆盖`)
  }
})

test('R13b:userQuote 校验——规范化后必须真的出现在本会话用户消息里', () => {
  const userTexts = ['帮我记一下:项目统一用 pnpm 管理依赖,别再装 npm 了']
  assert.equal(userQuoteMatches('项目统一用 pnpm 管理依赖', userTexts), true, '原样包含')
  assert.equal(userQuoteMatches('项目统一用   pnpm\n管理依赖', userTexts), true, '空白折叠后包含')
  assert.equal(userQuoteMatches('项目统一用 yarn 管理依赖', userTexts), false, '编造的不通过')
  assert.equal(userQuoteMatches('嗯', userTexts), false, '太短不算可验证原话')
  assert.equal(userQuoteMatches('', userTexts), false)
  assert.equal(userQuoteMatches(undefined, userTexts), false)
  assert.equal(userQuoteMatches('项目统一用 pnpm', undefined), false)
})

test('R13b:会话区间角色——按 turn 切段,供旧记录回填', () => {
  const events = [
    { type: 'turn/start', seq: 1, time: t, data: { turn: 1 } },
    userMsg('第一个问题', 2),
    assistantMsg('第一个回答', 3, 1),
    { type: 'turn/end', seq: 4, time: t, data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'turn/start', seq: 5, time: t, data: { turn: 2 } },
    userMsg('补一句:以后都用 pnpm', 6),
    { type: 'turn/end', seq: 7, time: t, data: { turn: 2, reason: { kind: 'completed' } } },
  ]
  assert.deepEqual(rolesOfSessionRange(events, 1, 7), ['mixed', 'user'])
  assert.equal(rolesOfSessionRange(events, 1, 4).length, 1, '只截第一回合')
  assert.deepEqual(rolesOfSessionRange(events, 1, 4), ['mixed'])
  assert.deepEqual(rolesOfSessionRange([], 1, 4), [])
  // 工具结果归到所属回合
  const withTool = [
    { type: 'turn/start', seq: 10, time: t, data: { turn: 3 } },
    userMsg('跑下构建', 11),
    { type: 'assistant/message', seq: 12, time: t, data: { turn: 3, step: 1, message: { id: 'a12', role: 'assistant', source: { kind: 'model', provider: 'p', model: 'm' }, content: [{ type: 'text', text: '好' }, { type: 'tool-call', id: 'tc1', name: 'bash', arguments: '{}' }] } } },
    toolResult('构建失败', 13, 3),
    { type: 'turn/end', seq: 14, time: t, data: { turn: 3, reason: { kind: 'completed' } } },
  ]
  assert.deepEqual(rolesOfSessionRange(withTool, 10, 14), ['mixed'])
})

test('R13b:来源档位——界面确认优先,旧数据 unknown 单独一档', () => {
  assert.equal(sourceTier({ source: 'user' }), 'user')
  assert.equal(sourceTier({ source: 'assistant' }), 'assistant')
  assert.equal(sourceTier({ source: 'unknown' }), 'unknown')
  assert.equal(sourceTier({ source: 'user', confirmedByUser: true }), 'confirmed', '界面确认优先于 source')
  assert.equal(sourceTier({ source: 'code' }), 'code')
  assert.equal(sourceTier({}), 'assistant')
})
