/**
 * 画像 & SOUL 面板(v1.15 ui-persona)契约测试。
 *
 * 覆盖面从归档的旧客户端测试(`.scratch/ui-redesign/legacy-client-tests.mjs`)移植:
 *  - SOUL 回滚二次确认(卡片内 + 覆盖层内两条路径)、编辑覆盖层、diff、提议采纳/忽略;
 *  - 总开关关闭时「允许自改」置灰且点击无效、总开关关闭时「编辑」仍可用;
 *  - 画像加载/保存/放弃修改/脏标记/重新加载互斥、空态与错误态。
 * 断言一律用 `t` 返回 key 的方式,不对中文文案做断言。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadClientFactory, createHarness, collectText, collectByProp, findByText, makeFetchRouter,
} from './helpers-client.mjs'
import { SOUL_FIELDS } from '../lib/client/soul-card.js'

const PROFILE_CONTENT = '## 本人\n- 偏好简短回答\n'
const SOUL_CONTENT = '示例人格\n- 先给结论\n'

/** 画像响应夹具(字段形状见 lib/api.js 的 profileSnapshot)。 */
const profileFixture = (over = {}) => ({
  ok: true,
  path: 'C:/Users/x/neural-mind-profile.md',
  content: PROFILE_CONTENT,
  chars: PROFILE_CONTENT.length,
  truncated: false,
  injectionChars: 120,
  pollSeconds: 5,
  ...over,
})

/** 4 条历史版本:卡片只展示最近 3 版,覆盖层展示全部。 */
const HISTORY = [
  { id: 'soul_v4', ts: '2026-11-01T08:00:00.000Z', author: 'agent', reason: '自动改写', before: 10, after: 12 },
  { id: 'soul_v3', ts: '2026-10-30T08:00:00.000Z', author: 'user', reason: '设置页编辑', before: 8, after: 10 },
  { id: 'soul_v2', ts: '2026-10-28T08:00:00.000Z', author: 'external', reason: '导入', before: 0, after: 8 },
  { id: 'soul_v1', ts: '2026-10-27T08:00:00.000Z', author: 'user', reason: '首版', before: 0, after: 0 },
]

/** SOUL 响应夹具(字段形状见 lib/api.js 的 soul 动作)。 */
const soulFixture = (over = {}) => ({
  ok: true,
  path: 'C:/Users/x/SOUL.md',
  content: SOUL_CONTENT,
  chars: SOUL_CONTENT.length,
  maxChars: 2000,
  enabled: true,
  selfEditEnabled: true,
  dailyUsed: 1,
  dailyBudget: 5,
  persisted: true,
  lastVersion: { ts: '2026-11-01T08:00:00.000Z', author: 'agent' },
  history: HISTORY,
  proposals: [],
  ...over,
})

/** 可重放的 configForms controller 替身:mutate 立即改写快照,便于断言开关状态跟着变。 */
function createConfigForm(initialValue = {}) {
  let snapshot = {
    status: 'ready',
    value: { ...initialValue },
    user: { ...initialValue },
    revision: 1,
    writable: true,
  }
  const mutations = []
  return {
    mutations,
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    mutate: (ops) => {
      mutations.push(ops)
      const nextValue = { ...snapshot.value }
      for (const op of ops) {
        if (op.op === 'set') nextValue[op.path.join('.')] = op.value
        else delete nextValue[op.path.join('.')]
      }
      snapshot = { ...snapshot, value: nextValue, revision: snapshot.revision + 1 }
      return Promise.resolve(true)
    },
  }
}

/**
 * 直接挂载单个面板(不走整页):冻结 props 为 `{ t, form, overview, refreshKey, onNavigate }`。
 * 返回句柄里 `render()` = 重新渲染并取最新树,`calls` = 后端调用序列。
 */
async function mountPanel(file, exportName, options = {}) {
  const def = await loadClientFactory()
  const harness = createHarness()
  def.factory(() => harness.react)
  const mod = await import(`../lib/client/${file}.js`)
  const component = mod[exportName]
  assert.equal(typeof component, 'function', `${file} 需导出 ${exportName}`)
  const router = makeFetchRouter(options.payloads ?? {})
  const previousFetch = globalThis.fetch
  globalThis.fetch = router.fetch
  const form = options.form ?? createConfigForm(options.formValue ?? { soulEnabled: true, soulSelfEditEnabled: true })
  const props = {
    t: (key) => key,
    form,
    overview: null,
    refreshKey: 0,
    onNavigate: options.onNavigate,
  }
  // 以「元素节点」挂载而不是直接调用组件:harness 只在函数组件节点上重置 hooks 游标。
  harness.mount(() => harness.react.createElement(component, props))
  await harness.settle(options.settleRounds ?? 4)
  return {
    harness,
    form,
    calls: router.calls,
    render: () => harness.rerender(),
    restore: () => { globalThis.fetch = previousFetch },
  }
}

