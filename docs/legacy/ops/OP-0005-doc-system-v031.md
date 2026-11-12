---
op: 5
title: "文档体系迁到模板 v0.3.1"
date: 2026-11-13
---

# OP-0005 · 文档体系迁到模板 v0.3.1

> **不代表现状**：本文件是事后补录的冻结计划；现状只看 `DESIGN.md` 与 `docs/design/`。

## 做了什么（已完成）

- `tools/check-design.mjs` 换成模板 v0.3.1 版，新增 `doc-system.config.json`；
- 10 份设计文档删掉 `status / since / supersedes / superseded_by`（设计只存现状）；
- 索引改 4 列（§ / 主题 / 文件 / 代码入口），与 front-matter `code:` 对齐；
- §15 草稿迁为计划草稿 `docs/ops/project-rules-agents-md.md`，删除未接线的 `lib/rules.js` 与 13 条测试；
- 引入 OP 队列模型：`docs/legacy/ops/` + `completed.md` + `tools/check-ops.mjs`，`NEXT_STEPS` 改三段式。

## 结果

设计 9 份 / 索引 10 行 / 归属 27 条；测试 399/396/0/3；P1 0 漂移。
