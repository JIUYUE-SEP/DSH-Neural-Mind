#!/usr/bin/env node
/**
 * B1 冻结评估集:B1 冻结评估集(frozen-v1 15 条 / frozen-v2 215 条),合成数据 + 确定性向量,
 * 不读 live pool、不发网络请求。
 * 口径:purpose=inject 的候选结果;最终渲染注入(预算/核验)由后续 D3 再加一层。
 *
 * 用法:
 *   node tools/eval-frozen.mjs                       # frozen-v2 双路径摘要(hybrid + bm25)
 *   node tools/eval-frozen.mjs --lane hybrid         # 只跑混合路(向量 + BM25)
 *   node tools/eval-frozen.mjs --lane bm25           # 只跑纯关键词路径(未配 embedding 的默认档)
 *   node tools/eval-frozen.mjs --dataset frozen-v1   # 历史基线(v1 保留作对照,冻结不改)
 *   node tools/eval-frozen.mjs --json                # 机器可读
 *
 * 为什么分两条路径(R18,2026-11-09):绝大多数用户不配 embedding,实际走纯 BM25;
 * `bm25OnlyMin` 门槛只在这条路径生效,而旧默认值 2 时两条路径的负例注入率差 3 倍
 * (纯 BM25 6/13 vs 混合路 2/13)。混在一起报"总体数字"会把混合路的成绩当成默认体验。
 *
 * 数据集差异(为什么 v2 用 512 维):
 *   - v1 是 15 条小池,64 维词袋哈希碰撞会制造大量假"语义命中"(负例 5/5 里 4 条纯 BM25 零命中);
 *   - v2 扩到 215 条 + 20 条 L0,维度提到 512,碰撞率显著下降,负例/正例的向量路更有区分度。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Config } from '../lib/config.js'
import { resolveConfig } from '../lib/compat.js'
import { createSearch } from '../lib/search.js'
import { tokenize } from '../lib/text.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = join(HERE, '..', 'test', 'fixtures', 'eval')

/**
 * 每个冻结集钉死自己的向量几何与评估基准时间,改任何一边都算新建数据集(不原地改历史基线)。
 * 维度说明:这是**离线确定性假向量的哈希桶数**(不是插件限制)。插件本身不限定维度,
 * 真实端点返回多少维就存多少(bge-m3 / qwen3-embedding = 1024,text-embedding-3-large = 3072);
 * 这里对齐现实维度只是为了"评估口径不落后于真实模型",v1 保留 64 维以维持历史基线可比。
 */
const DATASETS = {
  'frozen-v1': { dim: 64, model: 'frozen-v1', nowMs: Date.parse('2026-10-26T19:18:15.446Z') },
  'frozen-v2': { dim: 1024, model: 'frozen-v2', nowMs: Date.parse('2026-11-07T00:00:00.000Z') },
}
const DEFAULT_DATASET = 'frozen-v2'

function readJson(dataset, name) {
  return JSON.parse(readFileSync(join(FIXTURE_ROOT, dataset, name), 'utf8'))
}

