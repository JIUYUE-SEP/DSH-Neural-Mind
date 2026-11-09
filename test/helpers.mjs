/** 测试基建:假 Cordis ctx(事件/瀑布/工具/服务探测)+ 内存表 + 轮询等待。 */
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Config } from '../lib/config.js'
import { resolveConfig } from '../lib/compat.js'

/**
 * 本机能不能建符号链接?**探测,不猜平台**。
 *
 * 纪律(交接单 §5.3-3 的教训):"Windows 上跳过"这种写法判据错位——真正的条件不是
 * 平台,而是"能不能建 symlink"(Windows 需要开发者模式/管理员,Linux/macOS 不需要)。
 * 按平台写死会让"在能建 symlink 的 Windows 上"漏测,也说不清为什么跳过。
 *
 * 结果缓存在模块级(每个测试进程探一次)。
 */
let symlinkProbe = null
export async function symlinkUsable() {
  if (symlinkProbe !== null) return symlinkProbe
  const dir = await mkdtemp(join(tmpdir(), 'dsh-symlink-probe-'))
  try {
    const target = join(dir, 'target')
    await writeFile(target, 'x', 'utf8')
    await symlink(target, join(dir, 'link'))
    symlinkProbe = { ok: true, reason: '' }
  } catch (error) {
    symlinkProbe = { ok: false, reason: error?.code ?? String(error) }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  return symlinkProbe
}

/**
 * 权限位要不要断言?
 *
 * POSIX 的 `mode` 是可执行的契约;Windows 上 `chmod` 只影响只读位,`stat().mode`
 * 读回的是 NTFS 合成的权限(实测 0o666),**这一侧本来就测不到东西**。
 * 判据用 `process.platform !== 'win32'` 就够(没有"能落实 mode 的 Windows"),
 * 但仍把理由返回给调用方,让 skip 显示为可解释的跳过而不是静默。
 */
export const modeBitsMeaningful = process.platform !== 'win32'

/**
 * 按**生产环境同一条路**造配置:校验 → 解包 volatile 引用。
 *
 * 0.2.0 起,`Config` 里标了 `.volatile()` 的字段在解析后是引用对象(`{get()}`),
 * 真实的 `apply` 拿到的 `config` 就是这个形状,插件内部一律经 `getConfig()` →
 * `resolveConfig()` 读成纯值。测试直接用 `Config['~standard'].validate(x).value`
 * 就会把引用对象喂进 `createSearch` / `createInjection` 之类按纯值写的模块
 * ——那不是被测代码的缺陷,是测试没走同一条装配路径。统一从这里取配置。
 *
 * @param patch - 想覆盖的配置片段(可为 undefined = 全默认)。
 * @returns 解包后的纯值配置。
 */
export function testConfig(patch) {
  return resolveConfig(Config['~standard'].validate(patch).value)
}

export function memoryTable() {
  const map = new Map()
  return {
    get: (key) => map.get(key),
    put: async (key, value) => { map.set(key, value) },
    delete: async (key) => map.delete(key),
    update: async (key, fn) => {
      if (!map.has(key)) throw new Error(`missing-key: ${key}`)
      const next = fn(map.get(key))
      map.set(key, next)
      return next
    },
    entries: () => [...map.entries()][Symbol.iterator](),
    keys: () => [...map.keys()][Symbol.iterator](),
    get size() { return map.size },
  }
}

/**
 * @param options.globalInitial 覆盖 global 槽初值。默认把 `sourceRemapVersion` 记为 1:
 *   R13b 的旧记录来源回填只在真实升级时跑一次,测试默认不跑(否则所有种子记录的
 *   source:'user' 都会被重算)。专门测回填的用例传 `{ version: 1 }` 让迁移真的执行。
 */
export function createFakeCtx({ services = {}, config, globalInitial } = {}) {
  const listeners = new Map()
  const disposers = []
  const logs = []
  const tools = new Map()
  const sections = []
  const logger = { info: (m) => logs.push(String(m)), warn: (m) => logs.push(String(m)), error: (m) => logs.push(String(m)), debug: (m) => logs.push(String(m)) }

  const tables = {}
  const globals = {}
  const fakeStorageDomain = {
    open: async (spec) => {
      // global 槽按域分开持有:测试要能读到插件写的 global 状态(如 seenWorkspaces),
      // 否则"见过的工作区"这类 UI 辅助数据在测试里不可观测。
      const key = typeof spec?.name === 'string' && spec.name !== '' ? spec.name : 'default'
      const global = (globals[key] ??= (() => {
        let state = globalInitial ?? { ...(spec.global?.initial ?? {}), sourceRemapVersion: 1 }
        return { get: () => state, set: async (v) => { state = v } }
      })())
      return {
        table: (name) => (tables[name] ??= memoryTable()),
        global,
        close: async () => {},
      }
    },
  }

  const ctxBase = {
    logger: () => logger,
    /**
     * 真 cordis 在插件 ctx 上暴露 `.fiber`(本轮 `settings.configure({auto:false}, ctx.fiber)`
     * 的 owner 参数就取它)。假件原先**没有这个属性** → 它是 `undefined`,而宿主签名是
     * `configure(presentation, owner = this.ctx.fiber)`——显式传 `undefined` 与不传**完全等价**,
     * 所以就算有人把 `ctx.fiber` 删掉、策略记到 settings 服务自己的 fiber 上,测试照样全绿。
     * 这里给一个可Identity比对的替身,配合 settings.test.mjs 断言 owner 真的是插件自己的 fiber。
     */
    fiber: { name: 'neural-mind', uid: 7, state: 2, runtime: null },
    get: (name) => {
      if (name === 'storageDomain' && services.storageDomain !== undefined) return services.storageDomain
      return services[name]
    },
    /** 镜像 cordis ctx.inject:依赖齐全即同步执行子插件,否则跳过(主插件不阻塞)。 */
    inject: (deps, fn) => {
      if (deps.every((d) => ctx.get(d) !== undefined)) fn(ctx)
    },
    /**
     * 真 cordis 的 `ctx.on` 返回**注销器**;假件原先返回 `() => {}`(空转),于是
     * `disposers.push(ctx.on(...))` 这类"卸载时摘监听"从未被真正验证过——摘不摘都一样。
     * 现在真的把 listener 从表里移掉:漏注销会表现为"卸载后仍在响应",能被测出来。
     */
    on: (event, listener) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
    effect: (fn) => {
      const result = fn()
      if (result !== undefined) disposers.push(result)
      return result
    },
    timeout: (cb, ms) => { const h = setTimeout(cb, ms); return () => clearTimeout(h) },
    interval: (cb, ms) => { const h = setInterval(cb, ms); h.unref?.(); return () => clearInterval(h) },
  }
  // 镜像 cordis 的 ctx.<service> 属性解析(经当前 get,测试覆盖 get 后一致生效)
  const ctx = new Proxy(ctxBase, {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver)
      const service = target.get(prop)
      return service === undefined ? undefined : service
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value)
    },
  })
  ctx.logger.logs = logs

  return {
    ctx,
    tables,
    globals,
    logs,
    tools,
    sections,
    fakeStorageDomain,
    emit: (event, ...args) => {
      for (const l of listeners.get(event) ?? []) l(...args)
    },
    /** agent/pre-step 瀑布:next() 委托;末游返回默认 decision。 */
    runPreStep: async (payload) => {
      const list = listeners.get('agent/pre-step') ?? []
      let index = -1
      const dispatch = (i) => {
        if (i <= index) throw new Error('next() called multiple times')
        index = i
        if (i >= list.length) return Promise.resolve({ kind: 'enter', messages: payload.messages })
        return list[i](payload, () => dispatch(i + 1))
      }
      return dispatch(0)
    },
    dispose: async () => {
      for (const d of disposers.splice(0).reverse()) await (await d)?.() ?? undefined
    },
  }
}

