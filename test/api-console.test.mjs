/**
 * v1.15 记忆控制台宿主接口:
 *  - `lib/injectionlog.js` 的环形日志行为(不记正文/限长/计数);
 *  - `/neural-mind/api` 新增 action:`overview` / `injections` / `detail` / `recallPreview`,
 *    以及扩展后的 `list`(kind/workspaceId/sort/facets);
 *  - 端到端:pre-step 注入会落进注入日志,面板能解释"这一轮注入了什么"。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, Config } from '../lib/index.js'
import { createInjectionLog } from '../lib/injectionlog.js'
import { localDay } from '../lib/usage.js'
import { createFakeCtx, fakeSession, memoryTable, waitFor } from './helpers.mjs'

// ── 注入日志单元 ─────────────────────────────────────────────────────────────

test('injectionlog:环形缓冲、限长、计数;只存元数据不存正文', () => {
  const log = createInjectionLog({ max: 3 })
  log.record({ mode: 'inject', sessionId: 'sess-1', workspaceLabel: 'proj', records: 2, chars: 100, hitIds: ['m1', 'm2'] })
  log.record({ mode: 'skip', reason: 'no-hits', sessionId: 'sess-2', chars: 0 })
  log.record({ mode: 'resident', sessionId: 'sess-3', records: 1, chars: 40, resident: 1 })
  log.record({ mode: 'digest', sessionId: 'sess-4', records: 1, chars: 30, digest: 1 })

  const rows = log.list(10)
  assert.equal(rows.length, 3, '超过上限后丢最旧的')
  assert.equal(rows[0].mode, 'digest', '最新的在最前')
  assert.equal(rows[1].mode, 'resident')
  assert.equal(rows[2].mode, 'skip')
  assert.equal(rows[2].reason, 'no-hits')
  assert.deepEqual(rows[2].hitIds, [])

  const counts = log.summary()
  assert.equal(counts.inject, 1, '计数按写入累计,不随环形缓冲淘汰回退(它是"本次运行发生过什么")')
  assert.equal(counts.skip, 1)

  // 正文/查询原文绝不入库:只接受白名单字段
  const malicious = log.record({ mode: 'inject', content: '秘密正文', query: '用户查询', records: 1, chars: 10 })
  assert.equal('content' in malicious, false, '不落注入正文')
  assert.equal('query' in malicious, false, '不落用户查询')
  assert.deepEqual(malicious.hitIds, [])

  // 非法字段防御:负数/超长 id 列表被收敛
  const clamped = log.record({ mode: 'inject', records: -5, chars: Number.NaN, hitIds: Array.from({ length: 20 }, (_, i) => `m${i}`) })
  assert.equal(clamped.records, 0)
  assert.equal(clamped.chars, 0)
  assert.equal(clamped.hitIds.length, 10, 'id 列表最多 10 个')

  log.reset()
  assert.equal(log.list(10).length, 0)
})

// ── /neural-mind/api 新 action ───────────────────────────────────────────────────

function fakeReqRes(body, headers = {}) {
  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-neural-mind-client': '1', ...headers },
    listeners: {},
    on(event, cb) { this.listeners[event] = cb },
    destroy() {},
  }
  const res = {
    status: 0,
    body: '',
    writeHead(status) { this.status = status },
    end(text) { this.body = text },
  }
  process.nextTick(() => {
    req.listeners.data?.(Buffer.from(JSON.stringify(body)))
    req.listeners.end?.()
  })
  return { req, res }
}

/** 一条满足 memoryRecord 必填字段的测试记忆。 */
function record(overrides = {}) {
  return {
    id: 'mem_1',
    content: '用 pnpm 管理 workspace 依赖',
    kind: 'fact',
    source: 'user',
    importance: 5,
    confidence: 0.8,
    temporal: 'pattern',
    eventTime: '2026-11-05T08:00:00.000Z',
    workspaceId: 'ws-a',
    workspaceLabel: 'proj-a',
    sessionId: 'sess-a',
    evidence: [],
    status: 'active',
    createdAt: '2026-11-05T08:00:00.000Z',
    ...overrides,
  }
}

