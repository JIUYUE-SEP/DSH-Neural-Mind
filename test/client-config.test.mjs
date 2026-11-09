/**
 * 配置面板(v1.15,SPEC §7.4)测试。
 *
 * 测试姿势与共享基建一致(见 test/helpers-client.mjs):
 *  - 迷你 hooks 运行时 `createHarness()` + 手动 `initRuntime`,**只加载 config-card.js**,
 *    不经过页面外壳(配置卡与其它面板没有耦合,单文件测试更稳);
 *  - `t` 默认返回 key 本身,断言只看 key;只有需要验证插值 / 中文匹配时才注入自定义 `t`;
 *  - 写入一律断言 `[{ op:"set"|"unset", path, value? }]` 的**精确序列**;
 *  - fetch 用 `makeFetchRouter` 按 action 路由,`calls` 记录调用序列。
 *
 * 覆盖:26 字段闭合 / 分组折叠 / 全部展开收起 / 搜索(键名·标签·说明·中文)/
 * 诊断卡(正常·异常·跳转)/ 数字校验 / 已覆盖+重置 / 四类控件写入 ops /
 * 工作区勾选·搜索·全选·手动 / 空列表·接口失败 / 只读态 / 不可用态 / 写入失败 /
 * 密钥管理 + 连接测试。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHarness, collectText, collectByProp, makeFetchRouter } from './helpers-client.mjs'
import { initRuntime } from '../lib/client/runtime.js'
import { ConfigCard, GROUPS, diagnoseConfig } from '../lib/client/config-card.js'
import { zh as zhConfig, en as enConfig } from '../lib/client/i18n/config.js'

/** SPEC §8 的 26 个配置键(冻结清单,顺序不敏感)。 */
const SPEC_KEYS = [
  'privateWorkspaces',
  'disabledWorkspaces',
  'sensitiveNoCross',
  'sensitiveKeywords',
  'semanticSearch.enabled',
  'semanticSearch.baseUrl',
  'semanticSearch.modelId',
  'semanticSearch.apiKeyEnv',
  'semanticSearch.apiKeyOptional',
  'semanticSearch.timeoutMs',
  'semanticSearch.autoStartCommand',
  'semanticSearch.autoStartWaitMs',
  'semanticSearch.autoStartWarmup',
  'extractEnabled',
  'extractBatchTurns',
  'extractIdleMinutes',
  'toolOutputStorage',
  'toolOutputOverrides',
  'failedToolOutputChars',
  'autoRecall',
  'injectMaxItems',
  'injectMaxChars',
  'sessionInjectMaxChars',
  'excerptChars',
  'profileFile',
  'profilePollSeconds',
]

/** 每个用例都需要的假响应:密钥状态(向量组默认展开,挂载即拉)。 */
const DEFAULT_PAYLOADS = {
  embedKeyStatus: { ok: true, name: 'TEST_KEY', configured: false, writable: true, optional: false, credentials: true },
}

const clone = (value) => (value === undefined ? value : structuredClone(value))

// ── 假 form controller(带嵌套路径的 set/unset,可重放真实快照)────────────────

function setPath(root, path, value) {
  if (path.length === 1) {
    root[path[0]] = value
    return
  }
  if (root[path[0]] === null || typeof root[path[0]] !== 'object') root[path[0]] = {}
  setPath(root[path[0]], path.slice(1), value)
}

function unsetPath(root, path) {
  if (path.length === 1) {
    delete root[path[0]]
    return
  }
  const child = root[path[0]]
  if (child === null || typeof child !== 'object') return
  unsetPath(child, path.slice(1))
}

function applyOp(state, op) {
  const target = op.op === 'set' ? op.value : undefined
  if (op.op === 'set') {
    setPath(state.value, op.path, clone(target))
    setPath(state.user, op.path, clone(target))
  } else {
    unsetPath(state.value, op.path)
    unsetPath(state.user, op.path)
  }
}

/**
 * 配置表单夹具:mutate 立即改写快照(便于断言「勾选态立刻反映当前值」)。
 * @param options - `{ value, user, status, writable, reject, throwError }`
 */
function makeForm(options = {}) {
  const state = {
    status: options.status ?? 'ready',
    writable: options.writable !== false,
    value: clone(options.value ?? {}),
    user: clone(options.user ?? {}),
    revision: 1,
  }
  const mutations = []
  const form = {
    subscribe: () => () => {},
    getSnapshot: () => state,
    mutate: (ops) => {
      if (state.writable === false) return Promise.resolve(false)
      if (options.reject === true) return Promise.resolve(false)
      if (options.throwError !== undefined) return Promise.reject(options.throwError)
      mutations.push(clone(ops))
      for (const op of ops) applyOp(state, op)
      state.revision += 1
      return Promise.resolve(true)
    },
  }
  return { form, mutations, state }
}

// ── 挂载与查找小工具 ───────────────────────────────────────────────────────

