---
op: 4
title: "SOUL 写入权收缩（只提议 / 判断形态 / 周回顾 / 回执）"
date: 2026-11-13
---

# OP-0004 · SOUL 写入权收缩

> **不代表现状**：本文件是事后补录的冻结计划；现状只看 `DESIGN.md` 与 `docs/design/04-inject.md`。

## 做了什么（已完成）

1. **写入权**：`soul_update` → `soul_propose`（破坏性改名），agent 只落整篇提议，用户在记忆页采纳才落笔；`soulMode` / `soulReason` 可选字段，不升 domain 版本。
2. **内容形态**：工具描述与提炼器 `soulProposal` 同口径——写判断（选边 / 外推 / 代价 / 反例），不写情形规则与零成本表态。
3. **周节奏**：新增 `soul_signals` 表收"用户原话"信号，周回顾（7 天 + ≥2 条 + 跨 ≥2 天）才允许产出提议。
4. **回执与忽略理由**：有被忽略史时必须带 `ackIgnoredId`；忽略可填理由（`soulNote`），并在 `soulEnabled=false` 时连提炼通道一起停。

## 结果

§4.4 改写；测试 412 → 后随 OP-0005 调整为 399。
