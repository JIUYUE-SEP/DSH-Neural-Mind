import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../lib/index.js'
import {
  createFakeCtx,
  fakeSession,
  fakeToolsService,
  turnEvents,
  testConfig,
} from './helpers.mjs'

/**
 * A10 退避重试回归:失败两次后,第二次退避是 5 分钟,不是 60 秒。
 * 旧实现固定 60s 醒来一次,醒来时 pendingFor 为空就直接 return,
 * 不会按 nextRetryAt 再排定时器,于是条目永远停在 pending/retries=2。
 *
 * 用 node:test 的 mock timers 推进时间,不真的等 5 分钟。
 */

const yieldTurn = () => new Promise((resolve) => setImmediate(resolve))

async function until(condition, label, tries = 500) {
  for (let i = 0; i < tries; i += 1) {
    if (await condition()) return
    await yieldTurn()
  }
  assert.fail(`等待超时:${label}`)
}

test('A10:连续失败后按 5 分钟退避继续重试,不依赖新回合', async (t) => {
  const llm = {
    calls: 0,
    stream: () => {
      llm.calls += 1
      return (async function* () {
        throw new Error('simulated llm failure')
      })()
    },
  }
  const fake = createFakeCtx({})
  const services = {
    storageDomain: fake.fakeStorageDomain,
    llm,
    tools: fakeToolsService(fake.tools),
    timer: {},
  }
  fake.ctx.get = (name) => services[name]
  apply(fake.ctx, testConfig({
    extractEnabled: true,
    extractBatchTurns: 1,
    extractIdleMinutes: 60,
    outboxMaxRetries: 5,
  }))

  try {
    await until(() => fake.tools.has('memory_forget'), '插件 boot 完成')
    // boot 里的文件探测/存储超时用真实定时器跑完,再接管时钟。
    await new Promise((resolve) => setTimeout(resolve, 50))
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })

    const session = fakeSession('s-retry')
    for (const e of turnEvents(1, 0, '触发一次提炼失败', '好。')) fake.emit('session/event', session, e)

    await until(() => (fake.tables.outbox?.size ?? 0) > 0, 'outbox 登记')
    await until(() => llm.calls === 1, '第一次提炼调用')
    await until(() => {
      const row = [...fake.tables.outbox.entries()][0]?.[1]
      return row?.status === 'pending' && row.nextRetryAt !== undefined
    }, '第一次失败进入退避')
    const first = [...fake.tables.outbox.entries()][0][1]
    assert.equal(new Date(first.nextRetryAt).getTime() - Date.now(), 60_000, '第一次退避 60s')

    // 第一次退避到点:重试一次,但这次失败后应进入 5 分钟退避。
    t.mock.timers.tick(60_000 + 25)
    await until(() => llm.calls === 2, '第一次退避后的重试')
    await until(() => {
      const row = [...fake.tables.outbox.entries()][0]?.[1]
      return row?.status === 'pending' && new Date(row.nextRetryAt).getTime() > Date.now() + 200_000
    }, '第二次失败进入 5 分钟退避')

    // 旧实现到这里已经没有定时器了;新实现必须在 300s 后自己醒来。
    t.mock.timers.tick(300_000 + 25)
    await until(() => llm.calls === 3, '第二次退避后的自动重试')
    assert.equal(llm.calls, 3, '60s + 300s 两次退避都应自动重试')
  } finally {
    await fake.dispose()
    t.mock.timers.reset()
  }
})