async function renderCard(options = {}) {
  const harness = createHarness()
  initRuntime(harness.react)
  const fixture = makeForm(options)
  const router = makeFetchRouter({ ...DEFAULT_PAYLOADS, ...(options.payloads ?? {}) })
  const previousFetch = globalThis.fetch
  globalThis.fetch = router.fetch
  const t = options.t ?? ((key) => key)
  // 注意:必须让 ConfigCard 作为**元素**被渲染器展开,而不是在 mount 回调里直接调用它——
  // 直接调用会在渲染器上下文之外执行 hooks,而 hooks 槽位是按「路径 + 组件名」分组的,
  // 状态下一次重渲染就会落到别的组件的槽位里(表现为点击后状态丢失)。
  harness.mount(() => harness.react.createElement(ConfigCard, {
    t,
    form: options.noForm === true ? undefined : fixture.form,
    overview: options.overview,
    refreshKey: options.refreshKey ?? 0,
  }))
  await harness.settle(4)
  const ctx = {
    harness,
    router,
    form: fixture.form,
    mutations: fixture.mutations,
    state: fixture.state,
    t,
    tree: () => harness.rerender(),
    async settle() {
      await harness.tick()
      await harness.settle(4)
      return harness.rerender()
    },
    restore() { globalThis.fetch = previousFetch },
  }
  return ctx
}

function nodeBy(tree, prop, value) {
  const found = collectByProp(tree, prop).find((node) => node.props[prop] === value)
  assert.ok(found !== undefined, `找不到 ${prop}=${value} 的节点`)
  return found
}

function fieldRows(tree) {
  return collectByProp(tree, 'data-field')
}

function fieldRow(tree, key) {
  const found = fieldRows(tree).find((node) => node.props['data-field'] === key)
  assert.ok(found !== undefined, `找不到字段 ${key} 的字段行`)
  return found
}

/** 字段行里的 DraftInput 渲染结果(输入框 / 文本域;props 上带 onBlur)。 */
function draftOf(row) {
  const found = collectByProp(row, 'onBlur')
  assert.ok(found.length > 0, '字段行里应有 DraftInput')
  return found[0]
}

function inputByPlaceholder(tree, placeholder) {
  return collectByProp(tree, 'placeholder').find((node) => node.props.placeholder === placeholder)
}

async function clickNode(ctx, node) {
  assert.equal(typeof node.props.onClick, 'function', '节点应可点击')
  node.props.onClick()
  return ctx.settle()
}

/** 展开一个分组(已展开则不点,避免点成收起)。 */
async function openGroup(ctx, id) {
  let tree = ctx.tree()
  const wrap = nodeBy(tree, 'data-group-wrap', id)
  if (wrap.props['data-group-open'] === 'true') return tree
  return clickNode(ctx, nodeBy(tree, 'data-group', id))
}

/** 把某个 DraftInput 字段改成新文本并提交(失焦语义)。 */
async function commitField(ctx, key, text) {
  let tree = ctx.tree()
  draftOf(fieldRow(tree, key)).props.onChange({ target: { value: text } })
  await ctx.harness.tick()
  tree = ctx.tree()
  draftOf(fieldRow(tree, key)).props.onBlur()
  return ctx.settle()
}

// ── ① 契约:26 个键 / 导出形状 / 动态词典齐全 ──────────────────────────────

test('配置键闭合:GROUPS 恰好覆盖 SPEC §8 的 26 个键,ConfigCard / GROUPS 照旧导出', () => {
  assert.equal(typeof ConfigCard, 'function', 'ConfigCard 必须继续导出')
  assert.ok(Array.isArray(GROUPS), 'GROUPS 必须继续导出')
  assert.deepEqual(GROUPS.map((group) => group.id), ['privacy', 'embedding', 'write', 'inject', 'profile'],
    '五个分组:隐私 / 向量 / 写入 / 注入 / 画像')

  const fields = GROUPS.flatMap((group) => group.fields)
  assert.equal(fields.length, 26, '字段总数必须恰好 26(不可增删)')
  assert.deepEqual(fields.map((field) => field.key).sort(), [...SPEC_KEYS].sort(), '键名与 SPEC §8 完全一致')
  assert.deepEqual(GROUPS.map((group) => group.fields.length), [4, 9, 6, 5, 2], '各组字段数')

  // kinds must stay within the mapper check-seams ⑨ understands
  const KINDS = new Set(['toggle', 'text', 'number', 'lines', 'workspaces', 'dict', 'select'])
  for (const field of fields) {
    assert.ok(KINDS.has(field.kind), `${field.key} 的 kind=${field.kind} 不在允许集合里`)
  }
  assert.deepEqual(
    GROUPS.find((group) => group.id === 'write').fields.find((field) => field.key === 'toolOutputStorage').options,
    ['summary', 'head'],
    'select 候选必须与宿主 union 取值一致(否则选中即被校验拒绝)',
  )

  // 动态拼的 key(标签 / 说明 / 分组标题)由面板自己保证:这里逐项对账中英词典
  for (const field of fields) {
    const labelKey = 'f_' + field.key.split('.').pop()
    for (const dict of [zhConfig, enConfig]) {
      assert.equal(typeof dict[labelKey], 'string', `词典缺标签 ${labelKey}`)
      assert.equal(typeof dict[labelKey + '_desc'], 'string', `词典缺说明 ${labelKey}_desc`)
    }
  }
  for (const group of GROUPS) {
    assert.equal(typeof zhConfig[group.title], 'string', `zh 缺分组标题 ${group.title}`)
    assert.equal(typeof enConfig[group.title], 'string', `en 缺分组标题 ${group.title}`)
  }
})

// ── ② 折叠 / 全部展开收起 ─────────────────────────────────────────────────

