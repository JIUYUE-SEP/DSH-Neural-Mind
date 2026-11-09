/**
 * 「召回」试验台 + 「审计」面板(v1.15)契约测试。
 *
 * 沿用 test/helpers-client.mjs 的测试姿势:
 *  - 迷你 hooks 运行时(createHarness)+ 按 action 路由的 fetch 替身(makeFetchRouter);
 *  - 词典注入 `t: (key) => key`,断言按 key 而不是中文文案(SPEC §11);
 *  - 每次挂载前后恢复 globalThis.fetch,避免污染同进程里的其它测试。
 *
 * 覆盖(SPEC §7.3/§7.6):
 *  召回——运行成功渲染(摘要/闸门/两路徽章/原始分/注入预览)、无命中、检索不可用、
 *        展开系数与 chunk、超预算标红、表单校验与清空、refreshKey 跟随刷新;
 *  审计——动态类型下拉/条数、类型筛选+搜索+清除筛选、空态、错误重试、refreshKey 刷新;
 *  词典——源码里用到的 key 中英文齐全。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  createHarness, makeFetchRouter, collectText, collectByProp,
} from './helpers-client.mjs'
import { initRuntime } from '../lib/client/runtime.js'
import { RecallCard } from '../lib/client/recall-card.js'
import { AuditCard } from '../lib/client/audit-card.js'
import { zh as baseZh, en as baseEn } from '../lib/client/i18n/base.js'
import { zh as rcZh, en as rcEn } from '../lib/client/i18n/recall.js'

// ── 测试基建 ─────────────────────────────────────────────────────────────

/**
 * 挂载单张面板卡(整页挂载对这两个面板太重:不经过外壳,直接测面板契约)。
 * props 变化用 `setProps`(rerender,不重建 state),`refreshKey` 就靠它模拟页头刷新。
 */
function mountCard(Card, options = {}) {
  const harness = createHarness()
  initRuntime(harness.react)
  const payloads = options.payloads ?? {}
  const router = makeFetchRouter(payloads)
  const previousFetch = globalThis.fetch
  globalThis.fetch = router.fetch
  let props = { t: (key) => key, refreshKey: 0, ...(options.props ?? {}) }
  let tree = harness.mount(() => harness.react.createElement(Card, props))

  const refresh = () => {
    tree = harness.rerender()
    return tree
  }
  const settle = async (rounds = 8) => {
    await harness.settle(rounds)
    tree = harness.rerender()
    return tree
  }
  const manager = {
    harness,
    router,
    payloads,
    get tree() { return tree },
    refresh,
    settle,
    setProps(next) {
      props = { ...props, ...next }
      return refresh()
    },
    /** 按 data 属性取节点;value 省略表示取全部。 */
    nodes(attr, value) {
      return collectByProp(tree, attr).filter((node) => value === undefined || node.props[attr] === value)
    },
    /** 触发受控输入的 onChange(value)。 */
    setValue(attr, value) {
      const node = manager.nodes(attr)[0]
      assert.ok(node !== undefined, `找不到 ${attr} 控件`)
      node.props.onChange({ target: { value } })
      return refresh()
    },
    /** 点一个 data-action 按钮(同步,不等异步请求)。 */
    click(action) {
      const node = manager.nodes('data-action', action)[0]
      assert.ok(node !== undefined, `找不到 action=${action} 按钮`)
      node.props.onClick()
      return refresh()
    },
    restore() {
      globalThis.fetch = previousFetch
    },
  }
  return manager
}

const textsOf = (mgr) => collectText(mgr.tree).map((text) => String(text))
const hasText = (mgr, needle) => textsOf(mgr).some((text) => text.includes(needle))
const alertsOf = (mgr) => mgr.nodes('role').filter((node) => node.props.role === 'alert')
const nodeText = (node) => collectText(node).join(' ')
const callsOf = (mgr, action) => mgr.router.calls.filter((call) => call.action === action)
/** 审计搜索框在 SearchBox 内部,按 mem-search-input 类名找。 */
const searchInputOf = (mgr) => collectByProp(mgr.tree, 'className')
  .find((node) => typeof node.props.className === 'string' && node.props.className.includes('mem-search-input'))