/** 确定性 bag-of-words 向量:同一文本/同一维度永远同一向量,不依赖模型/网络。 */
function vectorOf(text, dim = 64) {
  const v = new Array(dim).fill(0)
  for (const token of tokenize(String(text))) {
    let h = 2166136261
    for (let i = 0; i < token.length; i += 1) {
      h ^= token.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    v[Math.abs(h) % dim] += 1
  }
  return v
}

export function loadFrozen(dataset = DEFAULT_DATASET) {
  const meta = DATASETS[dataset]
  if (meta === undefined) throw new Error(`未知冻结集: ${dataset}(可选 ${Object.keys(DATASETS).join(' / ')})`)
  const pool = readJson(dataset, 'pool.json')
  const queries = readJson(dataset, 'queries.json')
  const relations = readJson(dataset, 'relations.json')
  const withEmbedding = (record) => ({
    ...record,
    chunks: [{ text: record.content, embedding: vectorOf(record.content, dim) }],
    embeddingModel: meta.model,
  })
  // 数据集可在 pool.json 里自带维度(自描述);缺省用 DATASETS 的钉死值。
  const dim = Number.isInteger(pool.dim) && pool.dim > 0 ? pool.dim : meta.dim
  return {
    dataset,
    dim,
    model: meta.model,
    // 冻结集自带评估基准时间时以它为准:时间衰减必须可复现,不能随"今天跑的日期"漂移。
    nowMs: typeof pool.now === 'string' ? Date.parse(pool.now) : meta.nowMs,
    memories: (pool.memories ?? []).map(withEmbedding),
    hot: (pool.hot ?? []).map(withEmbedding),
    queries: queries.queries ?? [],
    current: queries.current ?? { workspaceId: '/frozen/ws-a', sessionId: 's-eval-query' },
    relations: relations.relations ?? [],
  }
}

export function createFrozenSearch(frozen = loadFrozen(), { lane = 'hybrid' } = {}) {
  const cfg = resolveConfig(Config['~standard'].validate({
    privateWorkspaces: ['/frozen/ws-private'],
    sensitiveNoCross: true,
    coldStartMinLocal: 0,
    injectMaxItems: 5,
    openingDigest: false,
    lessonResidentItems: 0,
  }).value)
  // bm25 路径 = 未配 embedding / 向量路降级时的真实形态:available() 返回 false,
  // 插件走纯 BM25 准入(relevanceGate.bm25OnlyMin)。hybrid 路径保持向量路可用。
  const embedder = {
    model: frozen.model,
    available: async () => lane !== 'bm25',
    embedQuery: async (text) => vectorOf(text, frozen.dim),
    embedChunks: async (text) => [{ text, embedding: vectorOf(text, frozen.dim) }],
  }
  const rankCfg = { ...cfg.decay, ...cfg.scoring }
  return { cfg, rankCfg, search: createSearch({ cfg, rankCfg, embedder, logger: { info: () => {} } }) }
}

function firstHit(ids, targets) {
  return ids.findIndex((id) => targets.includes(id))
}

async function runFrozenLane(frozen, lane) {
  const { cfg, rankCfg, search } = createFrozenSearch(frozen, { lane })
  search.rebuild(frozen.memories, frozen.hot)

  const rows = []
  let r1 = 0
  let r5 = 0
  let mrr = 0
  let positive = 0
  let negativeQueries = 0
  let negativeInjected = 0
  let negativeItems = 0
  let positiveItems = 0
  for (const q of frozen.queries) {
    const hits = await search.search({
      query: q.query,
      nowMs: frozen.nowMs,
      // 查询可自带"当前工作区"(真实场景是"在项目 X 里问 X");缺省用数据集默认工作区。
      // 不带上它时,同主题的其它项目记忆会因 ×0.8 异地系数压过目标——这不是检索缺陷,是 §5.4 设计。
      current: q.current ?? frozen.current,
      purpose: 'inject',
      limit: cfg.injectMaxItems,
    })
    const ids = (hits ?? []).map((h) => h.id)
    const idx = firstHit(ids, q.targets ?? [])
    const isNegative = (q.targets ?? []).length === 0
    if (isNegative) {
      negativeQueries += 1
      negativeItems += ids.length
      if (ids.length > 0) negativeInjected += 1
    } else {
      positive += 1
      positiveItems += ids.length
      if (idx === 0) r1 += 1
      if (idx >= 0 && idx < 5) r5 += 1
      if (idx >= 0) mrr += 1 / (idx + 1)
    }
    rows.push({ id: q.id, query: q.query, ids, targetIndex: idx, negative: isNegative, ...(q.hard === true ? { hard: true } : {}) })
  }

  const relationRows = []
  for (const rel of frozen.relations) {
    const fact = frozen.memories.find((m) => m.id === rel.factId)
    if (fact === undefined) continue
    const hits = await search.search({
      query: fact.content,
      nowMs: frozen.nowMs,
      // 关系判断发生在提炼时,那时的工作区就是该记忆的籍贯;用它当 current 才有意义。
      current: { workspaceId: fact.workspaceId, sessionId: 's-eval-relation' },
      purpose: 'relation',
      limit: Math.max(8, cfg.relationCandidateTopK),
    })
    const ids = (hits ?? []).map((h) => h.id)
    relationRows.push({ ...rel, candidateIds: ids, targetInCandidates: ids.includes(rel.targetId) })
  }

  return {
    lane,
    metrics: {
      positiveQueries: positive,
      recallAt1: positive === 0 ? 0 : Number((r1 / positive).toFixed(3)),
      recallAt5: positive === 0 ? 0 : Number((r5 / positive).toFixed(3)),
      mrr: positive === 0 ? 0 : Number((mrr / positive).toFixed(3)),
      negativeQueries,
      negativeInjected,
      negativeItems,
      hardNegativeQueries: rows.filter((r) => r.negative && r.hard === true).length,
      hardNegativeInjected: rows.filter((r) => r.negative && r.hard === true && r.ids.length > 0).length,
      chitChatNegativeInjected: rows.filter((r) => r.negative && r.hard !== true && r.ids.length > 0).length,
      positiveItems,
      avgItemsPositive: positive === 0 ? 0 : Number((positiveItems / positive).toFixed(2)),
      avgItemsNegative: negativeQueries === 0 ? 0 : Number((negativeItems / negativeQueries).toFixed(2)),
      relationCandidateRecall: relationRows.length === 0
        ? 0
        : Number((relationRows.filter((r) => r.targetInCandidates).length / relationRows.length).toFixed(3)),
    },
    queries: rows,
    relations: relationRows,
  }
}

/**
 * 跑冻结集评估。R18 起支持两条路径:
 *   - `hybrid`(默认时代：配了 embedding):向量 + BM25 两路;
 *   - `bm25`  :纯关键词路径,等价于"没配语义检索的绝大多数用户"。
 * `lane:'both'`(默认)两条都跑,顶层 `metrics` 取 hybrid 保持旧读者兼容,
 * 完整结果在 `lanes` 里。`--lane` 见文件头用法。
 */
export async function runFrozenEval({ dataset = DEFAULT_DATASET, lane = 'both' } = {}) {
  if (lane !== 'bm25' && lane !== 'hybrid' && lane !== 'both') {
    throw new Error(`未知评估路径: ${lane}(可选 bm25 / hybrid / both)`)
  }
  const frozen = loadFrozen(dataset)
  const wanted = lane === 'both' ? ['hybrid', 'bm25'] : [lane]
  const lanes = {}
  for (const one of wanted) lanes[one] = await runFrozenLane(frozen, one)
  const primary = lanes[wanted[0]]
  return {
    dataset,
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    vector: { model: frozen.model, dim: frozen.dim },
    pool: { memories: frozen.memories.length, hot: frozen.hot.length },
    lane,
    metrics: primary.metrics,
    queries: primary.queries,
    relations: primary.relations,
    lanes,
  }
}

function argValue(name) {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : undefined
}

async function main() {
  const dataset = argValue('--dataset') ?? DEFAULT_DATASET
  const lane = argValue('--lane') ?? 'both'
  const report = await runFrozenEval({ dataset, lane })
  const outDir = join(HERE, '..', 'bench-results')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `${dataset}.json`)
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`${dataset}: ${report.pool.memories} 记忆 + ${report.pool.hot} L0(lane=${report.lane})`)
    for (const [name, result] of Object.entries(report.lanes)) {
      const m = result.metrics
      console.log(`[${name}] R@1 ${m.recallAt1} · R@5 ${m.recallAt5} · MRR ${m.mrr} | 正例均注入 ${m.avgItemsPositive} 条 · 负例注入 ${m.negativeInjected}/${m.negativeQueries}(均 ${m.avgItemsNegative} 条) · 关系候选召回 ${m.relationCandidateRecall}`)
    }
    console.log(`报告:${outFile}`)
  }
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
