#!/usr/bin/env node
/**
 * **绝对相关性闸门**扫描(§5 融合议题 · 第三层)。
 *
 * 背景:注入路径评估发现 RRF 是名次制——噪声查询的 rank-1 与真实相关的 rank-1 同样得 1/61,
 * 于是"相关度"对排序几乎无信息,负例照样注入 3~5 条。方向是给注入加一道**绝对信号闸门**:
 * 保留每路自己的**原始分**(BM25 原始分 / 向量 cos),过线才允许进注入集(宁缺勿滥)。
 *
 * 与既有旋钮的区别:
 *   - 单路及格线(已有)= 进**候选**的门槛,作用在每一路内部;
 *   - 全局 minScore(设计否决过)= 给 RRF 分数设线,而 RRF 分是名次函数,设线≈取前 N;
 *   - 本闸门 = 用**绝对分**判断"这次查询对这条记忆,到底有没有一个说得过去的匹配信号"。
 *
 * 复刻范围:两路 → 闸门 → rrfFuse → computeFinalScore(直接用 lib 的导出)→ 取 top-K。
 * 基线(gateFloor 全 0)应与 inject-eval 的基线一致,这是本工具的**自校验**。
 *
 * 用法:node tools/gate-sweep.mjs
 */
import { Bm25Index } from '../lib/bm25.js'
import { tokenize } from '../lib/text.js'
import { cosine, createEmbedder } from '../lib/embed.js'
import { rrfFuse, computeFinalScore } from '../lib/rank.js'
import { loadPool, currentWorkspaceOf, POS, CROSS, NEG, firstHit, evalConfig, assertVectorLane, loadLiveConfig } from './eval-fixtures.mjs'

const base = loadLiveConfig()
const logger = { info: () => {} }
const { memories, hot } = loadPool()
const currentWorkspace = currentWorkspaceOf(memories)
const K = base.injectMaxItems
const LANE_LIMIT = Math.max(1, Math.floor(base.candidateMultiplier * K))

const corpus = new Map([...memories, ...hot].map((r) => [r.id, r]))
const bm25 = new Bm25Index({ k1: base.bm25.k1, b: base.bm25.b })
for (const r of memories) bm25.add(r.id, tokenize(r.content ?? ''))
for (const r of hot) bm25.add(r.id, tokenize(r.content ?? ''))

const embedder = createEmbedder({ cfg: evalConfig(base).semanticSearch, chunkCfg: base, ctx: { get: () => undefined }, logger })
await assertVectorLane(embedder)

/** 每条查询预计算一次:BM25 原始分全量 + 向量 cos 全量。 */
async function precompute(query) {
  const bAll = bm25.search(tokenize(query), corpus.size).map((h) => ({ id: h.id, raw: h.score }))
  const qv = await embedder.embedQuery(query)
  const vAll = []
  for (const [id, record] of corpus) {
    if (record.embeddingModel !== embedder.model || !Array.isArray(record.chunks)) continue
    let best = 0
    for (const chunk of record.chunks) { const s = cosine(qv, chunk.embedding); if (s > best) best = s }
    vAll.push({ id, raw: best })
  }
  vAll.sort((a, b) => b.raw - a.raw)
  return { bAll, vAll }
}

/**
 * 跑一次"注入集":两路各自过线 → **绝对闸门** → 融合 → 系数 → top-K。
 * @param gate { cos: number, bm25: number, mode: 'or' | 'and' }
 */
function injectOnce(pre, gate, laneLines) {
  const bLine = laneLines.bm25
  const vLine = laneLines.vec
  const pass = (bRaw, vRaw) => {
    const okB = bRaw >= gate.bm25
    const okV = vRaw >= gate.cos
    if (gate.mode === 'and') return okB && okV
    if (gate.mode === 'tiered') {
      // 分档:双路都过"共识线" → 放行;只有一路 → 该路必须过更高的"单路线"
      if (okB && okV) return true
      return (bRaw >= (gate.bm25Solo ?? Infinity)) || (vRaw >= (gate.cosSolo ?? Infinity))
    }
    return okB || okV
  }
  const bRawOf = new Map(pre.bAll.map((h) => [h.id, h.raw]))
  const vRawOf = new Map(pre.vAll.map((h) => [h.id, h.raw]))
  const b = pre.bAll
    .filter((h) => h.raw >= bLine && pass(h.raw, vRawOf.get(h.id) ?? 0))
    .slice(0, LANE_LIMIT)
  const v = pre.vAll
    .filter((h) => h.raw >= vLine && pass(bRawOf.get(h.id) ?? 0, h.raw))
    .slice(0, LANE_LIMIT)
  const fused = rrfFuse([b, v], base.rrfK)
  const out = []
  for (const [id, relevance] of fused) {
    const record = corpus.get(id)
    if (record === undefined) continue
    const { score } = computeFinalScore({
      relevance, record, nowMs: Date.now(), cfg: { ...base.decay, ...base.scoring }, currentWorkspaceId: currentWorkspace,
    })
    out.push({ id, score })
  }
  out.sort((a, b2) => b2.score - a.score)
  return out.slice(0, K).map((r) => r.id)
}

const LANE_LINES = { bm25: base.bm25.minScore, vec: base.vectorMinScore }
const allQueries = [...POS, ...CROSS]
const pre = new Map()
for (const [q] of allQueries) pre.set(q, await precompute(q))
for (const q of NEG) pre.set(q, await precompute(q))

