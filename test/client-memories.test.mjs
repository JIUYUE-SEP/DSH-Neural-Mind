/**
 * 记忆管理台(v1.15)客户端行为:
 *  - 列表默认请求参数(状态/类型/工作区/sort/offset/limit)与 facets 计数;
 *  - 搜索 250ms 防抖、筛选/排序立即重拉;
 *  - 点行进详情(api detail)、返回列表;暂存确认/拒绝后刷新;
 *  - 三态空态、错误横幅 + 重试、加载更多、复制 ID。
 *
 * 渲染走 `test/helpers-client.mjs` 的迷你 hooks 运行时(带状态、effect 按依赖比较);
 * t 返回 key,断言稳定。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mountMemoryPage, collectByProp, collectText, findByText, clickTab } from './helpers-client.mjs'

const overview = {
  ok: true,
  stats: { active: 2, staged: 1, archived: 1, hotTotal: 0, hotUndigested: 0, outboxPending: 0, outboxDead: 0, persisted: true },
  kinds: { fact: 2, lesson: 1, episode: 1 },
  embedded: { records: 0, total: 4 },
  workspaces: { total: 1, enabled: 1, disabled: 0 },
  embedding: { enabled: false, configured: false, available: false },
  gate: { enabled: true },
  extract: { enabled: true },
  injection: { autoRecall: true, recent: [], counts: {} },
  soul: { enabled: true, chars: 0, versions: 0 },
  profile: { configured: false },
  audit: { recent: [] },
}

const rows = [
  {
    id: 'm_alpha', content: '用 pnpm 管理 workspace 依赖', kind: 'fact', source: 'user', status: 'active',
    importance: 7, temporal: 'pattern', entity: 'repo', workspaceId: 'ws-a', workspaceLabel: 'proj-a',
    eventTime: '2026-11-05T08:00:00.000Z', createdAt: '2026-11-05T08:00:00.000Z',
  },
  {
    id: 'm_beta', content: '提交前先跑全量测试', kind: 'lesson', source: 'assistant', status: 'staged',
    importance: 5, temporal: 'pattern', workspaceId: 'ws-a', workspaceLabel: 'proj-a',
    eventTime: '2026-11-06T08:00:00.000Z', createdAt: '2026-11-06T08:00:00.000Z',
  },
  {
    id: 'm_gamma', content: '旧的项目结构', kind: 'episode', source: 'user', status: 'archived',
    importance: 2, temporal: 'episode', hidden: true, private: true, sensitive: true,
    workspaceId: 'ws-b', workspaceLabel: 'proj-b',
    eventTime: '2026-10-01T08:00:00.000Z', createdAt: '2026-10-01T08:00:00.000Z',
  },
]

const facets = {
  status: { active: 2, staged: 1, archived: 1 },
  kinds: { fact: 2, lesson: 1, episode: 1 },
  workspaces: [{ id: 'ws-a', label: 'proj-a', count: 2 }, { id: 'ws-b', label: 'proj-b', count: 1 }],
}

function listPayload(body) {
  let picked = rows
  if (body.status === 'staged') picked = rows.filter((row) => row.status === 'staged')
  else if (body.status === 'active') picked = rows.filter((row) => row.status === 'active')
  else if (body.status === 'archived') picked = rows.filter((row) => row.status === 'archived')
  if (body.kind !== undefined) picked = picked.filter((row) => row.kind === body.kind)
  if (body.workspaceId !== undefined) picked = picked.filter((row) => row.workspaceId === body.workspaceId)
  if (body.query !== undefined) picked = picked.filter((row) => row.content.includes(body.query))
  return { ok: true, total: picked.length, rows: picked, facets }
}

async function openMemories(payloads = {}) {
  const mounted = await mountMemoryPage({ payloads: { overview, list: listPayload, ...payloads } })
  await clickTab(mounted.harness, mounted.tree, 'memories')
  return mounted
}

test('记忆:列表默认参数(全部/最新/50)与 facets 计数,行内徽章与元数据', async () => {
  const mounted = await openMemories()
  try {
    const listCalls = mounted.calls.filter((call) => call.action === 'list')
    assert.equal(listCalls.length, 1, '挂载即拉一次列表')
    assert.deepEqual(listCalls[0].body, { action: 'list', sort: 'new', offset: 0, limit: 50 }, '默认:全部状态/不筛类型/不筛工作区/最新在前/50 条')
    const texts = collectText(mounted.harness.rerender())
    assert.ok(texts.includes('m_alpha') === false, '正文里没有 id')
    assert.ok(texts.some((text) => text.includes('pnpm')), '渲染了正文')
    assert.ok(texts.includes('memTitle'), '卡片标题')
    assert.ok(texts.includes('memCount'), '总数文案')
    // facets 计数进了筛选按钮
    const statusButtons = collectByProp(mounted.harness.rerender(), 'data-filter-status')
    assert.equal(statusButtons.length, 4, '4 个状态筛选')
    const counts = statusButtons.map((button) => collectText(button).join(''))
    assert.ok(counts.some((text) => text.includes('2')), '活跃计数 2')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300)) // 等可能的防抖 timer,避免串用例
    mounted.restore()
  }
})

test('记忆:状态/类型/工作区筛选各自带对参数,并立即重拉', async () => {
  const mounted = await openMemories()
  try {
    let tree = mounted.harness.rerender()
    collectByProp(tree, 'data-filter-status').find((node) => node.props['data-filter-status'] === 'staged').props.onClick()
    await mounted.harness.tick()
    tree = mounted.harness.rerender()
    assert.equal(mounted.calls.filter((call) => call.action === 'list').pop().body.status, 'staged')

    collectByProp(tree, 'data-filter-kind').find((node) => node.props['data-filter-kind'] === 'lesson').props.onClick()
    await mounted.harness.tick()
    tree = mounted.harness.rerender()
    const afterKind = mounted.calls.filter((call) => call.action === 'list').pop().body
    assert.equal(afterKind.kind, 'lesson')
    assert.equal(afterKind.status, 'staged', '筛选叠加,不互相清空')

    collectByProp(tree, 'data-filter-workspace')[0].props.onChange({ target: { value: 'ws-b' } })
    await mounted.harness.tick()
    const afterWorkspace = mounted.calls.filter((call) => call.action === 'list').pop().body
    assert.equal(afterWorkspace.workspaceId, 'ws-b')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:排序下拉改变 sort 参数', async () => {
  const mounted = await openMemories()
  try {
    const tree = mounted.harness.rerender()
    const sort = collectByProp(tree, 'aria-label').find((node) => node.props['aria-label'] === 'memSortLabel')
    assert.ok(sort !== undefined, '排序控件在')
    sort.props.onChange({ target: { value: 'importance' } })
    await mounted.harness.tick()
    assert.equal(mounted.calls.filter((call) => call.action === 'list').pop().body.sort, 'importance')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:搜索 250ms 防抖后才请求,带 query', async () => {
  const mounted = await openMemories()
  try {
    let tree = mounted.harness.rerender()
    const input = collectByProp(tree, 'className').find((node) => node.props.className === 'mem-search-input')
    const before = mounted.calls.filter((call) => call.action === 'list').length
    input.props.onChange({ target: { value: 'pnpm' } })
    tree = mounted.harness.rerender()
    assert.equal(mounted.calls.filter((call) => call.action === 'list').length, before, '防抖窗口内不请求')
    await new Promise((resolve) => setTimeout(resolve, 280))
    await mounted.harness.tick()
    const body = mounted.calls.filter((call) => call.action === 'list').pop().body
    assert.equal(body.query, 'pnpm')
    assert.equal(body.offset, 0, '搜索回到第一页')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:点行进入详情(api detail),证据时间线与字段齐全;返回列表', async () => {
  const detailPayload = {
    ok: true,
    row: {
      ...rows[1],
      evidence: [
        { ts: '2026-11-06T09:00:00.000Z', weight: 1, kind: 'reinforce' },
        { ts: '2026-11-06T10:00:00.000Z', weight: 0.5, kind: 'challenge' },
      ],
      filePaths: ['src/app.js'],
      confidence: 0.9,
      chunkCount: 2,
    },
  }
  const mounted = await openMemories({ detail: detailPayload })
  try {
    let tree = mounted.harness.rerender()
    const row = collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === 'm_beta')
    row.props.onClick()
    await mounted.harness.tick()
    await mounted.harness.settle(3)
    tree = mounted.harness.rerender()
    const detailCalls = mounted.calls.filter((call) => call.action === 'detail')
    assert.deepEqual(detailCalls[0].body, { action: 'detail', id: 'm_beta' })
    const texts = collectText(tree)
    assert.ok(texts.includes('memDetailTitle'), '详情标题')
    assert.ok(texts.includes('memFieldId'), '字段网格')
    assert.ok(texts.includes('memEvidenceTitle'), '证据时间线')
    assert.ok(texts.includes('memEvidenceReinforce') && texts.includes('memEvidenceChallenge'), '两类证据都在')
    assert.ok(texts.includes('src/app.js'), '文件锚展示')

    // 返回列表
    const back = findByText(tree, '← memBack').pop() ?? collectByProp(tree, 'className').find((node) => node.props.className === 'mem-back')
    back.props.onClick()
    tree = mounted.harness.rerender()
    assert.ok(collectText(tree).includes('memTitle'), '回到列表')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:暂存行「拒绝」调 api reject,成功后关闭详情并刷新列表', async () => {
  const mounted = await openMemories({ reject: { ok: true, row: { ...rows[1], status: 'archived' } } })
  try {
    let tree = mounted.harness.rerender()
    const row = collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === 'm_beta')
    row.props.onClick()
    await mounted.harness.tick()
    await mounted.harness.settle(3)
    tree = mounted.harness.rerender()
    const reject = findByText(tree, 'memReject').pop()
    assert.ok(reject !== undefined, '暂存行有拒绝按钮')
    const listBefore = mounted.calls.filter((call) => call.action === 'list').length
    reject.props.onClick({ stopPropagation() {} })
    await mounted.harness.tick()
    await mounted.harness.settle(3)
    assert.deepEqual(mounted.calls.filter((call) => call.action === 'reject')[0].body, { action: 'reject', id: 'm_beta' })
    assert.equal(mounted.calls.filter((call) => call.action === 'list').length > listBefore, true, '操作成功后刷新列表')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:三态空态(池空 / 搜索无结果 / 筛选无记忆)', async () => {
  const emptyFacets = { status: { active: 0, staged: 0, archived: 0 }, kinds: { fact: 0, lesson: 0, episode: 0 }, workspaces: [] }
  // ① 池空
  const poolEmpty = await openMemories({ list: { ok: true, total: 0, rows: [], facets: emptyFacets } })
  try {
    let tree = poolEmpty.harness.rerender()
    assert.ok(collectText(tree).includes('memPoolEmptyTitle'), '池空文案')
    await poolEmpty.restore()
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  // ② 搜索无结果(池子有数据,facets 合计 0 也可以)
  const searchEmpty = await mountMemoryPage({
    payloads: { overview, list: (body) => (body.query === undefined ? listPayload(body) : { ok: true, total: 0, rows: [], facets: emptyFacets }) },
  })
  try {
    await clickTab(searchEmpty.harness, searchEmpty.tree, 'memories')
    let tree = searchEmpty.harness.rerender()
    const input = collectByProp(tree, 'className').find((node) => node.props.className === 'mem-search-input')
    input.props.onChange({ target: { value: '不存在' } })
    await new Promise((resolve) => setTimeout(resolve, 280))
    await searchEmpty.harness.tick()
    await searchEmpty.harness.settle(3)
    tree = searchEmpty.harness.rerender()
    assert.ok(collectText(tree).includes('memNoSearchTitle'), '搜索无结果文案')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await searchEmpty.restore()
  }
  // ③ 筛选无记忆
  const filterEmpty = await mountMemoryPage({
    payloads: { overview, list: (body) => (body.status === undefined ? listPayload(body) : { ok: true, total: 0, rows: [], facets }) },
  })
  try {
    await clickTab(filterEmpty.harness, filterEmpty.tree, 'memories')
    let tree = filterEmpty.harness.rerender()
    collectByProp(tree, 'data-filter-status').find((node) => node.props['data-filter-status'] === 'archived').props.onClick()
    await filterEmpty.harness.tick()
    await filterEmpty.harness.settle(3)
    tree = filterEmpty.harness.rerender()
    assert.ok(collectText(tree).includes('memNoFilterTitle'), '筛选无记忆文案')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await filterEmpty.restore()
  }
})

test('记忆:列表失败显示错误横幅,重试后恢复', async () => {
  let attempts = 0
  const mounted = await mountMemoryPage({
    payloads: {
      overview,
      list: (body) => {
        attempts += 1
        if (attempts === 1) return new Error('list boom')
        return listPayload(body)
      },
    },
  })
  try {
    await clickTab(mounted.harness, mounted.tree, 'memories')
    let tree = mounted.harness.rerender()
    assert.ok(collectText(tree).some((text) => text === 'list boom'), '错误原因如实展示')
    const retry = findByText(tree, 'commonRetry').pop()
    retry.props.onClick()
    await mounted.harness.tick()
    await mounted.harness.settle(3)
    tree = mounted.harness.rerender()
    assert.ok(collectText(tree).some((text) => text.includes('pnpm')), '恢复后列出记忆')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:加载更多带 offset 并追加行', async () => {
  const many = Array.from({ length: 60 }, (_, index) => ({
    ...rows[0],
    id: `m_${index}`,
    content: `memory ${index}`,
    status: 'active',
  }))
  const mounted = await mountMemoryPage({
    payloads: {
      overview,
      list: (body) => {
        const offset = body.offset ?? 0
        return { ok: true, total: 60, rows: many.slice(offset, offset + 50), facets }
      },
    },
  })
  try {
    await clickTab(mounted.harness, mounted.tree, 'memories')
    let tree = mounted.harness.rerender()
    assert.equal(collectByProp(tree, 'data-memory').length, 50, '首屏 50 条')
    const more = collectByProp(tree, 'className').find((node) => String(node.props.className).includes('mem-load-more'))
    assert.ok(more !== undefined, '有加载更多按钮')
    more.props.onClick()
    await mounted.harness.tick()
    await mounted.harness.settle(3)
    tree = mounted.harness.rerender()
    assert.equal(collectByProp(tree, 'data-memory').length, 60, '追加后 60 条')
    assert.equal(mounted.calls.filter((call) => call.action === 'list').pop().body.offset, 50)
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})

test('记忆:详情可停用/恢复/改敏感标记,操作后留在详情并刷新(R1a)', async () => {
  const base = { ...rows[0], sessionId: 'sess-a', sourceRange: { startSeq: 0, endSeq: 3 }, sourceExpandable: true };
  let archived = false;
  let sensitive = false;
  const payloads = {
    detail: () => ({ ok: true, row: { ...base, status: archived ? 'archived' : 'active', sensitive } }),
    archive: () => { archived = true; return { ok: true, row: { ...base, status: 'archived' } }; },
    restore: () => { archived = false; return { ok: true, row: { ...base, status: 'active' } }; },
    sensitive: (body) => { sensitive = body.sensitive === true; return { ok: true, row: { ...base, sensitive } }; },
  };
  const mounted = await openMemories(payloads);
  try {
    let tree = mounted.harness.rerender();
    collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === 'm_alpha').props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);

    // 停用:调 archive,成功后留在详情并重新拉 detail
    tree = mounted.harness.rerender();
    const archive = collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'memory-archive');
    assert.ok(archive !== undefined, '活跃记忆有「停用」按钮');
    archive.props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    assert.deepEqual(mounted.calls.filter((call) => call.action === 'archive')[0].body, { action: 'archive', id: 'm_alpha' });
    assert.ok(mounted.calls.filter((call) => call.action === 'detail').length >= 2, '操作后刷新详情');
    tree = mounted.harness.rerender();
    assert.ok(collectByProp(tree, 'data-action').some((node) => node.props['data-action'] === 'memory-restore'), '归档后出现「恢复」');

    // 恢复
    collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'memory-restore').props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    assert.deepEqual(mounted.calls.filter((call) => call.action === 'restore')[0].body, { action: 'restore', id: 'm_alpha' });
    tree = mounted.harness.rerender();
    assert.ok(collectByProp(tree, 'data-action').some((node) => node.props['data-action'] === 'memory-archive'), '恢复后又能停用');

    // 改敏感标记(标为敏感 → 按钮变「标为不敏感」)
    collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'memory-sensitive').props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    assert.deepEqual(mounted.calls.filter((call) => call.action === 'sensitive')[0].body, { action: 'sensitive', id: 'm_alpha', sensitive: true });
    tree = mounted.harness.rerender();
    assert.ok(collectText(tree).includes('memUnmarkSensitive'), '已标敏感 → 按钮改成「标为不敏感」');
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300));
    mounted.restore();
  }
});

test('记忆:彻底隐藏要二次确认,隐藏后按钮收起并标已屏蔽(R1a)', async () => {
  const base = { ...rows[0], sessionId: 'sess-a', sourceRange: { startSeq: 0, endSeq: 3 }, sourceExpandable: true };
  let hidden = false;
  const payloads = {
    detail: () => ({ ok: true, row: { ...base, status: hidden ? 'archived' : 'active', hidden } }),
    hide: () => { hidden = true; return { ok: true, hidden: true, row: { ...base, status: 'archived', hidden: true } }; },
  };
  const mounted = await openMemories(payloads);
  try {
    let tree = mounted.harness.rerender();
    collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === 'm_alpha').props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    tree = mounted.harness.rerender();

    const hide = collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'memory-hide');
    assert.ok(hide !== undefined, '有「彻底隐藏」按钮');
    hide.props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(2);
    assert.equal(mounted.calls.filter((call) => call.action === 'hide').length, 0, '第一次点击只进入确认态,不直接执行');
    tree = mounted.harness.rerender();
    const confirm = collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'memory-hide');
    assert.equal(collectText(confirm).join(''), 'memHideConfirm', '按钮文案变成"再点一次确认"');
    confirm.props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    assert.deepEqual(mounted.calls.filter((call) => call.action === 'hide')[0].body, { action: 'hide', id: 'm_alpha' });

    tree = mounted.harness.rerender();
    assert.ok(collectText(tree).includes('memBadgeHidden'), '详情标出已屏蔽');
    const actions = collectByProp(tree, 'data-action').map((node) => node.props['data-action']);
    assert.ok(!actions.includes('memory-archive') && !actions.includes('memory-sensitive') && !actions.includes('memory-hide'), '隐藏后不再给这些操作');
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300));
    mounted.restore();
  }
});

test('记忆:展开来源轮次成功显示原文,失败如实提示(R1a)', async () => {
  const detailRow = { ...rows[0], sessionId: 'sess-a', sourceRange: { startSeq: 0, endSeq: 3 }, sourceExpandable: true };
  const mounted = await openMemories({
    detail: { ok: true, row: detailRow },
    expandSource: { ok: true, sessionId: 'sess-a', sourceRange: { startSeq: 0, endSeq: 3 }, text: '[用户] 我们用 pnpm 管理依赖\n[助手] 好的' },
  });
  try {
    let tree = mounted.harness.rerender();
    collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === 'm_alpha').props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    tree = mounted.harness.rerender();
    const expand = collectByProp(tree, 'data-action').find((node) => node.props['data-action'] === 'memory-expand');
    assert.ok(expand !== undefined, '有「展开来源轮次」按钮');
    expand.props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    assert.deepEqual(mounted.calls.filter((call) => call.action === 'expandSource')[0].body, { action: 'expandSource', id: 'm_alpha' });
    tree = mounted.harness.rerender();
    assert.ok(collectText(tree).some((text) => text.includes('我们用 pnpm 管理依赖')), '原文展示出来');
    assert.ok(collectText(tree).includes('memExpandedHint'), '提示"旧内容,以当前为准"');

    // 失败:如实提示读不回来
    const failing = await openMemories({
      detail: { ok: true, row: detailRow },
      expandSource: { ok: false, error: '来源区间读不回来' },
    });
    try {
      let failedTree = failing.harness.rerender();
      collectByProp(failedTree, 'data-memory').find((node) => node.props['data-memory'] === 'm_alpha').props.onClick();
      await failing.harness.tick();
      await failing.harness.settle(3);
      failedTree = failing.harness.rerender();
      collectByProp(failedTree, 'data-action').find((node) => node.props['data-action'] === 'memory-expand').props.onClick();
      await failing.harness.tick();
      await failing.harness.settle(3);
      failedTree = failing.harness.rerender();
      assert.ok(collectText(failedTree).some((text) => text.includes('来源区间读不回来')), '失败原因如实展示');
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 300));
      failing.restore();
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300));
    mounted.restore();
  }
});

test('记忆:热缓冲条目详情只读,可展开来源轮次(R1a)', async () => {
  const hotRow = {
    id: 'hb_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    content: '[用户] 一段还没消化的原文',
    kind: 'episode',
    status: 'hot',
    hidden: false,
    readOnly: true,
    sessionId: 'sess-a',
    sourceRange: { startSeq: 0, endSeq: 3 },
    sourceExpandable: true,
    workspaceId: 'ws-a',
    workspaceLabel: 'proj-a',
    createdAt: '2026-11-05T08:00:00.000Z',
  };
  const mounted = await openMemories({
    list: { ok: true, total: 1, rows: [hotRow], facets },
    detail: { ok: true, row: hotRow },
  });
  try {
    let tree = mounted.harness.rerender();
    collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === hotRow.id).props.onClick();
    await mounted.harness.tick();
    await mounted.harness.settle(3);
    tree = mounted.harness.rerender();
    const texts = collectText(tree);
    assert.ok(texts.includes('memBadgeHot'), '详情标出热缓冲状态');
    assert.ok(texts.includes('memReadOnlyHint'), '说明只读');
    const actions = collectByProp(tree, 'data-action').map((node) => node.props['data-action']);
    assert.ok(!actions.includes('memory-archive') && !actions.includes('memory-hide'), '热缓冲不给停用/隐藏');
    assert.ok(actions.includes('memory-expand'), '但仍可展开来源轮次');
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300));
    mounted.restore();
  }
});

test('记忆:详情里「复制 ID」写入剪贴板并给反馈', async () => {
  let clipped = ''
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async (value) => { clipped = value } } },
  })
  const mounted = await openMemories({ detail: { ok: true, row: { ...rows[0], evidence: [], chunkCount: 0 } } })
  try {
    let tree = mounted.harness.rerender()
    collectByProp(tree, 'data-memory').find((node) => node.props['data-memory'] === 'm_alpha').props.onClick()
    await mounted.harness.tick()
    await mounted.harness.settle(3)
    tree = mounted.harness.rerender()
    const copy = findByText(tree, 'memCopyId').pop()
    copy.props.onClick()
    await mounted.harness.settle(2)
    tree = mounted.harness.rerender()
    assert.equal(clipped, 'm_alpha', '复制的是该条记忆 id')
    assert.ok(collectText(tree).includes('memCopied'), '按钮反馈「已复制」')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 300))
    mounted.restore()
  }
})
