/**
 * 总览面板(v1.15)测试。
 *
 * 直接给 `OverviewCard` 灌 props(不经过外壳与其它面板的 import),这样并行开发期间
 * 别的面板文件未完成也不会让本文件假红;外壳集成契约由 `test/client-shell.test.mjs` 覆盖。
 *
 * 断言口径按 SPEC §11:注入 `t: (key) => key`,只断言 key/结构,不断言中文文案。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHarness, collectText, collectByProp } from './helpers-client.mjs'
import { initRuntime } from '../lib/client/runtime.js'
import { OverviewCard } from '../lib/client/overview-card.js'
import { zh, en } from '../lib/client/i18n/overview.js'
import { zh as baseZh, en as baseEn } from '../lib/client/i18n/base.js'
import { css } from '../lib/client/css/overview.js'

// ── 数据夹具(形状严格按 SPEC §6.1)────────────────────────────────────

function recentEntry(index, mode, reason = null) {
  return {
    ts: '2026-11-07T08:00:' + String(index).padStart(2, '0') + '.000Z',
    mode,
    reason,
    records: index === 0 ? 3 : index,
    chars: index === 0 ? 512 : index * 100,
    sessionId: 'sess_' + String(index).padStart(2, '0') + 'ab',
    workspaceLabel: index === 0 ? 'A:\\proj\\dsh-memory' : 'A:\\proj\\other',
    resident: 0,
    digest: 0,
    hitIds: [],
  }
}

const RECENT = [
  recentEntry(0, 'inject'),
  recentEntry(1, 'resident'),
  recentEntry(2, 'skip', 'no-hits'),
  recentEntry(3, 'skip', 'pressure'),
  recentEntry(4, 'digest'),
  recentEntry(5, 'skip', 'workspace-disabled'),
  recentEntry(6, 'inject'),
  recentEntry(7, 'skip', 'inline-timeout'),
  recentEntry(8, 'skip', 'subagent'),
  recentEntry(9, 'inject'),
]

const AUDIT = Array.from({ length: 8 }, (_, index) => ({
  id: 'audit-' + index,
  ts: '2026-11-07T07:' + String(50 + index) + ':00.000Z',
  kind: index % 2 === 0 ? 'memory.write' : 'memory.confirm',
  detail: 'audit-detail-' + index,
}))

function baseData() {
  return {
    ok: true,
    now: '2026-11-07T08:00:00.000Z',
    stats: {
      active: 12, staged: 2, archived: 3, hotTotal: 4, hotUndigested: 0, outboxPending: 0, outboxDead: 0, persisted: true,
      // R15a:进程内整理状态(首次整理前 lastExtract=null);丢弃计数按原因分开
      lastExtract: null,
      drops: { lowConfidence: 0, injection: 0, secret: 0, oversized: 0 },
    },
    kinds: { fact: 9, lesson: 4, episode: 4 },
    embedded: { records: 10, total: 17, model: 'bge-m3', dimension: 1024 },
    workspaces: { total: 3, enabled: 3, disabled: 0 },
    embedding: { enabled: true, configured: true, available: true, model: 'bge-m3', dimension: 1024, baseUrl: 'http://127.0.0.1:11434/v1', keyless: false, lastFailure: '' },
    gate: { enabled: true, consensusCos: 0.35, consensusBm25: 2, soloCos: 0.55, soloBm25: 10, bm25OnlyMin: 2, bm25OnlyMinPoolSize: 30 },
    injection: {
      autoRecall: true,
      openingDigest: false,
      budgets: { injectMaxItems: 6, injectMaxChars: 1600, sessionInjectMaxChars: 6000, excerptChars: 160 },
      recent: RECENT,
      counts: { inject: 4, resident: 1, skip: 3, chars: 2048, records: 11 },
    },
    soul: { enabled: true, chars: 420, versions: 3, dailyUsed: 0, dailyBudget: 5 },
    profile: { configured: true, path: 'C:/Users/x/.dsh/neural-mind-profile.md', injectionChars: 1200 },
    // v1.15 宿主 overview 新增:提炼通道状态(健康检查优先读数据面)
    extract: { enabled: true, batchTurns: 6, idleMinutes: 5 },
    audit: { recent: AUDIT },
  }
}

/** 生成一份数据,允许用例只覆盖几个字段(子对象做一层合并)。 */
function overviewData(overrides = {}) {
  const data = baseData()
  for (const key of Object.keys(overrides)) {
    const value = overrides[key]
    const base = data[key]
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && base !== null && typeof base === 'object') {
      data[key] = { ...base, ...value }
    } else {
      data[key] = value
    }
  }
  return data
}

