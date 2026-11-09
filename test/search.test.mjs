import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Bm25Index } from '../lib/bm25.js'
import { createSearch } from '../lib/search.js'
import { tokenize } from '../lib/text.js'
import { DAY_MS } from '../lib/util.js'
import { testConfig } from './helpers.mjs'

const cfg = testConfig(undefined)
const rankCfg = { ...cfg.decay, ...cfg.scoring }
const NOW = Date.parse('2026-09-15T12:00:00Z')
const isoDaysAgo = (d) => new Date(NOW - d * DAY_MS).toISOString()

const noEmbedder = { available: async () => false, model: '', embedQuery: async () => null, embedChunks: async () => undefined }

function memory(over) {
  return {
    id: over.id,
    content: over.content,
    kind: 'fact',
    source: 'user',
    importance: 5,
    confidence: 0.9,
    temporal: 'pattern',
    eventTime: isoDaysAgo(1),
    workspaceId: '/repo/a',
    workspaceLabel: 'a',
    sessionId: 's1',
    evidence: [],
    status: 'active',
    createdAt: isoDaysAgo(1),
    ...over,
  }
}

test('BM25:及格线过滤(§5.1)', () => {
  const index = new Bm25Index({ k1: 1.5, b: 0.75 })
  index.add('a', tokenize('项目统一用 pnpm 管理依赖'))
  index.add('b', tokenize('今天天气很好适合散步'))
  const hits = index.search(tokenize('pnpm 依赖'), 10)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].id, 'a')
  assert.ok(hits[0].score > 0.1, '过绝对及格线')
})

test('检索硬过滤(§5.4):hidden 全域不可见;sensitive 不跨域;private 只进不出;archived 仅 recall', async () => {
  const cfgPriv = testConfig({ privateWorkspaces: ['/repo/priv'], sensitiveNoCross: true })
  const searchPriv = createSearch({ cfg: cfgPriv, rankCfg: { ...cfgPriv.decay, ...cfgPriv.scoring }, embedder: noEmbedder, logger: console })
  searchPriv.upsertMemory(memory({ id: 'm_hidden', content: '隐藏的记忆 pnpm', hidden: true }))
  searchPriv.upsertMemory(memory({ id: 'm_sensitive', content: '敏感的记忆 pnpm', sensitive: true, workspaceId: '/repo/b', workspaceLabel: 'b' }))
  searchPriv.upsertMemory(memory({ id: 'm_private', content: '私有的记忆 pnpm', workspaceId: '/repo/priv', workspaceLabel: 'priv' }))
  searchPriv.upsertMemory(memory({ id: 'm_archived', content: '已归档的记忆 pnpm', status: 'archived' }))
  searchPriv.upsertMemory(memory({ id: 'm_normal', content: '正常的记忆 pnpm' }))
  // 填充语料,让 'pnpm' 的 IDF 高过绝对及格线 0.1(小语料 BM25 漂移,§5.1 已知特性)
  for (let i = 0; i < 8; i++) searchPriv.upsertMemory(memory({ id: `m_filler${i}`, content: `无关的填充内容 ${i} 号` }))

  const fromA = { workspaceId: '/repo/a', sessionId: 's2' }
  const hits = await searchPriv.search({ query: 'pnpm', current: fromA, purpose: 'inject', limit: 10 })
  const ids = hits.map((h) => h.id)
  assert.deepEqual(ids, ['m_normal'], `只有正常条目可注入,实际 ${ids}`)

  const recalled = await searchPriv.search({ query: 'pnpm', current: fromA, purpose: 'recall', includeArchived: true, limit: 10 })
  const rids = recalled.map((h) => h.id)
  assert.ok(rids.includes('m_archived'), 'archived recall 可见')
  assert.ok(!rids.includes('m_hidden'), 'hidden recall 也不可见')

  // 本地视角:sensitive 本地照常;private 本地可见
  const fromB = await searchPriv.search({ query: 'pnpm', current: { workspaceId: '/repo/b', sessionId: 's3' }, purpose: 'inject', limit: 10 })
  assert.ok(fromB.some((h) => h.id === 'm_sensitive'), 'sensitive 本地照常')
  const fromPriv = await searchPriv.search({ query: 'pnpm', current: { workspaceId: '/repo/priv', sessionId: 's4' }, purpose: 'inject', limit: 10 })
  assert.ok(fromPriv.some((h) => h.id === 'm_private'), 'private 本地可见')
})

