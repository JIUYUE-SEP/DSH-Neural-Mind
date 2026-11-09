# 遗留文档

> 本目录所有文件都已冻结：**不反映当前状态，正文不再修改**，只作历史参考与引用锚点。
> 现行文档在仓库根目录：[README](../../README.md) · [DESIGN](../../DESIGN.md) · [STATUS](../../STATUS.md) · [NEXT_STEPS](../../NEXT_STEPS.md) · [CHANGELOG](../../CHANGELOG.md)。

## 索引

| 文件 | 性质 | 实施状态 | 取代者 | 保留原因 |
|---|---|---|---|---|
| [HANDOFF.md](HANDOFF.md) | 0.5.0 第四轮交接单（Session V4 兼容修复） | 已实施 | — | Session V4 修复与宿主证据的唯一过程记录 |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | 历史实施日志与评审记录（0.1.x–0.6.0 前） | 部分实施 | STATUS / CHANGELOG | 决策过程、实验与踩坑细节；遗留工程债的出处 |
| [OPTIMIZATION_PLAN.md](OPTIMIZATION_PLAN.md) | 2026-10-27 审计后的优化规划原始版 | 部分实施 | FOLLOWUP_PLAN / NEXT_STEPS | 分期判据（MVP/V1.1/V2/V3）与 B/C/D/E 系列条目出处 |
| [FOLLOWUP_PLAN.md](FOLLOWUP_PLAN.md) | 2026-10-27 审计后的后续详细计划 | 部分实施 | NEXT_STEPS | W 系列条目与触发条件的出处 |
| [REVIEW.md](REVIEW.md) | 2026-11 实用性与完善建议评审 | 部分实施 | NEXT_STEPS | R 项编号的唯一出处；代码注释与 DESIGN 持续按编号引用 |
| [VERIFICATION-2026-11.md](VERIFICATION-2026-11.md) | 2026-11-09 及之前的验证记录与操作手册快照 | 已实施 | STATUS | 0.6.0–0.6.5 的验证原始记录；冻结评估指标与 UI 视觉验收口径 |
| [host-compat-history.md](host-compat-history.md) | 原 DESIGN §8.1–§8.4 跨版本校准史 | 已实施 | [§8](../design/08-host-seams.md) | 宿主版本考古（V4 / asar / zstd 等事实的出处） |
| [implementation-roadmap.md](implementation-roadmap.md) | 原 DESIGN §11 分期路线 | 部分实施 | [NEXT_STEPS](../../NEXT_STEPS.md) | MVP / V1.1 分期判据与交付状态 |
| [review-provenance.md](review-provenance.md) | 原 DESIGN §13 审核溯源 | 已实施 | — | 每个版本的审核结论与实现回流记录 |

## 规则

1. **冻结**：文件移入本目录后正文不再修改；如确需补充，只能在文首加一行横幅说明，不改原文。
2. **实施状态四档**：`已实施` / `部分实施` / `未实施` / `已废弃`。结论依据 2026-11-09 的逐条代码复核（REVIEW 与 REPORT 中的 R 项、W 项、A–E 系列）。
3. **引用去向**：需要最新事实时去根目录现行文档；需要"当时为什么这么定"时才查本目录。
4. **不再新增**：新内容一律写进现行文档；本目录只接收被取代的旧文档。

> 备注：旧文档正文里提到的 `ROADMAP.md` / `DOCS.md` / `VERIFICATION.md` 已删除或并入——规划并入 [NEXT_STEPS.md](../../NEXT_STEPS.md)（待设计池），文档索引并入 README / [DESIGN](../../DESIGN.md)，历史验证记录即本目录的 [VERIFICATION-2026-11.md](VERIFICATION-2026-11.md)。