// ── 召回:fixtures ────────────────────────────────────────────────────────

const WORKSPACES = {
  ok: true,
  workspaces: [
    { id: 'A:\\proj\\dsh-memory', label: 'dsh-memory', count: 12, lastSeenMs: 2, disabled: false },
    { id: 'A:\\proj\\other', label: 'other', count: 2, lastSeenMs: 1, disabled: true },
  ],
}

const GATE = {
  enabled: true,
  consensusCos: 0.35,
  consensusBm25: 2,
  soloCos: 0.55,
  soloBm25: 10,
  bm25OnlyMin: 2,
  bm25OnlyMinPoolSize: 30,
}

const BUDGETS = { injectMaxItems: 6, injectMaxChars: 1600, excerptChars: 160 }

/** 一次成功试验的响应(SPEC §6.5);用 overrides 拼"无命中/超预算"变体。 */
function recallResult(overrides = {}) {
  return {
    ok: true,
    query: '部署脚本放哪',
    workspaceId: 'A:\\proj\\dsh-memory',
    vectorRan: true,
    coldStart: false,
    lanes: { pool: 17, bm25: 5, vector: 2 },
    gate: GATE,
    budgets: BUDGETS,
    hits: [
      {
        id: 'mem_1',
        content: '部署脚本放在 scripts/deploy.ps1,用 -Env staging 参数',
        kind: 'fact',
        status: 'active',
        workspaceLabel: 'dsh-memory',
        eventTime: '2026-11-06T10:00:00.000Z',
        importance: 6,
        score: 2.13,
        relevance: 0.032,
        bm25Raw: 12.5,
        cos: 0.211,
        lanes: { bm25: true, vector: true },
        parts: { relevance: 0.032, time: 1.1, evidence: 1.2, workspace: 1, entity: 1, status: 1, E: 1.2 },
        chunk: 'scripts/deploy.ps1 -Env staging',
      },
      {
        id: 'mem_2',
        content: '明天下午三点开评审会',
        kind: 'episode',
        status: 'active',
        workspaceLabel: 'dsh-memory',
        eventTime: '2026-11-05T09:00:00.000Z',
        importance: 4,
        score: 1.02,
        relevance: 0.016,
        bm25Raw: 0,
        cos: 0.18,
        lanes: { bm25: false, vector: true },
        parts: { relevance: 0.016, time: 1, evidence: 1, workspace: 1, entity: 1, status: 1, E: 0.5 },
        chunk: null,
      },
    ],
    preview: {
      chars: 512,
      lines: [
        '- [dsh-memory · 2h] 部署脚本放在 scripts/deploy.ps1',
        '- [dsh-memory · 1d] 明天下午三点开评审会',
      ],
    },
    ...overrides,
  }
}

/** 在成功挂载后填查询并运行。 */
async function runExperiment(mgr, { query = '部署脚本放哪', workspaceId } = {}) {
  await mgr.settle()
  mgr.setValue('data-recall-query', query)
  if (workspaceId !== undefined) mgr.setValue('data-recall-workspace', workspaceId)
  mgr.click('recall-run')
  await mgr.settle()
}

// ── 召回:测试 ────────────────────────────────────────────────────────────