test('R4(0.6.6):默认配置 sensitive 开关关闭——标记不拦跨域;显式打开仍拦', async () => {
  // 默认(sensitiveNoCross=false):标了 sensitive 的技术记忆可跨工作区带入(R4 的目的)
  const searchDefault = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: console })
  searchDefault.upsertMemory(memory({ id: 'm_marked', content: '标了敏感的 pnpm 技术记忆', sensitive: true, workspaceId: '/repo/b', workspaceLabel: 'b' }))
  for (let i = 0; i < 8; i++) searchDefault.upsertMemory(memory({ id: `m_def_filler${i}`, content: `无关的填充内容 ${i} 号` }))
  const fromA = { workspaceId: '/repo/a', sessionId: 's2' }
  const openHits = await searchDefault.search({ query: 'pnpm', current: fromA, purpose: 'inject', limit: 10 })
  assert.ok(openHits.some((h) => h.id === 'm_marked'), '默认配置下 sensitive 标记不拦跨域(R4)')

  // 显式打开开关:同一份池子恢复跨域拦截(机制未删,只是默认关)
  const cfgStrict = testConfig({ sensitiveNoCross: true })
  const searchStrict = createSearch({
    cfg: cfgStrict,
    rankCfg: { ...cfgStrict.decay, ...cfgStrict.scoring },
    embedder: noEmbedder,
    logger: console,
  })
  searchStrict.upsertMemory(memory({ id: 'm_marked', content: '标了敏感的 pnpm 技术记忆', sensitive: true, workspaceId: '/repo/b', workspaceLabel: 'b' }))
  for (let i = 0; i < 8; i++) searchStrict.upsertMemory(memory({ id: `m_str_filler${i}`, content: `无关的填充内容 ${i} 号` }))
  const blocked = await searchStrict.search({ query: 'pnpm', current: fromA, purpose: 'inject', limit: 10 })
  assert.ok(!blocked.some((h) => h.id === 'm_marked'), '打开开关后仍跨域拦截')
})

test('本会话排除:当前会话的 L0 条目不参与动态注入(§4.2)', async () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: console })
  const hot = {
    id: 'hb_1', sessionId: 's1', workspaceId: '/repo/a', workspaceLabel: 'a',
    turn: 1, startSeq: 0, endSeq: 3, content: '刚才讨论的 pnpm 内容', digested: false, createdAt: isoDaysAgo(0),
  }
  search.upsertHot(hot)
  const sameSession = await search.search({ query: 'pnpm', current: { workspaceId: '/repo/a', sessionId: 's1' }, purpose: 'inject', limit: 5 })
  assert.equal(sameSession.length, 0, '本会话 L0 排除')
  const otherSession = await search.search({ query: 'pnpm', current: { workspaceId: '/repo/a', sessionId: 's2' }, purpose: 'inject', limit: 5 })
  assert.equal(otherSession.length, 1, '其他会话可见')
  // 消化后退出检索池(§1)
  search.upsertHot({ ...hot, digested: true })
  const afterDigest = await search.search({ query: 'pnpm', current: { workspaceId: '/repo/a', sessionId: 's2' }, purpose: 'inject', limit: 5 })
  assert.equal(afterDigest.length, 0)
})