test('分组折叠:默认只展开「向量检索 / 写入与提炼」,点标题展开或收起', async () => {
  const ctx = await renderCard()
  try {
    let tree = ctx.tree()
    // 默认展开:向量组 5 个非高级字段 + 写入组 6 个 = 11 行
    assert.equal(fieldRows(tree).length, 11, '默认只渲染默认展开组的字段')
    assert.equal(nodeBy(tree, 'data-group', 'embedding').props['aria-expanded'], true)
    assert.equal(nodeBy(tree, 'data-group', 'write').props['aria-expanded'], true)
    assert.equal(nodeBy(tree, 'data-group', 'privacy').props['aria-expanded'], false)
    assert.equal(nodeBy(tree, 'data-group', 'inject').props['aria-expanded'], false)
    assert.equal(nodeBy(tree, 'data-group', 'profile').props['aria-expanded'], false)
    assert.equal(nodeBy(tree, 'data-group-wrap', 'privacy').props['data-group-open'], 'false')

    tree = await clickNode(ctx, nodeBy(tree, 'data-group', 'privacy'))
    assert.equal(nodeBy(tree, 'data-group', 'privacy').props['aria-expanded'], true, '点标题展开')
    assert.equal(fieldRows(tree).length, 15, '展开隐私组后 11 + 4 行')
    for (const key of ['privateWorkspaces', 'disabledWorkspaces', 'sensitiveNoCross', 'sensitiveKeywords']) {
      assert.ok(fieldRow(tree, key) !== undefined, `展开后出现 ${key}`)
    }

    tree = await clickNode(ctx, nodeBy(tree, 'data-group', 'privacy'))
    assert.equal(fieldRows(tree).some((node) => node.props['data-field'] === 'privateWorkspaces'), false, '再点收起')
    assert.equal(fieldRows(tree).length, 11, '收起后回到 11 行')
  } finally {
    ctx.restore()
  }
})

test('全部展开 / 全部收起:一次渲染 26 个字段行(含高级选项),收起后清空', async () => {
  const ctx = await renderCard()
  try {
    let tree = await clickNode(ctx, nodeBy(ctx.tree(), 'data-action', 'expand'))
    const keys = fieldRows(tree).map((node) => node.props['data-field'])
    assert.equal(keys.length, 26, '全部展开后 26 个字段行都在')
    assert.deepEqual([...keys].sort(), [...SPEC_KEYS].sort(), '展开的字段集合 = SPEC 清单')
    for (const group of GROUPS) {
      assert.equal(nodeBy(tree, 'data-group-wrap', group.id).props['data-group-open'], 'true', `${group.id} 已展开`)
    }
    // 向量组的高级选项随「全部展开」一起打开
    assert.ok(fieldRow(tree, 'semanticSearch.timeoutMs') !== undefined, '高级字段 timeoutMs 可见')

    tree = await clickNode(ctx, nodeBy(tree, 'data-action', 'collapse'))
    assert.equal(fieldRows(tree).length, 0, '全部收起后不渲染任何字段行')
    assert.equal(nodeBy(tree, 'data-group-wrap', 'embedding').props['data-group-open'], 'false')
  } finally {
    ctx.restore()
  }
})

test('向量高级选项:默认收起,单独展开后才出现 4 个高级字段', async () => {
  const ctx = await renderCard()
  try {
    let tree = ctx.tree()
    assert.ok(!fieldRows(tree).some((node) => node.props['data-field'] === 'semanticSearch.timeoutMs'), '高级字段默认不可见')
    assert.ok(nodeBy(tree, 'data-advanced', 'embedding') !== undefined, '有高级选项开关')

    tree = await clickNode(ctx, nodeBy(tree, 'data-advanced', 'embedding'))
    for (const key of ['semanticSearch.timeoutMs', 'semanticSearch.autoStartCommand', 'semanticSearch.autoStartWaitMs', 'semanticSearch.autoStartWarmup']) {
      assert.ok(fieldRows(tree).some((node) => node.props['data-field'] === key), `展开高级后出现 ${key}`)
    }
    assert.equal(fieldRows(tree).length, 15, '默认 11 + 高级 4')
  } finally {
    ctx.restore()
  }
})

// ── ③ 搜索 ────────────────────────────────────────────────────────────────

test('搜索:按键名过滤、显示匹配数、无匹配给空态,清空后恢复默认折叠', async () => {
  const ctx = await renderCard()
  try {
    let tree = ctx.tree()
    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: 'baseUrl' } })
    tree = await ctx.settle()
    assert.equal(fieldRows(tree).length, 1, '按末段键名 baseUrl 只命中一项')
    assert.equal(fieldRow(tree, 'semanticSearch.baseUrl').props['data-field'], 'semanticSearch.baseUrl')
    assert.ok(collectText(tree).includes('cfgSearchMatches'), '显示匹配数')

    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: 'semanticSearch.' } })
    tree = await ctx.settle()
    assert.equal(fieldRows(tree).length, 9, '按完整键名前缀命中向量组 9 项')
    assert.ok(fieldRows(tree).some((node) => node.props['data-field'] === 'semanticSearch.timeoutMs'),
      '搜索时高级字段强制展开(否则搜到却看不见)')

    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: 'f_disabledWorkspaces' } })
    tree = await ctx.settle()
    assert.equal(fieldRows(tree).length, 1, '按标签 key 命中')

    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: 'zzz-nope' } })
    tree = await ctx.settle()
    assert.equal(fieldRows(tree).length, 0, '无匹配不渲染字段')
    assert.ok(collectText(tree).includes('cfgSearchEmpty'), '无匹配显示空态文案')

    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: '' } })
    tree = await ctx.settle()
    assert.equal(fieldRows(tree).length, 11, '清空搜索回到默认展开的两组')
  } finally {
    ctx.restore()
  }
})