/**
 * 启动一个带 fake webServer 的插件实例,返回 `/neural-mind/api` 路由与调用助手。
 * seed 在 apply 之前写表:这样启动时的 search.rebuild 能收录这些记忆。
 */
async function bootConsole({ patch = {}, seed, services = {} } = {}) {
  const fake = createFakeCtx({})
  if (seed !== undefined) seed(fake)
  let route = null
  fake.ctx.get = (name) => {
    if (name === 'storageDomain') return fake.fakeStorageDomain
    if (name === 'webServer') return { register: (definition) => { route = definition; return () => {} } }
    return services[name]
  }
  const config = Config['~standard'].validate(patch).value
  apply(fake.ctx, config)
  assert.ok(await waitFor(() => route !== null), 'webServer 注册 /neural-mind/api')
  const call = async (body) => {
    const { req, res } = fakeReqRes(body)
    await route.handler(req, res)
    return JSON.parse(res.body)
  }
  return { fake, route, call }
}

/** 在 apply 之前把记忆塞进会被 openStore 复用的表里。 */
function seedMemories(list, { hot = [], audit = [] } = {}) {
  return (fake) => {
    fake.tables.memories = memoryTable()
    for (const item of list) fake.tables.memories.put(item.id, item)
    if (hot.length > 0) {
      fake.tables.hotbuffer = memoryTable()
      for (const item of hot) fake.tables.hotbuffer.put(item.id, item)
    }
    if (audit.length > 0) {
      fake.tables.audit = memoryTable()
      for (const item of audit) fake.tables.audit.put(item.id, item)
    }
  }
}

test('/neural-mind/api overview:一次给齐看板所需聚合(stats/kinds/embedding/gate/injection/soul/profile/audit)', async () => {
  const memories = [
    record({ id: 'mem_a', kind: 'fact', status: 'active', importance: 7 }),
    record({ id: 'mem_b', kind: 'lesson', status: 'active', importance: 9 }),
    record({ id: 'mem_c', kind: 'episode', status: 'staged', importance: 3 }),
    record({ id: 'mem_d', kind: 'fact', status: 'archived', importance: 2 }),
  ]
  const audit = [{ id: 'aud_1', ts: '2026-11-06T00:00:00.000Z', kind: 'auto-archive', detail: 'mem_d 归档', sessionId: 'sess-a' }]
  const booted = await bootConsole({ seed: seedMemories(memories, { audit }) })
  try {
    const body = await booted.call({ action: 'overview' })
    assert.equal(body.ok, true)
    assert.deepEqual(body.stats.active, 2)
    assert.deepEqual(body.stats.staged, 1)
    assert.deepEqual(body.stats.archived, 1)
    assert.deepEqual(body.kinds, { fact: 2, lesson: 1, episode: 1 }, '按类型聚合(含归档)')
    assert.equal(body.workspaces.total, 1, '池里出现过的 workspace')
    assert.equal(body.workspaces.disabled, 0)
    assert.equal(typeof body.embedding.available, 'boolean', '向量可用性是轻量判定')
    assert.equal(body.embedding.enabled, true, '语义检索默认开启(需要端点+模型才真正可用)')
    assert.equal(body.embedding.configured, false, '默认没配端点/模型')
    assert.equal(body.embedding.available, false, '未配置 → 不可用(如实报)')
    assert.equal(body.gate.enabled, true, '闸门默认开(v1.13)')
    assert.equal(typeof body.gate.consensusCos, 'number')
    assert.deepEqual(body.extract, { enabled: true, batchTurns: 6, idleMinutes: 5 }, '提炼通道参数随总览下发(健康检查用)')
    assert.equal(body.injection.autoRecall, true)
    assert.ok(Array.isArray(body.injection.recent), '注入日志随总览下发')
    assert.equal(body.injection.budgets.injectMaxItems > 0, true)
    assert.equal(body.soul.enabled, true, 'SOUL 默认开')
    assert.equal(body.profile.configured, false, '默认没配画像文件')
    assert.ok(body.audit.recent.some((row) => row.id === 'aud_1'), '最近审计含种子记录')
    assert.ok(body.audit.recent.length <= 6, '最近审计最多 6 条')
    assert.match(body.now, /^\d{4}-\d{2}-\d{2}T/)
  } finally {
    await booted.fake.dispose()
  }
})