// ── 迷你挂载 ───────────────────────────────────────────────────────────

function byClass(tree, name) {
  return collectByProp(tree, 'className').filter((node) => String(node.props.className).split(' ').includes(name))
}

function mountOverview(options = {}) {
  const harness = createHarness()
  initRuntime(harness.react)
  const overview = {
    data: options.data === undefined ? baseData() : options.data,
    error: options.error ?? '',
    loading: options.loading ?? false,
    reload: options.reload ?? (() => {}),
  }
  const props = {
    t: options.t ?? ((key) => key),
    form: options.form,
    overview,
    refreshKey: 0,
    onNavigate: options.onNavigate,
  }
  const tree = harness.mount(() => harness.react.createElement(OverviewCard, props))
  return { harness, tree, overview, props }
}

// ── 用例 ───────────────────────────────────────────────────────────────

test('总览:正常数据渲染健康摘要、KPI、自检、构成与审计', () => {
  const calls = []
  const t = (key, vars) => {
    calls.push({ key, vars })
    return key
  }
  const { tree } = mountOverview({ t })
  const texts = collectText(tree)

  // ① 顶部单行健康摘要(与 shell 页头状态条去重,只有 1 个 chip)
  const summary = collectByProp(tree, 'className').find((node) => node.props.className === 'ov-summary')
  assert.ok(summary !== undefined, '有健康摘要单行容器')
  const summaryChips = byClass(summary, 'mem-chip')
  assert.equal(summaryChips.length, 1, '健康摘要只有一个 chip')
  assert.equal(summaryChips[0].props['data-tone'], 'ok', '全部正常 → ok 语气')
  assert.ok(texts.includes('ovHealthTopOk'), '摘要文案:健康检查全部正常')

  // ② KPI 六格 + 数值/插值参数接线
  for (const key of ['ovKpiLongTerm', 'ovKpiHot', 'ovKpiOutbox', 'ovKpiEmbedded', 'ovKpiInjection', 'ovKpiWorkspaces']) {
    assert.ok(texts.includes(key), `KPI 含 ${key}`)
  }
  assert.equal(byClass(tree, 'mem-stat').length, 6, 'KPI 六格')
  assert.ok(texts.includes('17'), '长期记忆总数(12+2+3)')
  assert.ok(texts.includes('10/17'), '向量覆盖 = 已向量化/总数')
  const longTermSub = calls.find((call) => call.key === 'ovKpiLongTermSub')
  assert.deepEqual(longTermSub.vars, { active: 12, staged: 2, archived: 3 }, '长期记忆副标题带三项计数')
  const injectionSub = calls.find((call) => call.key === 'ovKpiInjectionSub')
  assert.deepEqual(injectionSub.vars, { chars: '2048', records: '11' }, '注入 KPI 带字符与命中数')

  // ③ 状态自检:7 项、全部 ok(摘要与明细共用同一份判定)
  const healthRows = byClass(tree, 'ov-health-row')
  assert.equal(healthRows.length, 7, '状态自检 7 项')
  assert.ok(healthRows.every((node) => node.props['data-tone'] === 'ok'), '正常数据下 7 项全 ok')
  for (const key of ['ovCheckStorageOk', 'ovCheckVectorOk', 'ovCheckExtractOk', 'ovCheckRecallOk', 'ovCheckWorkspaceOk', 'ovCheckProfileOk', 'ovCheckSoulOk']) {
    assert.ok(texts.includes(key), `自检含 ${key}`)
  }

  // ④ 记忆构成:2 组 × 3 行 Bar,占比按各自合计算
  const bars = collectByProp(tree, 'style').filter((node) => typeof node.props.style?.width === 'string')
  assert.equal(bars.length, 6, '两个分布各 3 条 Bar')
  const widths = bars.map((node) => node.props.style.width)
  assert.ok(widths.includes('52.9%'), 'fact 9/17 → 52.9%')
  assert.ok(widths.includes('70.6%'), 'active 12/17 → 70.6%')
  assert.ok(texts.includes('ovCompKinds') && texts.includes('ovCompStatus'), '两组分布标题')

  // ⑤ 审计与注入标题在位;正常态没有 alert
  assert.ok(texts.includes('ovInjectTitle') && texts.includes('ovAuditTitle'))
  assert.equal(collectByProp(tree, 'role').filter((node) => node.props.role === 'alert').length, 0, '正常态无错误横幅')
})