test('固定 global:异地记忆照常可搜;private/sensitive 仍按域过滤', async () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: console })
  search.upsertMemory(memory({ id: 'm_remote', content: '异地的 pnpm 记忆', workspaceId: '/repo/b' }))
  const hits = await search.search({ query: 'pnpm', current: { workspaceId: '/repo/a', sessionId: 's' }, purpose: 'inject', limit: 5 })
  assert.equal(hits.length, 1, 'global 下异地记忆可见')
})

test('privateWorkspaces:Windows 正/反斜杠和尾斜杠归一', async () => {
  const cfgPath = testConfig({ privateWorkspaces: ['C:/repo/priv/'] })
  const search = createSearch({ cfg: cfgPath, rankCfg: { ...cfgPath.decay, ...cfgPath.scoring }, embedder: noEmbedder, logger: console })
  const record = memory({ id: 'm_priv', content: 'private pnpm', workspaceId: 'C:\\repo\\priv\\sub' })
  search.upsertMemory(record)
  assert.equal(search.canAccess(record, 'mem', {
    current: { workspaceId: 'C:/repo/priv/sub', sessionId: 's' }, includeArchived: true,
  }), true, '同域不同分隔符可访问')
  assert.equal(search.canAccess(record, 'mem', {
    current: { workspaceId: 'C:/repo/other', sessionId: 's' }, includeArchived: true,
  }), false, '异地 private 不可访问')
})

test('filter-only list:纯时间窗/纯 session 可枚举', async () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: console })
  const now = Date.now()
  search.upsertMemory(memory({ id: 'm_t1', content: '时间窗一', sessionId: 's1', eventTime: new Date(now - 86_400_000).toISOString() }))
  search.upsertMemory(memory({ id: 'm_t2', content: '时间窗二', sessionId: 's2', eventTime: new Date(now - 2 * 86_400_000).toISOString() }))
  const bySession = await search.list({ current: { workspaceId: '/repo/a', sessionId: 's1' }, sessionFilter: 's1', limit: 10 })
  assert.deepEqual(bySession.map((h) => h.id), ['m_t1'])
  const byTime = await search.list({
    current: { workspaceId: '/repo/a', sessionId: 's1' },
    timeWindow: { from: now - 36 * 3_600_000, to: now }, limit: 10,
  })
  assert.deepEqual(byTime.map((h) => h.id), ['m_t1'])
})

// ── 绝对相关性闸门(§5 v1.9)──────────────────────────────────────────────────
// 三条纪律各一条用例:只卡注入 / 两路都可用才生效 / 分档判据(共识 or 单路强)。

const gateCfg = {
  enabled: true, consensusCos: 0.35, consensusBm25: 2, soloCos: 0.55, soloBm25: 10,
}

/** 可控 embedder:给指定 id 返回指定余弦,便于构造"单路命中"。 */
function vectorEmbedder(cosById) {
  return {
    model: 'test-model',
    available: async () => true,
    embedQuery: async () => [1, 0],
    embedChunks: async () => undefined,
    _cos: cosById,
  }
}

/**
 * 构造"与查询向量夹角恰好为 cos"的记录:查询向量是 [1,0],所以单位向量取 [cos, √(1-cos²)]。
 * 注意别写成 [cos, 0] —— 那样与 [1,0] 的余弦恒为 1,缩放不改变方向(实测踩过)。
 */
function withCos(record, cos) {
  const y = Math.sqrt(Math.max(0, 1 - cos * cos))
  return { ...record, embeddingModel: 'test-model', chunks: [{ text: record.content, embedding: [cos, y] }] }
}

test('闸门:默认关闭时行为不变(注入照旧)', async () => {
  const embedder = vectorEmbedder({})
  const search = createSearch({
    cfg: { ...cfg, relevanceGate: { ...gateCfg, enabled: false } },
    rankCfg, embedder, logger: { info: () => {} },
  })
  search.rebuild([withCos(memory({ id: 'm_weak', content: '红烧肉怎么做才好吃' }), 0.4)], [])
  const hits = await search.search({ query: '红烧肉怎么做才好吃', purpose: 'inject', current: { workspaceId: 'w', sessionId: 's' } })
  assert.equal(hits.length, 1, '闸门关闭 → 弱条目照样注入')
})