test('/neural-mind/api list:状态/类型/工作区筛选 + 排序 + facets 计数', async () => {
  const memories = [
    record({ id: 'mem_1', content: 'alpha 事实', kind: 'fact', status: 'active', workspaceId: 'ws-a', workspaceLabel: 'A', importance: 4, createdAt: '2026-11-01T00:00:00.000Z' }),
    record({ id: 'mem_2', content: 'alpha 经验', kind: 'lesson', status: 'active', workspaceId: 'ws-b', workspaceLabel: 'B', importance: 8, createdAt: '2026-11-02T00:00:00.000Z' }),
    record({ id: 'mem_3', content: 'alpha 片段', kind: 'episode', status: 'staged', workspaceId: 'ws-a', workspaceLabel: 'A', importance: 6, createdAt: '2026-11-03T00:00:00.000Z' }),
    record({ id: 'mem_4', content: 'beta 事实', kind: 'fact', status: 'archived', workspaceId: 'ws-b', workspaceLabel: 'B', importance: 1, createdAt: '2026-11-04T00:00:00.000Z' }),
  ]
  const booted = await bootConsole({ seed: seedMemories(memories) })
  try {
    const all = await booted.call({ action: 'list', limit: 10 })
    assert.equal(all.total, 4)
    assert.deepEqual(all.facets.status, { active: 2, staged: 1, archived: 1 })
    assert.deepEqual(all.facets.kinds, { fact: 2, lesson: 1, episode: 1 })
    assert.deepEqual(all.facets.workspaces.map((row) => [row.id, row.count]), [['ws-a', 2], ['ws-b', 2]])

    const active = await booted.call({ action: 'list', status: 'active', limit: 10 })
    assert.deepEqual(active.rows.map((row) => row.id), ['mem_2', 'mem_1'], '默认按创建时间降序')
    assert.equal(active.facets.status.archived, 1, 'facets 不被状态筛选清掉')

    const byKind = await booted.call({ action: 'list', kind: 'lesson', limit: 10 })
    assert.deepEqual(byKind.rows.map((row) => row.id), ['mem_2'])

    const byWorkspace = await booted.call({ action: 'list', workspaceId: 'ws-a', limit: 10 })
    assert.deepEqual(byWorkspace.rows.map((row) => row.id).sort(), ['mem_1', 'mem_3'])

    const byImportance = await booted.call({ action: 'list', sort: 'importance', limit: 10 })
    assert.deepEqual(byImportance.rows.map((row) => row.id), ['mem_2', 'mem_3', 'mem_1', 'mem_4'])

    const old = await booted.call({ action: 'list', sort: 'old', limit: 10 })
    assert.equal(old.rows[0].id, 'mem_1', '最早在前')

    const searched = await booted.call({ action: 'list', query: 'alpha', limit: 10 })
    assert.equal(searched.total, 3, '搜索收窄')
    assert.deepEqual(searched.facets.status, { active: 2, staged: 1, archived: 0 }, 'facets 跟着搜索词走')
  } finally {
    await booted.fake.dispose()
  }
})

test('/neural-mind/api detail:按 id 取详情(证据/文件路径/向量段数);不存在时明确报错', async () => {
  const memories = [record({ id: 'mem_1', evidence: [{ ts: '2026-11-05T00:00:00.000Z', weight: 1, kind: 'reinforce' }], filePaths: ['src/app.js'], chunkCount: 2, chunks: [{ text: 'x', embedding: [0.1, 0.2] }] })]
  const booted = await bootConsole({ seed: seedMemories(memories) })
  try {
    const body = await booted.call({ action: 'detail', id: 'mem_1' })
    assert.equal(body.ok, true)
    assert.equal(body.row.id, 'mem_1')
    assert.equal(body.row.evidence.length, 1)
    assert.deepEqual(body.row.filePaths, ['src/app.js'])
    assert.equal(body.row.chunkCount, 1, '向量段数')
    assert.equal('chunks' in body.row, false, '不把向量本体下发浏览器')

    const missing = await booted.call({ action: 'detail', id: 'nope' })
    assert.equal(missing.ok, false)
  } finally {
    await booted.fake.dispose()
  }
})

