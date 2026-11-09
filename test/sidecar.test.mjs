/**
 * 本地 embedding 边车(§5 v1.9):dsh 起 → 服务起;dsh 关 → 服务关。
 * 重点验证三件事:端口已有人听不插手、幂等不重复拉起、卸载时收掉自己拉的那个。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { createSidecar, endpointOf, watchdogScript } from '../lib/sidecar.js'

const logger = { info: () => {} }

/** 假 spawn:返回一个可被 kill 观察的假子进程。 */
function fakeSpawn() {
  const calls = []
  const spawn = (file, args, options) => {
    const child = new EventEmitter()
    child.pid = 4000 + calls.length
    child.killed = false
    child.unref = () => { child.unrefed = true }
    child.kill = (signal) => { child.killed = true; child.killedWith = signal; return true }
    calls.push({ file, args, options, child })
    return child
  }
  return { spawn, calls }
}

function collector() {
  const rows = []
  return { rows, report: (kind, detail) => rows.push({ kind, detail }) }
}

const baseCfg = {
  enabled: true,
  baseUrl: 'http://127.0.0.1:11434/v1',
  autoStartCommand: 'ollama serve',
  autoStartWaitMs: 0, // 测试里不做就绪轮询(另有专项用例)
}

test('endpointOf:解析 baseUrl,退化的输入返回 null 而不是瞎猜', () => {
  assert.deepEqual(endpointOf('http://127.0.0.1:11434/v1'), { host: '127.0.0.1', port: 11434 })
  assert.deepEqual(endpointOf('https://example.com/v1'), { host: 'example.com', port: 443 })
  assert.deepEqual(endpointOf('http://example.com/v1'), { host: 'example.com', port: 80 })
  assert.equal(endpointOf(''), null)
  assert.equal(endpointOf('不是 URL'), null)
})

test('看门狗脚本:靠 stdin EOF 收尸,并带信号 trap', () => {
  const script = watchdogScript('ollama serve')
  assert.match(script, /ollama serve < \/dev\/null &/)
  assert.match(script, /cat > \/dev\/null/)
  assert.match(script, /trap cleanup TERM INT HUP/)
  assert.match(script, /kill "\$child"/)
})

test('默认不启用:命令为空 → 不探测、不 spawn', async () => {
  const { spawn, calls } = fakeSpawn()
  let probed = 0
  const { rows, report } = collector()
  const sidecar = createSidecar({
    getCfg: () => ({ ...baseCfg, autoStartCommand: '' }),
    logger, report, spawnImpl: spawn, probe: async () => { probed += 1; return false },
  })
  await sidecar.ensure()
  assert.equal(calls.length, 0)
  assert.equal(probed, 0, '连探测都不做')
  assert.deepEqual(rows, [])
})

test('向量路关掉时不管边车(没人用就不占资源)', async () => {
  const { spawn, calls } = fakeSpawn()
  const { rows, report } = collector()
  const sidecar = createSidecar({
    getCfg: () => ({ ...baseCfg, enabled: false }),
    logger, report, spawnImpl: spawn, probe: async () => false,
  })
  await sidecar.ensure()
  assert.equal(calls.length, 0)
  assert.deepEqual(rows, [])
})

test('端口已有人听 → 视为外部服务:不拉起、不回收,记一条 external', async () => {
  const { spawn, calls } = fakeSpawn()
  const { rows, report } = collector()
  const sidecar = createSidecar({
    getCfg: () => baseCfg, logger, report, spawnImpl: spawn, probe: async () => true,
  })
  await sidecar.ensure()
  await sidecar.ensure() // 幂等:第二次不再记重复的 external
  assert.equal(calls.length, 0, '别人起的服务不插手')
  assert.equal(sidecar.owned(), false)
  assert.deepEqual(rows.map((r) => r.kind), ['embed-sidecar-external'])
  sidecar.dispose()
  assert.equal(calls.length, 0)
})

test('端口没人听 → 用 sh -c 拉起看门狗;重复 ensure 不重复拉起;dispose 收掉它', async () => {
  const { spawn, calls } = fakeSpawn()
  const { rows, report } = collector()
  const sidecar = createSidecar({
    getCfg: () => baseCfg, logger, report, spawnImpl: spawn, probe: async () => false,
  })
  await sidecar.ensure()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].file, '/bin/sh')
  assert.equal(calls[0].args[0], '-c')
  assert.match(calls[0].args[1], /ollama serve/)
  assert.deepEqual(calls[0].options.stdio, ['pipe', 'ignore', 'ignore'], 'stdin 必须是管道(EOF 兜底靠它)')
  assert.equal(calls[0].child.unrefed, true, '边车不阻塞 dsh 退出')
  assert.equal(sidecar.owned(), true)
  assert.deepEqual(rows.map((r) => r.kind), ['embed-sidecar-started'])
  assert.match(rows[0].detail, /pid 4000/)

  await sidecar.ensure()
  assert.equal(calls.length, 1, '已托管 → 不重复拉起')
  await sidecar.ensure()
  assert.equal(calls.length, 1)

  sidecar.dispose()
  assert.equal(calls[0].child.killed, true)
  assert.equal(calls[0].child.killedWith, 'SIGTERM')
  assert.equal(sidecar.owned(), false)
  sidecar.dispose() // 幂等
})