test('闸门:开启后"单路信号不够强"的条目被挡(共识与单路线都不满足)', async () => {
  // 向量 cos 0.40(< 单路线 0.55)且 BM25 命中很弱(分数远低于共识线 2)→ 应被挡
  const embedder = vectorEmbedder({})
  const search = createSearch({
    cfg: { ...cfg, relevanceGate: gateCfg }, rankCfg, embedder, logger: { info: () => {} },
  })
  search.rebuild([withCos(memory({ id: 'm_weak', content: '完全不相干的内容' }), 0.40)], [])
  const hits = await search.search({ query: '红烧肉怎么做才好吃', purpose: 'inject', current: { workspaceId: 'w', sessionId: 's' } })
  assert.equal(hits.length, 0, '两路都不过线 → 不注入')
})

test('闸门:单路线可放行(只有向量路命中,但 cos 够高)', async () => {
  const embedder = vectorEmbedder({})
  const search = createSearch({
    cfg: { ...cfg, relevanceGate: gateCfg }, rankCfg, embedder, logger: { info: () => {} },
  })
  search.rebuild([withCos(memory({ id: 'm_solo', content: '完全不相干的内容' }), 0.60)], [])
  const hits = await search.search({ query: '红烧肉怎么做才好吃', purpose: 'inject', current: { workspaceId: 'w', sessionId: 's' } })
  assert.equal(hits.length, 1, '单路 cos≥0.55 → 放行(不做路级交集)')
})

test('闸门:recall 路径不受影响(用户主动问,保持宽松)', async () => {
  const embedder = vectorEmbedder({})
  const search = createSearch({
    cfg: { ...cfg, relevanceGate: gateCfg }, rankCfg, embedder, logger: { info: () => {} },
  })
  search.rebuild([withCos(memory({ id: 'm_weak', content: '完全不相干的内容' }), 0.40)], [])
  const hits = await search.search({ query: '红烧肉怎么做才好吃', purpose: 'recall', current: { workspaceId: 'w', sessionId: 's' } })
  assert.ok(hits.length >= 1, 'recall 不设闸门')
})

test('闸门:纯 BM25 且池子达标时按 bm25OnlyMin 准入(v1.13)', async () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  // 30 条填充共享查询里的高频词(上海/天气):词面命中但 IDF 被压低、绝对分远不到 2 → 不注入
  for (let i = 0; i < 30; i += 1) {
    search.upsertMemory(memory({ id: `m_filler${i}`, content: `上海天气闲聊记录第 ${i} 条` }))
  }
  search.upsertMemory(memory({ id: 'm_target', content: '红烧肉怎么做才好吃' }))
  const current = { workspaceId: '/repo/a', sessionId: 's2' }
  // 弱查询只由填充里高频出现的词组成(IDF 被压低),绝对分远不到 2 → 不注入
  const weak = await search.search({ query: '上海天气闲聊', purpose: 'inject', current })
  assert.deepEqual(weak.map((h) => h.id), [], '弱词面命中被 bm25OnlyMin 挡住')
  const strong = await search.search({ query: '红烧肉怎么做才好吃', purpose: 'inject', current })
  assert.deepEqual(strong.map((h) => h.id), ['m_target'], '强命中照常注入')
})

test('闸门:纯 BM25 的池子小于 bm25OnlyMinPoolSize 时不启用(v1.13)', async () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  search.rebuild([memory({ id: 'm_bm25', content: '红烧肉怎么做才好吃' })], [])
  const hits = await search.search({ query: '红烧肉', purpose: 'inject', current: { workspaceId: '/repo/a', sessionId: 's2' } })
  assert.equal(hits.length, 1, '小池子不启用门槛:绝对分随语料漂移,防误杀(§5.6)')
})