const actionsOf = (calls) => calls.map((call) => call.action)
const hasText = (texts, key) => texts.some((text) => String(text).includes(key))

/** 按类名找元素(组合组件的 children 在 props 里,按 className 精确分词匹配)。 */
function nodesByClass(tree, name) {
  return collectByProp(tree, 'className').filter((node) =>
    typeof node.props.className === 'string' && node.props.className.split(' ').includes(name))
}

/** 找文案为 key 的按钮(t 返回 key 时,按钮的 children 里就有这个字符串)。 */
function buttonByText(tree, key) {
  const node = findByText(tree, key).find((candidate) => typeof candidate.props.onClick === 'function')
  if (node === undefined) throw new Error(`找不到按钮:${key}`)
  return node
}

// ══ 画像 ProfileCard ═══════════════════════════════════════════════════════

test('画像:挂载即拉 profile,头部元信息与等宽编辑器就位', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', { payloads: { profile: profileFixture() } })
  try {
    const tree = panel.render()
    assert.deepEqual(actionsOf(panel.calls), ['profile'], '挂载即拉一次画像文件')
    const texts = collectText(tree)
    for (const key of ['profileTitle', 'profileHint', 'profileSave', 'profileReload', 'perPoll', 'perInjected', 'perLimit']) {
      assert.ok(texts.includes(key), `缺少文案 ${key}`)
    }
    for (const key of ['profileChars', 'C:/Users/x/neural-mind-profile.md']) {
      assert.ok(hasText(texts, key), `缺少元信息 ${key}`)
    }
    assert.ok(hasText(texts, '20000'), '字符上限提示')
    const area = collectByProp(tree, 'spellCheck')[0]
    assert.equal(area.props.value, PROFILE_CONTENT, '文本框内容 = 文件内容')
    assert.ok(String(area.props.className).includes('mem-profile-text'), '画像编辑器保持旧类名(块级撑宽)')
    assert.equal(texts.includes('profileDirty'), false, '未改 → 无脏标记')
    assert.equal(buttonByText(tree, 'profileSave').props.disabled, true, '未改 → 保存禁用')
    assert.notEqual(buttonByText(tree, 'profileReload').props.disabled, true, '未改 → 可重新加载')
    assert.equal(findByText(tree, 'profileUndo').length, 0, '未改 → 不显示放弃按钮')
  } finally {
    panel.restore()
  }
})

test('画像:改动出现脏标记,重新加载被禁用,放弃修改回到文件内容', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', { payloads: { profile: profileFixture() } })
  try {
    let tree = panel.render()
    collectByProp(tree, 'spellCheck')[0].props.onChange({ target: { value: '## 本人\n- 新内容\n' } })
    tree = panel.render()
    let texts = collectText(tree)
    assert.ok(texts.includes('profileDirty'), '改过 → 脏标记')
    assert.equal(buttonByText(tree, 'profileReload').props.disabled, true, '有未保存修改时禁止重载')
    assert.equal(buttonByText(tree, 'profileReload').props.title, 'profileReloadBlocked', '给出禁止重载的原因')
    assert.notEqual(buttonByText(tree, 'profileSave').props.disabled, true, '有修改 → 可保存')
    assert.ok(findByText(tree, 'profileUndo').length > 0, '提供放弃修改入口')

    buttonByText(tree, 'profileUndo').props.onClick()
    tree = panel.render()
    texts = collectText(tree)
    assert.equal(texts.includes('profileDirty'), false, '放弃修改后回到未脏状态')
    assert.equal(collectByProp(tree, 'spellCheck')[0].props.value, PROFILE_CONTENT, '文本框恢复文件内容')
    assert.deepEqual(actionsOf(panel.calls), ['profile'], '放弃修改只改本地草稿,不调后端')
  } finally {
    panel.restore()
  }
})

