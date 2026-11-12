---
op: 2
title: "0.6.7 发版"
date: 2026-11-10
---

# OP-0002 · 0.6.7 发版

> **不代表现状**：本文件是事后补录的冻结计划；现状只看 `DESIGN.md` 与 `docs/design/`。

## 做了什么（已完成）

升版本 → 重打包 candidate → 更新尺寸 / SHA / `SHA256SUMS` → 从最终 HEAD 跑 `verify:release` → tag `v0.6.7` + GitHub Release（不发 npm）→ 下载 asset 校验 SHA。

## 结果

`verify:release` PASS；Release asset 353,521 B，SHA256 与本地一致。