test('向量防呆:库中向量维度与端点不符 → 跳过不混算,并触发一次重嵌入回调', async () => {
  const mismatches = []
  const embedder = {
    model: 'test-model',
    available: async () => true,
    embedQuery: async () => [1, 0, 0],
    embedChunks: async () => undefined,
    dimension: () => 3,
    noteDegraded: () => {},
  }
  const search = createSearch({
    cfg, rankCfg, embedder, logger: { info: () => {} },
    onVectorMismatch: () => mismatches.push(1),
  })
  search.rebuild([{
    ...memory({ id: 'm_old_dim', content: '完全不相干的内容' }),
    embeddingModel: 'test-model',
    chunks: [{ text: '完全不相干的内容', embedding: [1, 0] }],
  }], [])
  const current = { workspaceId: '/repo/a', sessionId: 's2' }
  const hits = await search.search({ query: '红烧肉怎么做才好吃', purpose: 'inject', current })
  assert.deepEqual(hits.map((h) => h.id), [], '维度不符的向量不参与打分(不会被当成命中)')
  assert.equal(mismatches.length, 1, '触发一次重嵌入')
  await search.search({ query: '红烧肉怎么做才好吃', purpose: 'inject', current })
  assert.equal(mismatches.length, 1, '5 分钟内不重复触发(日志/kick 节流)')
})

test('检索失败契约:抛错返回 null(区分"没想起事"与"检索坏了")', async () => {
  const logs = []
  const broken = {
    available: async () => { throw new Error('embedder 炸了') },
    model: '',
    embedQuery: async () => null,
    embedChunks: async () => undefined,
  }
  const search = createSearch({ cfg, rankCfg, embedder: broken, logger: { info: (m) => logs.push(m) } })
  search.rebuild([memory({ id: 'm_1', content: '随便一条' })], [])

  // 回归:旧实现把异常直接抛给调用方,于是 inject/tools 两侧的 `hits === null` 是死代码,
  // §4.2 承诺的"记忆检索暂时不可用"永远说不出口(真实失败被静默吞成"没想起事")。
  const hits = await search.search({ query: '随便', purpose: 'inject', current: { workspaceId: 'w', sessionId: 's' } })
  assert.equal(hits, null, '抛错必须收敛成 null')
  assert.equal(logs.length, 1, '降级要留一行日志')

  // 对照组:"没有命中"仍是空数组,不能被当成故障
  const empty = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  assert.deepEqual(await empty.search({ query: '随便', current: { workspaceId: 'w', sessionId: 's' } }), [])
})

// ── 常驻 lesson 与开场动态选择器(§4.2,V1.1 接线)──────────────────────────────