test('画像:保存调 profileSave 并带草稿内容,保存后脏标记消失', async () => {
  const payloads = {
    profile: profileFixture(),
    profileSave: { ok: true, path: 'C:/Users/x/neural-mind-profile.md', chars: 12 },
  }
  const panel = await mountPanel('profile-card', 'ProfileCard', { payloads })
  try {
    let tree = panel.render()
    const nextContent = '## 本人\n- 新内容\n'
    collectByProp(tree, 'spellCheck')[0].props.onChange({ target: { value: nextContent } })
    tree = panel.render()
    buttonByText(tree, 'profileSave').props.onClick()
    await panel.harness.settle(4)
    tree = panel.render()
    const saveCall = panel.calls.find((call) => call.action === 'profileSave')
    assert.ok(saveCall !== undefined, '保存走 profileSave')
    assert.equal(saveCall.body.content, nextContent, '保存把编辑器内容发到后端')
    assert.deepEqual(actionsOf(panel.calls), ['profile', 'profileSave'], '保存不额外拉取')
    assert.ok(collectText(tree).includes('profileSaved'), '显示已保存')
    assert.equal(collectText(tree).includes('profileDirty'), false, '保存后不再脏')
    assert.equal(buttonByText(tree, 'profileSave').props.disabled, true, '无改动 → 保存又禁用')
  } finally {
    panel.restore()
  }
})

test('画像:重新加载重新拉取 profile(调用口径不变)', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', { payloads: { profile: profileFixture() } })
  try {
    const tree = panel.render()
    buttonByText(tree, 'profileReload').props.onClick()
    await panel.harness.settle(4)
    assert.deepEqual(actionsOf(panel.calls), ['profile', 'profile'], '重新加载再拉一次画像文件')
  } finally {
    panel.restore()
  }
})

test('画像:读取失败显示错误横幅', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', {
    payloads: { profile: new Error('画像文件读不到') },
  })
  try {
    const tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('commonError'), '错误横幅标题')
    assert.ok(texts.includes('画像文件读不到'), '错误原因如实展示')
    assert.ok(
      collectByProp(tree, 'role').some((node) => node.props.role === 'alert'),
      '错误用 alert 语义',
    )
  } finally {
    panel.restore()
  }
})

test('画像:未配置画像文件时给空态并引导去配置页', async () => {
  const navigated = []
  const panel = await mountPanel('profile-card', 'ProfileCard', {
    payloads: { profile: new Error('未配置 profileFile:L1 用户画像需要一个文件作为唯一真相源。') },
    formValue: { profileFile: '' },
    onNavigate: (tab) => navigated.push(tab),
  })
  try {
    const tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('perUnconfigured'), '未配置空态标题')
    assert.ok(texts.includes('profileNoFile'), '说明先去配置 profileFile')
    assert.equal(texts.includes('commonError'), false, '未配置走引导空态,不重复弹错误横幅')
    buttonByText(tree, 'perGoConfig').props.onClick()
    assert.deepEqual(navigated, ['config'], '空态按钮跳配置页签')
  } finally {
    panel.restore()
  }
})

test('画像:文件不存在时明确提示路径可能写错(不再装作空画像)', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', {
    payloads: { profile: profileFixture({ exists: false, content: '', chars: 0 }) },
  })
  try {
    const tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('perMissingTitle'), 'R26:缺文件给警告标题')
    assert.ok(hasText(texts, 'C:/Users/x/neural-mind-profile.md'), '提示里带具体路径')
    assert.equal(texts.includes('perTruncatedTitle'), false, '不是"被截断"场景,不串警告')
  } finally {
    panel.restore()
  }
})

test('画像:空文件提示还没有画像内容', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', {
    payloads: { profile: profileFixture({ content: '', chars: 0 }) },
  })
  try {
    const tree = panel.render()
    assert.ok(collectText(tree).includes('profileEmpty'), '空内容提示')
    assert.equal(collectByProp(tree, 'spellCheck')[0].props.value, '', '编辑器为空')
  } finally {
    panel.restore()
  }
})

