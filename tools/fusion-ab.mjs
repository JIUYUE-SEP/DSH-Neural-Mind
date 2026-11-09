#!/usr/bin/env node
/**
 * 融合策略对照实验(§5 双路核实议题):把插件真实的两路口径**只读复刻**一遍,
 * 在同一批查询上比 "并集(RRF,现状) / 共识(交集) / 纯 BM25" 三种口径的差异。
 *
 * 关注三个问题:
 *   1. 交集(双路都命中)会不会经常为空 → 那意味着"双路核实"会让注入整体归零;
 *   2. 并集里有多少条目是**单路**捞出来的 → 那就是交集会丢掉的东西;
 *   3. 单路捞出来的那些,抽样看看质量(是"改写命中"还是"噪声")。
 *
 * 用法:node tools/fusion-ab.mjs [--json]
 * 只读:不改记忆池、不写任何文件;查询向量走本机 Ollama(qwen3-embedding:0.6b)。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { Bm25Index } from '../lib/bm25.js'
import { tokenize } from '../lib/text.js'
import { cosine } from '../lib/embed.js'
import { POS as FIX_POS, CROSS, NEG, loadLiveConfig } from './eval-fixtures.mjs'

const POOL = join(homedir(), '.dsh/storages/neural_mind')
const cfg = loadLiveConfig()
const EMBED = { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen3-embedding:0.6b' }
const LANE_LIMIT = Math.max(1, Math.floor(cfg.candidateMultiplier * cfg.injectMaxItems))

/** 只读载入池子(与插件注入池同口径:active 记忆 + 未消化热缓冲,跳 hidden/archived)。 */
function loadPool() {
  const read = (dir, keep) => {
    const out = []
    for (const f of fs.readdirSync(join(POOL, dir))) {
      if (!f.endsWith('.json')) continue
      try {
        const rec = JSON.parse(fs.readFileSync(join(POOL, dir, f), 'utf8')).record
        if (rec !== undefined && keep(rec)) out.push(rec)
      } catch { /* 坏记录跳过 */ }
    }
    return out
  }
  return [
    ...read('memories', (r) => r.status === 'active' && r.hidden !== true),
    ...read('hotbuffer', (r) => r.digested !== true && r.hidden !== true),
  ]
}