test('召回:运行成功渲染摘要条、闸门 chips、两路徽章与注入预览', async () => {
  const mgr = mountCard(RecallCard, {
    payloads: { workspaces: WORKSPACES, recallPreview: recallResult() },
  })
  try {
    await mgr.settle()
    // 工作区下拉来自 api("workspaces"):首项「不指定」+ 两个已知工作区
    const select = mgr.nodes('data-recall-workspace')[0]
    assert.equal(select.props.value, '', '默认不指定工作区')
    const options = nodeText(select)
    assert.ok(options.includes('rcWorkspaceAny'), '首项是「不指定」')
    assert.ok(options.includes('dsh-memory'), '选项里有真实工作区')

    await runExperiment(mgr, { workspaceId: 'A:\\proj\\dsh-memory' })

    // 请求体:查询/工作区/条数(默认 8)
    const calls = callsOf(mgr, 'recallPreview')
    assert.equal(calls.length, 1, '只发一次 recallPreview')
    assert.deepEqual(calls[0].body, {
      action: 'recallPreview',
      query: '部署脚本放哪',
      workspaceId: 'A:\\proj\\dsh-memory',
      limit: 8,
    })

    // 摘要条:候选池/BM25/向量/向量路开
    assert.ok(nodeText(mgr.nodes('data-summary', 'pool')[0]).includes('17'))
    assert.ok(nodeText(mgr.nodes('data-summary', 'bm25')[0]).includes('5'))
    assert.ok(nodeText(mgr.nodes('data-summary', 'vector')[0]).includes('2'))
    assert.ok(nodeText(mgr.nodes('data-summary', 'lane')[0]).includes('rcVectorOn'), '向量路显示「开」')

    // 闸门 chips:开关 + 共识线 + 单路线 + 纯 BM25 门槛
    assert.deepEqual(
      mgr.nodes('data-gate').map((node) => node.props['data-gate']),
      ['gate', 'consensus', 'solo', 'bm25Only'],
    )
    assert.ok(nodeText(mgr.nodes('data-gate', 'consensus')[0]).includes('rcRuleConsensus'))

    // 命中列表:两条、排名顺序、正文摘要、两路徽章、score/relevance/原始分
    assert.deepEqual(
      mgr.nodes('data-hit-id').map((node) => node.props['data-hit-id']),
      ['mem_1', 'mem_2'],
    )
    assert.ok(hasText(mgr, '部署脚本放在 scripts/deploy.ps1'), '展示正文摘要')
    assert.deepEqual(
      mgr.nodes('data-lane-badge').map((node) => node.props['data-lane-badge']),
      ['bm25', 'vector', 'bm25', 'vector'],
      '每条命中都有两路徽章',
    )
    assert.ok(nodeText(mgr.nodes('data-metric', 'score')[0]).includes('2.13'), '综合分')
    assert.ok(nodeText(mgr.nodes('data-metric', 'relevance')[0]).includes('0.032'), 'relevance')
    assert.ok(nodeText(mgr.nodes('data-metric', 'bm25Raw')[0]).includes('12.50'), 'BM25 原始分')
    assert.ok(nodeText(mgr.nodes('data-metric', 'cos')[0]).includes('0.211'), 'cos')

    // 注入预览:等宽行 + 字符预算脚注
    assert.equal(mgr.nodes('data-preview-line').length, 2, 'preview.lines 逐行渲染')
    assert.ok(hasText(mgr, 'rcPreviewBudget'), '脚注显示字符预算(测试里 t 返回 key)')
    assert.ok(!hasText(mgr, 'rcUnavailable'), '成功结果不应出现「检索不可用」')
  } finally {
    mgr.restore()
  }
})