test('/neural-mind/api recallPreview:按注入路径返回两路候选/闸门/原始分/注入预览(只读)', async () => {
  const memories = [
    record({ id: 'mem_1', content: '用 pnpm 管理 workspace 依赖', kind: 'fact', status: 'active' }),
    record({ id: 'mem_2', content: '提交信息要写清动机', kind: 'lesson', status: 'active' }),
    record({ id: 'mem_3', content: 'pnpm 的 workspace 协议', kind: 'episode', status: 'active' }),
  ]
  const booted = await bootConsole({ seed: seedMemories(memories) })
  try {
    const body = await booted.call({ action: 'recallPreview', query: 'pnpm workspace 依赖', limit: 5 })
    assert.equal(body.ok, true)
    assert.ok(body.hits.length > 0, '能召回到相关记忆')
    assert.equal(body.hits[0].id, 'mem_1')
    assert.deepEqual(Object.keys(body.hits[0].parts).sort(), ['E', 'evidence', 'entity', 'relevance', 'status', 'time', 'workspace'].sort())
    assert.equal(typeof body.hits[0].bm25Raw, 'number')
    assert.equal(typeof body.hits[0].cos, 'number')
    assert.equal(typeof body.hits[0].lanes.bm25, 'boolean')
    assert.equal(body.vectorRan, false, '默认没配向量路 → 纯 BM25')
    assert.equal(body.gate.enabled, true, '闸门参数随诊断返回')
    assert.ok(body.lanes.pool >= 3)
    assert.ok(Array.isArray(body.preview.lines) && body.preview.lines.length === body.hits.length)
    assert.ok(body.preview.lines[0].startsWith('- ['), '预览行按注入格式渲染')
    assert.ok(body.preview.chars > 0)
    assert.equal(body.budgets.injectMaxChars > 0, true)

    const empty = await booted.call({ action: 'recallPreview', query: '   ' })
    assert.equal(empty.ok, false, '空查询明确报错')

    // 只读:再查一次内容不变,且不产生任何注入日志
    const again = await booted.call({ action: 'recallPreview', query: 'pnpm workspace 依赖', limit: 5 })
    assert.deepEqual(again.hits.map((row) => row.id), body.hits.map((row) => row.id))
    const log = await booted.call({ action: 'injections' })
    assert.equal(log.ok, true)
    assert.equal(log.rows.length, 0, '试验台不写注入日志')
  } finally {
    await booted.fake.dispose()
  }
})

test('/neural-mind/api injections + pre-step:真实注入后日志记录"注入了什么"(不记正文)', async () => {
  const memories = [record({ id: 'mem_1', content: '用 pnpm 管理 workspace 依赖', status: 'active' })]
  const booted = await bootConsole({ seed: seedMemories(memories) })
  try {
    const decision = await booted.fake.runPreStep({
      agent: { session: fakeSession('sess-inject') },
      messages: [{ source: { kind: 'user' }, content: [{ type: 'text', text: 'pnpm workspace 依赖怎么管' }] }],
      step: 1,
    })
    assert.ok(Array.isArray(decision.messages) && decision.messages.length > 0, '本轮注入了记忆')

    const log = await booted.call({ action: 'injections' })
    assert.equal(log.ok, true)
    assert.ok(log.rows.length > 0, '注入日志有记录')
    const row = log.rows[0]
    assert.equal(row.mode, 'inject')
    assert.equal(row.reason, null)
    assert.ok(row.records > 0)
    assert.ok(row.chars > 0)
    assert.ok(row.hitIds.includes('mem_1'))
    assert.equal('content' in row, false, '不记正文')
    assert.equal('query' in row, false, '不记查询原文')

    const overview = await booted.call({ action: 'overview' })
    assert.equal(overview.injection.recent.length > 0, true, '总览能拿到最近注入')
    assert.equal(overview.injection.counts.inject > 0, true, '计数含本次注入')

    // 关掉自动召回后的下一轮:日志解释"为什么没注入"
    const config = booted.fake
    assert.ok(config !== undefined)
    const off = await bootConsole({ patch: { autoRecall: false }, seed: seedMemories(memories) })
    try {
      await off.fake.runPreStep({
        agent: { session: fakeSession('sess-off') },
        messages: [{ source: { kind: 'user' }, content: [{ type: 'text', text: 'pnpm workspace 依赖怎么管' }] }],
        step: 1,
      })
      const offLog = await off.call({ action: 'injections' })
      assert.equal(offLog.rows[0].mode, 'skip')
      assert.equal(offLog.rows[0].reason, 'auto-recall-off')
    } finally {
      await off.fake.dispose()
    }
  } finally {
    await booted.fake.dispose()
  }
})

