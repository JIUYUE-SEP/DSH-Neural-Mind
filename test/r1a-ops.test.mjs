/**
 * R1a(0.6.6)记忆管理操作·基础版:
 *  - 后台 `archive` / `restore` / `sensitive` / `hide`(彻底隐藏)——沿用现有存储与操作记录;
 *  - `detail` 补来源追溯:`sessionId` / `sourceRange`;`hb_…` 临时原文缓存支持只读详情;
 *  - `expandSource` 展开来源轮次(与 `memory_recall` 的展开逻辑同源,过滤 hard forget 区间)。
 *
 * 与 `test/api-console.test.mjs` 一样走 `/neural-mind/api` 的真实路由;`extractEnabled:false`
 * 让本文件只测操作面,不被后台提炼干扰(失败/丢弃计数由 extract-visibility 用例覆盖)。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, Config } from '../lib/index.js'
import { createFakeCtx, memoryTable, turnEvents } from './helpers.mjs'

// ── 基建 ────────────────────────────────────────────────────────────────────

function record(overrides = {}) {
  return {
    id: 'm_a',
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
    sourceRange: { startSeq: 0, endSeq: 3 },
    evidence: [],
    status: 'active',
    createdAt: '2026-11-05T08:00:00.000Z',
    ...overrides,
  }
}

function hotEntry(overrides = {}) {
  return {
    id: 'hb_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    sessionId: 'sess-a',
    turn: 1,
    startSeq: 0,
    endSeq: 3,
    content: '[用户] 用 pnpm 管理 workspace 依赖\n[助手] 好的,记下了。',
    digested: false,
    createdAt: '2026-11-05T08:00:00.000Z',
    ...overrides,
  }
}

function fakeReqRes(body) {
  const req = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-neural-mind-client': '1' },
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

/** 启动带 fake webServer 的插件;seed 在 apply 前写表。 */
async function boot({ memories = [], hot = [], outbox = [], audit = [], sessions = {}, services = {}, patch = {} } = {}) {
  const fake = createFakeCtx({})
  if (memories.length > 0) {
    fake.tables.memories = memoryTable()
    for (const item of memories) await fake.tables.memories.put(item.id, item)
  }
  if (hot.length > 0) {
    fake.tables.hotbuffer = memoryTable()
    for (const item of hot) await fake.tables.hotbuffer.put(item.id, item)
  }
  if (outbox.length > 0) {
    fake.tables.outbox = memoryTable()
    for (const item of outbox) await fake.tables.outbox.put(item.id, item)
  }
  if (audit.length > 0) {
    fake.tables.audit = memoryTable()
    for (const item of audit) await fake.tables.audit.put(item.id, item)
  }
  let route = null
  const sessionQuery = { readSession: async (sessionId) => sessions[sessionId] ?? null }
  fake.ctx.get = (name) => {
    if (name === 'storageDomain') return fake.fakeStorageDomain
    if (name === 'webServer') return { register: (definition) => { route = definition; return () => {} } }
    if (name === 'sessionQuery') return sessionQuery
    return services[name]
  }
  await apply(fake.ctx, Config['~standard'].validate({ extractEnabled: false, ...patch }).value)
  const call = async (body) => {
    assert.notEqual(route, null, '/neural-mind/api 已注册')
    const { req, res } = fakeReqRes(body)
    await route.handler(req, res)
    return JSON.parse(res.body)
  }
  const auditKinds = () => [...fake.tables.audit.entries()].map(([, row]) => row.kind)
  const auditRows = () => [...fake.tables.audit.entries()].map(([, row]) => row)
  const memoryOf = (id) => fake.tables.memories.get(id)
  const hotOf = (id) => fake.tables.hotbuffer.get(id)
  const outboxOf = (id) => fake.tables.outbox.get(id)
  return { fake, call, auditKinds, auditRows, memoryOf, hotOf, outboxOf }
}

// ── 状态与标记 ──────────────────────────────────────────────────────────────

