/**
 * 工具层直测(§4.3):`registerTools` 注册的 memory_recall / memory_forget 走真实执行路径。
 *
 * 立这一层的起因(第四轮评审必修 #1):`memory_recall` 按 id 整条展开时并不经过
 * `search.search()` 的 `eligible()`,所以「hidden 全域不可见」这条合同只被 search 路径兑现,
 * id 直达能绕过。search.test.mjs 覆盖的是 search 路径,工具层此前**零测试**。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config } from '../lib/config.js'
import { createSearch } from '../lib/search.js'
import { registerTools } from '../lib/tools.js'
import { createFakeCtx, fakeToolsService, memoryTable, testConfig } from './helpers.mjs'

const cfg = testConfig(undefined)
const rankCfg = { ...cfg.decay, ...cfg.scoring }
const noEmbedder = { available: async () => false, model: '', embedQuery: async () => null, embedChunks: async () => undefined }
const SECRET = '用户的私密内容:银行密码是 123456'

function memory(over) {
  const now = new Date().toISOString()
  return {
    id: over.id,
    content: over.content,
    kind: 'fact',
    source: 'user',
    importance: 5,
    confidence: 0.9,
    temporal: 'pattern',
    eventTime: now,
    workspaceId: '/repo/a',
    workspaceLabel: 'a',
    sessionId: 's1',
    evidence: [],
    status: 'active',
    createdAt: now,
    ...over,
  }
}

/** 造一套最小的真实依赖:真 createSearch + 内存表 + 假审计/工作区。 */
async function build({ memories = [], hot = [], services = {}, workspace, config } = {}) {
  const activeCfg = config ?? cfg
  const activeRankCfg = { ...activeCfg.decay, ...activeCfg.scoring }
  const search = createSearch({ cfg: activeCfg, rankCfg: activeRankCfg, embedder: noEmbedder, logger: console })
  const store = { memories: memoryTable(), hotbuffer: memoryTable(), audit: memoryTable() }
  for (const m of memories) {
    await store.memories.put(m.id, m)
    search.upsertMemory(m)
  }
  for (const h of hot) await store.hotbuffer.put(h.id, h)

  const audit = {
    writes: [],
    write: async (kind, detail, sessionId) => { audit.writes.push({ kind, detail, sessionId }) },
  }
  const toolsMap = new Map()
  const fake = createFakeCtx({ services: { tools: fakeToolsService(toolsMap), ...services } })
  registerTools({
    ctx: fake.ctx,
    cfg: activeCfg,
    rankCfg: activeRankCfg,
    search,
    store,
    hotbuffer: { cascadeHidden: async () => {} },
    workspace: workspace ?? { resolve: async () => ({ id: '/repo/a', label: 'a' }) },
    audit,
    embedder: noEmbedder,
    logger: console,
    soul: undefined,
  })
  const call = async (name, args) => {
    const definition = toolsMap.get(name)
    assert.ok(definition !== undefined, `工具 ${name} 应已注册`)
    return definition.execute(args, { agent: { session: { id: 's1' } } })
  }
  return { search, store, audit, call, toolsMap, cfg: activeCfg, rankCfg: activeRankCfg }
}

const HIDDEN_ID = 'm_11111111-2222-3333-4444-555555555555'
const NORMAL_ID = 'm_66666666-7777-8888-9999-000000000000'
const HIDDEN_HOT_ID = 'hb_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