test('常驻 lesson:本地优先 + entity=user 异地补位;按 证据系数×importance 降序;硬过滤生效', () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  const lesson = (over) => memory({ kind: 'lesson', temporal: 'pattern', ...over })
  search.rebuild([
    lesson({ id: 'l_low', content: '本地低权重约定', importance: 5 }),
    lesson({ id: 'l_high', content: '本地高权重约定', importance: 8 }),
    lesson({ id: 'l_fact', content: '不是 lesson', kind: 'fact', importance: 10 }),
    lesson({ id: 'l_state', content: '不是 pattern', temporal: 'state', importance: 10 }),
    lesson({ id: 'l_user_remote', content: '用户本人的跨项目约定', entity: 'user', workspaceId: '/repo/b', workspaceLabel: 'b', importance: 9 }),
    lesson({ id: 'l_remote', content: '异地非用户约定不补位', workspaceId: '/repo/b', workspaceLabel: 'b', importance: 10 }),
    lesson({ id: 'l_hidden', content: '隐藏的约定', hidden: true, importance: 10 }),
    lesson({ id: 'l_superseded', content: '已被取代的旧约定', importance: 10, supersededBy: 'l_new' }),
  ], [])
  const picked = search.residentLessons({ current: { workspaceId: '/repo/a', sessionId: 's' }, nowMs: NOW, rankCfg, limit: 2 })
  assert.deepEqual(picked.map((r) => r.id), ['l_high', 'l_low'], '本地按权重降序取满,异地不挤占')
  const filled = search.residentLessons({ current: { workspaceId: '/repo/c', sessionId: 's' }, nowMs: NOW, rankCfg, limit: 2 })
  assert.deepEqual(filled.map((r) => r.id), ['l_user_remote'], '无本地时 entity=user 异地补位(非 user 不补)')
  // SOUL 提议(entity='soul' 的 staged lesson)不进常驻:提议的归宿是设置页采纳通道,审阅前不进常驻曝光(§9-17)
  search.upsertMemory(lesson({ id: 'l_soul', content: '我回复倾向于简短,先给结论。', entity: 'soul', importance: 10, status: 'staged', stagedBy: 'model' }))
  const after = search.residentLessons({ current: { workspaceId: '/repo/a', sessionId: 's' }, nowMs: NOW, rankCfg, limit: 2 })
  assert.ok(!after.map((r) => r.id).includes('l_soul'), 'SOUL 提议不进常驻区块(哪怕权重最高)')
  assert.ok(!after.map((r) => r.id).includes('l_superseded'), '已取代的 lesson 不再常驻')
})

test('openingDigest:(unknown) 不作为真实同域,也不跨域注入 sensitive', () => {
  // 本用例锁的是"打开 sensitive 开关时"的跨域拦截(R4 后默认关,机制仍需回归)
  const cfgDigest = testConfig({ sensitiveNoCross: true })
  const search = createSearch({
    cfg: cfgDigest,
    rankCfg: { ...cfgDigest.decay, ...cfgDigest.scoring },
    embedder: noEmbedder,
    logger: { info: () => {} },
  })
  search.rebuild([
    memory({ id: 'u1', workspaceId: '(unknown)', workspaceLabel: '未知', content: '未知位置的动态一', temporal: 'state', eventTime: isoDaysAgo(1) }),
    memory({ id: 'u2', workspaceId: '(unknown)', workspaceLabel: '未知', content: '未知位置的动态二', temporal: 'state', eventTime: isoDaysAgo(1) }),
    memory({ id: 'u3', workspaceId: '(unknown)', workspaceLabel: '未知', content: '未知位置的敏感动态', temporal: 'state', eventTime: isoDaysAgo(1), sensitive: true }),
  ], [])
  const digest = search.openingDigest({
    current: { workspaceId: '(unknown)', sessionId: 's' },
    nowMs: NOW,
    days: 7,
    limit: 3,
  })
  assert.deepEqual(digest, [], '(unknown) 不是可共享的真实域;敏感条目更不能借此跨会话')
})

