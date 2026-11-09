/**
 * Session 格式 V4 接缝的单元回归(DSH 0.2.0-rc.1 起宿主写 V4)。
 *
 * 背景(真机审计结论,见 HANDOFF 第四轮):
 *  - V4 要求消息来源是"生产者拥有"的 kind:非空且不等于字面量 `plugin`。
 *    旧形状 `{ kind:'plugin', plugin:<包名> }` 会被宿主编码器拒绝,
 *    而 checkpoint 在每次模型请求前 flush 会话日志 → 一次注入坏消息会卡死整条会话。
 *  - 2026-11-09 插件改名(dsh-plugin-memory → neural-mind):新写入用新包名,
 *    读侧继续认改名前的两代形状(历史会话日志 + 旧测试素材)。
 *  - V4 的 tool/result 是 tool 角色消息:callId/isError 在消息顶层、content 是直接内容块数组;
 *    V3 的 `{type:'tool-result'}` 包装块是退役语法。旧解析器只认包装块 → 工具产出全丢。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPluginSource, LEGACY_PLUGIN_NAMES, OWN_SOURCE_KIND, PLUGIN_NAME, pluginSource } from '../lib/compat.js'
import { eventsToTurnParts, toolResultOf } from '../lib/turns.js'

const now = Date.now()

test('V4 注入消息来源:写侧用生产者 kind,读侧兼容改名前后与两代形状', () => {
  assert.equal(PLUGIN_NAME, 'neural-mind')
  assert.deepEqual(LEGACY_PLUGIN_NAMES, ['dsh-plugin-memory'])
  assert.equal(OWN_SOURCE_KIND, 'plugin:neural-mind')
  assert.deepEqual(pluginSource(), { kind: 'plugin:neural-mind' })

  // V4:新写入 / 改名后的历史日志
  assert.equal(isPluginSource({ kind: 'plugin:neural-mind' }), true)
  // V3 新形状(旧宿主迁移边可能产出):读侧同样认
  assert.equal(isPluginSource({ kind: 'plugin', plugin: 'neural-mind' }), true)
  // 改名前的历史日志:V4 与 V3 两代旧形状都必须继续认(不能因改名读丢旧注入)
  assert.equal(isPluginSource({ kind: 'plugin:dsh-plugin-memory' }), true)
  assert.equal(isPluginSource({ kind: 'plugin', plugin: 'dsh-plugin-memory' }), true)
  // 其他生产者、字面量 plugin 缺 plugin 字段、非对象一律不认
  assert.equal(isPluginSource({ kind: 'plugin:other-plugin' }), false)
  assert.equal(isPluginSource({ kind: 'plugin' }), false)
  assert.equal(isPluginSource({ kind: 'user' }), false)
  assert.equal(isPluginSource(undefined), false)
  assert.equal(isPluginSource(null), false)
})

test('tool/result 解析:V4 tool 角色消息(直接 content)归一成调用结果', () => {
  const v4 = {
    type: 'tool/result',
    seq: 5,
    time: now,
    data: {
      turn: 1,
      step: 1,
      message: {
        id: 't1',
        role: 'tool',
        toolCallId: 'call_1',
        source: { kind: 'tool', callId: 'call_1' },
        content: [{ type: 'text', text: '第一行\n第二行' }],
        isError: false,
      },
    },
  }
  assert.deepEqual(toolResultOf(v4), { callId: 'call_1', output: '第一行\n第二行', isError: false })

  const failed = structuredClone(v4)
  failed.data.message.isError = true
  assert.equal(toolResultOf(failed)?.isError, true)
})

test('tool/result 解析:V3 包装块仍然能读(历史日志兼容)', () => {
  const v3 = {
    type: 'tool/result',
    seq: 6,
    time: now,
    data: {
      turn: 1,
      step: 1,
      message: {
        id: 't2',
        role: 'user',
        source: { kind: 'tool', callId: 'call_2' },
        content: [{ type: 'tool-result', toolCallId: 'call_2', content: [{ type: 'text', text: 'old output' }], isError: true }],
      },
    },
  }
  assert.deepEqual(toolResultOf(v3), { callId: 'call_2', output: 'old output', isError: true })
})

test('tool/result 解析:缺 callId 的形状返回 null,不造半条记录', () => {
  const broken = {
    type: 'tool/result',
    seq: 7,
    time: now,
    data: { message: { role: 'tool', content: [{ type: 'text', text: 'x' }] } },
  }
  assert.equal(toolResultOf(broken), null)
  assert.equal(toolResultOf({ type: 'tool/result', seq: 8, time: now, data: {} }), null)
})

test('回合累积:V4 工具结果按 callId 归并进 assistant 的 tool-call 记录', () => {
  const parts = eventsToTurnParts([
    {
      type: 'user/message',
      seq: 1,
      time: now,
      data: { id: 'u', role: 'user', content: [{ type: 'text', text: '看下 package.json' }], source: { kind: 'user' } },
    },
    {
      type: 'assistant/message',
      seq: 2,
      time: now,
      data: {
        turn: 1,
        step: 1,
        message: {
          id: 'a',
          role: 'assistant',
          source: { kind: 'model', provider: 'p', model: 'm' },
          content: [
            { type: 'text', text: '我读一下' },
            { type: 'tool-call', id: 'call_1', name: 'fs_read', arguments: '{"path":"package.json"}' },
          ],
        },
      },
    },
    {
      type: 'tool/result',
      seq: 3,
      time: now,
      data: {
        turn: 1,
        step: 1,
        message: {
          id: 't',
          role: 'tool',
          toolCallId: 'call_1',
          source: { kind: 'tool', callId: 'call_1' },
          content: [{ type: 'text', text: '{"name":"dsh-plugin-memory"}' }],
          isError: false,
        },
      },
    },
    // 本插件注入消息(生产者来源)不回流入池
    {
      type: 'user/message',
      seq: 4,
      time: now,
      data: { id: 'inj', role: 'user', source: { kind: 'plugin:dsh-plugin-memory' }, content: [{ type: 'text', text: '历史记忆注入' }] },
    },
    { type: 'turn/end', seq: 5, time: now, data: { turn: 1, reason: { kind: 'completed' } } },
  ])
  assert.deepEqual(parts.userTexts, ['看下 package.json'])
  assert.deepEqual(parts.assistantTexts, ['我读一下'])
  const call = parts.toolCalls.get('call_1')
  assert.equal(call?.name, 'fs_read')
  assert.equal(call?.output, '{"name":"dsh-plugin-memory"}')
  assert.equal(call?.isError, false)
  assert.equal(parts.truncated, false)
})