test('工具:hard 屏蔽后按 id recall 必须拒绝,不返回正文(§4.2 全域不可见)', async () => {
  const env = await build({
    memories: [
      memory({ id: HIDDEN_ID, content: SECRET, hidden: true, status: 'archived' }),
      memory({ id: NORMAL_ID, content: '用户的公开偏好:示例偏好' }),
    ],
  })

  // 前置事实:hidden 条目确实还在语料里(search.get 是裸查询、不过 eligible)——这正是后门所在
  assert.equal(env.search.get(HIDDEN_ID)?.record.content, SECRET, '语料里仍可取到 hidden 记录(故守卫必须在工具层)')
  const viaSearch = await env.search.search({ query: SECRET, purpose: 'recall', includeArchived: true, limit: 10 })
  assert.ok(!viaSearch.map((h) => h.id).includes(HIDDEN_ID), 'search 路径本来就不返回 hidden')

  const blocked = await env.call('memory_recall', { query: HIDDEN_ID })
  assert.ok(!blocked.text.includes('123456'), `正文不得出现,实际:${blocked.text}`)
  assert.match(blocked.text, /硬屏蔽/)
  assert.equal(env.audit.writes.filter((w) => w.kind === 'recall-hidden-blocked').length, 1, '拒绝要留审计')

  // 对照组:非 hidden 条目按 id 照常展开(守卫不能过宽)
  const normal = await env.call('memory_recall', { query: NORMAL_ID })
  assert.ok(normal.text.includes('示例偏好'), `正常条目应返回正文,实际:${normal.text}`)
})

test('工具:热缓冲里的 hidden 条目走 store 兜底路径也要被拒', async () => {
  const env = await build({
    hot: [{ id: HIDDEN_HOT_ID, content: SECRET, hidden: true, sessionId: 's1', createdAt: new Date().toISOString() }],
  })
  // 该条不在语料里(hot 未 upsert),只能由 store.hotbuffer 直取命中 → 守着的是兜底那一条
  assert.equal(env.search.get(HIDDEN_HOT_ID), undefined, '语料里没有它,只能走 store 兜底')
  const blocked = await env.call('memory_recall', { query: HIDDEN_HOT_ID })
  assert.ok(!blocked.text.includes('123456'), `正文不得出现,实际:${blocked.text}`)
  assert.match(blocked.text, /硬屏蔽/)
})

test('工具:memory_forget(hard) 之后,同一条的 id 通道立即关闭(端到端)', async () => {
  const env = await build({ memories: [memory({ id: NORMAL_ID, content: SECRET })] })
  const before = await env.call('memory_recall', { query: NORMAL_ID })
  assert.ok(before.text.includes('123456'), '屏蔽前按 id 可读')

  const forgotten = await env.call('memory_forget', { id: NORMAL_ID, hard: true })
  assert.match(forgotten.text, /屏蔽/)

  const after = await env.call('memory_recall', { query: NORMAL_ID })
  assert.ok(!after.text.includes('123456'), `屏蔽后正文不得再出现,实际:${after.text}`)
  assert.match(after.text, /硬屏蔽/)

  // 普通(非 hard)归档不受影响:仍可 recall,渲染带"(已归档)"
  const archivedOnly = await build({ memories: [memory({ id: NORMAL_ID, content: SECRET })] })
  await archivedOnly.call('memory_forget', { id: NORMAL_ID })
  const recalled = await archivedOnly.call('memory_recall', { query: NORMAL_ID })
  assert.ok(recalled.text.includes('123456'), 'archived 仍可 recall(设计如此)')
  assert.match(recalled.text, /已归档/)
})

test('工具:L0 条目软遗忘不得记成 forget-hard,打码只发生在 hard(§4.3)', async () => {
  const SOFT_HOT = 'hb_11111111-2222-3333-4444-555555555555'
  const HARD_HOT = 'hb_22222222-3333-4444-5555-666666666666'
  const env = await build({
    hot: [
      { id: SOFT_HOT, content: '热缓冲里的普通内容', sessionId: 's1', createdAt: new Date().toISOString() },
      { id: HARD_HOT, content: SECRET, sessionId: 's1', createdAt: new Date().toISOString() },
    ],
  })

  // 软遗忘:L0 没有 archived 态,按 hidden 处理,但审计要如实记 forget(不是 forget-hard)
  const soft = await env.call('memory_forget', { id: SOFT_HOT })
  assert.match(soft.text, /L0 无归档态/)
  assert.equal(env.store.hotbuffer.get(SOFT_HOT).hidden, true, '软遗忘也要立刻退出一切通道')
  const softAudit = env.audit.writes.filter((w) => w.kind.startsWith('forget'))
  assert.deepEqual(softAudit.map((w) => w.kind), ['forget'], '软遗忘不得记成 forget-hard')

  // hard:记 forget-hard,并且审计里不留正文
  await env.call('memory_forget', { id: HARD_HOT, hard: true })
  const hardAudit = env.audit.writes.filter((w) => w.kind === 'forget-hard')
  assert.equal(hardAudit.length, 1)
  assert.ok(!hardAudit[0].detail.includes('123456'), `hard 审计不得带正文,实际:${hardAudit[0].detail}`)
})