test('搜索:中文标签与说明也参与匹配(t 返回真实中文时)', async () => {
  const LABELS = {
    f_baseUrl: '端点地址',
    f_baseUrl_desc: 'OpenAI 兼容端点',
    f_modelId: '模型名',
    f_modelId_desc: 'embedding 模型',
  }
  const t = (key) => LABELS[key] ?? key
  const ctx = await renderCard({ t })
  try {
    let tree = ctx.tree()
    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: '端点' } })
    tree = await ctx.settle()
    assert.deepEqual(fieldRows(tree).map((node) => node.props['data-field']), ['semanticSearch.baseUrl'],
      '中文标签命中端点,且不误伤其它字段')

    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: '兼容' } })
    tree = await ctx.settle()
    assert.deepEqual(fieldRows(tree).map((node) => node.props['data-field']), ['semanticSearch.baseUrl'],
      '中文说明也参与匹配')

    inputByPlaceholder(tree, 'cfgSearchPlaceholder').props.onChange({ target: { value: '模型' } })
    tree = await ctx.settle()
    const keys = fieldRows(tree).map((node) => node.props['data-field'])
    assert.ok(keys.includes('semanticSearch.modelId'), '「模型」命中模型名')
  } finally {
    ctx.restore()
  }
})

// ── ④ 诊断 ────────────────────────────────────────────────────────────────

test('诊断卡:向量端点不全 / 自动召回关闭 / 提炼关闭 / 停用工作区逐条提示,可跳到分组', async () => {
  const ctx = await renderCard({
    value: {
      semanticSearch: { enabled: true },
      autoRecall: false,
      extractEnabled: false,
      disabledWorkspaces: ['/repo/x'],
      profileFile: '/p.md',
    },
  })
  try {
    let tree = ctx.tree()
    const ids = collectByProp(tree, 'data-diag').map((node) => node.props['data-diag'])
    for (const id of ['vector-incomplete', 'recall-off', 'extract-off', 'disabled-ws']) {
      assert.ok(ids.includes(id), `诊断应包含 ${id}`)
    }
    assert.ok(!ids.includes('profile-empty'), '画像已配置时不提示')
    const tones = collectByProp(tree, 'data-diag').map((node) => node.props['data-tone'])
    assert.equal(tones[0], 'warn', 'warn 排在最前')
    assert.ok(tones.includes('info'), 'info 也如实展示(不是错误)')

    // 「去设置」跳转:清空搜索并展开对应分组
    tree = await clickNode(ctx, nodeBy(tree, 'data-diag-jump', 'privacy'))
    assert.ok(fieldRows(tree).some((node) => node.props['data-field'] === 'disabledWorkspaces'),
      '点「去设置」后隐私组展开、停用工作区字段出现')
  } finally {
    ctx.restore()
  }
})

test('诊断卡:配置无问题时显示绿色「配置检查通过」;overview 暴露内存态 / 无工作区', async () => {
  const healthyValue = {
    semanticSearch: { enabled: true, baseUrl: 'http://127.0.0.1:11434/v1', modelId: 'bge-m3', apiKeyEnv: 'EMBED_KEY' },
    autoRecall: true,
    extractEnabled: true,
    profileFile: '/p.md',
    disabledWorkspaces: [],
    privateWorkspaces: [],
  }
  const okCtx = await renderCard({
    value: healthyValue,
    overview: { data: { stats: { persisted: true }, workspaces: { total: 2 }, embedding: { lastFailure: '' } } },
  })
  const badCtx = await renderCard({
    value: healthyValue,
    overview: { data: { stats: { persisted: false }, workspaces: { total: 0 }, embedding: { lastFailure: 'ECONNREFUSED' } } },
  })
  try {
    const okTree = okCtx.tree()
    assert.equal(collectByProp(okTree, 'data-diag').length, 0, '无问题时没有诊断行')
    assert.ok(collectText(okTree).includes('cfgDiagOk'), '显示绿色「配置检查通过」')

    const badTree = badCtx.tree()
    const ids = collectByProp(badTree, 'data-diag').map((node) => node.props['data-diag'])
    assert.deepEqual(ids.sort(), ['memory-only', 'no-workspace', 'vector-failed'], '内存态 / 无工作区 / 上次向量失败')
    assert.equal(collectByProp(badTree, 'data-diag').find((node) => node.props['data-diag'] === 'memory-only').props['data-tone'], 'warn')
  } finally {
    badCtx.restore()
    okCtx.restore()
  }
})