test('画像:文件被截断时保存禁用(防截断写回);草稿超上限仍提示', async () => {
  const panel = await mountPanel('profile-card', 'ProfileCard', {
    payloads: { profile: profileFixture({ truncated: true }) },
  })
  try {
    let tree = panel.render()
    assert.ok(collectText(tree).includes('perTruncatedTitle'), '载入被截断时给警告')
    // 改成"有改动"(dirty)状态:正常文件此时应可保存,但源文件超长必须禁用(R13a,防尾部丢失)
    collectByProp(tree, 'spellCheck')[0].props.onChange({ target: { value: '精简后的草稿' } })
    tree = panel.render()
    assert.equal(buttonByText(tree, 'profileSave').props.disabled, true,
      '源文件超长 → 即使有改动也禁用保存(行为变化:后端同样会拒绝)')
    // 草稿超上限提示保留(输入态提示,不是拦截依据)
    collectByProp(tree, 'spellCheck')[0].props.onChange({ target: { value: 'x'.repeat(20_001) } })
    tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('perOverLimit'), '超上限提示')
    const charcount = collectByProp(tree, 'data-over')
      .find((node) => String(node.props.className ?? '').includes('per-charcount'))
    assert.ok(charcount !== undefined, '字符计数带 data-over')
    assert.equal(charcount.props['data-over'], 'true', '超限时标记超限')
    assert.equal(buttonByText(tree, 'profileSave').props.disabled, true, '超长/截断时保存始终禁用')
  } finally {
    panel.restore()
  }
})

// ══ SOUL SoulCard ═════════════════════════════════════════════════════════

test('接缝:SOUL_FIELDS 仍是两个 volatile 设置字段且顺序不变', () => {
  assert.deepEqual(SOUL_FIELDS, ['soulEnabled', 'soulSelfEditEnabled'])
  assert.equal(SOUL_FIELDS.length, 2)
})

test('SOUL:挂载即拉 soul,头部元信息/预览/最近 3 版就位', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', { payloads: { soul: soulFixture() } })
  try {
    const tree = panel.render()
    assert.deepEqual(actionsOf(panel.calls), ['soul'], '挂载即拉一次 SOUL')
    const texts = collectText(tree)
    for (const key of [
      'soulTitle', 'soulMaster', 'soulSelfEdit', 'soulPreviewTitle', 'soulEdit',
      'soulPreviewHint', 'soulRecentVersions', 'soulAllHistory', 'soulFootHint',
    ]) {
      assert.ok(texts.includes(key), `缺少文案 ${key}`)
    }
    for (const key of ['soulCharsUnit', 'soulTodayEdit', 'soulLastVersion', 'soulVersionCount', 'soulAuthorAgent']) {
      assert.ok(hasText(texts, key), `缺少元信息 ${key}`)
    }
    assert.ok(hasText(texts, '/ 2000'), '字符数 / 上限')
    assert.ok(hasText(texts, '1/5'), '今日自改预算')
    // 4 条历史只渲染最近 3 版
    assert.equal(nodesByClass(tree, 'mem-soul-v').length, 3, '卡片只渲染最近 3 版')
    assert.equal(texts.filter((text) => text === 'soulDiff').length, 3, '节奏一致的 diff 入口')
  } finally {
    panel.restore()
  }
})

test('SOUL:两个开关渲染当前值,点击写 configForms(自改 / 总开关)', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', { payloads: { soul: soulFixture() } })
  try {
    let tree = panel.render()
    let switches = collectByProp(tree, 'data-on')
    assert.equal(switches.length, 2, '总开关 + 允许自改两个开关')
    assert.deepEqual(switches.map((node) => node.props['data-on']), ['true', 'true'], '默认都开')

    switches[1].props.onClick()
    await panel.harness.tick()
    tree = panel.render()
    assert.deepEqual(panel.form.mutations[0], [{ op: 'set', path: ['soulSelfEditEnabled'], value: false }])
    switches = collectByProp(tree, 'data-on')
    assert.deepEqual(switches.map((node) => node.props['data-on']), ['true', 'false'], '自改开关状态跟着快照走')

    switches[0].props.onClick()
    await panel.harness.tick()
    assert.deepEqual(panel.form.mutations[1], [{ op: 'set', path: ['soulEnabled'], value: false }])
  } finally {
    panel.restore()
  }
})