test('召回:检索正常但没有命中 → 空态,而不是错误(纯 BM25/闸门关闭/冷启动也能展示)', async () => {
  const mgr = mountCard(RecallCard, {
    payloads: {
      workspaces: WORKSPACES,
      recallPreview: recallResult({
        vectorRan: false,
        coldStart: true,
        gate: { enabled: false },
        lanes: { pool: 9, bm25: 0, vector: 0 },
        hits: [],
        preview: { chars: 0, lines: [] },
      }),
    },
  })
  try {
    await runExperiment(mgr)
    // 不指定工作区时请求体不带 workspaceId(交给宿主按"无本地工作区"口径)
    assert.equal('workspaceId' in callsOf(mgr, 'recallPreview')[0].body, false)
    assert.ok(hasText(mgr, 'rcEmptyTitle'), '空结果是 rcEmptyTitle')
    assert.ok(hasText(mgr, 'rcEmptyHint'))
    assert.ok(!hasText(mgr, 'rcUnavailable'), '空结果不是检索不可用')
    assert.equal(alertsOf(mgr).length, 0, '空态不弹错误横幅')
    assert.ok(hasText(mgr, 'rcPreviewEmpty'), '没有可注入内容时预览给说明')
    // 摘要条要如实交代"向量路关闭/冷启动";闸门关闭时只留开关 chip
    assert.ok(nodeText(mgr.nodes('data-summary', 'lane')[0]).includes('rcVectorOff'))
    assert.equal(mgr.nodes('data-summary', 'cold').length, 1, '冷启动时展示收紧提示')
    assert.deepEqual(mgr.nodes('data-gate').map((node) => node.props['data-gate']), ['gate'], '闸门关闭不再展示阈值')
  } finally {
    mgr.restore()
  }
})

test('召回:ok:false(检索不可用)与「没有命中」区分,重试可恢复', async () => {
  const payloads = {
    workspaces: WORKSPACES,
    recallPreview: { ok: false, error: '记忆检索暂时不可用' },
  }
  const mgr = mountCard(RecallCard, { payloads })
  try {
    await runExperiment(mgr)
    assert.ok(hasText(mgr, 'rcUnavailable'), '错误横幅标题是「检索不可用」')
    assert.ok(hasText(mgr, '记忆检索暂时不可用'), '如实展示宿主错误原因')
    assert.equal(alertsOf(mgr).length, 1, '错误横幅 role=alert')
    assert.ok(!hasText(mgr, 'rcEmptyTitle'), '不可用不能伪装成空结果')

    // 换回成功响应后点「重试」→ 恢复
    mgr.payloads.recallPreview = recallResult()
    mgr.click('recall-retry')
    await mgr.settle()
    assert.ok(!hasText(mgr, 'rcUnavailable'), '重试成功后不再报错')
    assert.equal(mgr.nodes('data-hit-id').length, 2, '重试后显示命中')
  } finally {
    mgr.restore()
  }
})

test('召回:点击命中展开 7 项排序系数与命中 chunk;键盘也能展开', async () => {
  const mgr = mountCard(RecallCard, {
    payloads: { workspaces: WORKSPACES, recallPreview: recallResult() },
  })
  try {
    await runExperiment(mgr)
    assert.equal(mgr.nodes('data-part').length, 0, '默认折叠')

    mgr.nodes('data-hit-id', 'mem_1')[0].props.onClick()
    mgr.refresh()
    assert.equal(mgr.nodes('data-hit-id', 'mem_1')[0].props['aria-expanded'], true, '展开态写入 aria-expanded')
    assert.deepEqual(
      mgr.nodes('data-part').map((node) => node.props['data-part']),
      ['relevance', 'time', 'evidence', 'workspace', 'entity', 'status', 'E'],
      '7 个系数一排',
    )
    assert.ok(hasText(mgr, 'scripts/deploy.ps1 -Env staging'), '展开后显示命中 chunk')
    assert.ok(hasText(mgr, 'rcPartsTitle'))

    // 键盘可达:Enter 展开第二条(chunk 为 null → 给"没有片段"说明)
    const row = mgr.nodes('data-hit-id', 'mem_2')[0]
    row.props.onKeyDown({ key: 'Enter', target: row, currentTarget: row, preventDefault() {} })
    mgr.refresh()
    assert.equal(mgr.nodes('data-hit-id', 'mem_2')[0].props['aria-expanded'], true)
    assert.ok(hasText(mgr, 'rcChunkEmpty'), '没有向量片段时给说明而不是空块')
  } finally {
    mgr.restore()
  }
})