test('工具:trajectory 回放会话行动链;缺省本会话;回放不触动任何记忆(§4.3)', async () => {
  const seen = []
  const turn = (n, user, assistant, toolName) => [
    { type: 'turn/start', seq: n * 10, time: Date.now(), data: { turn: n } },
    { type: 'user/message', seq: n * 10 + 1, time: Date.now(), data: { id: `u${n}`, role: 'user', content: [{ type: 'text', text: user }], source: { kind: 'user' } } },
    { type: 'assistant/message', seq: n * 10 + 2, time: Date.now(), data: { turn: n, step: 1, message: { id: `a${n}`, role: 'assistant', content: [
      { type: 'text', text: assistant },
      ...(toolName !== undefined ? [{ type: 'tool-call', id: `tc${n}`, name: toolName, arguments: '{}' }] : []),
    ] } } },
  ]
  const sessionQuery = {
    readSession: async (id) => { seen.push(id); return { events: [
      ...turn(1, '怎么装这个依赖', '先看下 package.json', 'bash'),
      // V4 tool/result(DSH 0.2.0-rc.1 起):tool 角色消息,toolCallId/isError 在顶层,content 直接是内容块
      {
        type: 'tool/result', seq: 13, time: Date.now(),
        data: { turn: 1, step: 1, message: { id: 't1', role: 'tool', toolCallId: 'tc1', source: { kind: 'tool', callId: 'tc1' }, content: [{ type: 'text', text: 'npm error E404' }], isError: true } },
      },
      ...turn(2, '报错了怎么办', '是版本问题,升级即可'),
    ] } },
  }
  // 过期时间用相对值:写死绝对日期会在「过期 + 2×TTL 宽限期」后变成归档态,用例自毁(2026-10 的教训)
  const expires = new Date(Date.now() + 5 * 86_400_000).toISOString()
  const stateRecord = memory({ id: 'm_state', content: '进行中的事项', temporal: 'state', expiresAt: expires })
  const env = await build({ memories: [stateRecord], services: { sessionQuery } })

  const out = await env.call('memory_recall', { mode: 'trajectory' })
  assert.ok(out.text.includes('会话行动链(共 2 轮'), out.text)
  assert.ok(out.text.includes('怎么装这个依赖') && out.text.includes('调用: bash'), out.text)
  assert.ok(out.text.includes('(1 个失败)'), `V4 tool/result 的 isError 要计入失败数:${out.text}`)
  assert.deepEqual(seen, ['s1'], '不传 session 时回放本会话')
  // 回放的是会话日志,不触碰记忆记录:state 条目的 expiresAt 原样(不计召回续期,§4.3)
  assert.equal(env.store.memories.get('m_state').expiresAt, expires, '回放不得触发召回续期')

  const explicit = await env.call('memory_recall', { mode: 'trajectory', session: 's-other' })
  assert.deepEqual(seen[1], 's-other', 'session 参数显式指定')
  // 管道缺席时如实告知(§7 降级)
  const env2 = await build({})
  const degraded = await env2.call('memory_recall', { mode: 'trajectory' })
  assert.match(degraded.text, /管道缺席/)
})

