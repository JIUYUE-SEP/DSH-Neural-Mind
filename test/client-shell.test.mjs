/**
 * 记忆控制台外壳(v1.15)契约:
 *  - 模块 id / 注入服务 / 两个槽位成对注册不变(宿主 0.2.1 主侧栏契约);
 *  - 7 个页签、默认总览、首次切到才挂载(之后保持挂载);
 *  - 页头状态条由 overview 数据驱动;「刷新」重新拉取 overview;
 *  - overview 失败时显示错误横幅 + 重试。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadClientFactory, collectText, collectByProp, findByText,
  mountMemoryPage, makeClientCtx, findTab, findPanel, clickTab, packageName,
} from './helpers-client.mjs'

const overviewPayload = {
  ok: true,
  now: '2026-11-07T08:00:00.000Z',
  stats: { active: 12, staged: 2, archived: 3, hotTotal: 4, hotUndigested: 2, outboxPending: 1, outboxDead: 0, persisted: true },
  kinds: { fact: 9, lesson: 4, episode: 3 },
  embedded: { records: 10, total: 17, model: 'bge-m3', dimension: 1024 },
  workspaces: { total: 3, enabled: 2, disabled: 1 },
  embedding: { enabled: true, configured: true, available: true, model: 'bge-m3', dimension: 1024, baseUrl: 'http://127.0.0.1:11434/v1', keyless: false, lastFailure: '' },
  gate: { enabled: true, consensusCos: 0.35, consensusBm25: 2, soloCos: 0.55, soloBm25: 10, bm25OnlyMin: 2, bm25OnlyMinPoolSize: 30 },
  injection: {
    autoRecall: true,
    openingDigest: false,
    budgets: { injectMaxItems: 6, injectMaxChars: 1600, sessionInjectMaxChars: 6000, excerptChars: 160 },
    recent: [],
    counts: { inject: 0, resident: 0, skip: 0, chars: 0, records: 0 },
  },
  soul: { enabled: true, chars: 420, versions: 3, dailyUsed: 0, dailyBudget: 5 },
  profile: { configured: true, path: 'C:/x/neural-mind-profile.md', injectionChars: 1200 },
  audit: { recent: [] },
}

test('外壳:模块 id 等于包名;主侧栏入口 + main 面板成对注册,id 同源', async () => {
  const def = await loadClientFactory()
  assert.equal(def.id, packageName(), 'loader 按包名查工厂,id 漂移则页面不出现')
  for (const svc of ['slots', 'locale', 'configForms']) assert.ok(def.inject.includes(svc), `inject 缺 ${svc}`)

  const module = def.factory(() => ({
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useSyncExternalStore: (_s, getSnapshot) => getSnapshot(),
  }))
  const { registered } = makeClientCtx(module)
  assert.equal(registered.length, 2, '注册 main 与 sidebar.panellist 两项')
  assert.ok(registered.every(({ descriptor }) => descriptor.name !== 'settings.section'), '设置弹窗入口必须删除')

  const main = registered.find(({ descriptor }) => descriptor.name === 'main')
  const panel = registered.find(({ descriptor }) => descriptor.name === 'sidebar.panellist')
  assert.equal(main.descriptor.key, 'neural-mind', 'main 的 key 就是面板 id')
  assert.equal(panel.descriptor.id, 'neural-mind', '侧栏 id 与 main key 同源')
  assert.ok(panel.descriptor.order > 10, '排在「自动化任务」(order 10)之后')
  assert.equal(panel.descriptor.locale, 'neural-mind')
  assert.equal(panel.descriptor.label(), 'tab', '侧栏标签走词典')
  assert.deepEqual(main.descriptor.inject(), { form: main.descriptor.inject().form }, 'main 注入配置表单 controller')
})

test('外壳:7 个页签、默认总览、首次切到才挂载(之后保持挂载)', async () => {
  const mounted = await mountMemoryPage({ payloads: { overview: overviewPayload } })
  try {
    const { harness, tree } = mounted
    const tabs = collectByProp(tree, 'data-tab')
    assert.deepEqual(tabs.map((node) => node.props['data-tab']), ['overview', 'memories', 'recall', 'config', 'profile', 'soul', 'audit'], '7 个页签按顺序')
    const active = tabs.filter((node) => node.props['aria-selected'] === true)
    assert.equal(active.length, 1, '同时只有一个选中页签')
    assert.equal(active[0].props['data-tab'], 'overview', '默认在总览')

    // 首屏只挂总览:其余面板的 children 必须是 [null](未访问过;h(div,...,null) 会包一层)
    for (const id of ['memories', 'recall', 'config', 'profile', 'soul', 'audit']) {
      const panel = findPanel(tree, id)
      assert.ok(panel !== undefined, `面板 ${id} 存在`)
      assert.ok(Array.isArray(panel.children) && panel.children.every((child) => child === null), `面板 ${id} 未访问前不挂载`)
    }
    const overviewPanel = findPanel(tree, 'overview')
    assert.ok(Array.isArray(overviewPanel.children) && overviewPanel.children.some((child) => child !== null), '默认面板已挂载')

    // 切到「审计」:挂载审计面板;未访问的「配置」仍不挂载
    let next = await clickTab(harness, tree, 'audit')
    assert.ok(Array.isArray(findPanel(next, 'audit').children) && findPanel(next, 'audit').children.some((child) => child !== null), '访问后挂载审计面板')
    assert.ok(Array.isArray(findPanel(next, 'config').children) && findPanel(next, 'config').children.every((child) => child === null), '未访问的配置面板仍不挂载')
    assert.ok(mounted.calls.some((call) => call.action === 'audit'), '审计面板挂载即拉取 audit')

    // 切到「配置」后,再切回「总览」:配置面板保持挂载(不重建)
    next = await clickTab(harness, next, 'config')
    assert.ok(Array.isArray(findPanel(next, 'config').children) && findPanel(next, 'config').children.some((child) => child !== null), '访问后挂载配置面板')
    next = await clickTab(harness, next, 'overview')
    assert.ok(Array.isArray(findPanel(next, 'config').children) && findPanel(next, 'config').children.some((child) => child !== null), '切走后配置面板仍挂载(状态不丢)')
    assert.ok(Array.isArray(findPanel(next, 'overview').children) && findPanel(next, 'overview').children.some((child) => child !== null), '总览仍在挂载')
  } finally {
    mounted.restore()
  }
})

test('外壳:状态条由 overview 驱动;「刷新」重新拉取 overview', async () => {
  const mounted = await mountMemoryPage({ payloads: { overview: overviewPayload } })
  try {
    const { harness, tree } = mounted
    const texts = collectText(tree)
    assert.ok(texts.some((text) => text.startsWith('stStorage')), '状态条含存储状态')
    assert.ok(texts.some((text) => text.startsWith('stVector')), '状态条含向量路状态')
    assert.ok(texts.some((text) => text.startsWith('stRecall')), '状态条含自动召回状态')
    assert.ok(texts.some((text) => text.startsWith('stScope')), '状态条含工作区范围状态')

    const chips = collectByProp(tree, 'data-tone')
    const tones = chips.map((node) => node.props['data-tone'])
    assert.ok(tones.includes('ok'), '已落盘/向量可用/自动召回 → 有 ok 态')
    assert.ok(tones.includes('warn'), '停用 1 个工作区 → 有 warn 态')

    assert.equal(mounted.calls.filter((call) => call.action === 'overview').length, 1, '首屏只拉一次 overview')
    const refresh = collectByProp(tree, 'title').find((node) => node.props.title === 'headerRefreshHint')
    assert.ok(refresh !== undefined, '页头有刷新按钮')
    refresh.props.onClick()
    await harness.tick()
    await harness.settle(4)
    assert.equal(mounted.calls.filter((call) => call.action === 'overview').length, 2, '刷新重新拉 overview')
  } finally {
    mounted.restore()
  }
})

test('外壳:overview 失败显示错误横幅,重试后恢复', async () => {
  const mounted = await mountMemoryPage({ payloads: { overview: new Error('boom') } })
  try {
    const { harness, tree } = mounted
    const texts = collectText(tree)
    assert.ok(texts.includes('commonError'), '显示错误横幅标题')
    assert.ok(texts.includes('boom'), '错误原因如实展示')

    // 换回成功响应后点重试 → 恢复 KPI,不再显示错误横幅
    mounted.payloads.overview = overviewPayload
    const retry = findByText(tree, 'commonRetry').pop()
    assert.ok(retry !== undefined, '横幅里有重试按钮')
    retry.props.onClick()
    await harness.tick()
    await harness.settle(4)
    const after = harness.rerender()
    assert.ok(!collectText(after).includes('boom'), '恢复后不再显示错误')
    const alerts = collectByProp(after, 'role').filter((node) => node.props.role === 'alert')
    assert.equal(alerts.length, 0, '错误横幅消失')
  } finally {
    mounted.restore()
  }
})

test('外壳:页签文本走词典,总览卡拿到 overview 数据', async () => {
  const mounted = await mountMemoryPage({ payloads: { overview: overviewPayload } })
  try {
    const texts = collectText(mounted.tree)
    for (const label of ['navOverview', 'navMemories', 'navRecall', 'navConfig', 'navProfile', 'navSoul', 'navAudit']) {
      assert.ok(texts.includes(label), `页签文本 ${label} 在`)
    }
    assert.ok(texts.includes('navOverview'), '总览卡标题')
    // 暂存条数徽章:stats.staged = 2 → 记忆页签上带 2
    const memoryTab = findTab(mounted.tree, 'memories')
    assert.ok(JSON.stringify(memoryTab.children ?? []).includes('2'), '记忆页签带暂存计数徽章')
  } finally {
    mounted.restore()
  }
})