test('召回:注入预览超出字符预算时标红', async () => {
  const mgr = mountCard(RecallCard, {
    payloads: {
      workspaces: WORKSPACES,
      recallPreview: recallResult({
        // 防御性场景:预览本该按预算裁剪,超了说明口径不一致
        preview: { chars: 2000, lines: ['- 超长预览行'] },
      }),
    },
  })
  try {
    await runExperiment(mgr)
    const foot = mgr.nodes('data-preview-foot')[0]
    assert.ok(String(foot.props.className).includes('rc-preview-over'), '脚注带超预算类')
    assert.ok(hasText(mgr, 'rcPreviewOver'), '显示超预算提示')
    assert.ok(nodeText(mgr.nodes('data-preview-budget', 'chars')[0]).includes('rcPreviewBudget'), '同时显示 chars/max')
  } finally {
    mgr.restore()
  }
})

test('召回:空查询/非法条数不发请求;运行后可清空回初始态', async () => {
  const mgr = mountCard(RecallCard, { payloads: { workspaces: WORKSPACES } })
  try {
    await mgr.settle()

    // 条数输入:默认 8,范围 1–20(与宿主 recallPreview 的 limit 夹取一致)
    const limitInput = mgr.nodes('data-recall-limit')[0]
    assert.equal(limitInput.props.value, '8', '默认条数 8')
    assert.equal(limitInput.props.min, 1)
    assert.equal(limitInput.props.max, 20, '上限与宿主 limit 夹取一致')

    // 空查询:就地提示,不发请求
    mgr.click('recall-run')
    await mgr.settle()
    assert.ok(hasText(mgr, 'rcQueryRequired'))
    assert.equal(callsOf(mgr, 'recallPreview').length, 0, '空查询不发 recallPreview')

    // 非法条数:1–20 校验(21 已超上限)
    mgr.setValue('data-recall-query', '部署脚本放哪')
    mgr.setValue('data-recall-limit', '21')
    mgr.click('recall-run')
    await mgr.settle()
    assert.ok(hasText(mgr, 'rcLimitInvalid'))
    assert.equal(callsOf(mgr, 'recallPreview').length, 0, '非法条数不发请求')

    // 改回合法值 → 正常出结果
    mgr.setValue('data-recall-limit', '8')
    mgr.click('recall-run')
    await mgr.settle()
    assert.equal(callsOf(mgr, 'recallPreview').length, 1)
    assert.ok(hasText(mgr, 'rcResultTitle'))

    // 清空:表单与结果一起回初始态
    mgr.click('recall-clear')
    mgr.refresh()
    assert.ok(!hasText(mgr, 'rcResultTitle'), '清空后结果卡消失')
    assert.equal(mgr.nodes('data-recall-query')[0].props.value, '')
    assert.equal(mgr.nodes('data-recall-workspace')[0].props.value, '')
    assert.equal(mgr.nodes('data-recall-limit')[0].props.value, '8', '条数回到默认 8')
  } finally {
    mgr.restore()
  }
})

test('召回:refreshKey 自增(页头刷新)重新拉取工作区列表', async () => {
  const mgr = mountCard(RecallCard, { payloads: { workspaces: WORKSPACES } })
  try {
    await mgr.settle()
    assert.equal(callsOf(mgr, 'workspaces').length, 1, '挂载即拉一次工作区')
    mgr.setProps({ refreshKey: 1 })
    await mgr.settle()
    assert.equal(callsOf(mgr, 'workspaces').length, 2, '页头刷新跟随重新拉取')
  } finally {
    mgr.restore()
  }
})

// ── 审计:fixtures 与测试 ─────────────────────────────────────────────────

