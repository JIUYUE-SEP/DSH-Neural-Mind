/**
 * 向量路(§5):自建 HTTP 通道的密钥策略与降级账。
 *   - apiKeyOptional:本地无鉴权端点(Ollama/自建 ONNX 服务)不必再编假密钥
 *   - embed-degraded:降级按原因计数落审计(否则"到底有没有走向量路"只能靠服务端日志)
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chunkText, createEmbedder, createReembedder } from '../lib/embed.js'
import { validateChunkConfig } from '../lib/config.js'
import { memoryTable, testConfig } from './helpers.mjs'

const base = testConfig(undefined)
const chunkCfg = base

function makeAudit() {
  const rows = []
  return {
    rows,
    write: async (kind, detail, sessionId) => { rows.push({ kind, detail, sessionId }) },
    prune: async () => {},
    list: () => rows,
  }
}

const ctx = { get: () => undefined }
const logger = { info: () => {} }

function cfgWith(over) {
  return { ...base.semanticSearch, enabled: true, baseUrl: 'http://127.0.0.1:11434/v1', modelId: 'bge-m3', ...over }
}

/** 假端点:记录请求头,按脚本返回 */
function fakeEndpoint(handler) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    return handler(calls.length, init)
  }
  return calls
}

const okBody = (n) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: Array.from({ length: n }, (_, i) => ({ embedding: [i + 1, 0.5] })) }),
})

test('A4:分块配置交叉约束与运行时正 stride 防线', () => {
  assert.throws(() => chunkText('x'.repeat(2000), { chunkPlainMaxChars: 1, chunkSize: 0, chunkOverlap: 0 }), /chunkSize/)
  assert.throws(() => chunkText('x'.repeat(2000), { chunkPlainMaxChars: 1, chunkSize: 10, chunkOverlap: 10 }), /chunkOverlap/)
  const bad = {
    ...base,
    chunkSize: 10,
    chunkOverlap: 10,
    semanticSearch: { ...base.semanticSearch, reembedBatchSize: 0 },
  }
  assert.throws(() => validateChunkConfig(bad), /chunkOverlap/)
  assert.throws(() => validateChunkConfig({ ...bad, chunkOverlap: 1 }), /reembedBatchSize/)
  assert.doesNotThrow(() => validateChunkConfig(base))
})

test('密钥策略:默认必须有密钥(缺失即向量路关闭并记 no-key)', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({ cfg: cfgWith({ apiKeyEnv: 'MEMORY_TEST_MISSING_KEY' }), chunkCfg, ctx, logger, audit })

  assert.equal(await embedder.available(), false, '缺密钥 → 不可用')
  assert.equal(await embedder.embedQuery('测试'), null)
  assert.equal(calls.length, 0, '不可用时一次请求都不发')
  assert.equal(audit.rows.length, 1, '首次降级立即落账')
  assert.equal(audit.rows[0].kind, 'embed-degraded')
  assert.match(audit.rows[0].detail, /no-key=1/)
  assert.match(audit.rows[0].detail, /model=bge-m3/)
})

test('密钥策略:apiKeyOptional 开启 → 无密钥照常请求,且不发 Authorization 头', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyEnv: '', apiKeyOptional: true }), chunkCfg, ctx, logger, audit,
  })

  assert.equal(await embedder.available(), true, '无鉴权端点可用')
  assert.deepEqual(await embedder.embedQuery('测试'), [1, 0.5])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].headers.authorization, undefined, '本地端点不带凭据')
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/v1/embeddings')
  assert.deepEqual(audit.rows, [], '正常路径不记降级')
})

test('密钥策略:配了密钥仍照发 Authorization(不改既有行为)', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyEnv: 'MEMORY_TEST_KEY', apiKeyOptional: true }), chunkCfg, ctx, logger, audit,
  })
  process.env.MEMORY_TEST_KEY = 'sk-local-test'
  try {
    assert.equal(await embedder.available(), true)
    await embedder.embedQuery('测试')
    assert.equal(calls[0].headers.authorization, 'Bearer sk-local-test')
  } finally {
    delete process.env.MEMORY_TEST_KEY
  }
})

test('密钥策略:启动后再补凭据无需重建 embedder(设置页先测后填 key 的场景)', async () => {
  const audit = makeAudit()
  fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyEnv: 'MEMORY_TEST_LATE_KEY', apiKeyOptional: false }), chunkCfg, ctx, logger, audit,
  })
  delete process.env.MEMORY_TEST_LATE_KEY
  try {
    assert.equal(await embedder.available(), false, '先没有 key')
    process.env.MEMORY_TEST_LATE_KEY = 'sk-late'
    assert.equal(await embedder.available(), true, '补上 key 后立即可用,不缓存 undefined')
    assert.deepEqual(await embedder.embedQuery('测试'), [1, 0.5])
  } finally {
    delete process.env.MEMORY_TEST_LATE_KEY
  }
})