test('总览:数据未到时渲染骨架屏,不渲染看板', () => {
  const { tree } = mountOverview({ data: null, loading: true })
  assert.equal(byClass(tree, 'mem-skeleton').length, 1, '有骨架屏容器')
  assert.equal(byClass(tree, 'mem-skeleton-line').length, 6, '骨架 6 行')
  const texts = collectText(tree)
  assert.ok(texts.includes('commonLoading'), '骨架屏提示加载中')
  assert.ok(!texts.includes('ovKpiTitle'), '加载态不渲染看板')
})

test('总览:错误横幅展示原因,重试调用 overview.reload 并恢复', () => {
  let reloads = 0
  const options = {
    data: null,
    error: 'HTTP 500',
    reload: () => { reloads += 1 },
  }
  const { harness, tree, overview } = mountOverview(options)
  let texts = collectText(tree)
  assert.ok(texts.includes('commonError'), '错误横幅标题')
  assert.ok(texts.includes('HTTP 500'), '错误原因如实展示')
  const retry = collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'retry')
  assert.ok(retry !== undefined, '横幅里有重试按钮')
  retry.props.onClick()
  assert.equal(reloads, 1, '重试调用 overview.reload(由外壳真正重新拉取)')

  // 模拟外壳 reload 成功:错误清空、数据回来 → 看板恢复
  overview.error = ''
  overview.data = baseData()
  texts = collectText(harness.rerender())
  assert.ok(texts.includes('ovKpiTitle'), '恢复后显示看板')
  assert.equal(collectByProp(harness.rerender(), 'role').filter((node) => node.props.role === 'alert').length, 0, '错误横幅消失')
})

test('总览:长期池为空时给 Empty 引导(热缓冲不为空时改口径)', () => {
  const empty = overviewData({ stats: { active: 0, staged: 0, archived: 0, hotTotal: 0, hotUndigested: 0 } })
  const first = mountOverview({ data: empty })
  let texts = collectText(first.tree)
  assert.ok(texts.includes('ovEmptyTitle'), '空态标题')
  assert.ok(texts.includes('ovEmptyHint'), '空态引导:聊几轮先进热缓冲')
  assert.ok(byClass(first.tree, 'mem-empty').length >= 1, '用共享 Empty 组件')
  // 空池也保留顶部单行健康摘要(打开即知道存储/召回等状况)
  assert.ok(texts.includes('ovHealthTopOk'), '空池时仍有健康摘要')

  // 热缓冲已有内容:提示改成"已有 N 条会自动进来",不说"什么都没有"
  const hot = overviewData({ stats: { active: 0, staged: 0, archived: 0, hotTotal: 3, hotUndigested: 3 } })
  const second = mountOverview({ data: hot })
  texts = collectText(second.tree)
  assert.ok(texts.includes('ovEmptyHotHint'), '热缓冲非空时给对应引导')
  assert.ok(!texts.includes('ovEmptyHint'), '两种空态文案不混用')
})