const AUDIT_ROWS = {
  ok: true,
  rows: [
    { id: 'a1', ts: '2026-11-07T08:00:00.000Z', kind: 'staging-confirmed', detail: 'mem_1: 部署脚本放哪' },
    { id: 'a2', ts: '2026-11-07T07:58:00.000Z', kind: 'embed-degraded', detail: 'HTTP 500(已降级纯 BM25)' },
    { id: 'a3', ts: '2026-11-07T07:50:00.000Z', kind: 'staging-confirmed', detail: 'mem_2: 明天下午开评审会' },
    { id: 'a4', ts: '2026-11-07T07:40:00.000Z', kind: 'forget-hard-redacted', detail: 'mem_3: 打码 2 条审计正文' },
  ],
}

test('审计:渲染行、动态收集类型下拉并统计条数', async () => {
  const mgr = mountCard(AuditCard, { payloads: { audit: AUDIT_ROWS } })
  try {
    await mgr.settle()
    assert.equal(callsOf(mgr, 'audit').length, 1, '挂载即拉取 audit')
    assert.equal(mgr.nodes('data-audit-row').length, 4, '4 条审计记录')
    assert.ok(hasText(mgr, 'staging-confirmed'))
    assert.ok(hasText(mgr, '部署脚本放哪'), 'detail 可读')
    assert.ok(hasText(mgr, 'HTTP 500(已降级纯 BM25)'))

    // 类型下拉:全部 + 返回数据里出现的 3 个 kind(不写死枚举)
    const select = mgr.nodes('data-audit-kind')[0]
    assert.equal(select.props.value, 'all')
    const optionText = nodeText(select)
    assert.ok(optionText.includes('auFilterAll'))
    for (const kind of ['staging-confirmed', 'embed-degraded', 'forget-hard-redacted']) {
      assert.ok(optionText.includes(kind), `下拉里有 ${kind}`)
    }
    // 条数统计
    assert.ok(nodeText(mgr.nodes('data-audit-count')[0]).includes('auCount'))
  } finally {
    mgr.restore()
  }
})

test('审计:类型筛选 + 关键词搜索(kind/detail)+ 清除筛选', async () => {
  const mgr = mountCard(AuditCard, { payloads: { audit: AUDIT_ROWS } })
  try {
    await mgr.settle()

    // 类型筛选
    mgr.setValue('data-audit-kind', 'staging-confirmed')
    assert.deepEqual(
      mgr.nodes('data-audit-row').map((node) => node.props['data-kind']),
      ['staging-confirmed', 'staging-confirmed'],
    )

    // 搜索命中 detail(大小写不敏感)
    mgr.setValue('data-audit-kind', 'all')
    const search = searchInputOf(mgr)
    assert.ok(search !== undefined, '有搜索框')
    search.props.onChange({ target: { value: 'http' } })
    mgr.refresh()
    assert.deepEqual(
      mgr.nodes('data-audit-row').map((node) => node.props['data-kind']),
      ['embed-degraded'],
      '按 detail 子串过滤',
    )

    // 搜索命中 kind
    searchInputOf(mgr).props.onChange({ target: { value: 'redacted' } })
    mgr.refresh()
    assert.deepEqual(
      mgr.nodes('data-audit-row').map((node) => node.props['data-kind']),
      ['forget-hard-redacted'],
      '按 kind 子串过滤',
    )

    // 无匹配 → 空态 + 清除筛选
    searchInputOf(mgr).props.onChange({ target: { value: '不存在的关键词' } })
    mgr.refresh()
    assert.equal(mgr.nodes('data-audit-row').length, 0)
    assert.ok(hasText(mgr, 'auNoMatchTitle'), '筛选无结果给空态')
    mgr.click('audit-reset')
    mgr.refresh()
    assert.equal(mgr.nodes('data-audit-row').length, 4, '清除筛选恢复全部')
    assert.equal(searchInputOf(mgr).props.value, '')
  } finally {
    mgr.restore()
  }
})

