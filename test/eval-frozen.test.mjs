import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runFrozenEval } from '../tools/eval-frozen.mjs'

test('frozen 评估集:v2(215 条)主口径 + v1 历史基线冻结,默认准入挡闲聊、注入量收敛、隐私零泄漏', async () => {
  // ── 主口径:frozen-v2(215 记忆 + 20 L0,37 正例 / 13 负例)────────────────
  const first = await runFrozenEval()
  const second = await runFrozenEval()
  assert.equal(first.dataset, 'frozen-v2')
  // 评估口径对齐真实模型维度:确定性假向量 ≥1024 维(bge-m3 / qwen3-embedding 都是 1024);
  // 注意:插件本身不限定维度,真实端点返回多少维就存多少,这里只约束离线评估的假向量。
  assert.equal(first.vector.dim >= 1024, true, `评估向量维度过低: ${first.vector.dim}`)
  assert.ok(first.pool.memories >= 200, `池子太小: ${first.pool.memories}`)
  assert.ok(first.pool.hot >= 10, `L0 太少: ${first.pool.hot}`)
  assert.ok(first.metrics.recallAt5 >= 0.95, `R@5 过低: ${first.metrics.recallAt5}`)
  assert.ok(first.metrics.recallAt1 >= 0.8, `R@1 过低: ${first.metrics.recallAt1}`)
  assert.ok(first.metrics.relationCandidateRecall >= 0.3, `关系候选召回过低: ${first.metrics.relationCandidateRecall}`)
  // 2026-11-07 用户反馈"注入过多 + 错误注入"的回归口径:闲聊类负例必须零注入
  assert.equal(first.metrics.chitChatNegativeInjected, 0, `闲聊负例被注入: ${first.metrics.chitChatNegativeInjected}`)
  // 困难负例(池里确实没有目标、但词面沾边)允许少量——固定 global 是产品决策,不是缺陷
  assert.ok(first.metrics.hardNegativeInjected <= 2, `困难负例注入过多: ${first.metrics.hardNegativeInjected}`)
  // 评估集自带固定基准时间:结果不得随运行日期漂移(两次跑逐条一致,含时间衰减)
  assert.deepEqual(first.queries, second.queries)
  assert.deepEqual(first.relations, second.relations)
  // 隐私:private/sensitive/hidden 记录不得从任何查询的注入结果里出现(两条路径都查)
  for (const id of [...first.queries, ...first.lanes.bm25.queries].flatMap((row) => row.ids)) {
    assert.equal(/^m_(private|sensitive|hidden)_/.test(id), false, `隐私记录不得注入: ${id}`)
  }

  // ── R18(0.6.6):两条评估路径分开验收 ──────────────────────────────────────
  // 纯 BM25 是"没配 embedding 的绝大多数用户"的默认档;旧默认 bm25OnlyMin=2 时
  // 负例注入 6/13(均 2.15 条)、R@1 0.973。0.6.6 默认改 10 后应与混合路同水平。
  assert.equal(first.lane, 'both')
  assert.ok(first.lanes.hybrid !== undefined && first.lanes.bm25 !== undefined, 'both 应同时含两条路径')
  const bm25Metrics = first.lanes.bm25.metrics
  assert.ok(bm25Metrics.negativeInjected <= 2, `纯关键词路径负例注入过多: ${bm25Metrics.negativeInjected}`)
  assert.equal(bm25Metrics.chitChatNegativeInjected, 0, `纯关键词路径闲聊负例被注入: ${bm25Metrics.chitChatNegativeInjected}`)
  assert.ok(bm25Metrics.recallAt1 >= 0.973, `纯关键词路径 R@1 下降(旧默认 0.973): ${bm25Metrics.recallAt1}`)
  assert.ok(bm25Metrics.avgItemsNegative <= 0.8, `纯关键词路径负例平均注入过多: ${bm25Metrics.avgItemsNegative}`)
  // 单 lane 也可单独跑,且与 both 里的同一条路径逐条一致(确定性)
  const onlyBm25 = await runFrozenEval({ lane: 'bm25' })
  assert.equal(onlyBm25.lane, 'bm25')
  assert.deepEqual(onlyBm25.queries, first.lanes.bm25.queries, '单 lane 与 both 的 bm25 结果应一致')
  await assert.rejects(() => runFrozenEval({ lane: 'no-such-lane' }), /未知评估路径/)

  // ── 历史基线:frozen-v1 保留冻结,不随本次默认值改动重写(数字是 2026-10-26 快照口径)──
  const legacy = await runFrozenEval({ dataset: 'frozen-v1' })
  assert.equal(legacy.dataset, 'frozen-v1')
  assert.equal(legacy.pool.memories, 15)
  assert.ok(legacy.metrics.recallAt5 >= 0.8, `v1 R@5 过低: ${legacy.metrics.recallAt5}`)
  assert.ok(legacy.metrics.negativeInjected <= 1, `v1 负例注入过多: ${legacy.metrics.negativeInjected}`)
  assert.ok(legacy.metrics.relationCandidateRecall >= 0.5, `v1 关系候选召回过低: ${legacy.metrics.relationCandidateRecall}`)
})