console.log(`池子:${memories.length} 记忆 + ${hot.length} 热缓冲 · 当前工作区 ${currentWorkspace.slice(0, 14)} · 正例 ${allQueries.length} / 负例 ${NEG.length} · K=${K}`)
console.log(`单路及格线沿用现状:b m25 ≥ ${LANE_LINES.bm25} · cos ≥ ${LANE_LINES.vec}\n`)

function evaluate(label, gate) {
  let r1 = 0; let r5 = 0; let mrr = 0; let posShown = 0
  for (const [q, targets] of allQueries) {
    const ids = injectOnce(pre.get(q), gate, LANE_LINES)
    posShown += ids.length
    const idx = firstHit(ids, targets)
    if (idx === 0) r1 += 1
    if (idx >= 0 && idx < 5) r5 += 1
    if (idx >= 0) mrr += 1 / (idx + 1)
  }
  let negShown = 0
  for (const q of NEG) negShown += injectOnce(pre.get(q), gate, LANE_LINES).length
  const n = allQueries.length
  console.log(
    `${label.padEnd(34)} R@1 ${(r1 / n).toFixed(2)}  R@5 ${(r5 / n).toFixed(2)}  MRR ${(mrr / n).toFixed(3)}  ` +
    `正例均注入 ${(posShown / n).toFixed(1)}  负例均注入 ${(negShown / NEG.length).toFixed(1)}`,
  )
  return { r5: r5 / n, neg: negShown / NEG.length }
}

console.log('闸门 = 任一绝对信号达标(OR);0 表示不设该路闸门')
const baseline = evaluate('基线(无闸门)', { cos: 0, bm25: 0, mode: 'or' })
console.log('')
const rows = []
for (const cosFloor of [0.35, 0.4, 0.45, 0.5, 0.55]) {
  for (const bm25Floor of [0, 2, 4, 6]) {
    const r = evaluate(`OR cos≥${cosFloor} / bm25≥${bm25Floor}`, { cos: cosFloor, bm25: bm25Floor, mode: 'or' })
    rows.push({ cosFloor, bm25Floor, ...r })
  }
}
console.log('\n分档闸门:共识线(两路都过)+ 单路需过更高的单路线')
for (const [c, b, cs, bs] of [[0.35, 2, 0.5, 8], [0.35, 2, 0.55, 10], [0.4, 4, 0.55, 10], [0.3, 1, 0.45, 6]]) {
  evaluate(`分档 共识 cos≥${c}/bm25≥${b} · 单路 cos≥${cs}/bm25≥${bs}`, { cos: c, bm25: b, cosSolo: cs, bm25Solo: bs, mode: 'tiered' })
}

console.log('\n对照:AND(两路绝对分都要达标)')
for (const [c, b] of [[0.4, 4], [0.5, 6]]) {
  evaluate(`AND cos≥${c} / bm25≥${b}`, { cos: c, bm25: b, mode: 'and' })
}

// ── 诊断:AND 到底砍掉了哪些正例,它们是不是"单路独家" ──────────────────────
{
  const andGate = { cos: 0.4, bm25: 4, mode: 'and' }
  console.log('\n== 逐条诊断:AND(cos≥0.4 且 bm25≥4) 相对基线的得失 ==')
  for (const [q, targets] of allQueries) {
    const pre1 = pre.get(q)
    const baseIds = injectOnce(pre1, { cos: 0, bm25: 0, mode: 'or' }, LANE_LINES)
    const andIds = injectOnce(pre1, andGate, LANE_LINES)
    const b0 = firstHit(baseIds, targets)
    const b1 = firstHit(andIds, targets)
    if (b0 === b1) continue                                  // 无变化不打印
    // 目标在两条路上的绝对分(判断是否单路命中)
    const t = targets[0]
    const bRaw = pre1.bAll.find((h) => h.id.startsWith(t))?.raw ?? 0
    const vRaw = pre1.vAll.find((h) => h.id.startsWith(t))?.raw ?? 0
    const lane = (bRaw >= LANE_LINES.bm25 && vRaw >= LANE_LINES.vec) ? '双路'
      : (vRaw >= LANE_LINES.vec ? '仅向量' : (bRaw >= LANE_LINES.bm25 ? '仅BM25' : '两路都弱'))
    console.log(`  «${q.slice(0, 26)}» 基线 ${b0 < 0 ? '未中' : '第' + (b0 + 1)} → AND ${b1 < 0 ? '未中' : '第' + (b1 + 1)}   [目标绝对分 bm25 ${bRaw.toFixed(1)} / cos ${vRaw.toFixed(3)} ⇒ ${lane}]`)
  }
}

console.log('\n== 取舍一览(R@5 与 负例均注入 的帕累托前沿)==')
const sorted = [...rows].sort((a, b) => b.r5 - a.r5 || a.neg - b.neg)
let bestNeg = Number.POSITIVE_INFINITY
for (const r of sorted) {
  const onFrontier = r.neg < bestNeg
  if (onFrontier) bestNeg = r.neg
  console.log(
    `  cos≥${String(r.cosFloor).padEnd(4)} bm25≥${String(r.bm25Floor).padEnd(2)}  R@5 ${r.r5.toFixed(2)}  负例 ${r.neg.toFixed(1)}${onFrontier ? '   ← 前沿' : ''}`,
  )
}
console.log(`\n基线参考:R@5 ${baseline.r5.toFixed(2)} · 负例均注入 ${baseline.neg.toFixed(1)}`)