test('审计:没有记录时渲染空态(工具栏仍可用)', async () => {
  const mgr = mountCard(AuditCard, { payloads: { audit: { ok: true, rows: [] } } })
  try {
    await mgr.settle()
    assert.equal(mgr.nodes('data-audit-row').length, 0)
    assert.ok(hasText(mgr, 'auEmptyTitle'), '空态标题')
    assert.ok(hasText(mgr, 'auEmptyHint'))
    assert.equal(mgr.nodes('data-audit-kind').length, 1, '空态仍保留下拉')
    assert.equal(mgr.nodes('data-action', 'audit-refresh').length, 1, '空态仍保留刷新')
  } finally {
    mgr.restore()
  }
})

test('审计:加载失败显示错误横幅,重试后恢复', async () => {
  const payloads = { audit: new Error('boom') }
  const mgr = mountCard(AuditCard, { payloads })
  try {
    await mgr.settle()
    assert.ok(hasText(mgr, 'boom'), '如实展示错误原因')
    assert.ok(hasText(mgr, 'commonError'), '错误横幅标题')
    assert.equal(alertsOf(mgr).length, 1)

    mgr.payloads.audit = AUDIT_ROWS
    mgr.click('audit-retry')
    await mgr.settle()
    assert.ok(!hasText(mgr, 'boom'), '重试成功后不再报错')
    assert.equal(mgr.nodes('data-audit-row').length, 4)
  } finally {
    mgr.restore()
  }
})

test('审计:refreshKey 自增(页头刷新)重新拉取审计', async () => {
  const mgr = mountCard(AuditCard, { payloads: { audit: AUDIT_ROWS } })
  try {
    await mgr.settle()
    assert.equal(callsOf(mgr, 'audit').length, 1)
    mgr.setProps({ refreshKey: 1 })
    await mgr.settle()
    assert.equal(callsOf(mgr, 'audit').length, 2, '页头刷新跟随重新拉取')
    assert.equal(mgr.nodes('data-audit-row').length, 4, '刷新后数据仍在')
  } finally {
    mgr.restore()
  }
})

// ── 词典 ─────────────────────────────────────────────────────────────────

test('词典:召回/审计源码里的 t("key") 中英文都有,片段内 key 集合一致', () => {
  // 只合并 base + 本面板片段:自己的测试不依赖其它面板的词典文件(并行开发时互不拖累)。
  const dictZh = { ...baseZh, ...rcZh }
  const dictEn = { ...baseEn, ...rcEn }
  const used = new Set()
  for (const rel of ['../lib/client/recall-card.js', '../lib/client/audit-card.js']) {
    const source = readFileSync(new URL(rel, import.meta.url), 'utf8')
    // 先剥掉注释,避免注释里的示例被误扫(与 test/client-locale.test.mjs 同口径)
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    for (const match of code.matchAll(/\b(?:t|tt)\(\s*["']([A-Za-z][A-Za-z0-9_]*)["']/g)) used.add(match[1])
  }
  assert.ok(used.size > 30, `扫到的 key 数量看起来不对: ${used.size}`)
  assert.deepEqual([...used].filter((key) => !(key in dictZh)), [], 'zh 缺 key')
  assert.deepEqual([...used].filter((key) => !(key in dictEn)), [], 'en 缺 key')

  // 片段自身中英文 key 集合必须一致(漏写一种语言时当场红)
  assert.deepEqual([...Object.keys(rcZh)].filter((key) => !(key in rcEn)), [])
  assert.deepEqual([...Object.keys(rcEn)].filter((key) => !(key in rcZh)), [])
  // 不允许无声覆盖共享 base 词(同名 key 会让一种语言"看起来有、其实是旧文案")
  assert.deepEqual(Object.keys(rcZh).filter((key) => key in baseZh), [], '与 base 重复的 key')
  assert.ok(Object.keys(rcZh).length >= 75, '召回+审计词条数量异常')
})