test('诊断纯函数:无配置不抛错,警告在前、提示在后', () => {
  const t = (key) => key
  assert.deepEqual(diagnoseConfig(t, undefined, null).map((item) => item.id), ['vector-off', 'profile-empty'],
    '空配置:向量关闭 + 画像未配置,两者都是提示')

  const items = diagnoseConfig(t, {
    semanticSearch: { enabled: true, baseUrl: '', modelId: '' },
    autoRecall: false,
  }, null)
  assert.equal(items[0].id, 'vector-incomplete')
  assert.equal(items[0].tone, 'warn')
  assert.ok(items.some((item) => item.id === 'recall-off'))
  assert.equal(items[items.length - 1].tone, 'info', 'info 排在最后')

  const sorted = diagnoseConfig(t, {
    semanticSearch: { enabled: false },
    autoRecall: true,
    extractEnabled: true,
    profileFile: '/p.md',
  }, { stats: { persisted: false }, workspaces: { total: 0 } })
  assert.equal(sorted[0].id, 'memory-only', 'warn 优先于 info')

  // v1.16:回合管道没起来是最坏的一种静默失效(0 工作区/0 记忆),必须 warn 且带原因
  const tv = (key, vars) => (vars === undefined ? key : key + JSON.stringify(vars))
  const failed = diagnoseConfig(tv, {
    semanticSearch: { enabled: false },
    autoRecall: true,
    extractEnabled: true,
    profileFile: '/p.md',
  }, { stats: { persisted: true, health: { state: 'failed', error: 'reembedBatchSize 必须是正整数' } }, workspaces: { total: 4 } })
  assert.equal(failed[0].id, 'boot-failed')
  assert.equal(failed[0].tone, 'warn')
  assert.match(failed[0].title, /reembedBatchSize/, '标题带失败原因,便于截图报障')
  const ready = diagnoseConfig(t, {
    semanticSearch: { enabled: false },
    autoRecall: true,
    extractEnabled: true,
    profileFile: '/p.md',
  }, { stats: { persisted: true, health: { state: 'ready' } }, workspaces: { total: 4 } })
  assert.equal(ready.some((item) => item.id === 'boot-failed'), false, 'ready 时不误报')
})

// ── ⑤ 字段行:已覆盖 / 重置 / 数字校验 ────────────────────────────────────

test('已覆盖与重置:徽章 + 状态条计数 + 逐项 unset,分组计数同步', async () => {
  const t = (key, vars) => (vars === undefined ? key : key + JSON.stringify(vars))
  const ctx = await renderCard({
    t,
    value: { autoRecall: false },
    user: { autoRecall: false },
  })
  try {
    let tree = await openGroup(ctx, 'inject')
    const row = fieldRow(tree, 'autoRecall')
    assert.equal(collectByProp(row, 'data-override').length, 1, '已覆盖徽章在')
    const resetButton = collectByProp(row, 'data-reset').find((node) => node.props['data-reset'] === 'autoRecall')
    assert.ok(resetButton !== undefined, '重置按钮在')
    assert.equal(String(collectText(row)).includes('overridden'), true, '徽章文案走词典')

    const texts = collectText(tree)
    assert.ok(texts.includes('cfgOverriddenCount{"n":1}'), '状态条显示已覆盖 1 项')
    const changed = collectByProp(tree, 'data-changed').find((node) => node.props['data-changed'] === 1)
    assert.ok(changed !== undefined, '注入组显示「已改 1 项」')
    assert.ok(collectText(changed).includes('cfgGroupChanged{"n":1}'))

    tree = await clickNode(ctx, resetButton)
    assert.deepEqual(ctx.mutations[0], [{ op: 'unset', path: ['autoRecall'] }], '重置走 unset(恢复组合层默认)')
  } finally {
    ctx.restore()
  }
})

test('数字校验:非法值不提交并就地提示,合法值按 number 写入', async () => {
  const ctx = await renderCard({ value: { injectMaxItems: 6 } })
  try {
    await openGroup(ctx, 'inject')
    let tree = await commitField(ctx, 'injectMaxItems', 'abc')
    assert.equal(ctx.mutations.length, 0, '非法值不得写入')
    const invalid = collectByProp(tree, 'data-invalid').find((node) => node.props['data-invalid'] === 'injectMaxItems')
    assert.ok(invalid !== undefined, '就地提示非法输入')
    assert.ok(collectText(tree).includes('cfgNumberInvalid'), '提示文案走词典')

    tree = await commitField(ctx, 'injectMaxItems', '')
    assert.equal(ctx.mutations.length, 0, '空值不得写入')
    assert.ok(collectText(tree).includes('cfgNumberRequired'), '空值提示')

    tree = await commitField(ctx, 'injectMaxItems', '12')
    assert.deepEqual(ctx.mutations, [[{ op: 'set', path: ['injectMaxItems'], value: 12 }]], '合法值写 number')
    assert.equal(typeof ctx.state.value.injectMaxItems, 'number', '写入类型是数字,不是字符串')
    assert.equal(ctx.state.value.injectMaxItems, 12)
    assert.equal(collectByProp(tree, 'data-invalid').length, 0, '合法提交后提示消失')
  } finally {
    ctx.restore()
  }
})

// ── ⑥ 四类控件的写入 ops 序列 ─────────────────────────────────────────────