async function embedQuery(text) {
  const res = await fetch(`${EMBED.baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBED.model, input: [text] }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`embedding HTTP ${res.status}`)
  return (await res.json()).data[0].embedding
}

/** 复刻 lib/search.js 的两路口径(单路及格线 → top laneLimit)。 */
function lanes(query, corpus, bm25) {
  const tokens = tokenize(query)
  let b = bm25.search(tokens, LANE_LIMIT * 4)
  if (b.length > 0) {
    let line = cfg.bm25.minScore
    if (cfg.bm25.minScoreTopRatio > 0) line = Math.max(line, b[0].score * cfg.bm25.minScoreTopRatio)
    b = b.filter((h) => h.score >= line)
  }
  b = b.filter((h) => corpus.has(h.id)).slice(0, LANE_LIMIT)
  return { bm25: b.map((h) => ({ id: h.id, score: h.score })) }
}

function vectorLane(queryVec, corpus) {
  const hits = []
  for (const [id, record] of corpus) {
    if (record.embeddingModel !== EMBED.model || !Array.isArray(record.chunks)) continue
    let best = 0
    for (const chunk of record.chunks) {
      const score = cosine(queryVec, chunk.embedding)
      if (score > best) best = score
    }
    if (best >= cfg.vectorMinScore) hits.push({ id, score: best })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, LANE_LIMIT)
}

/** 用户池子里的真实主题 × 三类查询形态(同义改写 / 跨语言 / 标识符 / 负例)。 */
const QUERIES = [
  ['同义改写', '网页域名解析坏了但直接填 IP 能打开'],
  ['同义改写', '怎么让本地模型跟着我的进程一起关掉'],
  ['同义改写', '换一个记忆检索用的模型要做什么'],
  ['同义改写', '回复里不要出现表情符号'],
  ['同义改写', '怎么确认改动到底有没有生效'],
  ['跨语言', 'why does the embedding service shut down with the harness'],
  ['跨语言', 'how are memories shared across different workspaces'],
  ['跨语言', 'how are style preferences stored'],
  ['标识符', 'storageDomain open 超时看门狗'],
  ['标识符', 'autoStartWarmup'],
  ['标识符', 'highQuotaRatio'],
  ['标识符', 'pnpm-workspace.yaml overrides'],
  ['抽象概念', '未经验证的信息不要写进常驻层'],
  ['抽象概念', '同一个知识点出现在两个地方会怎样'],
  ['个人事实', '我常用的编辑器是哪个'],
  ['个人事实', '我常用的包管理器是哪个'],
  ['个人事实', '我用什么工具生成图片'],
  ['事件时间', '哪天把网络问题修好的'],
  ['事件时间', '上次我拒绝的那条记忆是什么'],
  ['负例(无关)', '明天上海天气怎么样'],
  ['负例(无关)', '推荐几部 2024 年的电影'],
  ['负例(无关)', '怎么做红烧肉'],
]

const pool = loadPool()
const corpus = new Map(pool.map((r) => [r.id, r]))
const bm25 = new Bm25Index({ k1: cfg.bm25.k1, b: cfg.bm25.b })
for (const r of pool) bm25.add(r.id, tokenize(r.content ?? ''))

const rows = []
for (const [kind, query] of QUERIES) {
  const { bm25: b } = lanes(query, corpus, bm25)
  let v = []
  let vectorError = null
  try {
    v = vectorLane(await embedQuery(query), corpus)
  } catch (error) {
    vectorError = error.message
  }
  const bIds = new Set(b.map((h) => h.id))
  const vIds = new Set(v.map((h) => h.id))
  const union = new Set([...bIds, ...vIds])
  const both = [...bIds].filter((id) => vIds.has(id))
  rows.push({ kind, query, b: b.length, v: v.length, union: union.size, both: both.length, vectorError, bIds, vIds })
}

const text = (id) => (corpus.get(id)?.content ?? '').replace(/\s+/g, ' ').slice(0, 60)
console.log(`池子:${pool.length} 条(active 记忆 + 未消化热缓冲)· laneLimit=${LANE_LIMIT} · bm25.minScore=${cfg.bm25.minScore} · vectorMinScore=${cfg.vectorMinScore}\n`)
console.log('类别        查询                                    BM25  向量  并集  交集  单路独家')
for (const r of rows) {
  const solo = r.union - r.both
  console.log(
    `${r.kind.padEnd(10)}  ${r.query.padEnd(38).slice(0, 38)}  ${String(r.b).padStart(3)}  ${String(r.v).padStart(4)}  ${String(r.union).padStart(4)}  ${String(r.both).padStart(4)}  ${String(solo).padStart(6)}` +
    (r.vectorError === null ? '' : `   [向量路失败: ${r.vectorError}]`),
  )
}

const empty = rows.filter((r) => r.both === 0)
const allSolo = rows.filter((r) => r.union > 0 && r.both === 0)
console.log('\n== 汇总 ==')
console.log(`  交集为空(双路核实 → 一条都不注入)的查询:${empty.length}/${rows.length}`)
console.log(`  并集非空但交集为空(本来能召回,严格后会全丢):${allSolo.length} 条`)
console.log(`  平均:BM25 ${(rows.reduce((s, r) => s + r.b, 0) / rows.length).toFixed(1)} 条 / 向量 ${(rows.reduce((s, r) => s + r.v, 0) / rows.length).toFixed(1)} 条 / 并集 ${(rows.reduce((s, r) => s + r.union, 0) / rows.length).toFixed(1)} 条 / 交集 ${(rows.reduce((s, r) => s + r.both, 0) / rows.length).toFixed(1)} 条`)

console.log('\n== 单路独家的例子(交集会丢掉的东西) ==')
let shown = 0
for (const r of rows) {
  if (r.union === 0 || shown >= 8) continue
  const soloB = [...r.bIds].filter((id) => !r.vIds.has(id)).slice(0, 1)
  const soloV = [...r.vIds].filter((id) => !r.bIds.has(id)).slice(0, 1)
  if (soloB.length === 0 && soloV.length === 0) continue
  shown += 1
  console.log(`  «${r.query}»`)
  if (soloB.length > 0) console.log(`     仅 BM25 : ${text(soloB[0])}`)
  if (soloV.length > 0) console.log(`     仅 向量 : ${text(soloV[0])}`)
}

if (process.argv.includes('--json')) {
  console.log('\n' + JSON.stringify(rows.map(({ kind, query, b, v, union, both }) => ({ kind, query, bm25: b, vector: v, union, both })), null, 2))
}

// ── 阈值扫描(--sweep):回答"线该设多高才既保召回又不误注入" ──────────────────
if (process.argv.includes('--sweep')) {
  // 正例:查询 → 目标记忆里必须出现的关键字(用于判定"这条该被找到")
  const POSITIVE = [
    ['网页域名解析坏了但直接填 IP 能打开', ['DNS', '域名']],
    ['回复里不要出现表情符号', ['emoji']],
    ['我常用的编辑器是哪个', ['编辑器']],
    ['我用什么工具生成图片', ['图片']],
    ['怎么让本地模型跟着我的进程一起关掉', ['边车', '进程', '卸载']],
    ['storageDomain open 超时看门狗', ['storageDomain', '看门狗']],
    ['highQuotaRatio', ['highQuotaRatio', '配额']],
    ['未经验证的信息不要写进常驻层', ['画像', '编造', '出处', '不能编']],
    ['哪天把网络问题修好的', ['DNS', '加速器', 'github', 'GitHub']],
    ['换一个记忆检索用的模型要做什么', ['重嵌入', 'modelId', '向量']],
  ]
  const NEGATIVE = ['明天上海天气怎么样', '推荐几部 2024 年的电影', '怎么做红烧肉']

  console.log('\n\n=== 阈值扫描(每条查询只 embed 一次,阈值纯过滤)===')
  // 预计算:每条查询的 BM25 全量与向量余弦全量
  const pre = new Map()
  for (const q of [...POSITIVE.map((p) => p[0]), ...NEGATIVE]) {
    const tokens = tokenize(q)
    const bAll = bm25.search(tokens, corpus.size)
    const qv = await embedQuery(q)
    const vAll = []
    for (const [id, record] of corpus) {
      if (record.embeddingModel !== EMBED.model || !Array.isArray(record.chunks)) continue
      let best = 0
      for (const chunk of record.chunks) { const s = cosine(qv, chunk.embedding); if (s > best) best = s }
      vAll.push({ id, score: best })
    }
    vAll.sort((a, b) => b.score - a.score)
    pre.set(q, { bAll, vAll })
  }
  const evalAt = (bLine, vLine) => {
    let negTotal = 0
    let hitTop5 = 0
    for (const [q, keys] of POSITIVE) {
      const { bAll, vAll } = pre.get(q)
      const b = bAll.filter((h) => h.score >= bLine).slice(0, LANE_LIMIT).map((h) => h.id)
      const v = vAll.filter((h) => h.score >= vLine).slice(0, LANE_LIMIT).map((h) => h.id)
      const union = [...new Set([...b, ...v])]
      const hit = union.slice(0, 5).some((id) => keys.some((k) => (corpus.get(id)?.content ?? '').includes(k)))
      if (hit) hitTop5 += 1
    }
    for (const q of NEGATIVE) {
      const { bAll, vAll } = pre.get(q)
      const b = bAll.filter((h) => h.score >= bLine).slice(0, LANE_LIMIT).length
      const v = vAll.filter((h) => h.score >= vLine).slice(0, LANE_LIMIT).length
      negTotal += new Set([...bAll.filter((h) => h.score >= bLine).slice(0, LANE_LIMIT).map((h) => h.id),
        ...vAll.filter((h) => h.score >= vLine).slice(0, LANE_LIMIT).map((h) => h.id)]).size || (b + v)
    }
    return { hitTop5, negTotal }
  }
  // BM25 分数分布(帮助选范围)
  const bTop = [...pre.values()].map((p) => p.bAll[0]?.score ?? 0)
  const vTop = [...pre.values()].map((p) => p.vAll[0]?.score ?? 0)
  console.log(`  参考:每条查询的 BM25 最高分 ${Math.min(...bTop).toFixed(2)}~${Math.max(...bTop).toFixed(2)};向量最高 cos ${Math.min(...vTop).toFixed(3)}~${Math.max(...vTop).toFixed(3)}`)
  console.log('  bm25线  向量线   正例命中(前5)   负例平均注入条数')
  for (const bLine of [0.1, 1, 2, 4, 6]) {
    for (const vLine of [0.2, 0.3, 0.4, 0.5]) {
      const { hitTop5, negTotal } = evalAt(bLine, vLine)
      const mark = hitTop5 === POSITIVE.length && negTotal <= 3 ? '  ← 候选' : ''
      console.log(`  ${String(bLine).padStart(6)}  ${String(vLine).padStart(6)}   ${String(hitTop5).padStart(2)}/${POSITIVE.length}          ${(negTotal / NEGATIVE.length).toFixed(1)}${mark}`)
    }
  }
}


// ── 带 id 的评估(--eval):ground truth 钉到具体记录,回答"线该设多高" ─────────────
// 标注方式:挑真实记录 → 写一条**用户会这么问**的查询(刻意不照抄原文措辞,含跨语言),
// 把应命中的记录 id 钉下来。正例看 R@1 / R@5 / MRR,负例看"平均误注入条数"。
if (process.argv.includes('--eval')) {
  // ground truth 单一真相源是 tools/eval-fixtures.mjs(2026-09-18 收敛;此前此处内联 25 条,已分叉)
  const POS = [...FIX_POS, ...CROSS]

  const pre = new Map()
  for (const [q] of [...POS, ...NEG.map((q) => [q])]) {
    const tokens = tokenize(q)
    const bAll = bm25.search(tokens, corpus.size)
    const qv = await embedQuery(q)
    const vAll = []
    for (const [id, record] of corpus) {
      if (record.embeddingModel !== EMBED.model || !Array.isArray(record.chunks)) continue
      let best = 0
      for (const chunk of record.chunks) { const s = cosine(qv, chunk.embedding); if (s > best) best = s }
      vAll.push({ id, score: best })
    }
    vAll.sort((a, b) => b.score - a.score)
    pre.set(q, { bAll, vAll })
  }

  const rank = (q, bLine, vLine, mode, topRatio) => {
    const { bAll, vAll } = pre.get(q)
    let line = bLine
    if (topRatio > 0 && bAll.length > 0) line = Math.max(bLine, (bAll[0].score ?? 0) * topRatio)
    const b = bAll.filter((h) => h.score >= line).slice(0, LANE_LIMIT).map((h) => h.id)
    const v = vAll.filter((h) => h.score >= vLine).slice(0, LANE_LIMIT).map((h) => h.id)
    if (mode === 'and') {
      const vSet = new Set(v)
      return b.filter((id) => vSet.has(id))
    }
    return [...new Set([...b, ...v])]      // union(RRF 的候选集与其一致)
  }

  const configs = [
    ['现状 union (0.1 / 0.2)', 'union', 0.1, 0.2, 0],
    ['union (2 / 0.4)', 'union', 2, 0.4, 0],
    ['union (6 / 0.4)', 'union', 6, 0.4, 0],
    ['union (2 / 0.5)', 'union', 2, 0.5, 0],
    ['union 相对线0.35 (0.1 / 0.4)', 'union', 0.1, 0.4, 0.35],
    ['union 相对线0.5 (0.1 / 0.4)', 'union', 0.1, 0.4, 0.5],
    ['AND 双路交集 (0.1 / 0.2)', 'and', 0.1, 0.2, 0],
    ['AND 双路交集 (2 / 0.4)', 'and', 2, 0.4, 0],
  ]

  console.log(`\n\n=== 带 id 的评估(${POS.length} 正例含 ${CROSS.length} 跨语言 / ${NEG.length} 负例)· laneLimit=${LANE_LIMIT} ===`)
  console.log('配置                          R@1    R@5    MRR    负例平均误注入   正例平均召回')
  for (const [name, mode, bLine, vLine, topRatio] of configs) {
    let r1 = 0; let r5 = 0; let mrr = 0; let posTotal = 0
    for (const [q, targets] of POS) {
      const ids = rank(q, bLine, vLine, mode, topRatio)
      posTotal += ids.length
      // 标注用 id 前缀(可读),实际 id 是完整 UUID → 用 startsWith 匹配
      const first = ids.findIndex((id) => targets.some((t) => id.startsWith(t)))
      if (first === 0) r1 += 1
      if (first >= 0 && first < 5) r5 += 1
      if (first >= 0) mrr += 1 / (first + 1)
    }
    let negTotal = 0
    for (const q of NEG) negTotal += rank(q, bLine, vLine, mode, topRatio).length
    console.log(`${name.padEnd(28)}  ${(r1 / POS.length).toFixed(2)}  ${(r5 / POS.length).toFixed(2)}  ${(mrr / POS.length).toFixed(3)}   ${(negTotal / NEG.length).toFixed(1).padStart(10)}   ${(posTotal / POS.length).toFixed(1).padStart(10)}`)
  }

  // 分类拆分:跨语言查询是向量路的主场——AND 会把它整片砍掉,这里用数据说清
  console.log(`\n按查询语言拆 R@5(中文 ${POS.length - CROSS.length} 条 / 跨语言英文 ${CROSS.length} 条):`)
  for (const [name, mode, bLine, vLine, topRatio] of [configs[0], configs[2], configs[6]]) {
    const hit = { zh: 0, en: 0 }; const tot = { zh: 0, en: 0 }
    for (const [q, targets] of POS) {
      const isEn = /^[\x00-\x7F]+$/.test(q)
      const ids = rank(q, bLine, vLine, mode, topRatio)
      const first = ids.findIndex((id) => targets.some((t) => id.startsWith(t)))
      tot[isEn ? 'en' : 'zh'] += 1
      if (first >= 0 && first < 5) hit[isEn ? 'en' : 'zh'] += 1
    }
    console.log(`  ${name.padEnd(28)}  中文 ${hit.zh}/${tot.zh}   跨语言 ${hit.en}/${tot.en}`)
  }
}
