/**
 * 边车 × 启动时序的接线回归(实测踩过的坑):
 *
 * 插件按 **entry 的当前配置** boot 一次,那一代可能还没有端点(baseUrl/modelId 为空);
 * 之后用户在设置页补上端点,Loader 把新值**原地提交**进 volatile 引用并在插件 ctx 上
 * emit `loader/volatile-update`,插件热重建出**第二代** embedder。
 *
 * 边车是进程级的、不随热重建重启,所以它会由第一次 boot 拉起(它读的是**活配置**,
 * 端点补上后就能解析出端口)——若预热抓住的是**第一次 boot 那个没有端点的 embedder**,
 * `available()` 立刻为 false,于是"0ms 预热失败":连请求都没发出去,第一次检索照旧
 * 冷启动降级。这里把那个时序固定下来当回归测试。
 *
 * 0.2.0 接缝:触发第二代的方式从 `settings.installSection({onChange})` 换成了
 * volatile 提交 + `loader/volatile-update`(旧设置服务已移除)。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { apply, Config } from '../lib/index.js'
import { createFakeCtx, waitFor } from './helpers.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** cosmokit 跨副本共享的 volatile 写通道符号(与 lib/compat.js 同源)。 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** 模拟 Loader 的 `_commitVolatile`:把新值原地提交进 volatile 引用。 */
function setVolatile(root, dotted, value) {
  const path = dotted.split('.')
  let cur = root
  for (const key of path.slice(0, -1)) cur = cur[key]
  cur[path[path.length - 1]][VOLATILE_WRITE](value)
}

/** 找一个空闲端口(拿到就释放,留给被测的边车去拉起的假服务占)。 */
function freePort() {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

/** 被测边车要拉起的"假 embedding 服务":一个只听指定端口的 HTTP 服务。 */
function serverCommand(port) {
  const script = `require('node:http').createServer((q,s)=>{let b='';q.on('data',c=>b+=c);`
    + `q.on('end',()=>{s.writeHead(200,{'content-type':'application/json'});`
    + `s.end(JSON.stringify({data:[{embedding:[0.1,0.2,0.3]}]}))})}).listen(${port},'127.0.0.1')`
  return `node -e "${script}"`
}

/**
 * 边车看门狗是 **POSIX shell 脚本**(`/bin/sh -c` + stdin EOF 收尸),Windows 上没有
 * `/bin/sh`,边车必然起不来。这条用例因此在 Windows 上永远红——那不是回归信号,
 * 会把真回归淹掉,所以显式跳过并说明原因(该用例在 Linux/WSL/macOS 上照常跑)。
 */
const SKIP_ON_WINDOWS = process.platform === 'win32'
  ? '边车看门狗依赖 /bin/sh(Windows 无此路径)'
  : false

test('预热取的是"当前这一代"的 embedder:entry 当前配置没有端点时也不哑火(0ms 失败回归)', { skip: SKIP_ON_WINDOWS }, async () => {
  const port = await freePort()
  const fake = createFakeCtx({})

  // ① 存储开得慢一点,给"设置层在 boot 中途附着"留出真实窗口
  const inner = fake.fakeStorageDomain
  const storageDomain = {
    open: async (spec) => {
      await sleep(150)
      return inner.open(spec)
    },
  }

  // ② 基座 config:有命令、有预热开关,但**没有端点**(复刻启动那一代的形态)
  const entry = Config['~standard'].validate({
    extractEnabled: false,
    semanticSearch: {
      enabled: true,
      autoStartCommand: serverCommand(port),
      autoStartWaitMs: 8000,
      autoStartWarmup: true,
    },
  }).value

  // ③ 设置页补端点:volatile 原地提交 + loader/volatile-update(0.2.0 的变更通道)
  const endpoint = `http://127.0.0.1:${port}/v1`
  let configured = false
  const settings = {
    configure: () => { configured = true; return () => {} },
    /** 模拟"用户在设置页填上端点并保存" */
    applyEndpoint: () => {
      setVolatile(entry, 'semanticSearch.baseUrl', endpoint)
      setVolatile(entry, 'semanticSearch.modelId', 'e2e-model')
      setVolatile(entry, 'semanticSearch.apiKeyOptional', true)
      fake.emit('loader/volatile-update', [
        ['semanticSearch', 'baseUrl'],
        ['semanticSearch', 'modelId'],
      ])
    },
  }

  fake.ctx.get = (name) => {
    if (name === 'storageDomain') return storageDomain
    if (name === 'settings') return settings
    return undefined
  }
  // inject 延后 40ms 触发:让第一次 boot 先按 entry 的当前配置跑起来(真实竞争窗口)
  fake.ctx.inject = (deps, fn) => {
    if (!deps.every((d) => fake.ctx.get(d) !== undefined)) return
    setTimeout(() => fn(fake.ctx), 40)
  }
  // 端点在第一次 boot 的 ensure() 读活配置之前补齐 —— 与旧版同一条竞态窗口
  setTimeout(() => settings.applyEndpoint(), 40)

  apply(fake.ctx, entry)
  try {
    assert.ok(await waitFor(() => configured), '设置服务已附着(configure 已登记自带页面策略)')

    const rows = () => [...(fake.tables.audit?.entries() ?? [])].map(([, r]) => r)
    const kinds = () => rows().map((r) => r.kind)
    // 边车必须真的由"基座那一代"拉起来(这正是哑火的触发条件)
    assert.ok(await waitFor(() => kinds().includes('embed-sidecar-started'), { timeoutMs: 5000 }),
      `边车应被拉起(实际审计: ${JSON.stringify(kinds())})`)
    assert.ok(
      await waitFor(() => kinds().includes('embed-sidecar-warmed'), { timeoutMs: 20000 }),
      `预热必须用当前这一代的 embedder 并真的发出请求(实际审计: ${JSON.stringify(kinds())})`,
    )
    const warmed = rows().find((r) => r.kind === 'embed-sidecar-warmed')
    assert.match(warmed.detail, /e2e-model/, '审计里带的是当前模型名')
  } finally {
    await fake.dispose()
    await sleep(50)
  }
})