test('工具:A1 current 让普通 recall 看到本域 private/sensitive,跨域仍隐藏', async () => {
  const env = await build({
    config: testConfig({ privateWorkspaces: ['/repo/priv'], sensitiveNoCross: true }),
    memories: [
      memory({ id: 'm_local_vis', content: '本地 pnpm 偏好' }),
      memory({ id: 'm_priv_vis', content: '私有目录 pnpm 偏好', workspaceId: '/repo/priv' }),
      memory({ id: 'm_sens_vis', content: '敏感 pnpm 偏好', workspaceId: '/repo/b', sensitive: true }),
    ],
  })
  const recalled = await env.call('memory_recall', { query: 'pnpm' })
  assert.ok(recalled.text.includes('本地 pnpm'), recalled.text)
  assert.ok(!recalled.text.includes('私有目录'), '跨域 private 不出现')
  assert.ok(!recalled.text.includes('敏感 pnpm'), '跨域 sensitive 不出现')

  const blockedForget = await env.call('memory_forget', { id: 'm_priv_vis' })
  assert.match(blockedForget.text, /没有找到/)
  assert.equal(env.store.memories.get('m_priv_vis').status, 'active', '跨域 private 不得被修改')
})

test('工具:filter-only recall 支持纯 session / 纯时间窗', async () => {
  const now = new Date().toISOString()
  const env = await build({
    memories: [
      memory({ id: 'm_time_1', content: '纯时间窗记忆一', temporal: 'state', sessionId: 's-time', eventTime: now }),
      memory({ id: 'm_time_2', content: '纯时间窗记忆二', temporal: 'state', sessionId: 's-other', eventTime: now }),
    ],
  })
  const bySession = await env.call('memory_recall', { session: 's-time' })
  assert.ok(bySession.text.includes('纯时间窗记忆一'), bySession.text)
  assert.ok(!bySession.text.includes('纯时间窗记忆二'), bySession.text)
  const byTime = await env.call('memory_recall', { time: '7d' })
  assert.ok(byTime.text.includes('纯时间窗记忆一'), byTime.text)
  assert.ok(byTime.text.includes('纯时间窗记忆二'), byTime.text)
})

test('工具:A9 trajectory / expandOriginal 过滤 hard-forget 隐藏区间', async () => {
  const hiddenHot = {
    id: 'hb_99999999-9999-9999-9999-999999999999', content: 'HIDDEN-HOT-SECRET',
    sessionId: 's1', hidden: true, startSeq: 1, endSeq: 5, createdAt: new Date().toISOString(),
  }
  const hiddenMem = memory({
    id: 'm_hidden_range', content: 'HIDDEN-MEM-SECRET', hidden: true,
    sessionId: 's1', sourceRange: { startSeq: 1, endSeq: 5 },
  })
  const visible = memory({
    id: 'm_aaaaaaaa-0000-0000-0000-000000000000', content: '可见结论', sessionId: 's1',
    sourceRange: { startSeq: 1, endSeq: 5 },
  })
  const sessionQuery = {
    readSession: async () => ({
      session: { cwd: '/repo/a' },
      events: [
        { type: 'turn/start', seq: 1, time: Date.now(), data: { turn: 1 } },
        { type: 'user/message', seq: 2, time: Date.now(), data: { id: 'u1', role: 'user', content: [{ type: 'text', text: 'HIDDEN-HOT-SECRET' }], source: { kind: 'user' } } },
        { type: 'assistant/message', seq: 3, time: Date.now(), data: { turn: 1, step: 1, message: { id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'HIDDEN-MEM-SECRET' }] } } },
        { type: 'turn/end', seq: 4, time: Date.now(), data: { turn: 1, reason: { kind: 'completed' } } },
        { type: 'turn/start', seq: 6, time: Date.now(), data: { turn: 2 } },
        { type: 'user/message', seq: 7, time: Date.now(), data: { id: 'u2', role: 'user', content: [{ type: 'text', text: '可见内容' }], source: { kind: 'user' } } },
        { type: 'assistant/message', seq: 8, time: Date.now(), data: { turn: 2, step: 1, message: { id: 'a2', role: 'assistant', content: [{ type: 'text', text: '可见回复' }] } } },
        { type: 'turn/end', seq: 9, time: Date.now(), data: { turn: 2, reason: { kind: 'completed' } } },
      ],
    }),
  }
  const env = await build({ memories: [hiddenMem, visible], hot: [hiddenHot], services: { sessionQuery } })
  const trajectory = await env.call('memory_recall', { mode: 'trajectory' })
  assert.ok(!trajectory.text.includes('HIDDEN-HOT-SECRET'), trajectory.text)
  assert.ok(!trajectory.text.includes('HIDDEN-MEM-SECRET'), trajectory.text)
  assert.ok(trajectory.text.includes('可见内容'), trajectory.text)
  const expanded = await env.call('memory_recall', { query: 'm_aaaaaaaa-0000-0000-0000-000000000000' })
  assert.ok(!expanded.text.includes('HIDDEN-HOT-SECRET'), expanded.text)
  assert.ok(!expanded.text.includes('HIDDEN-MEM-SECRET'), expanded.text)
  assert.match(expanded.text, /原文已不可考/)
})