/** 注册工具服务假件:register 收定义,按名字可取出直接调 execute。 */
export function fakeToolsService(tools) {
  return {
    register: (definition) => {
      tools.set(definition.name, definition)
      return () => tools.delete(definition.name)
    },
  }
}

export function fakeSession(id, { cwd, origin } = {}) {
  return {
    id,
    header: { id, cwd, origin, createdAt: Date.now(), isSeeded: false },
    requestHeader: () => ({ config: { provider: 'test-provider', model: 'test-model' } }),
  }
}

export function turnEvents(turn, seqStart, userText, assistantText) {
  return [
    { type: 'turn/start', seq: seqStart, time: Date.now(), data: { turn } },
    {
      type: 'user/message', seq: seqStart + 1, time: Date.now(),
      data: { id: `u${turn}`, role: 'user', content: [{ type: 'text', text: userText }], source: { kind: 'user' } },
    },
    {
      type: 'assistant/message', seq: seqStart + 2, time: Date.now(),
      data: {
        turn, step: 1,
        message: { id: `a${turn}`, role: 'assistant', content: [{ type: 'text', text: assistantText }], source: { kind: 'model', provider: 'p', model: 'm' } },
        stream: [],
      },
    },
    { type: 'turn/end', seq: seqStart + 3, time: Date.now(), data: { turn, reason: { kind: 'completed' } } },
  ]
}

export async function waitFor(condition, { timeoutMs = 3000, stepMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return true
    await new Promise((r) => setTimeout(r, stepMs))
  }
  return false
}

/** 假 llm.stream:一次性吐出 canned 文本 + stop。 */
export function fakeLlm(cannedText) {
  const calls = []
  return {
    calls,
    stream: (options) => {
      calls.push(options)
      return (async function* () {
        yield { type: 'text-delta', index: 0, text: cannedText }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }
}