test('SOUL:总开关关闭时「允许自改」置灰且点击无效(旧回归)', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture() },
    formValue: { soulEnabled: false, soulSelfEditEnabled: true },
  })
  try {
    const tree = panel.render()
    const disabled = collectByProp(tree, 'data-disabled')
    assert.equal(disabled.length, 1, '只有自改开关带 data-disabled 标记')
    const selfSwitch = disabled[0]
    assert.equal(selfSwitch.props['data-disabled'], 'true', '总开关关掉 → 自改开关置灰')
    assert.equal(selfSwitch.props['aria-disabled'], 'true', '无障碍状态同步')
    assert.equal(selfSwitch.props.tabIndex, -1, '置灰后不可聚焦')
    assert.equal(selfSwitch.props.title, 'soulSelfEditDisabled', '带解释性 title')

    selfSwitch.props.onClick()
    await panel.harness.tick()
    assert.equal(panel.form.mutations.length, 0, '置灰后点击不改配置')

    const master = collectByProp(tree, 'data-on')[0]
    assert.equal(master.props['aria-label'], 'soulMaster', '总闸标签键仍是 soulMaster')
    assert.equal(master.props.title, 'soulMasterHint', '总闸带解释性 title')
    master.props.onClick()
    await panel.harness.tick()
    assert.deepEqual(panel.form.mutations[0], [{ op: 'set', path: ['soulEnabled'], value: true }], '总开关本身仍可点')
  } finally {
    panel.restore()
  }
})

test('SOUL:总开关关闭时「编辑」入口仍可用(用户通道不受限,旧回归)', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture() },
    formValue: { soulEnabled: false, soulSelfEditEnabled: false },
  })
  try {
    let tree = panel.render()
    const edit = buttonByText(tree, 'soulEdit')
    assert.notEqual(edit.props.disabled, true, '「编辑」不得被总开关置灰')
    edit.props.onClick()
    tree = panel.render()
    assert.ok(collectText(tree).includes('soulEditorTitle'), '点击后编辑覆盖层照常打开')
    assert.equal(collectByProp(tree, 'spellCheck').length, 1, '编辑器就位')
  } finally {
    panel.restore()
  }
})

test('SOUL:回滚先二次确认;取消不调后端,确认后调 soulRollback 并刷新', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture(), soulRollback: { ok: true, id: 'soul_v5', chars: 0 } },
  })
  try {
    let tree = panel.render()
    buttonByText(tree, 'soulRollback').props.onClick()
    tree = panel.render()
    assert.ok(collectText(tree).includes('soulConfirm'), '出现二次确认条')
    assert.deepEqual(actionsOf(panel.calls), ['soul'], '未确认前不调后端')

    buttonByText(tree, 'soulCancel').props.onClick()
    tree = panel.render()
    assert.equal(collectText(tree).includes('soulConfirm'), false, '取消后确认条消失')
    assert.deepEqual(actionsOf(panel.calls), ['soul'], '取消不调后端')

    buttonByText(tree, 'soulRollback').props.onClick()
    tree = panel.render()
    buttonByText(tree, 'soulConfirmOk').props.onClick()
    await panel.harness.settle(4)
    assert.deepEqual(actionsOf(panel.calls), ['soul', 'soulRollback', 'soul'], '确认后回滚并重新拉取预览')
  } finally {
    panel.restore()
  }
})

test('SOUL:编辑覆盖层——超限提示、保存走 soulSave 后刷新并关闭', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture(), soulSave: { ok: true, id: 'soul_v5', chars: 12 } },
  })
  try {
    let tree = panel.render()
    buttonByText(tree, 'soulEdit').props.onClick()
    tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('soulEditorTitle'), '覆盖层打开')
    assert.ok(texts.includes('soulEditorSub'), '说明保存会新增版本')
    assert.equal(collectByProp(tree, 'spellCheck').length, 1, '编辑器就位')

    let editor = collectByProp(tree, 'spellCheck')[0]
    editor.props.onChange({ target: { value: 'x'.repeat(2001) } })
    tree = panel.render()
    assert.ok(collectText(tree).includes('soulOverLimit'), '超上限提示')
    assert.equal(buttonByText(tree, 'soulSave').props.disabled, true, '超上限禁止保存')
    const charcount = collectByProp(tree, 'data-over')
      .find((node) => String(node.props.className ?? '').includes('mem-charcount'))
    assert.equal(charcount.props['data-over'], 'true', '字符计数标红')

    editor = collectByProp(tree, 'spellCheck')[0]
    editor.props.onChange({ target: { value: '新的人格设定' } })
    tree = panel.render()
    buttonByText(tree, 'soulSave').props.onClick()
    await panel.harness.settle(4)
    tree = panel.render()
    const saveCall = panel.calls.find((call) => call.action === 'soulSave')
    assert.equal(saveCall.body.content, '新的人格设定', '保存发出编辑器内容')
    assert.ok(hasText(collectText(tree), 'soulSaved'), '显示已保存')
    assert.equal(collectText(tree).includes('soulEditorTitle'), false, '保存后覆盖层关闭')
    assert.deepEqual(actionsOf(panel.calls).slice(-2), ['soulSave', 'soul'], '保存后重新拉取预览')
  } finally {
    panel.restore()
  }
})