test('R8a(0.6.6):recall 展开原文不受整理用的工具输出上限影响(长度不变)', async () => {
  // docs/legacy/REVIEW.md R8 的关键约束:renderOriginal 同时供后台整理与 memory_recall 展开原文;
  // 整理路径按 extractToolOutputMaxChars(默认 8000)截工具输出,展开原文必须仍是全文
  // (只受 recallFullMaxChars 约束)。这里 9,000+ 字符的单个工具输出正好卡在两者之间。
  const bigOutput = `${'详细日志行\n'.repeat(1500)}FULL-DETAIL-TAIL`
  assert.ok(bigOutput.length > 8000 && bigOutput.length < 16384, '前置:超过整理上限、低于展开上限')
  const sessionQuery = {
    readSession: async () => ({
      session: { cwd: '/repo/a' },
      events: [
        { type: 'turn/start', seq: 1, time: Date.now(), data: { turn: 1 } },
        { type: 'user/message', seq: 2, time: Date.now(), data: { id: 'u1', role: 'user', content: [{ type: 'text', text: '看下构建日志' }], source: { kind: 'user' } } },
        {
          type: 'assistant/message', seq: 3, time: Date.now(),
          data: {
            turn: 1, step: 1,
            message: {
              id: 'a1', role: 'assistant', source: { kind: 'model', provider: 'p', model: 'm' },
              content: [
                { type: 'text', text: '我跑一下' },
                { type: 'tool-call', id: 'tc1', name: 'bash', arguments: '{"cmd":"build"}' },
              ],
            },
          },
        },
        { type: 'tool/result', seq: 4, time: Date.now(), data: { turn: 1, step: 1, message: { id: 't1', role: 'tool', toolCallId: 'tc1', source: { kind: 'tool', callId: 'tc1' }, content: [{ type: 'text', text: bigOutput }], isError: false } } },
        { type: 'turn/end', seq: 5, time: Date.now(), data: { turn: 1, reason: { kind: 'completed' } } },
      ],
    }),
  }
  const visible = memory({
    id: 'm_cccccccc-0000-0000-0000-000000000000', content: '构建日志的结论', sessionId: 's1',
    sourceRange: { startSeq: 1, endSeq: 5 },
  })
  const env = await build({ memories: [visible], services: { sessionQuery } })
  const expanded = await env.call('memory_recall', { query: visible.id })
  assert.ok(expanded.text.includes('FULL-DETAIL-TAIL'), `展开原文不该被整理上限截掉: ${expanded.text.slice(0, 300)}`)
})