test('R1a:archive / restore / sensitive —— 可停用、可恢复、可改敏感标记,均有操作记录', async () => {
  // 打开 sensitiveNoCross 才能验证"手动敏感标记真的影响跨工作区检索"(R4 起默认关)
  const env = await boot({ memories: [record({ id: 'm_a' })], patch: { sensitiveNoCross: true } })
  try {
    const archived = await env.call({ action: 'archive', id: 'm_a' })
    assert.equal(archived.ok, true)
    assert.equal(archived.row.status, 'archived')
    assert.equal(env.memoryOf('m_a').status, 'archived')
    assert.ok(env.auditKinds().includes('memory-archived'), '停用留痕')

    const restored = await env.call({ action: 'restore', id: 'm_a' })
    assert.equal(restored.ok, true)
    assert.equal(restored.row.status, 'active')
    assert.equal(env.memoryOf('m_a').status, 'active')
    assert.ok(env.auditKinds().includes('memory-restored'), '恢复留痕')

    // 敏感标记生效:打开 sensitiveNoCross 时,别的 workspace 的自动带入路径不再命中。
    // 用 recallPreview(=注入路径);标记前能命中,取消后又能命中。
    const before = await env.call({ action: 'recallPreview', query: 'pnpm 管理 workspace 依赖', workspaceId: 'ws-b' })
    assert.equal(before.ok, true)
    assert.equal(before.hits.length, 1, '标记前:跨工作区能检索到')

    const on = await env.call({ action: 'sensitive', id: 'm_a', sensitive: true })
    assert.equal(on.ok, true)
    assert.equal(on.row.sensitive, true)
    assert.equal(env.memoryOf('m_a').sensitive, true)
    const blocked = await env.call({ action: 'recallPreview', query: 'pnpm 管理 workspace 依赖', workspaceId: 'ws-b' })
    assert.equal(blocked.ok, true)
    assert.equal(blocked.hits.length, 0, '标敏感 + sensitiveNoCross:跨工作区检索被拦')

    const off = await env.call({ action: 'sensitive', id: 'm_a', sensitive: false })
    assert.equal(off.ok, true)
    assert.equal(off.row.sensitive, false)
    assert.notEqual(env.memoryOf('m_a').sensitive, true, '取消标记 = 字段不存在(旧数据的默认口径)')
    const visible = await env.call({ action: 'recallPreview', query: 'pnpm 管理 workspace 依赖', workspaceId: 'ws-b' })
    assert.equal(visible.hits.length, 1, '取消标记后恢复跨工作区检索')
    assert.equal(env.auditKinds().filter((kind) => kind === 'memory-sensitive-set').length, 2)

    // 不存在的 id 与缺参:明确报错,不静默成功
    assert.equal((await env.call({ action: 'archive', id: 'm_missing' })).ok, false)
    assert.equal((await env.call({ action: 'sensitive', id: 'm_a' })).ok, false, '缺 sensitive 参数应报错')
  } finally {
    await env.fake.dispose()
  }
})

test('R1a:restore 拒绝已彻底隐藏;恢复时清 negativeSince、过期的 state 续期', async () => {
  const env = await boot({
    memories: [
      record({ id: 'm_hidden', status: 'archived', hidden: true }),
      record({
        id: 'm_neg',
        status: 'archived',
        negativeSince: '2026-10-01T00:00:00.000Z',
        evidence: [{ ts: '2026-09-30T00:00:00.000Z', weight: 1, kind: 'challenge' }],
      }),
      record({
        id: 'm_state',
        status: 'archived',
        temporal: 'state',
        content: '当前项目进度:等待发布',
        expiresAt: '2026-09-01T00:00:00.000Z',
      }),
    ],
  })
  try {
    const blocked = await env.call({ action: 'restore', id: 'm_hidden' })
    assert.equal(blocked.ok, false, '已彻底隐藏不能恢复')
    assert.match(blocked.error, /隐藏/)

    const neg = await env.call({ action: 'restore', id: 'm_neg' })
    assert.equal(neg.ok, true)
    assert.equal(env.memoryOf('m_neg').negativeSince, undefined, '用户恢复 = 不再按旧质疑自动归档')
    assert.equal(env.memoryOf('m_neg').status, 'active')

    const state = await env.call({ action: 'restore', id: 'm_state' })
    assert.equal(state.ok, true)
    assert.ok(Date.parse(env.memoryOf('m_state').expiresAt) > Date.now(), 'state 恢复后重新续期,不会被下一次清扫立刻归档')
  } finally {
    await env.fake.dispose()
  }
})

