---
op: 1
title: "S12 使用观测（R3 + R9 只读）"
date: 2026-11-10
---

# OP-0001 · S12 使用观测

> **不代表现状**：本文件是事后补录的冻结计划；现状只看 `DESIGN.md` 与 `docs/design/14-observability.md`。

## 做了什么（已完成）

- 独立短命域 `neural_mind_usage`（`days` / `recent` 两表，不升主域版本）；
- 注入 / 跳过 / 提炼 / 召回计数按天汇总 + 明细滚动；
- 注入质量元数据只记录不拦截；`/neural-mind/api` 增 `usage` / `pool` 只读动作。

## 结果

随 0.6.7 发布；设计见 §14。