test('R13b(0.6.6):remember 带真实用户原话核对通过 → 来源 user + 用户权重印证', async () => {
  const sessionQuery = {
    readSession: async () => ({
      session: { cwd: '/repo/a' },
      events: [
        { type: 'turn/start', seq: 1, time: Date.now(), data: { turn: 1 } },
        { type: 'user/message', seq: 2, time: Date.now(), data: { id: 'u1', role: 'user', content: [{ type: 'text', text: '帮我记一下:项目统一用 pnpm 管理依赖' }], source: { kind: 'user' } } },
        { type: 'turn/end', seq: 3, time: Date.now(), data: { turn: 1, reason: { kind: 'completed' } } },
      ],
    }),
  }
  const env = await build({ services: { sessionQuery } })
  await env.call('memory_remember', {
    content: '项目统一用 pnpm 管理依赖',
    confirm: true,
    userQuote: '项目统一用 pnpm 管理依赖',
  })
  const record = [...env.store.memories.entries()][0][1]
  assert.equal(record.source, 'user', '原话核对通过 → 用户说的')
  assert.equal(record.evidence[0].weight, 1, '用户权重印证(evidenceWeights.user)')
})

test('R13b(0.6.6):remember 不带引用 / 引用对不上 → 来源 assistant + 系统权重', async () => {
  const sessionQuery = {
    readSession: async () => ({
      session: { cwd: '/repo/a' },
      events: [
        { type: 'turn/start', seq: 1, time: Date.now(), data: { turn: 1 } },
        { type: 'user/message', seq: 2, time: Date.now(), data: { id: 'u1', role: 'user', content: [{ type: 'text', text: '今天天气不错' }], source: { kind: 'user' } } },
        { type: 'turn/end', seq: 3, time: Date.now(), data: { turn: 1, reason: { kind: 'completed' } } },
      ],
    }),
  }
  const env = await build({ services: { sessionQuery } })
  // ① 不带引用
  await env.call('memory_remember', { content: 'R13B-NO-QUOTE 42', confirm: true })
  const noQuote = [...env.store.memories.entries()].find(([, m]) => m.content === 'R13B-NO-QUOTE 42')[1]
  assert.equal(noQuote.source, 'assistant', '没引用 → 助手说的(confirm 不是证据)')
  assert.equal(noQuote.evidence[0].weight, 0.5, '系统权重')
  // ② 引用对不上(编造原话)
  await env.call('memory_remember', { content: 'R13B-FAKE-QUOTE 42', confirm: true, userQuote: '用户原话里根本没这句' })
  const fakeQuote = [...env.store.memories.entries()].find(([, m]) => m.content === 'R13B-FAKE-QUOTE 42')[1]
  assert.equal(fakeQuote.source, 'assistant', '引用对不上 → 助手说的')
  assert.equal(fakeQuote.evidence[0].weight, 0.5)
})

test('R13b(0.6.6):recall 列表显示来源档位(用户说的 / 助手记下的 / 来源查不清 / 你确认过)', async () => {
  const env = await build({
    memories: [
      memory({ id: 'm_11111111-0000-0000-0000-000000000001', content: 'TIER-LABEL 42 用户档', source: 'user' }),
      memory({ id: 'm_11111111-0000-0000-0000-000000000002', content: 'TIER-LABEL 42 助手档', source: 'assistant' }),
      memory({ id: 'm_11111111-0000-0000-0000-000000000003', content: 'TIER-LABEL 42 查不清档', source: 'unknown' }),
      memory({ id: 'm_11111111-0000-0000-0000-000000000004', content: 'TIER-LABEL 42 确认档', source: 'assistant', confirmedByUser: true }),
    ],
  })
  const out = await env.call('memory_recall', { query: 'TIER-LABEL' })
  assert.ok(out.text.includes('用户说的'), out.text)
  assert.ok(out.text.includes('助手记下的'), out.text)
  assert.ok(out.text.includes('来源查不清'), out.text)
  assert.ok(out.text.includes('你确认过'), out.text)
})