test('openingDigest:近 N 天本地 state/episode top-N;≥3 条启用;validUntil 过期非 todo 排除', () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  search.rebuild([
    memory({ id: 'd_new', content: '昨天的新进展', temporal: 'state', eventTime: isoDaysAgo(1), importance: 5 }),
    memory({ id: 'd_mid', content: '三天前的进展', temporal: 'episode', eventTime: isoDaysAgo(3), importance: 9 }),
    memory({ id: 'd_old', content: '十天前的旧事不进窗', temporal: 'state', eventTime: isoDaysAgo(10) }),
    memory({ id: 'd_pattern', content: 'pattern 不是动态', temporal: 'pattern', eventTime: isoDaysAgo(1) }),
    memory({ id: 'd_past', content: '已过期的演唱会', temporal: 'state', eventTime: isoDaysAgo(1), validUntil: isoDaysAgo(1).slice(0, 10) }),
    memory({ id: 'd_todo', content: '逾期的报告该提醒', temporal: 'state', eventTime: isoDaysAgo(2), validUntil: isoDaysAgo(1).slice(0, 10), todo: true }),
    memory({ id: 'd_remote', content: '异地动态不选', temporal: 'state', eventTime: isoDaysAgo(1), workspaceId: '/repo/b' }),
    memory({ id: 'd_expired', content: '已过期的状态', temporal: 'state', eventTime: isoDaysAgo(2), expiresAt: isoDaysAgo(1) }),
    memory({ id: 'd_past_episode', content: '五天前的旧 episode', temporal: 'episode', eventTime: isoDaysAgo(5) }),
    memory({ id: 'd_superseded', content: '已被取代的动态', temporal: 'state', eventTime: isoDaysAgo(1), supersededBy: 'd_new' }),
  ], [])
  const digest = search.openingDigest({ current: { workspaceId: '/repo/a', sessionId: 's' }, nowMs: NOW, days: 7, limit: 3 })
  assert.deepEqual(digest.map((r) => r.id), ['d_new', 'd_todo', 'd_mid'], '近者优先(d_todo 逾期 todo 仍入选提醒)')
  // 换一个没有任何本地条目的工作区:不足 3 条不启用
  const none = search.openingDigest({ current: { workspaceId: '/repo/empty', sessionId: 's' }, nowMs: NOW, days: 7, limit: 3 })
  assert.deepEqual(none, [], '本地 <3 条不启用')
})

test('段即片段精修:只有多段长文本的命中段直出;未分段长条目仍裁到 excerptChars(§4.2,V1.1)', () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  const longContent = '很长的分段内容。'.repeat(100) // ≈800 字符 > excerptChars(300)
  const hitChunk = '命中段本体。'.repeat(60) // ≈360 字符,也超 300
  // 真正被滑动窗切成多段:命中段整段直出
  assert.equal(search.excerptFor({
    record: { content: longContent, chunks: [{ text: '第一段' }, { text: hitChunk }] },
    hitChunkText: hitChunk,
  }, ['内容']), hitChunk)
  // 单 chunk 的 hitChunkText 就是全文:必须裁到 excerptChars
  const oneChunk = search.excerptFor({
    record: { content: longContent, chunks: [{ text: longContent }] },
    hitChunkText: longContent,
  }, ['分段'])
  assert.ok(oneChunk.length <= cfg.excerptChars + 30, `单 chunk 应裁到 excerptChars 附近,实际 ${oneChunk.length}`)
  // 未分段长条目:仍按查询词窗口裁剪
  const clipped = search.excerptFor({ record: { content: longContent } }, ['分段'])
  assert.ok(clipped.length <= cfg.excerptChars + 30, `应裁到 excerptChars 附近,实际 ${clipped.length}`)
  assert.ok(clipped.length < longContent.length)
})

test('entity 加权:cwd 子路径重合或近 N 轮提及 → ×entityBoost(§5.4,V1.1)', async () => {
  const turns = { recentTexts: (sessionId) => (sessionId === 's1' ? ['我们在聊 web 包的构建'] : []) }
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} }, turns })
  search.rebuild([
    memory({ id: 'm_entity', content: '构建相关的约定 pnpm', entity: 'web' }),
    memory({ id: 'm_plain', content: '构建相关的约定 pnpm 二号' }),
  ], [])
  const find = (hits, id) => hits.find((h) => h.id === id)
  // 通道 1:cwd 子路径重合(workspaceId 含 'web')
  const hit1 = await search.search({ query: '构建 约定', current: { workspaceId: '/repo/a/packages/web', sessionId: 's9' }, purpose: 'inject', limit: 5 })
  assert.equal(find(hit1, 'm_entity').parts.entity, 1.1, 'cwd 重合 → entityBoost')
  assert.equal(find(hit1, 'm_plain').parts.entity, 1, '无 entity 字段不受影响')
  // 通道 2:近 N 轮提及(s1 近期文本含 'web')
  const hit2 = await search.search({ query: '构建 约定', current: { workspaceId: '/repo/a', sessionId: 's1' }, purpose: 'inject', limit: 5 })
  assert.equal(find(hit2, 'm_entity').parts.entity, 1.1, '近 N 轮提及 → entityBoost')
  // 未命中:无重合无提及
  const hit3 = await search.search({ query: '构建 约定', current: { workspaceId: '/repo/a', sessionId: 's2' }, purpose: 'inject', limit: 5 })
  assert.equal(find(hit3, 'm_entity').parts.entity, 1, '未命中 → ×1')
})

