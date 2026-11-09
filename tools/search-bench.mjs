#!/usr/bin/env node
/**
 * B2 确定性基准(不读真实记忆池、不发网络请求、不依赖 LLM):
 *  - search:  BM25-only / hybrid 的 p50/p95
 *  - inject:  search + excerptFor(候选渲染预算)的 p50/p95
 *  - write:   corpus 索引写入成本(upsertMemory)
 *  - digest:  openingDigest 的同步全表扫描成本
 *  - 资源:    CPU / RSS
 *
 * 单次 wall-clock 不作为 CI 硬门禁;报告落 bench-results/,C 的启动门槛以多轮数据为准。
 *
 * 用法:
 *   node tools/search-bench.mjs [--sizes 1000,5000,20000] [--queries 20] [--rounds 3] [--out path]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import os from 'node:os'
import { Config } from '../lib/config.js'
import { resolveConfig } from '../lib/compat.js'
import { createSearch } from '../lib/search.js'
import { tokenize } from '../lib/text.js'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback
}
const sizes = String(flag('--sizes', '1000,5000,20000')).split(',').map(Number).filter((n) => n > 0)
const queryCount = Math.max(1, Number(flag('--queries', '20')) || 20)
const rounds = Math.max(1, Number(flag('--rounds', '3')) || 3)
const outFile = flag('--out', join(fileURLToPath(new URL('..', import.meta.url)), 'bench-results', 'search-bench.json'))
const now = new Date().toISOString()

const cfg = resolveConfig(Config['~standard'].validate({ inlineBudgetMs: 300 }).value)
const rankCfg = { ...cfg.decay, ...cfg.scoring }
const base = {
  kind: 'fact', source: 'user', importance: 6, confidence: 0.9, temporal: 'pattern',
  eventTime: now, workspaceId: '/bench/a', sessionId: 's-bench', evidence: [], status: 'active', createdAt: now,
}
const terms = ['pnpm', '记忆', '缓存', '部署', 'typescript', 'sqlite', '向量', '检索', '会议', '图像', '工作流', '配置']
const queries = Array.from({ length: queryCount }, (_, i) => `${terms[i % terms.length]} ${terms[(i * 3 + 2) % terms.length]}`)

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x1_0000_0000
  }
}

function vectorOf(seed, dim = 64) {
  const r = rng(seed)
  return Array.from({ length: dim }, () => Number((r() * 2 - 1).toFixed(6)))
}

function corpusOf(size) {
  const r = rng(42)
  return Array.from({ length: size }, (_, i) => {
    const t1 = terms[Math.floor(r() * terms.length)]
    const t2 = terms[Math.floor(r() * terms.length)]
    return {
      ...base,
      id: `m_${String(i).padStart(8, '0')}`,
      content: `${t1} ${t2} 这是第 ${i} 条合成记忆,用于固定语料的检索基准。`,
      workspaceId: i % 5 === 0 ? '/bench/b' : '/bench/a',
      chunks: [{ text: `${t1} ${t2} chunk ${i}`, embedding: vectorOf(i + 1) }],
      embeddingModel: 'bench-model',
    }
  })
}

function digestCorpusOf(size) {
  return Array.from({ length: size }, (_, i) => ({
    ...base,
    id: `d_${String(i).padStart(8, '0')}`,
    content: `第 ${i} 条近期动态`,
    temporal: 'state',
    eventTime: now,
    expiresAt: '2030-01-01T00:00:00.000Z',
    importance: 5 + (i % 5),
  }))
}

const noEmbedder = { model: 'none', available: async () => false, embedQuery: async () => null, embedChunks: async () => undefined }
const benchEmbedder = {
  model: 'bench-model',
  available: async () => true,
  embedQuery: async (q) => vectorOf(q.length + 7),
  embedChunks: async () => undefined,
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]
}

function stats(ms) {
  const sorted = [...ms].sort((a, b) => a - b)
  return {
    p50: Number(percentile(sorted, 50).toFixed(3)),
    p95: Number(percentile(sorted, 95).toFixed(3)),
    max: Number(sorted[sorted.length - 1].toFixed(3)),
    n: sorted.length,
  }
}

async function measureSearch(search, extract = false) {
  for (const q of queries.slice(0, Math.min(3, queries.length))) {
    await search.search({ query: q, purpose: 'inject', current: { workspaceId: '/bench/a', sessionId: 's-bench' }, limit: cfg.injectMaxItems })
  }
  const times = []
  for (let r = 0; r < rounds; r += 1) {
    for (const q of queries) {
      const t0 = performance.now()
      const hits = await search.search({ query: q, purpose: 'inject', current: { workspaceId: '/bench/a', sessionId: 's-bench' }, limit: cfg.injectMaxItems })
      if (extract) {
        for (const hit of hits ?? []) search.excerptFor(hit, tokenize(q))
      }
      times.push(performance.now() - t0)
    }
  }
  return stats(times)
}

function measureWrite(size) {
  const records = corpusOf(size)
  const times = []
  for (let r = 0; r < rounds; r += 1) {
    const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
    const t0 = performance.now()
    for (const record of records) search.upsertMemory(record)
    times.push(performance.now() - t0)
  }
  const s = stats(times)
  return { ...s, msPerRecord: Number((s.p50 / size).toFixed(4)) }
}

function measureDigest(size) {
  const records = digestCorpusOf(size)
  const search = createSearch({ cfg, rankCfg, embedder: noEmbedder, logger: { info: () => {} } })
  search.rebuild(records, [])
  const times = []
  for (let r = 0; r < rounds; r += 1) {
    const t0 = performance.now()
    search.openingDigest({ current: { workspaceId: '/bench/a', sessionId: 's-bench' }, nowMs: Date.now(), days: 7, limit: 3 })
    times.push(performance.now() - t0)
  }
  return stats(times)
}

const cpu0 = process.cpuUsage()
const results = []
for (const size of sizes) {
  const records = corpusOf(size)
  for (const [lane, embedder] of [['bm25', noEmbedder], ['hybrid', benchEmbedder]]) {
    const search = createSearch({ cfg, rankCfg, embedder, logger: { info: () => {} } })
    search.rebuild(records, [])
    results.push({ size, metric: 'search', lane, ...(await measureSearch(search)) })
    results.push({ size, metric: 'inject', lane, ...(await measureSearch(search, true)) })
  }
  results.push({ size, metric: 'write', lane: 'corpus', ...measureWrite(size) })
  results.push({ size, metric: 'openingDigest', lane: 'sync', ...measureDigest(size) })
}
const cpu = process.cpuUsage(cpu0)
const report = {
  generatedAt: now,
  node: process.version,
  platform: process.platform,
  cpus: os.cpus().length,
  rounds,
  queries: queryCount,
  sizes,
  inlineBudgetMs: cfg.inlineBudgetMs,
  results,
  resource: {
    cpuMs: Number(((cpu.user + cpu.system) / 1000).toFixed(1)),
    rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
  },
}
mkdirSync(join(outFile, '..'), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`# search-bench ${now}`)
console.log(`node=${report.node} platform=${report.platform} cpus=${report.cpus} queries=${queryCount} rounds=${rounds}`)
console.log('size\tmetric\tlane\tp50ms\tp95ms\tmaxms')
for (const row of results) {
  console.log(`${row.size}\t${row.metric}\t${row.lane}\t${row.p50}\t${row.p95}\t${row.max}`)
}
console.log(`resource: cpu=${report.resource.cpuMs}ms rss=${report.resource.rssMb}MB`)
console.log(`报告:${outFile}`)