test('工具:trajectory 跨域纪律——只回放当前或同工作区会话(2026-09-19 裁决)', async () => {
  const sessionQuery = {
    readSession: async (id) => ({
      header: { id, cwd: id === 's-far' ? '/other/place' : '/repo/a' },
      events: [
        { type: 'turn/start', seq: 1, time: Date.now(), data: { turn: 1 } },
        { type: 'user/message', seq: 2, time: Date.now(), data: { id: 'u1', role: 'user', content: [{ type: 'text', text: '远端会话内容' }], source: { kind: 'user' } } },
      ],
    }),
  }
  const env = await build({ services: { sessionQuery }, workspace: { resolve: async (cwd) => ({ id: cwd, label: cwd }) } })
  const recall = env.toolsMap.get('memory_recall')
  const execFor = (cwd) => ({ agent: { session: { id: 's-here', header: { cwd } } } })
  // 同工作区回放:放行
  const near = await recall.execute({ mode: 'trajectory', session: 's-near' }, execFor('/repo/a'))
  assert.ok(near.text.includes('远端会话内容'), `同工作区回放放行: ${near.text}`)
  // 不同工作区:拒
  const far = await recall.execute({ mode: 'trajectory', session: 's-far' }, execFor('/repo/a'))
  assert.ok(!far.text.includes('远端会话内容') && far.text.includes('不在当前工作区'), `跨工作区回放拒绝: ${far.text}`)
  // 无法确认同工作区(无 cwd):保守拒绝
  const unknown = await recall.execute({ mode: 'trajectory', session: 's-near' }, { agent: { session: { id: 's-here' } } })
  assert.ok(unknown.text.includes('无法确认'), `无法确认时拒绝: ${unknown.text}`)
})

test('工具:R13a recall 截断标注 + limit(1–20,默认 10)', async () => {
  const memories = []
  for (let i = 1; i <= 15; i += 1) {
    memories.push(memory({ id: `m_limit_${String(i).padStart(2, '0')}`, content: `相同主题的记忆内容 ${i} 号,都在讲同一个关键词。` }))
  }
  const env = await build({ memories })
  const dflt = await env.call('memory_recall', { query: '相同主题的记忆内容' })
  assert.equal((dflt.text.match(/^\[m_limit_/gm) ?? []).length, 10, '默认显示前 10 条')
  assert.match(dflt.text, /共显示前 10 条/, '截断要有标注')
  assert.match(dflt.text, /还有更多/, '提示收窄条件')

  const three = await env.call('memory_recall', { query: '相同主题的记忆内容', limit: 3 })
  assert.equal((three.text.match(/^\[m_limit_/gm) ?? []).length, 3, 'limit=3 生效')
  assert.match(three.text, /共显示前 3 条/)

  const all = await env.call('memory_recall', { query: '相同主题的记忆内容', limit: 20 })
  assert.equal((all.text.match(/^\[m_limit_/gm) ?? []).length, 15, 'limit=20 全量显示')
  assert.ok(!all.text.includes('还有更多'), '全量显示时不提示截断')

  const low = await env.call('memory_recall', { query: '相同主题的记忆内容', limit: 0 })
  assert.equal((low.text.match(/^\[m_limit_/gm) ?? []).length, 1, 'limit 下界夹到 1')
})

test('工具:R13a forget 关联记忆回显上限(10 条 + 总数)', async () => {
  const memories = [memory({ id: 'm_ft_main', content: '唯一目标 pnpm 项目记录', entity: '项目X' })]
  for (let i = 1; i <= 15; i += 1) {
    memories.push(memory({ id: `m_ft_rel_${i}`, content: `无关对象 Z 的记录 ${i}`, entity: '项目X' }))
  }
  const env = await build({ memories })
  const out = await env.call('memory_forget', { query: '唯一目标 pnpm 项目记录' })
  assert.match(out.text, /同 entity 相关记忆\(共 15 条,显示前 10 条/, out.text)
  assert.equal((out.text.match(/^\[m_ft_rel_/gm) ?? []).length, 10, '相关条目最多列 10 条')
  assert.match(out.text, /另有 5 条未列出/, '未列出的给总数')
})
