/**
 * 浏览器半**产物**的宿主契约:把 `lib/client.js` 当字节读出来执行,验证它真的能注册模块、
 * 装配起来、并渲染出记忆控制台(v1.15:7 个页签,默认总览)。
 *
 * 这是本轮修掉的那条静默通道的守门用例:宿主 `@deepseek-ai/dsh-client-modules` 用
 * `readFileSync(exports["./client"])` 取件、**不做编译**,所以那个文件必须是自包含
 * bundle。曾经它是 ESM 源码——boot graph 里行还在、combo 也 200,但响应体里没有本插件
 * 的模块(声明 7 个 entries,bundle 内只有 6 个 id),页面永远不出现且毫无告警。
 *
 * 本用例复刻宿主的取件与执行方式(`new Function(source)` 模拟浏览器的 classic script,
 * `window.__ModuleLoader__` 与 `require` 用替身),所以"打包器漏内联一个模块""导出形状
 * 不对""initRuntime 顺序错"这一类问题都会在这里当场失败,而不是等到用户打开页面。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/** React 替身:同步求值、hooks 无状态(渲染一次等价于展开一次)。 */
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useSyncExternalStore: (_s, getSnapshot) => getSnapshot(),
}

/** 展开函数组件(替身 hooks 无状态,等价于渲染一次)。 */
const expand = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node === 'object' && typeof node.type === 'function') return expand(node.type(node.props ?? {}))
  if (typeof node === 'object') return { ...node, children: expand(node.children) }
  return null
}

test('浏览器半产物:lib/client.js 是自包含 bundle,能被宿主原样执行并注册记忆控制台', () => {
  let captured = null
  globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def } } }

  // 宿主的取件方式:fs 读字节 + 当 classic script 执行
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  new Function(source)()

  assert.ok(captured !== null, 'bundle 必须调用 window.__ModuleLoader__.load 注册模块(否则页面不出现)')
  assert.equal(captured.id, 'neural-mind', '模块 id 必须等于包名(loader 按包名查工厂)')
  assert.equal(typeof captured.factory, 'function', 'definition 必须带 factory')

  // require 替身:只该被问 react。记录 + 断言钉死,免得将来引入宿主模块表里没有的外部包。
  const required = []
  const module = captured.factory((name) => {
    required.push(name)
    if (name !== 'react') throw new Error(`客户端 bundle 请求了未声明为外部依赖的模块: ${name}`)
    return reactStub
  })
  assert.deepEqual(required, ['react'], 'bundle 的 require 只该问 react')

  assert.ok(Array.isArray(module.inject), 'module.exports.inject 必须是必需的客户端服务列表')
  for (const svc of ['slots', 'locale', 'configForms']) {
    assert.ok(module.inject.includes(svc), `inject 缺 ${svc}`)
  }
  assert.equal(typeof module.apply, 'function', 'module.exports.apply 必须是函数')

  // 跑一遍 apply:相对 import 没被内联的话,这里会抛 ReferenceError
  const registered = []
  const form = {
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'ready', value: {}, user: {}, revision: 1, writable: true }),
    mutate: () => Promise.resolve(true),
  }
  const ctx = {
    effect: (fn) => { if (typeof fn === 'function') fn(); return () => {} },
    locale: { register: () => () => {}, bind: () => (key) => key },
    configForms: { get: () => form },
    slots: {
      inject: (_name, cb) => { cb() },
      register: (options, component) => { registered.push([options, component]); return () => {} },
    },
  }

  // 首屏会拉 overview:给个最小假响应,避免渲染期间发起真实网络请求
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, stats: {}, embedding: {}, workspaces: {}, injection: {} }) })
  try {
    module.apply(ctx)
  } finally {
    globalThis.fetch = previousFetch
  }

  assert.equal(registered.length, 2, 'apply 必须注册 main 面板与 sidebar.panellist 入口')
  assert.ok(registered.every(([options]) => options.name !== 'settings.section'), '设置弹窗入口已删除')

  const [mainOptions, mainComponent] = registered.find(([options]) => options.name === 'main')
  const [panelOptions] = registered.find(([options]) => options.name === 'sidebar.panellist')
  assert.equal(mainOptions.key, 'neural-mind', 'main 的 key 与 entry id 同源')
  assert.equal(panelOptions.id, 'neural-mind', '侧栏 id 与 main 的 key 同源')
  assert.equal(panelOptions.order, 20, '排在「自动化任务」(10)之后')
  assert.equal(typeof mainComponent, 'function', '记忆控制台组件必须是函数')

  // 渲染:7 个页签都在,默认总览;首屏只挂总览(其余面板懒挂载)
  const tree = mainComponent({ t: (key) => key, form })
  const text = JSON.stringify(expand(tree))
  for (const label of ['navOverview', 'navMemories', 'navRecall', 'navConfig', 'navProfile', 'navSoul', 'navAudit']) {
    assert.ok(text.includes(label), `渲染树应包含页签 ${label}`)
  }
  for (const id of ['overview', 'memories', 'recall', 'config', 'profile', 'soul', 'audit']) {
    assert.ok(text.includes(`"data-tab":"${id}"`), `页签 ${id} 有 data-tab 标记`)
  }
  assert.ok(text.includes('mem-page'), '页面外壳类名在')
  assert.ok(text.includes('settings.section') === false, '渲染树里不该混入 slot 名')
})