// ── v1.16 工作区选择器:三源合并(DSH 注册表 / 已见 / 记忆池)────────────────────

/** 预置 global 记录(contain 场景:seenWorkspaces 已在盘上)。 */
function seedGlobal(state) {
  return (fake) => {
    let current = state
    fake.globals.neural_mind = { get: () => current, set: async (value) => { current = value } }
  }
}

test('/neural-mind/api workspaces:合并 DSH 工作区注册表(全新安装、零回合也能列出全部工作区)', async () => {
  const memories = [
    record({ id: 'mem_ws1', workspaceId: 'A:\\proj\\dsh-memory', workspaceLabel: 'dsh-memory' }),
    record({ id: 'mem_ws2', workspaceId: 'A:/proj/dsh-memory/packages/core', workspaceLabel: 'dsh-memory/packages/core' }),
  ]
  const registry = {
    list: () => [
      { id: 'uuid-1', path: 'A:\\proj\\dsh-memory', title: 'dsh-memory', sessionIds: [] },
      { id: 'uuid-2', path: 'A:\\proj\\project-b', title: 'project-b', sessionIds: [] },
      { id: 'uuid-3', path: 'A:\\proj\\project-c', title: 'project-c', sessionIds: [] },
    ],
  }
  const booted = await bootConsole({
    patch: { disabledWorkspaces: ['A:\\proj\\project-b'] },
    seed: seedMemories(memories),
    services: { workspaceRegistry: registry },
  })
  try {
    const body = await booted.call({ action: 'workspaces' })
    assert.equal(body.ok, true)
    assert.deepEqual(body.workspaces.map((row) => row.label), ['dsh-memory', 'project-b', 'project-c'], '注册表行在前,标题优先')
    const root = body.workspaces[0]
    assert.equal(root.id, 'A:\\proj\\dsh-memory', '行 id 是路径(disabledWorkspaces 的写入口径)')
    assert.equal(root.count, 2, '仓库根行把 monorepo 子路径的记忆一并计数')
    assert.equal(root.disabled, false)
    assert.equal(body.workspaces[1].disabled, true, '停用判定按路径前缀')
    assert.equal(body.workspaces.length, 3, '子路径记忆不再单列一行(已被根行覆盖)')

    const overview = await booted.call({ action: 'overview' })
    assert.equal(overview.workspaces.total, 3)
    assert.equal(overview.workspaces.disabled, 1)
    assert.equal(overview.stats.health.state, 'ready', '回合管道健康随 stats 下发')
  } finally {
    await booted.fake.dispose()
  }
})

test('injectionlog:onRecord 旁路 sink 收到同一行;回调抛错不影响注入记录', () => {
  const seen = []
  const log = createInjectionLog({ max: 5, onRecord: (row) => seen.push(row) })
  log.record({
    mode: 'inject', sessionId: 's', records: 2, chars: 30,
    items: [{ id: 'm1', r: 0.5, s: 0.2, c: 0.8, e: 1, src: 'user', k: 'fact' }],
  })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].items.length, 1, '质量元数据原样透传给 sink')
  assert.equal(log.list(1)[0], seen[0])
  // sink 抛错:注入记录照常完成,不向上抛(观测不得影响主流程)
  const boom = createInjectionLog({ onRecord: () => { throw new Error('sink boom') } })
  const row = boom.record({ mode: 'skip', reason: 'no-hits', sessionId: 's' })
  assert.equal(row.mode, 'skip')
  assert.equal(boom.list(1).length, 1)
})