test('总览:最近注入取前 8 条,模式徽章与跳过原因映射成人话', () => {
  const calls = []
  const t = (key, vars) => {
    calls.push({ key, vars })
    return key
  }
  const { tree } = mountOverview({ t })
  const texts = collectText(tree)

  assert.equal(byClass(tree, 'ov-inj-row').length, 8, '最多展示 8 条')
  assert.equal(byClass(tree, 'ov-inj-row')[0].props['data-mode'], 'inject', '行上带 data-mode')
  for (const key of ['ovModeInject', 'ovModeResident', 'ovModeSkip', 'ovModeDigest']) {
    assert.ok(texts.includes(key), `模式徽章 ${key}`)
  }
  for (const key of ['ovReasonNoHits', 'ovReasonPressure', 'ovReasonWorkspaceDisabled', 'ovReasonInlineTimeout']) {
    assert.ok(texts.includes(key), `跳过原因映射 ${key}`)
  }
  assert.ok(!texts.includes('ovReasonSubagent'), '第 9 条起不渲染(第 9 条是 subagent)')

  // 条数/字符通过 t 插值传参(测试里 t 返回 key,数值只能从调用参数验证)
  assert.ok(calls.some((call) => call.key === 'ovInjectRecords' && call.vars?.n === 3), '首条记录 3 条')
  assert.ok(calls.some((call) => call.key === 'ovInjectChars' && call.vars?.n === 512), '首条记录 512 字符')

  // 工作区短名 + 完整路径放 title;会话短 id
  const scopes = byClass(tree, 'ov-inj-scope')
  assert.ok(scopes.some((node) => collectText(node).join('') === 'dsh-memory'), '工作区显示末段短名')
  assert.equal(scopes[0].props.title, 'A:\\proj\\dsh-memory', '完整工作区路径放 title')
  const sessions = byClass(tree, 'ov-inj-session')
  assert.equal(collectText(sessions[0]).join(''), 'sess_00ab', '会话短 id')
})

test('总览:最近审计取前 6 条,onNavigate 可用时按钮跳审计页签', () => {
  const navigated = []
  const { tree } = mountOverview({ onNavigate: (id) => navigated.push(id) })
  assert.equal(byClass(tree, 'ov-audit-row').length, 6, '最多展示 6 条')
  const texts = collectText(tree)
  assert.ok(texts.includes('audit-detail-0'), '第 1 条在')
  assert.ok(!texts.includes('audit-detail-6'), '第 7 条起不渲染')

  const jump = collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'jump-audit')
  assert.ok(jump !== undefined, '有跳转按钮')
  jump.props.onClick()
  assert.deepEqual(navigated, ['audit'], 'onNavigate 收到审计页签 id')
})

test('总览:没有 onNavigate 时用静态提示代替跳转按钮', () => {
  const { tree } = mountOverview()
  assert.ok(collectText(tree).includes('ovJumpHint'), '静态提示')
  assert.equal(
    collectByProp(tree, 'data-action').filter((node) => node.props['data-action'] === 'jump-audit').length,
    0,
    '没有 onNavigate 就不渲染按钮',
  )
})