test('冷启动收紧:本地不足 coldStartMinLocal 时,异地及格线 ×2、系数 ×0.625;达标自动恢复(§2/§5.4,V1.1)', async () => {
  // minScore 抬到 0.5,让"过正常线(0.5)但不过收紧线(1.0)"的异地条目可构造(该池实测:弱 0.707 / 强 1.329)
  const cfgTight = testConfig({ bm25: { minScore: 0.5 } })
  const rankTight = { ...cfgTight.decay, ...cfgTight.scoring }
  const search = createSearch({ cfg: cfgTight, rankCfg: rankTight, embedder: noEmbedder, logger: { info: () => {} } })
  const mk = (id, over) => memory({ id, content: '异地的 pnpm 弱相关记录', workspaceId: '/repo/b', ...over })
  search.rebuild([
    memory({ id: 'm_local1', content: '本地记忆一' }),
    memory({ id: 'm_local2', content: '本地记忆二' }),
    mk('m_remote_weak'),
    memory({ id: 'm_remote_strong', content: 'pnpm pnpm pnpm pnpm pnpm pnpm pnpm pnpm 异地的强相关记录', workspaceId: '/repo/b' }),
  ], [])
  const cold = await search.search({ query: 'pnpm', current: { workspaceId: '/repo/a', sessionId: 's' }, purpose: 'inject', limit: 10 })
  const coldIds = cold.map((h) => h.id)
  assert.ok(!coldIds.includes('m_remote_weak'), '收紧期:弱异地(0.707 < 0.5×2)被 ×2 及格线切掉')
  assert.ok(coldIds.includes('m_remote_strong'), '收紧期:强异地(1.329 ≥ 1.0)仍可进')
  assert.equal(cold.find((h) => h.id === 'm_remote_strong').parts.workspace, 0.5, '收紧期异地系数 0.8×0.625=0.5')
  // 本地达标(补足 10 条)→ 收紧解除,弱异地回留、系数回 0.8
  for (let i = 0; i < 9; i++) search.upsertMemory(memory({ id: `m_fill${i}`, content: `本地填充 ${i}` }))
  const warm = await search.search({ query: 'pnpm', current: { workspaceId: '/repo/a', sessionId: 's' }, purpose: 'inject', limit: 10 })
  assert.ok(warm.map((h) => h.id).includes('m_remote_weak'), '本地达标后收紧解除,弱异地回留')
  assert.equal(warm.find((h) => h.id === 'm_remote_strong').parts.workspace, 0.8, '恢复后异地系数回 0.8')
})

test('diagnose:返回最终 hits 与两路候选集(B1 评估仪器)', async () => {
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  search.rebuild([memory({ id: 'm_diag', content: '诊断 pnpm 记忆' })], [])
  const diag = await search.diagnose({ query: 'pnpm', purpose: 'inject', current: { workspaceId: '/repo/a', sessionId: 's' }, limit: 5 })
  assert.ok(diag.hits.some((h) => h.id === 'm_diag'))
  assert.ok(diag.bm25Ids.includes('m_diag'), 'BM25 路候选可见')
  assert.deepEqual(diag.vectorIds, [], '无向量路时向量候选为空')
})