test('SOUL:历史行「diff」拉取 soulVersion 并渲染增删行', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: {
      soul: soulFixture(),
      soulVersion: {
        ok: true,
        entry: {
          id: 'soul_v4', ts: '2026-11-01T08:00:00.000Z', author: 'agent', reason: '自动改写',
          prevContent: '旧的一行', nextContent: '新的一行',
        },
      },
    },
  })
  try {
    let tree = panel.render()
    buttonByText(tree, 'soulDiff').props.onClick()
    await panel.harness.settle(4)
    tree = panel.render()
    const call = panel.calls.find((candidate) => candidate.action === 'soulVersion')
    assert.ok(call !== undefined, 'diff 走 soulVersion')
    assert.equal(call.body.id, 'soul_v4', '带版本 id')
    const texts = collectText(tree)
    assert.ok(hasText(texts, 'soulDiffTitle'), 'diff 覆盖层标题')
    assert.ok(hasText(texts, '旧的一行') && hasText(texts, '新的一行'), '展示前后内容')
    const classes = collectByProp(tree, 'className').map((node) => String(node.props.className ?? ''))
    assert.ok(classes.some((name) => name.includes('add')), '新增行有 add 标记')
    assert.ok(classes.some((name) => name.includes('del')), '删除行有 del 标记')
  } finally {
    panel.restore()
  }
})

test('SOUL:覆盖层内回滚确认条出现,并在覆盖层确认后调 soulRollback(旧回归)', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture(), soulRollback: { ok: true, id: 'soul_v5', chars: 0 } },
  })
  try {
    let tree = panel.render()
    buttonByText(tree, 'soulEdit').props.onClick()
    tree = panel.render()
    const rollbacks = findByText(tree, 'soulRollback')
    rollbacks[rollbacks.length - 1].props.onClick()
    tree = panel.render()
    assert.ok(
      collectByProp(tree, 'className').some((node) => node.props.className === 'mem-overlay-confirm'),
      '覆盖层内出现确认条(不是只在卡片后面)',
    )
    const confirms = findByText(tree, 'soulConfirmOk')
    confirms[confirms.length - 1].props.onClick()
    await panel.harness.settle(4)
    assert.ok(panel.calls.some((candidate) => candidate.action === 'soulRollback'), '覆盖层确认后真的调 soulRollback')
  } finally {
    panel.restore()
  }
})

test('SOUL:人格提议「采纳」走 soulAdoptProposal 并刷新', async () => {
  const proposal = { id: 'm_prop1', content: '我回复倾向于简短,先给结论。', createdAt: '2026-10-20T00:00:00.000Z' }
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: {
      soul: soulFixture({ proposals: [proposal] }),
      soulAdoptProposal: { ok: true, id: 'soul_v5', chars: 20 },
    },
  })
  try {
    let tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('soulProposals'), '提议区标题渲染')
    assert.ok(hasText(texts, '我回复倾向于简短'), '提议内容渲染')
    buttonByText(tree, 'soulAdopt').props.onClick()
    await panel.harness.settle(4)
    const call = panel.calls.find((candidate) => candidate.action === 'soulAdoptProposal')
    assert.ok(call !== undefined, '采纳走 soulAdoptProposal')
    assert.equal(call.body.id, 'm_prop1')
    assert.ok(collectText(panel.render()).includes('soulAdopted'), '显示已采纳')
    assert.deepEqual(actionsOf(panel.calls).slice(-2), ['soulAdoptProposal', 'soul'], '采纳后刷新预览')
  } finally {
    panel.restore()
  }
})

test('SOUL:人格提议「忽略」走 soulIgnoreProposal 并刷新', async () => {
  const proposal = { id: 'm_prop2', content: '我说话更直一点。', createdAt: '2026-10-20T00:00:00.000Z' }
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: {
      soul: soulFixture({ proposals: [proposal] }),
      soulIgnoreProposal: { ok: true },
    },
  })
  try {
    const tree = panel.render()
    assert.ok(collectText(tree).includes('soulIgnore'), '有忽略入口')
    buttonByText(tree, 'soulIgnore').props.onClick()
    await panel.harness.settle(4)
    assert.ok(panel.calls.some((candidate) => candidate.action === 'soulIgnoreProposal'), '忽略走 soulIgnoreProposal')
    assert.ok(collectText(panel.render()).includes('soulIgnored'), '显示已忽略')
  } finally {
    panel.restore()
  }
})

