#!/usr/bin/env node
/**
 * **注入路径**评估(§5 融合议题 · 第二层):不是测"候选集",而是测你真正会被注入的东西。
 *
 * 与 fusion-ab.mjs 的区别:
 *   - 那个只复刻两路口径(及格线 → laneLimit → 并集/交集),看的是候选;
 *   - 这个直接把插件的 `createSearch` 拿过来用真池子跑,过完 **RRF → 系数(衰减/证据/籍贯)
 *     → top-K** 之后再看结果 —— 也就是 `purpose:'inject'` 实际返回的那几条。
 *
 * 输出三件事:
 *   1. 三种口径(现状 / 提线 / 门槛另设)在**真实注入集**上的 R@1 / R@5 / MRR;
 *   2. 负例查询**实际注入了什么**(逐条列出来,肉眼可判);
 *   3. 失手分类:目标没进任何一路 / 进了路但没过线 / 过了线但被系数挤出 top-K。
 *
 * 用法:node tools/inject-eval.mjs
 * 只读:不写记忆池;查询向量走本机 Ollama。
 */
import { createSearch } from '../lib/search.js'
import { createEmbedder } from '../lib/embed.js'
import { loadPool, currentWorkspaceOf, POS, CROSS, NEG, firstHit, evalConfig, assertVectorLane, loadLiveConfig } from './eval-fixtures.mjs'

const base = loadLiveConfig()
const logger = { info: () => {} }
const { memories, hot } = loadPool()
const currentWorkspace = currentWorkspaceOf(memories)

function makeSearch(overrides) {
  const cfg = { ...evalConfig(base), ...overrides, semanticSearch: { ...evalConfig(base).semanticSearch, ...(overrides?.semanticSearch ?? {}) } }
  const embedder = createEmbedder({ cfg: cfg.semanticSearch, chunkCfg: cfg, ctx: { get: () => undefined }, logger, audit: undefined })
  const search = createSearch({ cfg, rankCfg: { ...cfg.decay, ...cfg.scoring }, embedder, logger })
  search.rebuild(memories, hot)
  return { search, cfg, embedder }
}

const MODES = [
  // 基线继承线上配置(loadLiveConfig):线上 relevanceGate 开着,基线就是开着——仪器与线上一致(留档第四例的修法)
  ['线上现状', {}],
  ['对照:闸门关闭', { relevanceGate: { ...base.relevanceGate, enabled: false } }],
  ['提线 (bm25 6 / vec 0.4)', { bm25: { ...base.bm25, minScore: 6 }, vectorMinScore: 0.4 }],
  ['提线+相对线 (0.1×0.5 / vec 0.4)', { bm25: { ...base.bm25, minScoreTopRatio: 0.5 }, vectorMinScore: 0.4 }],
]

const hit = firstHit

const attractors = new Map()
console.log(`池子:${memories.length} 记忆 + ${hot.length} 热缓冲 · 当前工作区 ${currentWorkspace.slice(0, 12)} · 正例 ${POS.length + CROSS.length} / 负例 ${NEG.length}\n`)

for (const [name, overrides] of MODES) {
  const { search, embedder } = makeSearch(overrides)
  await assertVectorLane(embedder)
  let r1 = 0; let r5 = 0; let mrr = 0; let missNotInPool = 0; let missNotInLane = 0; let missRankedOut = 0
  const injectedTotal = []
  for (const [query, targets] of [...POS, ...CROSS]) {
    const opts = {
      query, purpose: 'inject', current: { workspaceId: currentWorkspace, sessionId: '' }, limit: base.injectMaxItems,
    }
    const diag = await search.diagnose(opts)
    const list = (diag?.hits ?? []).map((r) => r.id)
    injectedTotal.push(list.length)
    const idx = hit(list, targets)
    if (idx === 0) r1 += 1
    if (idx >= 0 && idx < 5) r5 += 1
    else if (idx < 0) {
      const inPool = targets.some((t) => [...memories, ...hot].some((r) => r.id.startsWith(t)))
      const inLane = targets.some((t) => diag?.bm25Ids?.some((id) => id.startsWith(t))
        || diag?.vectorIds?.some((id) => id.startsWith(t)))
      if (!inPool) missNotInPool += 1
      else if (!inLane) missNotInLane += 1
      else missRankedOut += 1
    }
    if (idx >= 0) mrr += 1 / (idx + 1)
  }
  let r5Rel = 0
  for (const [query, targets] of [...POS, ...CROSS]) {
    const rows = await search.search({ query, purpose: 'inject', current: { workspaceId: currentWorkspace, sessionId: '' }, limit: base.injectMaxItems })
    const byRelevance = [...(rows ?? [])].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0)).map((r) => r.id)
    const idxRel = byRelevance.findIndex((id) => targets.some((t) => id.startsWith(t)))
    if (idxRel >= 0 && idxRel < 5) r5Rel += 1
  }
  let negShown = []
  for (const query of NEG) {
    const rows = await search.search({ query, purpose: 'inject', current: { workspaceId: currentWorkspace, sessionId: '' }, limit: base.injectMaxItems })
    negShown.push([query, (rows ?? []).map((r) => ({
      text: (r.record.content ?? '').replace(/\s+/g, ' ').slice(0, 34),
      score: r.score, relevance: r.relevance, imp: r.record.importance, ev: (r.record.evidence ?? []).length, temporal: r.record.temporal,
    }))])
  }
  for (const [q, items] of negShown) {
    for (const it of items) {
      const key = it.text
      attractors.set(key, (attractors.get(key) ?? 0) + 1)
    }
  }
  const n = POS.length + CROSS.length
  console.log(`── ${name}`)
  console.log(`   真实注入集:R@1 ${(r1 / n).toFixed(2)} · R@5 ${(r5 / n).toFixed(2)} · MRR ${(mrr / n).toFixed(3)} · 平均注入 ${(injectedTotal.reduce((a, b) => a + b, 0) / n).toFixed(1)} 条`)
  console.log(`   消融:只按相关度(RRF)取 top-5 的 R@5 = ${(r5Rel / n).toFixed(2)}  ← 与上一行比,差值就是"系数主导"的代价`)
  console.log(`   失手分类:目标不在池 ${missNotInPool} · 在池但未进候选路 ${missNotInLane} · 进了路但被挤出 top-${base.injectMaxItems} ${missRankedOut}`)
  console.log('   负例实际注入(含最终分/相关度/重要度/证据数/时间语义):')
  for (const [q, items] of negShown) {
    console.log(`     «${q}» → ${items.length === 0 ? '(空)' : items.length + ' 条'}`)
    for (const it of items.slice(0, 3)) {
      console.log(`         · ${it.text}  [score ${Number(it.score).toFixed(3)} rel ${Number(it.relevance).toFixed(4)} imp ${it.imp} ev ${it.ev} ${it.temporal}]`)
    }
  }
  console.log('')
}

console.log('== 负例里反复出现的"吸引子"条目(出现次数)→ 说明它们是泛化内容被系数抬高 ==')
for (const [text, n] of [...attractors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`   ${n} 次  ${text}`)
}