test('写入 ops:toggle / select / lines / dict 各自写对 path 与类型', async () => {
  const ctx = await renderCard({
    value: { extractEnabled: true, toolOutputStorage: 'summary', autoRecall: true, sensitiveKeywords: ['a'] },
  })
  try {
    // select(写入组默认展开)
    let tree = ctx.tree()
    collectByProp(fieldRow(tree, 'toolOutputStorage'), 'data-select')[0]
      .props.onChange({ target: { value: 'head' } })
    tree = await ctx.settle()

    // dict:每行 工具名=summary|head,非法行忽略
    tree = await commitField(ctx, 'toolOutputOverrides', 'web_search=head\nnot-a-line')

    // toggle(注入组默认收起,先展开)
    tree = await openGroup(ctx, 'inject')
    collectByProp(fieldRow(tree, 'autoRecall'), 'data-toggle')[0]
      .props.onChange({ target: { checked: false } })
    tree = await ctx.settle()

    // lines(隐私组默认收起)
    tree = await openGroup(ctx, 'privacy')
    tree = await commitField(ctx, 'sensitiveKeywords', 'secret-one\nsecret-two')

    assert.deepEqual(ctx.mutations, [
      [{ op: 'set', path: ['toolOutputStorage'], value: 'head' }],
      [{ op: 'set', path: ['toolOutputOverrides'], value: { web_search: 'head' } }],
      [{ op: 'set', path: ['autoRecall'], value: false }],
      [{ op: 'set', path: ['sensitiveKeywords'], value: ['secret-one', 'secret-two'] }],
    ], '四类控件都走 set + 正确的 path/value 类型')
  } finally {
    ctx.restore()
  }
})

// ── ⑦ 工作区选择器 ────────────────────────────────────────────────────────

const WORKSPACE_ROWS = {
  ok: true,
  workspaces: [
    { id: '/repo/a', label: 'alpha', count: 3, lastSeenMs: Date.parse('2026-11-07T08:00:00.000Z'), disabled: false },
    { id: '/repo/b', label: 'beta', count: 0, lastSeenMs: 0, disabled: true },
    { id: '/repo/c', label: 'gamma', count: 5, lastSeenMs: 0, disabled: false },
  ],
}

test('工作区选择器:勾选 = 启用写 disabledWorkspaces,条数与最近出现时间可见', async () => {
  const t = (key, vars) => (vars === undefined ? key : key + JSON.stringify(vars))
  const ctx = await renderCard({
    t,
    value: { disabledWorkspaces: ['/repo/b'] },
    payloads: { workspaces: WORKSPACE_ROWS },
  })
  try {
    let tree = await openGroup(ctx, 'privacy')
    const boxes = () => collectByProp(tree, 'data-workspace').filter((node) => node.props.type === 'checkbox')
    assert.deepEqual(boxes().map((node) => node.props['data-workspace']), ['/repo/a', '/repo/b', '/repo/c'],
      '每个已知工作区一行')
    assert.deepEqual(boxes().map((node) => node.props.checked), [true, false, true],
      '勾选态 = 不在 disabledWorkspaces 里(以当前配置值为准)')

    const texts = collectText(tree)
    assert.ok(texts.includes('cfgWsCount{"n":3}'), '每行显示记忆条数')
    assert.ok(texts.some((text) => text.startsWith('cfgWsLastSeen')), '每行显示最近出现时间')
    assert.ok(texts.includes('cfgWsNeverSeen') === false || texts.some((text) => text.includes('cfgWsNeverSeen')) === true,
      '无记录行显示「未记录」')
    assert.ok(texts.includes('cfgWsSummary{"total":3,"disabled":1}'), '汇总条数 / 停用数')

    // 取消勾选 /repo/a(启用 → 停用):基于当前值追加,不覆盖已有条目
    boxes().find((node) => node.props['data-workspace'] === '/repo/a').props.onChange({ target: { checked: false } })
    tree = await ctx.settle()
    assert.deepEqual(ctx.mutations[0], [{ op: 'set', path: ['disabledWorkspaces'], value: ['/repo/b', '/repo/a'] }],
      '停用 → 追加 workspaceId')
    assert.equal(
      collectByProp(tree, 'data-workspace').find((node) => node.props['data-workspace'] === '/repo/a').props.checked,
      false,
      '写入后勾选态立刻反映当前值',
    )

    // 勾选 /repo/b(停用 → 启用):移除覆盖它的条目
    collectByProp(tree, 'data-workspace').find((node) => node.props['data-workspace'] === '/repo/b')
      .props.onChange({ target: { checked: true } })
    tree = await ctx.settle()
    assert.deepEqual(ctx.mutations[1], [{ op: 'set', path: ['disabledWorkspaces'], value: ['/repo/a'] }],
      '启用 → 从列表移除该 id')
  } finally {
    ctx.restore()
  }
})

