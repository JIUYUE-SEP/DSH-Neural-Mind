import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../lib/index.js'
import {
  createFakeCtx,
  fakeSession,
  fakeToolsService,
  turnEvents,
  waitFor,
  testConfig,
} from './helpers.mjs'

/**
 * A9 回归:hard forget 发生在提炼进行中(LLM 已调用、尚未返回)时,
 * 这一批输入已经被读进内存;LLM 返回后绝不能再落成 active L2。
 *
 * 旧实现只把 outbox 标 skipped、L0 标 hidden,但 flushSession 在 LLM 返回后
 * 直接落盘,没有复查,所以用户看到“已屏蔽”后内容仍会复活。
 */

function gatedLlm(cannedText) {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const calls = []
  return {
    calls,
    release: () => release(),
    stream: (options) => {
      calls.push(options)
      return (async function* () {
        await gate
        yield { type: 'text-delta', index: 0, text: cannedText }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
}

test('A9:hard forget 与提炼并发时,LLM 返回后不得复活成 L2', async () => {
  const secret = 'RACE-RESURRECTED 决不能被提炼落盘'
  const canned = JSON.stringify({
    episode: null,
    facts: [{
      content: secret,
      kind: 'fact',
      source: 'user',
      temporal: 'pattern',
      importance: 6,
      confidence: 0.9,
      eventTime: '2026-09-15T11:00:00+08:00',
    }],
    lessons: [],
    relations: [],
  })
  const llm = gatedLlm(canned)
  const fake = createFakeCtx({})
  const services = {
    storageDomain: fake.fakeStorageDomain,
    llm,
    tools: fakeToolsService(fake.tools),
    timer: {},
  }
  fake.ctx.get = (name) => services[name]
  apply(fake.ctx, testConfig({ extractEnabled: true, extractBatchTurns: 1, inlineBudgetMs: 5000 }))

  try {
    assert.ok(await waitFor(() => fake.tools.has('memory_forget'), 3000), '插件 boot 完成')
    const session = fakeSession('s-race', { cwd: '/nonexistent-dir' })
    for (const e of turnEvents(1, 0, `${secret} 的原始回合`, '收到')) fake.emit('session/event', session, e)

    assert.ok(await waitFor(() => (fake.tables.outbox?.size ?? 0) === 1, 3000), 'outbox 已登记')
    assert.ok(await waitFor(() => llm.calls.length > 0, 3000), '提炼已进入 LLM')

    const hot = [...fake.tables.hotbuffer.entries()][0]?.[1]
    assert.ok(hot !== undefined, 'L0 已落盘')
    const outboxBefore = [...fake.tables.outbox.entries()][0]?.[1]
    assert.equal(outboxBefore.status, 'extracting', 'LLM 调用期间 outbox 处于 extracting')

    const forget = fake.tools.get('memory_forget')
    const result = await forget.execute({ id: hot.id, hard: true }, { agent: { session } })
    assert.match(result.text, /已屏蔽/, 'hard forget 已返回')
    assert.equal(fake.tables.hotbuffer.get(hot.id).hidden, true, 'L0 已 hidden')
    assert.equal([...fake.tables.outbox.entries()][0]?.[1].status, 'skipped', 'outbox 已终止')

    llm.release()
    // 给 flushSession 足够时间走完:旧实现会在这里落盘,新实现应主动放弃。
    await new Promise((resolve) => setTimeout(resolve, 300))

    const memories = [...fake.tables.memories.entries()].map(([, record]) => record)
    assert.equal(
      memories.some((record) => record.content.includes('RACE-RESURRECTED')),
      false,
      'hard forget 之后不得出现新的 active L2',
    )
    assert.equal(
      [...fake.tables.memories.entries()].length,
      0,
      '整批放弃,不落任何记忆',
    )
    assert.ok(
      [...fake.tables.audit.entries()].some(([, entry]) => entry.kind === 'extract-forget-race-aborted'),
      '放弃要留审计',
    )
  } finally {
    await fake.dispose()
  }
})