test('SOUL:空 SOUL 给写第一版引导,点击打开编辑覆盖层', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture({ content: '', chars: 0, lastVersion: null, history: [] }) },
  })
  try {
    let tree = panel.render()
    const texts = collectText(tree)
    for (const key of ['soulEmptyTitle', 'soulEmptyBody', 'soulCreate']) {
      assert.ok(texts.includes(key), `空态缺少 ${key}`)
    }
    assert.equal(texts.includes('soulEdit'), false, '没有预览片段就没有「编辑」入口')
    assert.ok(texts.includes('soulNoFile'), '元信息标记文件不存在')
    buttonByText(tree, 'soulCreate').props.onClick()
    tree = panel.render()
    assert.ok(collectText(tree).includes('soulEditorTitle'), '写第一版打开编辑覆盖层')
    assert.equal(collectByProp(tree, 'spellCheck')[0].props.value, '', '编辑器为空')
  } finally {
    panel.restore()
  }
})

test('SOUL:加载失败显示错误横幅', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: new Error('SOUL 运行时缺席') },
  })
  try {
    const texts = collectText(panel.render())
    assert.ok(texts.includes('commonError'), '错误横幅标题')
    assert.ok(hasText(texts, 'SOUL 运行时缺席'), '错误原因如实展示')
  } finally {
    panel.restore()
  }
})

test('SOUL:未落盘时历史区提示不可用', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: { soul: soulFixture({ persisted: false, history: [] }) },
  })
  try {
    const texts = collectText(panel.render())
    assert.ok(texts.includes('soulUnpersisted'), '存储未落盘 → 历史不可用')
    assert.equal(texts.includes('soulRecentVersions'), false, '不假装有「最近 3 版」')
  } finally {
    panel.restore()
  }
})

test('SOUL:「全部历史」打开覆盖层并列出全部版本(卡片只留最近 3 版)', async () => {
  const panel = await mountPanel('soul-card', 'SoulCard', { payloads: { soul: soulFixture() } })
  try {
    let tree = panel.render()
    assert.equal(nodesByClass(tree, 'mem-soul-v').length, 3, '卡片最近 3 版')
    buttonByText(tree, 'soulAllHistory').props.onClick()
    tree = panel.render()
    assert.equal(nodesByClass(tree, 'mem-soul-v').length, 3 + 4, '覆盖层侧栏列出全部 4 版')
    assert.ok(hasText(collectText(tree), 'soulVersionCount'), '覆盖层带版本计数')
  } finally {
    panel.restore()
  }
})


test('SOUL:整篇提议「采纳」先开 diff 覆盖层,确认后才落笔(0.7.0)', async () => {
  const proposal = {
    id: 'm_full1', content: '# Vector\n\n新人格。', mode: 'replace', reason: '语气太像通用助手',
    chars: 15, createdAt: '2026-10-20T00:00:00.000Z',
  }
  const panel = await mountPanel('soul-card', 'SoulCard', {
    payloads: {
      soul: soulFixture({ proposals: [proposal] }),
      soulAdoptProposal: { ok: true, id: 'soul_v6', chars: 15 },
    },
  })
  try {
    const tree = panel.render()
    const texts = collectText(tree)
    assert.ok(texts.includes('soulProposalReplace'), '渲染整篇徽章')
    assert.ok(texts.includes('语气太像通用助手'), '渲染理由(不是整篇正文)')
    buttonByText(tree, 'soulAdopt').props.onClick()
    const opened = panel.render()
    assert.equal(panel.calls.some((c) => c.action === 'soulAdoptProposal'), false, '未确认前不得落笔')
    assert.ok(collectText(opened).includes('soulProposalDiffTitle'), '打开提议对比覆盖层')
    const confirms = findByText(opened, 'soulProposalAdoptHere')
    confirms[confirms.length - 1].props.onClick()
    await panel.harness.settle(4)
    const call = panel.calls.find((c) => c.action === 'soulAdoptProposal')
    assert.ok(call !== undefined, '覆盖层确认后才调 soulAdoptProposal')
    assert.equal(call.body.id, 'm_full1')
  } finally {
    panel.restore()
  }
})