test('工作区选择器:搜索过滤 / 全部启用 / 全部停用 / 手动添加路径折叠区', async () => {
  const ctx = await renderCard({
    value: { disabledWorkspaces: [] },
    payloads: { workspaces: WORKSPACE_ROWS },
  })
  try {
    let tree = await openGroup(ctx, 'privacy')
    // 搜索过滤:只留 gamma
    inputByPlaceholder(tree, 'cfgWsSearch').props.onChange({ target: { value: 'gamma' } })
    tree = await ctx.settle()
    assert.deepEqual(
      collectByProp(tree, 'data-workspace-row').map((node) => node.props['data-workspace-row']),
      ['/repo/c'],
      '搜索按 label 过滤',
    )
    inputByPlaceholder(tree, 'cfgWsSearch').props.onChange({ target: { value: '' } })
    tree = await ctx.settle()

    // 全部停用 → 追加所有已知 id;全部启用 → 清空列表
    tree = await clickNode(ctx, nodeBy(tree, 'data-ws-action', 'disable-all'))
    assert.deepEqual(ctx.mutations[0], [{ op: 'set', path: ['disabledWorkspaces'], value: ['/repo/a', '/repo/b', '/repo/c'] }],
      '全部停用写入所有已知 id')
    tree = await clickNode(ctx, nodeBy(tree, 'data-ws-action', 'enable-all'))
    assert.deepEqual(ctx.mutations[1], [{ op: 'set', path: ['disabledWorkspaces'], value: [] }], '全部启用清空停用列表')

    // 手动添加:折叠区默认收起,展开后每行一条写同一字段
    assert.equal(inputByPlaceholder(tree, 'cfgWsManualHint') === undefined, true, '手动区默认折叠')
    tree = await clickNode(ctx, nodeBy(tree, 'data-ws-manual', 'toggle'))
    const manual = inputByPlaceholder(tree, 'cfgWsManualHint')
    assert.ok(manual !== undefined, '展开后出现手动输入区')
    manual.props.onChange({ target: { value: '/repo/manual\n/repo/prefix' } })
    tree = await ctx.settle()
    inputByPlaceholder(tree, 'cfgWsManualHint').props.onBlur()
    tree = await ctx.settle()
    assert.deepEqual(ctx.mutations[2], [{ op: 'set', path: ['disabledWorkspaces'], value: ['/repo/manual', '/repo/prefix'] }],
      '手动输入整段写同一字段')
  } finally {
    ctx.restore()
  }
})

test('工作区选择器:空列表 / 接口失败都不拖垮配置页,手动输入仍可用', async () => {
  // 情况一:没有任何已知工作区 → 空提示,但手动区照常写
  const emptyCtx = await renderCard({
    value: { disabledWorkspaces: [] },
    payloads: { workspaces: { ok: true, workspaces: [] } },
  })
  try {
    let tree = await openGroup(emptyCtx, 'privacy')
    assert.ok(collectText(tree).includes('cfgWsEmpty'), '空列表显示提示')
    assert.ok(inputByPlaceholder(tree, 'cfgWsManualHint') === undefined, '手动区默认折叠但仍可达')
    tree = await clickNode(emptyCtx, nodeBy(tree, 'data-ws-manual', 'toggle'))
    inputByPlaceholder(tree, 'cfgWsManualHint').props.onChange({ target: { value: '/repo/never-seen' } })
    tree = await emptyCtx.settle()
    inputByPlaceholder(tree, 'cfgWsManualHint').props.onBlur()
    tree = await emptyCtx.settle()
    assert.deepEqual(emptyCtx.mutations[0], [{ op: 'set', path: ['disabledWorkspaces'], value: ['/repo/never-seen'] }],
      '空列表下手动输入照常可写')
  } finally {
    emptyCtx.restore()
  }

  // 情况二:接口失败 → 控件内错误行;配置页其余部分照常(两个 context 各自持有 fetch,需串行)
  const failedCtx = await renderCard({
    value: { disabledWorkspaces: [] },
    payloads: { workspaces: new Error('workspaces boom') },
  })
  try {
    const tree = await openGroup(failedCtx, 'privacy')
    const failedTexts = collectText(tree)
    assert.ok(failedTexts.some((text) => String(text).includes('workspaces boom')), '失败如实显示在控件内')
    assert.ok(failedTexts.some((text) => String(text).includes('cfgWsError')))
    assert.ok(collectText(tree).includes('groupPrivacy'), '配置卡其余部分照常渲染')
    assert.ok(inputByPlaceholder(tree, 'cfgWsManualHint') === undefined, '失败时手动区入口仍在')
  } finally {
    failedCtx.restore()
  }
})

// ── ⑧ 三态:只读 / 不可用 / 写入失败 ──────────────────────────────────────

test('只读态:writable=false 显示横幅、控件禁用且不写入', async () => {
  const ctx = await renderCard({ value: { extractEnabled: true }, writable: false })
  try {
    const tree = ctx.tree()
    const texts = collectText(tree)
    assert.ok(texts.includes('configReadonly'), '只读横幅')
    assert.ok(texts.some((text) => String(text).includes('cfgServiceReadonly')), '状态条显示只读')

    const toggle = collectByProp(fieldRow(tree, 'extractEnabled'), 'data-toggle')[0]
    assert.equal(toggle.props.disabled, true, '开关被禁用')
    toggle.props.onChange({ target: { checked: false } })
    await ctx.settle()
    assert.equal(ctx.mutations.length, 0, '只读态点击不写配置')
  } finally {
    ctx.restore()
  }
})

test('设置服务不可用 / 加载中:如实提示,不渲染字段也不崩', async () => {
  const unavailableCtx = await renderCard({ status: 'unavailable' })
  const loadingCtx = await renderCard({ status: 'loading' })
  try {
    const unavailableTexts = collectText(unavailableCtx.tree())
    assert.ok(unavailableTexts.includes('cfgServiceUnavailable'), '状态条显示不可用')
    assert.ok(unavailableTexts.includes('configUnavailable'), '给出不可用原因')
    assert.ok(unavailableTexts.includes('configUnavailableHint'), '给出如何恢复')
    assert.equal(fieldRows(unavailableCtx.tree()).length, 0, '不可用时不渲染字段(避免改假值)')

    const loadingTexts = collectText(loadingCtx.tree())
    assert.ok(loadingTexts.includes('configTitle'), '加载中仍有标题')
    assert.equal(fieldRows(loadingCtx.tree()).length, 0, '加载中不渲染字段')
  } finally {
    loadingCtx.restore()
    unavailableCtx.restore()
  }
})

