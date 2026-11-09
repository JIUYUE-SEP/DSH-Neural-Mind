/**
 * 浏览器半(v1.15 记忆控制台)共享测试基建。
 *
 * 从旧 `test/client.test.mjs` 抽出(该文件在重设计期间已移到 `.scratch/ui-redesign/`
 * 作为面板测试的移植来源),供各面板测试文件共用:
 *  - `reactStub()` / `loadClientFactory()`:载入源码入口,复刻打包器行为;
 *  - `createHarness()`:带状态迷你 hooks 运行时(useState 触发重渲染、useEffect 按依赖比较);
 *  - `collectText` / `renderTree` / `collectByProp` / `findByText`:遍历渲染树;
 *  - `makeFetchRouter()`:按 action 路由的 fetch 替身,记录调用;
 *  - `mountMemoryPage()`:一键装配假 ctx + 挂载整页(含 overview 请求)。
 *
 * 渲染器约定见 components.js:组合组件的 children 走 props(不是第三参数)。
 */
import { readFileSync } from 'node:fs'

/** React 替身:同步求值函数组件,hooks 简化实现。 */
export function reactStub() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  }
}

let importSeq = 0

/**
 * 载入客户端模块定义,返回与宿主 `module.exports` 同形的对象。
 * 读的是源码入口 `lib/client/index.js`,不是构建产物 `lib/client.js`
 * (产物契约由 `test/client-bundle.test.mjs` 覆盖)。
 * 绕模块缓存的键用自增序号:同毫秒两次 import 会命中同一 URL(全量跑时偶发假红)。
 */
export function loadClientFactory() {
  importSeq += 1
  return import(`../lib/client/index.js?seq=${importSeq}`).then((mod) => ({
    id: mod.definition.id,
    inject: mod.inject,
    factory: (require) => {
      mod.definition.factory(require)
      return { apply: mod.apply, inject: mod.inject }
    },
  }))
}

/** 收集渲染树里的文本节点。 */
export function collectText(node, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const child of node) collectText(child, out); return out }
  if (typeof node === 'object' && node.children !== undefined) collectText(node.children, out)
  return out
}

/** 迷你渲染器:react 替身的 createElement 只造元素,这里把函数组件展开成纯元素。 */
export function renderTree(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(renderTree)
  if (typeof node === 'object' && typeof node.type === 'function') return renderTree(node.type(node.props ?? {}))
  if (typeof node === 'object') return { ...node, children: renderTree(node.children) }
  return null
}

/** 收集带指定 prop 的节点。 */
export function collectByProp(node, prop, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) collectByProp(child, prop, out); return out }
  if (node.props !== undefined && node.props[prop] !== undefined) out.push(node)
  if (node.children !== undefined) collectByProp(node.children, prop, out)
  return out
}

/** 找到 children 里直接含某段文本的节点(按钮/标签)。 */
export function findByText(node, text, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) findByText(child, text, out); return out }
  if (Array.isArray(node.children) && node.children.includes(text)) out.push(node)
  if (node.children !== undefined) findByText(node.children, text, out)
  return out
}

/**
 * 带状态的迷你 hooks 运行时:useState 触发重渲染,useEffect/useCallback 按依赖比较。
 * 槽位按「实例路径 + 组件类型」分组(等价 React 的 per-fiber):纯路径会在
 * "同一位置条件切换组件"时串槽,纯组件函数又会把同函数多实例(多个 Group)串在一起。
 */
export function createHarness() {
  const slotsByPath = new Map()
  let current = null
  let currentPath = 'root'
  let invoke = null
  const shallow = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const slotsFor = () => {
    const key = `${currentPath}::${current?.name ?? 'anon'}`
    let entry = slotsByPath.get(key)
    if (entry === undefined) { entry = { slots: [], cursor: 0 }; slotsByPath.set(key, entry) }
    return entry
  }
  function render(node, path = 'root') {
    if (node === null || node === undefined || typeof node === 'boolean') return null
    if (typeof node === 'string' || typeof node === 'number') return node
    if (Array.isArray(node)) return node.map((child, i) => render(child, `${path}/${i}`))
    if (typeof node === 'object' && typeof node.type === 'function') {
      const previous = current
      const previousPath = currentPath
      current = node.type
      currentPath = path
      const entry = slotsFor()
      entry.cursor = 0
      const out = node.type(node.props ?? {})
      current = previous
      currentPath = previousPath
      return render(out, path)
    }
    if (typeof node === 'object') return { ...node, children: render(node.children, `${path}/c`) }
    return null
  }
  const rerender = () => (invoke === null ? null : render(invoke()))
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const entry = slotsFor()
      const i = entry.cursor++
      if (entry.slots[i] === undefined) entry.slots[i] = { kind: 'state', value: typeof initial === 'function' ? initial() : initial }
      const slot = entry.slots[i]
      return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; rerender() }]
    },
    useEffect(fn, deps) {
      const entry = slotsFor()
      const i = entry.cursor++
      const prev = entry.slots[i]
      if (prev !== undefined && prev.kind === 'effect' && shallow(prev.deps, deps)) return
      entry.slots[i] = { kind: 'effect', deps }
      fn()
    },
    useCallback(fn, deps) {
      const entry = slotsFor()
      const i = entry.cursor++
      const prev = entry.slots[i]
      if (prev !== undefined && prev.kind === 'callback' && shallow(prev.deps, deps)) return prev.fn
      entry.slots[i] = { kind: 'callback', deps, fn }
      return fn
    },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  return {
    react,
    mount(fn) { invoke = fn; slotsByPath.clear(); return rerender() },
    rerender,
    tick: () => new Promise((resolve) => setTimeout(resolve, 0)),
    /** 等到所有 fetch 落地(固定轮数;测试里数据都是同步 resolve 的假响应)。 */
    async settle(rounds = 8) {
      for (let i = 0; i < rounds; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      return rerender()
    },
  }
}

