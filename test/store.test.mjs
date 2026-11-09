import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openStore } from '../lib/store.js'

const logger = { info: () => {} }

/** 与内存表同形的测试表(Map 支撑;entries/keys 返回快照迭代器)。 */
function tableFrom(map) {
  return {
    get: (key) => map.get(key),
    put: async (key, value) => { map.set(key, value) },
    delete: async (key) => map.delete(key),
    update: async (key, fn) => { const next = fn(map.get(key)); map.set(key, next); return next },
    entries: () => [...map.entries()][Symbol.iterator](),
    keys: () => [...map.keys()][Symbol.iterator](),
    get size() { return map.size },
  }
}

/** 测试域:按需建表;global 用可变对象模拟真实后端。 */
function makeDomain(tables = {}, globalValue = { version: 1 }) {
  const maps = new Map(Object.entries(tables))
  const domain = {
    globalValue,
    closed: 0,
    table(name) {
      if (!maps.has(name)) maps.set(name, new Map())
      return tableFrom(maps.get(name))
    },
    global: {
      get: () => domain.globalValue,
      set: async (value) => { domain.globalValue = value },
    },
    async close() { domain.closed += 1 },
  }
  return domain
}

test('存储:open 超时后晚成功的 domain 必须 close,不遗留句柄', async () => {
  let closed = 0
  const lateDomain = {
    close: async () => { closed += 1 },
    table: () => { throw new Error('不应被使用') },
    global: { get: () => ({}), set: async () => {} },
  }
  const storageDomain = {
    open: () => new Promise((resolve) => setTimeout(() => resolve(lateDomain), 60)),
  }
  const store = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 10 })
  assert.equal(store.persisted, false, '超时降级为内存态')
  assert.equal(closed, 0, '超时当下还没有可 close 的域')
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(closed, 1, '晚到的 domain 必须被关闭')
})

test('存储:主域成功、neural_mind_extract 超时,主存储仍可用且晚到域被关闭', async () => {
  let closed = 0
  let calls = 0
  const lateBatchDomain = { close: async () => { closed += 1 } }
  const memoryDomain = {
    close: async () => { closed += 1 },
    table: () => ({
      get: () => undefined, put: async () => {}, delete: async () => {}, update: async () => undefined,
      entries: () => [][Symbol.iterator](), keys: () => [][Symbol.iterator](), size: 0,
    }),
    global: { get: () => ({}), set: async () => {} },
  }
  const storageDomain = {
    open: (spec) => {
      calls += 1
      if (calls === 1) return Promise.resolve(memoryDomain)
      if (calls === 2) return new Promise((resolve) => setTimeout(() => resolve(lateBatchDomain), 60))
      // 第三次是旧域名迁移探测:本用例不覆盖迁移,让 open 失败 → openStore 跳过迁移,不影响主流程。
      throw new Error(`unexpected domain: ${spec.name}`)
    },
  }
  const store = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 10 })
  assert.equal(store.persisted, true, '主域成功')
  assert.equal(store.batchesPersisted, false, 'batch 域超时降级为进程内')
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(closed, 1, '晚到的 batch domain 必须被关闭')
  await store.close()
  assert.equal(closed, 2, '正常关闭时主域也要 close')
})

test('存储:改名迁移把旧 memory 域记录补进新域,旧域只读且只迁移一次', async () => {
  const legacyGlobal = {
    version: 1,
    onboardedAt: '2026-11-07T00:00:00.000Z',
    seenWorkspaces: [{ id: 'A:/proj' }],
  }
  const legacy = makeDomain({
    memories: new Map([['m_1', { id: 'm_1' }], ['m_2', { id: 'm_2' }]]),
    hotbuffer: new Map([['hb_1', { id: 'hb_1' }]]),
  }, { ...legacyGlobal })
  const target = makeDomain({ memories: new Map([['m_2', { id: 'm_2', kept: true }]]) })
  const batch = makeDomain()
  const opens = []
  const storageDomain = {
    open: async (spec) => {
      opens.push(spec.name)
      if (spec.name === 'neural_mind') return target
      if (spec.name === 'neural_mind_extract') return batch
      if (spec.name === 'memory') return legacy
      throw new Error(`unexpected domain: ${spec.name}`)
    },
  }
  const store = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 50 })
  assert.equal(store.persisted, true)
  assert.deepEqual([...store.memories.keys()].sort(), ['m_1', 'm_2'])
  assert.deepEqual(store.memories.get('m_2'), { id: 'm_2', kept: true }, '新域已有记录不被覆盖')
  assert.equal(store.hotbuffer.keys().next().value, 'hb_1')
  assert.deepEqual(target.globalValue.migratedDomains, ['memory'])
  assert.equal(target.globalValue.onboardedAt, legacyGlobal.onboardedAt)
  assert.equal(legacy.closed, 1, '旧域读完必须关闭')
  assert.equal(legacy.globalValue.migratedDomains, undefined, '旧域保持只读,不写迁移标记')
  assert.deepEqual(opens, ['neural_mind', 'neural_mind_extract', 'memory'])
  await store.close()

  // 第二次启动:标记已写在新域 global 里,不再打开旧域
  const second = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 50 })
  await second.close()
  assert.equal(opens.filter((name) => name === 'memory').length, 1, '迁移只做一次')
})

test('存储:旧域打不开时跳过迁移且不写标记(下次启动重试),主存储照常', async () => {
  const target = makeDomain()
  const batch = makeDomain()
  const opens = []
  const storageDomain = {
    open: async (spec) => {
      opens.push(spec.name)
      if (spec.name === 'memory') throw new Error('legacy broken')
      if (spec.name === 'neural_mind') return target
      if (spec.name === 'neural_mind_extract') return batch
      throw new Error(`unexpected domain: ${spec.name}`)
    },
  }
  const store = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 50 })
  assert.equal(store.persisted, true)
  assert.equal(target.globalValue.migratedDomains, undefined, '失败不写标记,留给下次重试')
  await store.close()
  const second = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 50 })
  await second.close()
  assert.equal(opens.filter((name) => name === 'memory').length, 2, '每次启动都会重试')
})

test('存储:旧域是空目录时也写标记,不留重复迁移', async () => {
  const legacy = makeDomain()
  const target = makeDomain()
  const batch = makeDomain()
  const opens = []
  const storageDomain = {
    open: async (spec) => {
      opens.push(spec.name)
      if (spec.name === 'neural_mind') return target
      if (spec.name === 'neural_mind_extract') return batch
      if (spec.name === 'memory') return legacy
      throw new Error(`unexpected domain: ${spec.name}`)
    },
  }
  const store = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 50 })
  await store.close()
  assert.deepEqual(target.globalValue.migratedDomains, ['memory'])
  const second = await openStore({ get: () => storageDomain }, logger, { timeoutMs: 50 })
  await second.close()
  assert.equal(opens.filter((name) => name === 'memory').length, 1)
})