test('设置页探针:成功返回 model/dimensions/latency,且只发一条固定短文本', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyOptional: true }), chunkCfg, ctx, logger, audit,
  })
  const result = await embedder.probe()
  assert.equal(result.ok, true)
  assert.equal(result.model, 'bge-m3')
  assert.equal(result.dimensions, 2)
  assert.equal(typeof result.latencyMs, 'number')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].body.input, ['memory embedding connectivity test'])
  assert.deepEqual(audit.rows, [], '探针成功不记降级')
})

test('设置页探针:缺凭据时明确报错,不打端点', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyEnv: 'MEMORY_TEST_MISSING_KEY', apiKeyOptional: false }), chunkCfg, ctx, logger, audit,
  })
  const result = await embedder.probe()
  assert.equal(result.ok, false)
  assert.match(result.error, /凭据/)
  assert.equal(calls.length, 0)
})

test('设置页探针:HTTP 失败返回可读错误', async () => {
  const audit = makeAudit()
  fakeEndpoint(() => ({ ok: false, status: 401, json: async () => ({}) }))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyOptional: true }), chunkCfg, ctx, logger, audit,
  })
  const result = await embedder.probe()
  assert.equal(result.ok, false)
  assert.match(result.error, /HTTP 401/)
  assert.equal(typeof result.latencyMs, 'number')
})

test('降级账:按原因分类(http 状态/超时/网络/形状),阈值内只落一条', async () => {
  const audit = makeAudit()
  fakeEndpoint(() => ({ ok: false, status: 401, json: async () => ({}) }))
  const embedder = createEmbedder({
    cfg: cfgWith({ apiKeyEnv: '', apiKeyOptional: true }), chunkCfg, ctx, logger, audit,
  })

  await embedder.embedQuery('一')
  assert.equal(audit.rows.length, 1)
  assert.match(audit.rows[0].detail, /http-401=1/)

  await embedder.embedQuery('二')
  assert.equal(audit.rows.length, 1, '同一窗口内不重复刷屏')

  fakeEndpoint(() => { const e = new Error('boom'); e.name = 'TimeoutError'; throw e })
  for (let i = 0; i < 9; i++) await embedder.embedQuery('三')
  assert.equal(audit.rows.length, 2, '累计到阈值再落一条')
  assert.match(audit.rows[1].detail, /timeout=9/)

  fakeEndpoint(() => okBody(2)) // 请求多条只回两条 → 形状不符
  const long = '超长内容'.repeat(7000)
  for (let i = 0; i < 10; i++) {
    assert.equal(await embedder.embedChunks(long), undefined, '形状不符 → 写入路放弃')
  }
  assert.equal(audit.rows.length, 3)
  assert.match(audit.rows[2].detail, /shape=10/)
})

test('维度防呆:端点维度变化 → 本次降级并记 dim-mismatch,绝不混用两种维度', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint((n) => ({
    ok: true,
    status: 200,
    json: async () => ({ data: [{ embedding: n === 2 ? [1, 0.5] : [1, 0.5, 0.25] }] }),
  }))
  const embedder = createEmbedder({ cfg: cfgWith({ apiKeyOptional: true }), chunkCfg, ctx, logger, audit })
  assert.deepEqual(await embedder.embedQuery('一'), [1, 0.5, 0.25], '首次成功响应确定维度 3')
  assert.equal(embedder.dimension(), 3)
  assert.equal(await embedder.embedQuery('二'), null, '维度 3→2:本次降级,不返回错维向量')
  assert.match(audit.rows.at(-1).detail, /dim-mismatch=1/)
  assert.equal(calls.length, 2)
  // 维度恢复一致后照常工作:是不是"真换了模型"由用户判断,不永久关闭向量路
  assert.deepEqual(await embedder.embedQuery('三'), [1, 0.5, 0.25])
})

test('重嵌入:hidden/archived/private 不出站,公开记录同步 corpus', async () => {
  const now = new Date().toISOString()
  const baseRecord = { kind: 'fact', source: 'user', importance: 5, confidence: 0.9, temporal: 'pattern', eventTime: now, sessionId: 's', evidence: [], status: 'active', createdAt: now, embeddingModel: 'old' }
  const store = { memories: memoryTable(), hotbuffer: memoryTable() }
  await store.memories.put('m_public', { ...baseRecord, id: 'm_public', content: 'PUBLIC-EMBED', workspaceId: '/pub' })
  await store.memories.put('m_hidden', { ...baseRecord, id: 'm_hidden', content: 'HIDDEN-EMBED', workspaceId: '/pub', hidden: true })
  await store.memories.put('m_archived', { ...baseRecord, id: 'm_archived', content: 'ARCHIVED-EMBED', workspaceId: '/pub', status: 'archived' })
  await store.memories.put('m_private', { ...baseRecord, id: 'm_private', content: 'PRIVATE-EMBED', workspaceId: '/priv' })
  await store.hotbuffer.put('hb_public', { id: 'hb_public', content: 'HOT-PUBLIC', sessionId: 's', workspaceId: '/pub', turn: 1, startSeq: 1, endSeq: 2, digested: false, createdAt: now, embeddingModel: 'old' })
  await store.hotbuffer.put('hb_hidden', { id: 'hb_hidden', content: 'HOT-HIDDEN', sessionId: 's', workspaceId: '/pub', turn: 2, startSeq: 3, endSeq: 4, digested: false, hidden: true, createdAt: now, embeddingModel: 'old' })
  const embedded = []
  const synced = []
  const embedder = {
    model: 'new', available: async () => true,
    embedChunks: async (text) => { embedded.push(text); return [{ text, embedding: [1, 2] }] },
  }
  const search = {
    upsertMemory: (r) => synced.push(`mem:${r.id}`),
    upsertHot: (r) => synced.push(`hot:${r.id}`),
  }
  const reembedder = createReembedder({
    store, embedder, cfg: { ...base.semanticSearch, reembedBatchSize: 10 }, logger, search,
    isPrivate: (workspaceId) => workspaceId === '/priv',
    schedule: (cb) => setTimeout(cb, 0),
  })
  reembedder.kick()
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(embedded.sort(), ['HOT-PUBLIC', 'PUBLIC-EMBED'], '只发送公开且未归档/隐藏的记录')
  assert.deepEqual(synced.sort(), ['hot:hb_public', 'mem:m_public'], 'store 更新后才同步 corpus')
})