test('总览:健康检查覆盖降级场景,提炼开关优先读 overview.extract.enabled', () => {
  const data = overviewData({
    stats: { persisted: false, hotUndigested: 5, outboxDead: 1 },
    embedding: { available: false, lastFailure: 'ECONNREFUSED' },
    injection: { autoRecall: false },
    workspaces: { total: 3, enabled: 1, disabled: 2 },
    profile: { configured: false },
    soul: { enabled: false },
    extract: { enabled: false },
  })
  const { tree } = mountOverview({ data })
  const texts = collectText(tree)

  for (const key of [
    'ovCheckStorageWarn', 'ovCheckVectorFailure', 'ovCheckExtractOff', 'ovCheckRecallWarn',
    'ovCheckWorkspaceInfo', 'ovCheckProfileInfo', 'ovCheckSoulInfo',
  ]) {
    assert.ok(texts.includes(key), `自检含 ${key}`)
  }
  const rows = byClass(tree, 'ov-health-row')
  assert.equal(rows.length, 7, '仍是 7 项')
  const warnRows = rows.filter((node) => node.props['data-tone'] === 'warn')
  const infoRows = rows.filter((node) => node.props['data-tone'] === 'info')
  assert.ok(warnRows.length >= 3, '内存态/向量失败/提炼/召回 → 至少 3 项 warn')
  assert.ok(infoRows.length >= 2, '停用工作区/画像/SOUL → 至少 2 项 info')
  assert.ok(texts.includes('ovHealthTopWarn'), '顶部摘要变成「N 项需关注」')

  // 数据面优先:extract.enabled=true 时不退回 form 快照(即使 form 说关闭)
  const formSaysOff = { getSnapshot: () => ({ status: 'ready', value: { extractEnabled: false }, writable: true }) }
  const dataSaysOn = mountOverview({ data: overviewData(), form: formSaysOff })
  const onTexts = collectText(dataSaysOn.tree)
  assert.ok(onTexts.includes('ovCheckExtractOk'), '数据面 enabled=true → 显示正常')
  assert.ok(!onTexts.includes('ovCheckExtractOff'), '不被 form 快照覆盖')

  // 旧响应没有 extract 字段时,退回 form 快照兼容(宿主未升级也不会误报)
  const fallback = mountOverview({ data: overviewData({ extract: undefined }), form: formSaysOff })
  assert.ok(collectText(fallback.tree).includes('ovCheckExtractOff'), '无 extract 字段时退回 form 快照')

  // 积压/死信判定与开关无关,继续生效
  const backlog = mountOverview({ data: overviewData({ stats: { hotUndigested: 2 } }) })
  assert.ok(collectText(backlog.tree).includes('ovCheckExtractBacklog'), '热缓冲积压 → warn')
  const dead = mountOverview({ data: overviewData({ stats: { hotUndigested: 0, outboxDead: 2 } }) })
  assert.ok(collectText(dead.tree).includes('ovCheckExtractDead'), '提炼死信 → warn')

  // 向量路关闭属于「提示」而不是故障
  const vectorOff = mountOverview({ data: overviewData({ embedding: { enabled: false } }) })
  assert.ok(collectText(vectorOff.tree).includes('ovCheckVectorOff'), '向量路关闭 → info')
})

test('总览:整理失败/丢弃在健康检查里可见,成功时显示上次整理时间(R15a)', () => {
  const calls = [];
  const t = (key, vars) => {
    calls.push({ key, vars });
    return key;
  };

  // ① 上次整理失败:优先于"积压"提示,如实带原因(失败原因来自 stats.lastExtract)
  const failed = mountOverview({
    t,
    data: overviewData({
      stats: {
        hotUndigested: 2,
        lastExtract: { at: '2026-11-07T08:00:00.000Z', ok: false, reason: 'LLM 超时', batchTurns: 3, chars: 900 },
      },
    }),
  });
  let texts = collectText(failed.tree);
  assert.ok(texts.includes('ovCheckExtractFailed'), '健康检查报上次整理失败');
  assert.ok(!texts.includes('ovCheckExtractBacklog'), '失败优先于积压提示');
  const extractRow = byClass(failed.tree, 'ov-health-row').find((node) => node.props.key === 'extract');
  assert.equal(extractRow.props['data-tone'], 'warn', '提炼一项变 warn');
  const failedCall = calls.find((call) => call.key === 'ovCheckExtractFailed');
  assert.equal(failedCall.vars.reason, 'LLM 超时', '失败原因原样展示');
  assert.ok(texts.includes('ovHealthTopWarn'), '顶部摘要提示需关注');

  // ② 丢弃计数:只在非零时多一行 info(正常数据仍 7 项,不制造焦虑)
  const drops = mountOverview({
    data: overviewData({ stats: { drops: { lowConfidence: 2, injection: 1, secret: 0, oversized: 1 } } }),
  });
  texts = collectText(drops.tree);
  assert.ok(texts.includes('ovCheckExtractDrops') && texts.includes('ovCheckExtractDropsDesc'), '展示丢弃明细');
  const dropRow = byClass(drops.tree, 'ov-health-row').find((node) => node.props.key === 'extractDrops');
  assert.equal(dropRow.props['data-tone'], 'info', '丢弃是提示不是故障');
  assert.equal(byClass(drops.tree, 'ov-health-row').length, 8, '正常 7 项 + 丢弃 1 项');

  // ③ 成功:显示"上次整理什么时候、多少回合/字符"(时间格式化随本地时区,断言参数而非字面时间)
  const okCalls = [];
  const ok = mountOverview({
    t: (key, vars) => { okCalls.push({ key, vars }); return key; },
    data: overviewData({
      stats: { lastExtract: { at: '2026-11-07T08:00:00.000Z', ok: true, reason: '', batchTurns: 3, chars: 900 } },
    }),
  });
  texts = collectText(ok.tree);
  assert.ok(texts.includes('ovCheckExtractLastOk'), '成功时显示上次整理');
  const okCall = okCalls.find((call) => call.key === 'ovCheckExtractLastOk');
  assert.equal(okCall.vars.turns, 3, '带回合数');
  assert.match(okCall.vars.time, /\d{2}:\d{2}/, '带可读时间');
});