test('/neural-mind/api usage/pool:跨重启遥测读取 + R9 只读统计 + stats/overview 带 usage 块', async () => {
  const seededDay = localDay()
  const nowIso = new Date().toISOString()
  const booted = await bootConsole({
    seed: (fake) => {
      seedMemories([record({ id: 'mem_u1' })])(fake)
      // 模拟"上一次运行已经落盘"的遥测:usage.start() 应读回内存镜像
      fake.tables.days = memoryTable()
      fake.tables.days.put(`u_${seededDay}`, {
        id: `u_${seededDay}`,
        date: seededDay,
        counters: {
          'inject.inject': 2, 'inject.records': 3, 'inject.chars': 400,
          'inject.relevanceSum': 1.1, 'inject.relevanceCount': 3,
          'inject.confSum': 2.1, 'inject.confCount': 3,
          'inject.lowTrust': 1, 'inject.unverified': 0,
        },
        updatedAt: nowIso,
      })
      fake.tables.recent = memoryTable()
      fake.tables.recent.put('r_1', {
        id: 'r_1', ts: nowIso, mode: 'inject', records: 3, chars: 400, sessionId: 'sess',
        items: [{ id: 'mem_u1', r: 0.55, s: 0.2, c: 0.7, e: 1, src: 'user', k: 'fact' }],
      })
    },
  })
  try {
    const usageBody = await booted.call({ action: 'usage' })
    assert.equal(usageBody.ok, true)
    assert.equal(usageBody.available, true)
    assert.equal(usageBody.days.length, 1, '启动时读回按天汇总(跨重启可读)')
    assert.equal(usageBody.totals.counters['inject.inject'], 2)
    assert.equal(usageBody.totals.quality.rAvg, 0.37, '1.1 / 3 保留两位')
    assert.equal(usageBody.recent.length, 1)
    assert.equal(usageBody.recent[0].quality.rAvg, 0.55, '明细缺 quality 时由 items 聚合补上')
    assert.equal(usageBody.retention.recentDays, 7)

    const poolBody = await booted.call({ action: 'pool' })
    assert.equal(poolBody.ok, true)
    assert.equal(poolBody.available, true)
    assert.equal(poolBody.counts.active, 1)
    assert.ok(poolBody.volume.totalBytes > 0)

    const statsBody = await booted.call({ action: 'stats' })
    assert.equal(statsBody.usage.available, true)
    assert.equal(statsBody.usage.today['inject.inject'], 2)

    const overviewBody = await booted.call({ action: 'overview' })
    assert.equal(overviewBody.usage.available, true)
  } finally {
    await booted.fake.dispose()
  }
})

test('/neural-mind/api workspaces:注册表缺席/抛错时退回 seenWorkspaces,接口不失败', async () => {
  const broken = await bootConsole({
    seed: (fake) => {
      seedGlobal({ version: 1, seenWorkspaces: [{ id: '/repo/ghost', label: 'ghost', lastSeenMs: 1_700_000_000_000 }] })(fake)
    },
    services: { workspaceRegistry: { list: () => { throw new Error('registry boom') } } },
  })
  try {
    const body = await broken.call({ action: 'workspaces' })
    assert.equal(body.ok, true, '注册表异常不拖垮接口')
    assert.deepEqual(body.workspaces.map((row) => [row.id, row.label, row.lastSeenMs]), [['/repo/ghost', 'ghost', 1_700_000_000_000]])
  } finally {
    await broken.fake.dispose()
  }

  // 服务缺席(老 DSH):仅用 seen/池,不报错
  const absent = await bootConsole({
    seed: (fake) => {
      seedGlobal({ version: 1, seenWorkspaces: [{ id: '/repo/seen', label: 'seen', lastSeenMs: 1 }] })(fake)
    },
  })
  try {
    const body = await absent.call({ action: 'workspaces' })
    assert.equal(body.ok, true)
    assert.equal(body.workspaces.length, 1)
    assert.equal(body.workspaces[0].id, '/repo/seen')
  } finally {
    await absent.fake.dispose()
  }
})