/**
 * 按 action 路由的 fetch 替身。
 * @param payloads - `{ overview: {...}, list: {...} }`,或 `{ overview: (body) => ({...}) }`
 * @returns `{ fetch, calls }`;`calls` 记录 `{ action, body }`,断言后端调用序列用。
 */
export function makeFetchRouter(payloads = {}, defaults = {}) {
  const calls = []
  const fetch = async (_url, init) => {
    const body = JSON.parse(init?.body ?? '{}')
    calls.push({ action: body.action, body })
    const source = payloads[body.action]
    const value = typeof source === 'function' ? source(body) : source
    if (value instanceof Error) throw value
    const payload = value === undefined ? { ok: true, ...defaults } : value
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    }
  }
  return { fetch, calls }
}

/**
 * 装配一个假客户端 ctx,并返回捕获的槽位注册。
 * @param module - loadClientFactory() 的返回值(已 factory 初始化)
 * @param options - `{ form, t, onDefine }`
 */
export function makeClientCtx(module, options = {}) {
  const registered = []
  const form = options.form ?? {
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'ready', value: {}, user: {}, revision: 1, writable: true }),
    mutate: () => Promise.resolve(true),
  }
  const t = options.t ?? ((key) => key)
  module.apply({
    effect: (fn) => (typeof fn === 'function' ? fn() : undefined),
    locale: { register: () => () => {}, bind: () => t },
    configForms: { get: (ns) => { if (options.assertNs !== false) { if (ns !== 'neural-mind') throw new Error(`unexpected ns: ${ns}`) } return form } },
    slots: {
      inject: (name, fn) => {
        if (options.assertSlots !== false && name !== 'main' && name !== 'sidebar.panellist') throw new Error(`unexpected slot: ${name}`)
        fn()
      },
      register: (descriptor, component) => registered.push({ descriptor, component }),
    },
  })
  return { registered, form, t }
}

/**
 * 一键挂载整页:载入源码、装 fetch 路由、创建 harness、apply、mount。
 * @returns `{ harness, tree, main, registered, calls, form }`
 */
export async function mountMemoryPage(options = {}) {
  const def = await loadClientFactory()
  const harness = createHarness()
  const module = def.factory(() => harness.react)
  const payloads = options.payloads ?? {}
  const router = makeFetchRouter(payloads, options.defaults ?? { ok: true, rows: [], total: 0 })
  const previousFetch = globalThis.fetch
  globalThis.fetch = router.fetch
  const { registered, form, t } = makeClientCtx(module, {
    form: options.form,
    t: options.t,
    assertNs: options.assertNs,
    assertSlots: options.assertSlots,
  })
  const main = registered.find(({ descriptor }) => descriptor.name === 'main')
  const tree = harness.mount(main.component)
  await harness.tick()
  if (options.settle !== false) await harness.settle(options.settleRounds ?? 6)
  const restore = () => { globalThis.fetch = previousFetch }
  return { harness, tree: harness.rerender(), main, registered, calls: router.calls, form, restore, router, payloads }
}

/** 找一个页签按钮(按 data-tab)。 */
export function findTab(tree, id) {
  return collectByProp(tree, 'data-tab').find((node) => node.props['data-tab'] === id)
}

/** 找一个面板(按 data-panel)。 */
export function findPanel(tree, id) {
  return collectByProp(tree, 'data-panel').find((node) => node.props['data-panel'] === id)
}

/** 点页签并等到渲染稳定。 */
export async function clickTab(harness, tree, id) {
  const tab = findTab(tree, id)
  if (tab === undefined) throw new Error(`找不到页签 ${id}`)
  tab.props.onClick()
  await harness.tick()
  return harness.settle(4)
}

/** 读包名(断言 module id 用)。 */
export function packageName() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name
}