test('总览:词典中英 key 齐平,样式只用主题令牌与 .ov- 前缀', () => {
  // 词典:中英同 key、非空;不覆盖 base 的共享词
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(zhKeys, enKeys, 'zh/en key 集合一致')
  assert.ok(zhKeys.length >= 80, '总览词典规模足够')
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], 'string', `zh.${key} 是字符串`)
    assert.equal(typeof en[key], 'string', `en.${key} 是字符串`)
    assert.ok(zh[key].length > 0 && en[key].length > 0, `${key} 两种语言都非空`)
  }
  assert.deepEqual(zhKeys.filter((key) => key in baseZh), [], '不与 base 共享词重名覆盖')
  assert.deepEqual(enKeys.filter((key) => key in baseEn), [], 'en 不与 base 重名')

  // 源码里字面量 t("key") 必须都在词典里(动态 key 由上面的人工词典兜底)
  const source = readFileSync(new URL('../lib/client/overview-card.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
  const usedKeys = new Set([...source.matchAll(/\b(?:t|tt)\(\s*["']([A-Za-z][A-Za-z0-9_]*)["']/g)].map((match) => match[1]))
  assert.ok(usedKeys.size > 70, '扫描到足够多的 t() 字面量 key')
  const mergedZh = { ...baseZh, ...zh }
  const mergedEn = { ...baseEn, ...en }
  for (const key of usedKeys) {
    assert.ok(key in mergedZh, `源码用到但 zh 缺 key: ${key}`)
    assert.ok(key in mergedEn, `源码用到但 en 缺 key: ${key}`)
  }
  // 反向:词典里不留孤儿 key。模式徽章/跳过原因走查表映射,不会以字面量出现。
  const dynamicOnly = new Set([
    'ovModeDigest',
    'ovReasonAutoRecallOff', 'ovReasonInlineTimeout', 'ovReasonNoHits', 'ovReasonNoQuery',
    'ovReasonPressure', 'ovReasonSearchUnavailable', 'ovReasonSubagent', 'ovReasonWorkspaceDisabled',
  ])
  const orphans = zhKeys.filter((key) => !usedKeys.has(key) && !dynamicOnly.has(key))
  assert.deepEqual(orphans, [], '词典里有源码没用到的孤儿 key')

  // 样式:只允许 --dsw-alias-* 令牌;不写死色值;类名只写 .ov- 前缀或共享类
  assert.ok(css.includes('.ov-'), '有 .ov- 前缀样式')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), '不能写死 hex 色值')
  const vars = [...css.matchAll(/var\((--[a-z0-9-]+)\)/gi)].map((match) => match[1])
  assert.ok(vars.length > 0, '样式使用了主题令牌')
  assert.deepEqual(vars.filter((name) => !name.startsWith('--dsw-alias-')), [], '只允许 --dsw-alias-* 令牌')
  const classNames = [...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9-]*)/g)].map((match) => match[1])
  assert.deepEqual(classNames.filter((name) => !name.startsWith('ov') && name !== 'mem-stat-grid'), [], '只写自己的 .ov- 类或复用共享类')
})