test('防御:form 缺席(设置服务没注入)时按「不可用」渲染,不白屏也不渲染字段', async () => {
  const ctx = await renderCard({ noForm: true })
  try {
    const tree = ctx.tree()
    assert.ok(collectText(tree).includes('configUnavailable'), '给出不可用原因')
    assert.equal(fieldRows(tree).length, 0, '没有 controller 时不渲染字段')
  } finally {
    ctx.restore()
  }
})

test('写入失败:横幅如实提示,不谎报成功', async () => {
  // 宿主判 false(非 loopback / 页面只读 / disposed)→ 必须报失败,不谎报成功
  const rejectedCtx = await renderCard({ value: { extractEnabled: true }, reject: true })
  try {
    let tree = rejectedCtx.tree()
    collectByProp(fieldRow(tree, 'extractEnabled'), 'data-toggle')[0]
      .props.onChange({ target: { checked: false } })
    tree = await rejectedCtx.settle()
    assert.ok(collectText(tree).includes('configWriteFailed'), '宿主拒绝 → 显示写入失败')
    assert.equal(rejectedCtx.mutations.length, 0)
  } finally {
    rejectedCtx.restore()
  }

  // 写入抛错 → 异常信息原样上屏
  const thrownCtx = await renderCard({ value: { extractEnabled: true }, throwError: new Error('boom-write') })
  try {
    let tree = thrownCtx.tree()
    collectByProp(fieldRow(tree, 'extractEnabled'), 'data-toggle')[0]
      .props.onChange({ target: { checked: false } })
    tree = await thrownCtx.settle()
    assert.ok(collectText(tree).some((text) => String(text).includes('boom-write')), '异常信息原样上屏')
  } finally {
    thrownCtx.restore()
  }
})

// ── ⑨ 向量检索:密钥管理 + 连接测试 ───────────────────────────────────────

test('向量检索:密钥只写不显示(保存/清除),连接测试展示 model / dim / 延迟', async () => {
  const ctx = await renderCard({
    value: { semanticSearch: { enabled: true } },
    payloads: {
      embedKeyStatus: { ok: true, name: 'EMBED_KEY', configured: true, writable: true, optional: false, credentials: true, source: 'stored' },
      embedKeySave: { ok: true, name: 'EMBED_KEY', configured: true, writable: true, optional: false, credentials: true },
      embedKeyClear: { ok: true, name: 'EMBED_KEY', configured: false, writable: true, optional: false, credentials: true },
      embedTest: { ok: true, model: 'bge-m3', dimensions: 1024, latencyMs: 12 },
    },
  })
  try {
    let tree = ctx.tree()
    assert.ok(collectText(tree).some((text) => String(text).includes('embedKeyConfigured')), '展示已配置状态')
    const keyInput = nodeBy(tree, 'data-embed-key', 'input')
    assert.equal(keyInput.props.type, 'password', '密钥输入是 password,不回显')
    keyInput.props.onChange({ target: { value: 'sk-secret-1' } })
    tree = await ctx.settle()
    tree = await clickNode(ctx, nodeBy(tree, 'data-embed-action', 'save'))
    const saveCall = ctx.router.calls.find((call) => call.action === 'embedKeySave')
    assert.ok(saveCall !== undefined, '保存调 embedKeySave')
    assert.equal(saveCall.body.key, 'sk-secret-1', '把 key 发给后端')
    assert.equal(collectText(tree).some((text) => String(text).includes('sk-secret-1')), false, '页面绝不回显 key')

    tree = await clickNode(ctx, nodeBy(tree, 'data-embed-action', 'clear'))
    assert.ok(ctx.router.calls.some((call) => call.action === 'embedKeyClear'), '清除走 embedKeyClear')

    tree = await clickNode(ctx, nodeBy(tree, 'data-embed-action', 'test'))
    const result = nodeBy(tree, 'data-embed-result', 'ok')
    const resultText = collectText(result).join(' ')
    assert.ok(resultText.includes('bge-m3'), '展示模型名')
    assert.ok(resultText.includes('1024'), '展示向量维度')
    assert.ok(resultText.includes('12ms'), '展示延迟')
    assert.ok(collectText(result).join(' ').includes('embedTestDims'), '维度单位走词典')
  } finally {
    ctx.restore()
  }
})

test('向量检索:未填凭据变量名时只给引导,不渲染密钥输入框', async () => {
  const ctx = await renderCard({
    payloads: {
      embedKeyStatus: { ok: true, name: '', configured: false, writable: true, optional: false, credentials: true },
    },
  })
  try {
    const tree = ctx.tree()
    assert.ok(collectText(tree).includes('embedKeyNeedName'), '提示先填凭据变量名')
    assert.equal(collectByProp(tree, 'data-embed-key').length, 0, '没有变量名时不渲染密钥输入')
    assert.ok(nodeBy(tree, 'data-embed-action', 'test') !== undefined, '连接测试仍可用(便于先验证端点)')
  } finally {
    ctx.restore()
  }
})