// ── 彻底隐藏(与工具同口径)──────────────────────────────────────────────────

test('R1a:hide —— archived+hidden、级联 L0、终止同源 outbox、审计打码,与工具同口径', async () => {
  const secret = '秘密内容:银行密码是 123456'
  const env = await boot({
    memories: [record({ id: 'm_secret', content: secret })],
    hot: [hotEntry({ content: secret })],
    outbox: [{
      id: 'ob_1',
      sessionId: 'sess-a',
      turn: 1,
      startSeq: 0,
      endSeq: 3,
      status: 'pending',
      retries: 0,
      createdAt: '2026-11-05T08:00:00.000Z',
    }],
    audit: [{
      id: 'au_old',
      ts: '2026-11-05T09:00:00.000Z',
      kind: 'extract-done',
      detail: `提炼落盘 1 条:${secret}`,
      sessionId: 'sess-a',
    }],
  })
  try {
    const hidden = await env.call({ action: 'hide', id: 'm_secret' })
    assert.equal(hidden.ok, true)

    const memory = env.memoryOf('m_secret')
    assert.equal(memory.status, 'archived')
    assert.equal(memory.hidden, true)
    assert.equal(env.hotOf('hb_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee').hidden, true, '级联屏蔽同源 L0')
    assert.equal(env.outboxOf('ob_1').status, 'skipped', '终止同源待提炼任务')
    assert.ok(env.auditKinds().includes('forget-hard'), '与 memory_forget(hard) 同一条操作记录')
    assert.ok(env.auditKinds().includes('forget-hard-outbox-skipped'))
    assert.ok(env.auditKinds().includes('forget-hard-redacted'), '审计正文打码')
    assert.ok(!env.auditRows().find((row) => row.id === 'au_old').detail.includes('123456'), '旧审计不得继续带正文')

    const again = await env.call({ action: 'hide', id: 'm_secret' })
    assert.equal(again.ok, false, '已隐藏再点:明确报错,不假装成功')

    // L0 条目同样支持彻底隐藏(控制台详情只读也能操作)
    const hot = hotEntry({ id: 'hb_11111111-2222-3333-4444-555555555555', content: '另一段原文' })
    await env.fake.tables.hotbuffer.put(hot.id, hot)
    const hiddenHot = await env.call({ action: 'hide', id: hot.id })
    assert.equal(hiddenHot.ok, true)
    assert.equal(env.hotOf(hot.id).hidden, true)
  } finally {
    await env.fake.dispose()
  }
})

// ── 来源追溯 ────────────────────────────────────────────────────────────────