test('baseUrl 解析不了:只记账,不 spawn', async () => {
  const { spawn, calls } = fakeSpawn()
  const { rows, report } = collector()
  const sidecar = createSidecar({
    getCfg: () => ({ ...baseCfg, baseUrl: '不是 URL' }),
    logger, report, spawnImpl: spawn, probe: async () => false,
  })
  await sidecar.ensure()
  assert.equal(calls.length, 0)
  assert.equal(rows[0].kind, 'embed-sidecar-failed')
})

test('spawn 抛错:记账、不抛给宿主', async () => {
  const { rows, report } = collector()
  const sidecar = createSidecar({
    getCfg: () => baseCfg,
    logger,
    report,
    spawnImpl: () => { throw new Error('spawn boom') },
    probe: async () => false,
  })
  await sidecar.ensure()
  assert.equal(rows.at(-1).kind, 'embed-sidecar-failed')
  assert.match(rows.at(-1).detail, /spawn boom/)
  assert.equal(sidecar.owned(), false)
})

test('就绪确认:端口后来开了记 ready,一直不开记 unready(都不阻塞启动)', async () => {
  const mk = (probeResults, waitMs = 5000) => {
    const { spawn } = fakeSpawn()
    const { rows, report } = collector()
    let i = 0
    const sidecar = createSidecar({
      getCfg: () => ({ ...baseCfg, autoStartWaitMs: waitMs }),
      logger,
      report,
      spawnImpl: spawn,
      probe: async () => probeResults[Math.min(i++, probeResults.length - 1)],
      schedule: (cb) => { cb(); return 0 }, // 立刻推进等待循环
    })
    return { sidecar, rows }
  }

  const ready = mk([false, true]) // 第一次探测(启动前)=没人听;之后就绪
  await ready.sidecar.ensure()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(ready.rows.map((r) => r.kind), ['embed-sidecar-started', 'embed-sidecar-ready'])

  const unready = mk([false], 150) // 窗口给小,免得测试白等 5 秒
  await unready.sidecar.ensure()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(unready.rows.map((r) => r.kind), ['embed-sidecar-started', 'embed-sidecar-unready'])
})

test('预热:只在显式开启且由本进程拉起时做一次,成功/失败都记账', async () => {
  const build = (cfgOver, warmupImpl) => {
    const { spawn } = fakeSpawn()
    const { rows, report } = collector()
    let i = 0
    const sidecar = createSidecar({
      getCfg: () => ({ ...baseCfg, autoStartWaitMs: 4000, ...cfgOver }),
      logger,
      report,
      spawnImpl: spawn,
      probe: async () => i++ > 0, // 启动前探测=没人听,之后就绪
      schedule: (cb) => { cb(); return 0 },
    })
    return { sidecar, rows, warmupImpl }
  }

  // 默认关:拉起但不预热
  const off = build({}, async () => { throw new Error('不该被调用') })
  await off.sidecar.ensure(off.warmupImpl)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(off.rows.map((r) => r.kind), ['embed-sidecar-started', 'embed-sidecar-ready'])

  // 开启:就绪后预热一次,并记下耗时
  let warmed = 0
  const on = build({ autoStartWarmup: true }, async () => { warmed += 1; return true })
  await on.sidecar.ensure(on.warmupImpl)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(warmed, 1)
  assert.deepEqual(on.rows.map((r) => r.kind), ['embed-sidecar-started', 'embed-sidecar-ready', 'embed-sidecar-warmed'])
  assert.match(on.rows[2].detail, /bge-m3|11434|ms/, '带模型名与耗时')

  // 预热失败(返回 false)与抛错:都记 warmup-failed,且不影响其它审计
  const bad = build({ autoStartWarmup: true }, async () => false)
  await bad.sidecar.ensure(bad.warmupImpl)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(bad.rows.map((r) => r.kind), ['embed-sidecar-started', 'embed-sidecar-ready', 'embed-sidecar-warmup-failed'])

  const boom = build({ autoStartWarmup: true }, async () => { throw new Error('模型加载失败') })
  await boom.sidecar.ensure(boom.warmupImpl)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(boom.rows.at(-1).kind, 'embed-sidecar-warmup-failed')
  assert.match(boom.rows.at(-1).detail, /模型加载失败/)
})

test('外部服务不预热(不是我们起的,不替它占显存)', async () => {
  const { spawn } = fakeSpawn()
  const { rows, report } = collector()
  let warmed = 0
  const sidecar = createSidecar({
    getCfg: () => ({ ...baseCfg, autoStartWarmup: true }),
    logger, report, spawnImpl: spawn, probe: async () => true,
  })
  await sidecar.ensure(async () => { warmed += 1; return true })
  assert.equal(warmed, 0)
  assert.deepEqual(rows.map((r) => r.kind), ['embed-sidecar-external'])
})
