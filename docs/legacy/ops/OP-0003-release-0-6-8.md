---
op: 3
title: "0.6.8 发版：SOUL 提议修正"
date: 2026-11-12
---

# OP-0003 · 0.6.8 发版

> **不代表现状**：本文件是事后补录的冻结计划；现状只看 `DESIGN.md` 与 `docs/design/`。

## 做了什么（已完成）

- `restore` 对 `entity='soul'` 的提议回到 `staged`（修"手滑忽略后恢复卡中间态"）；
- 收紧 `soulProposal` 判据（排除流程 / 偏好 / 推断 / 用户事实）；
- 设计侧落 §15 草稿与 `lib/rules.js` 原语（未接线——后于 OP-0005 迁出并删除）。

## 结果

`verify:release` PASS；tag `v0.6.8` + Release，asset 356,538 B，SHA 一致。