test('R1a:detail —— 记忆带 sessionId/sourceRange;hb_ 临时原文缓存支持只读详情', async () => {
  const env = await boot({
    memories: [record({ id: 'm_a' })],
    hot: [hotEntry()],
  })
  try {
    const memory = await env.call({ action: 'detail', id: 'm_a' })
    assert.equal(memory.ok, true)
    assert.equal(memory.row.sessionId, 'sess-a')
    assert.deepEqual(memory.row.sourceRange, { startSeq: 0, endSeq: 3 })
    assert.equal(memory.row.sourceExpandable, true, '有来源区间才给"展开来源轮次"')

    const hot = await env.call({ action: 'detail', id: 'hb_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
    assert.equal(hot.ok, true)
    assert.equal(hot.row.status, 'hot', 'L0 没有 archived 态,详情如实标 hot')
    assert.equal(hot.row.readOnly, true, '热缓冲详情只读')
    assert.ok(hot.row.content.includes('pnpm'))
    assert.equal(hot.row.sessionId, 'sess-a')
    assert.deepEqual(hot.row.sourceRange, { startSeq: 0, endSeq: 3 })

    // 没有来源区间(旧数据):detail 正常,但不给展开入口
    await env.fake.tables.memories.put('m_legacy', record({ id: 'm_legacy', sourceRange: undefined }))
    const legacy = await env.call({ action: 'detail', id: 'm_legacy' })
    assert.equal(legacy.ok, true)
    assert.equal(legacy.row.sourceExpandable, false)
  } finally {
    await env.fake.dispose()
  }
})

test('R1a:expandSource —— 读回来源轮次;hard forget 的区间不展示;无来源/隐藏明确报错', async () => {
  const hiddenRange = record({ id: 'm_covered', sessionId: 'sess-b' })
  const env = await boot({
    memories: [
      record({ id: 'm_a' }),
      hiddenRange,
      record({ id: 'm_legacy', sourceRange: undefined }),
      // 已彻底隐藏的记忆:给独立会话,别让它把 sess-a 的整个区间也一起藏掉
      record({ id: 'm_hidden', hidden: true, status: 'archived', sessionId: 'sess-h' }),
    ],
    hot: [hotEntry({
      id: 'hb_bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      sessionId: 'sess-b',
      hidden: true,
      content: '这段被 hard forget',
    })],
    sessions: {
      'sess-a': {
        session: { cwd: '/repo/a' },
        events: turnEvents(1, 0, '我们用 pnpm 管理依赖', '好的,记住了。'),
      },
      'sess-b': {
        session: { cwd: '/repo/a' },
        events: turnEvents(1, 0, '这段被 hard forget', '不应展示。'),
      },
    },
  })
  try {
    const expanded = await env.call({ action: 'expandSource', id: 'm_a' })
    assert.equal(expanded.ok, true, JSON.stringify(expanded))
    assert.equal(expanded.sessionId, 'sess-a')
    assert.deepEqual(expanded.sourceRange, { startSeq: 0, endSeq: 3 })
    assert.ok(expanded.text.includes('我们用 pnpm 管理依赖'), '读回用户原文')
    assert.ok(expanded.text.includes('好的,记住了。'), '读回助手原文')

    const covered = await env.call({ action: 'expandSource', id: 'm_covered' })
    assert.equal(covered.ok, false, '整个区间都被 hard forget:不展示任何内容')

    const legacy = await env.call({ action: 'expandSource', id: 'm_legacy' })
    assert.equal(legacy.ok, false)
    assert.match(legacy.error, /来源区间/)

    const hidden = await env.call({ action: 'expandSource', id: 'm_hidden' })
    assert.equal(hidden.ok, false)
    assert.match(hidden.error, /隐藏/)

    const missing = await env.call({ action: 'expandSource', id: 'm_missing' })
    assert.equal(missing.ok, false)
  } finally {
    await env.fake.dispose()
  }
})

test('SOUL 提议从记忆页恢复后回到暂存(待采纳),不是 active(手滑纠正)', async () => {
  const env = await boot({
    memories: [
      record({
        id: 'm_soul',
        entity: 'soul',
        kind: 'lesson',
        source: 'assistant',
        stagedBy: 'model',
        status: 'archived',
        content: '我回复倾向于简短',
        importance: 6,
        confidence: 0.7,
      }),
    ],
  })
  try {
    const restored = await env.call({ action: 'restore', id: 'm_soul' })
    assert.equal(restored.ok, true)
    assert.equal(restored.row.status, 'staged', 'SOUL 提议必须回到待采纳,不能变成 active')
    assert.equal(env.memoryOf('m_soul').status, 'staged')
    const audit = env.auditRows().find((row) => row.kind === 'memory-restored')
    assert.ok(/SOUL 提议/.test(String(audit?.detail)), '审计写明恢复为 SOUL 提议')
    // 恢复后仍走 SOUL 通道:普通暂存确认继续拒绝,避免被当成普通记忆转正
    assert.equal((await env.call({ action: 'confirm', id: 'm_soul' })).ok, false)
  } finally {
    await env.fake.dispose()
  }
})