test('重嵌入:快照后变 hidden 的记录不再出站(TOCTOU)', async () => {
  const now = new Date().toISOString()
  const baseRecord = { kind: 'fact', source: 'user', importance: 5, confidence: 0.9, temporal: 'pattern', eventTime: now, sessionId: 's', evidence: [], status: 'active', createdAt: now, embeddingModel: 'old' }
  const store = { memories: memoryTable(), hotbuffer: memoryTable() }
  await store.memories.put('m_first', { ...baseRecord, id: 'm_first', content: 'FIRST-EMBED', workspaceId: '/pub' })
  await store.memories.put('m_second', { ...baseRecord, id: 'm_second', content: 'SECOND-EMBED', workspaceId: '/pub' })
  const embedded = []
  const synced = []
  const audit = makeAudit()
  const embedder = {
    model: 'new', available: async () => true,
    embedChunks: async (text) => {
      embedded.push(text)
      if (text === 'FIRST-EMBED') {
        await store.memories.update('m_second', (cur) => ({ ...cur, hidden: true }))
      }
      return [{ text, embedding: [1, 2] }]
    },
  }
  const search = {
    upsertMemory: (r) => synced.push(`mem:${r.id}`),
    upsertHot: (r) => synced.push(`hot:${r.id}`),
  }
  const reembedder = createReembedder({
    store, embedder, cfg: { ...base.semanticSearch, reembedBatchSize: 1 }, logger, search, audit,
    isPrivate: () => false,
    schedule: (cb) => setTimeout(cb, 0),
  })
  reembedder.kick()
  await new Promise((r) => setTimeout(r, 80))
  assert.deepEqual(embedded, ['FIRST-EMBED'], '第二条在快照后被 hidden,不得发送')
  assert.deepEqual(synced, ['mem:m_first'], '只同步真正重嵌入成功的记录')
  assert.ok(audit.rows.some((row) => row.kind === 'reembed-skipped'), '跳过要留审计')
})

test('重嵌入:modelId 未变但库里向量维度不符时自愈(维度防呆)', async () => {
  const now = new Date().toISOString()
  const store = { memories: memoryTable(), hotbuffer: memoryTable() }
  await store.memories.put('m_old_dim', {
    id: 'm_old_dim', content: 'DIM-EMBED', kind: 'fact', source: 'user', importance: 5, confidence: 0.9,
    temporal: 'pattern', eventTime: now, workspaceId: '/pub', sessionId: 's', evidence: [], status: 'active',
    createdAt: now, embeddingModel: 'new', chunks: [{ text: 'DIM-EMBED', embedding: [1, 2] }],
  })
  const embedded = []
  const synced = []
  const embedder = {
    model: 'new',
    available: async () => true,
    dimension: () => 3,
    embedChunks: async (text) => { embedded.push(text); return [{ text, embedding: [1, 2, 3] }] },
  }
  const search = { upsertMemory: (r) => synced.push(r.id), upsertHot: () => {} }
  const reembedder = createReembedder({
    store, embedder, cfg: { ...base.semanticSearch, reembedBatchSize: 10 }, logger, search,
    isPrivate: () => false, schedule: (cb) => setTimeout(cb, 0),
  })
  reembedder.kick()
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(embedded, ['DIM-EMBED'], '维度不符的旧向量会被重新嵌入')
  assert.deepEqual(synced, ['m_old_dim'])
  assert.deepEqual((await store.memories.get('m_old_dim')).chunks[0].embedding, [1, 2, 3])
})

test('降级账:未配置端点不算降级(不刷无意义的审计)', async () => {
  const audit = makeAudit()
  const calls = fakeEndpoint(() => okBody(1))
  const embedder = createEmbedder({
    cfg: cfgWith({ enabled: false }), chunkCfg, ctx, logger, audit,
  })
  assert.equal(await embedder.available(), false)
  assert.equal(calls.length, 0)
  assert.deepEqual(audit.rows, [])
})
