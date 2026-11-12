# neural-mind 当前状态

> **本文是当前状态的唯一事实来源**（覆写式：每次发布 / 验证 / 里程碑后重写）。
> 最后更新：2026-11-10（0.6.7 已发布：tag + GitHub Release + asset 校验）
> 现行文档：[README](README.md) · [DESIGN](DESIGN.md) · [NEXT_STEPS](NEXT_STEPS.md) · [CHANGELOG](CHANGELOG.md)
> 历史过程见 [docs/legacy/](docs/legacy/README.md)；历史验证记录见 [docs/legacy/VERIFICATION-2026-11.md](docs/legacy/VERIFICATION-2026-11.md)。

## 版本与发布状态

| 项 | 值 |
|---|---|
| 仓库 | `JIUYUE-SEP/DSH-Neural-Mind`（public，MIT License；2026-11-10 由 `neural-mind` 改名，旧名自动重定向） |
| 工作树版本 | **0.6.7**（S12 使用观测） |
| 最新已发布 | **0.6.7**（2026-11-10，Release [v0.6.7](https://github.com/JIUYUE-SEP/DSH-Neural-Mind/releases/tag/v0.6.7)） |
| 下一版 | **0.7.0**（记忆质量，S13–S16；S12 观测已随 0.6.7 交付） |
| 0.6.7 状态 | **已发布**：tag `v0.6.7`（提交 `3fd6055`）+ GitHub Release 已按用户明确授权创建（**不发 npm**）；asset = `neural-mind-0.6.7-candidate.tgz`（60 文件，353,521 B），下载校验 SHA256 `DA3F45B8…D93120` 一致 |
| 0.6.6 状态 | **已发布**：tag `v0.6.6` + GitHub Release 已按用户明确授权创建（**不发 npm**）；Release asset = 候选 tarball（59 文件，339,282 B，SHA256 见 `bench-results/artifacts/SHA256SUMS`） |

**0.6.7 内容**：S12 使用观测——独立观测域 `neural_mind_usage`（R3 计数 + 明细 + 注入质量元数据）+ R9 只读容量统计；**不改记忆行为**。逐条见 [CHANGELOG](CHANGELOG.md)。

0.6.6 内容：正确性补丁 R1a / R4 / R8a / R13a / R13b / R14 / R15a / R16 / R16b / R18 / R26（R0 是 0.6.5 的发版收尾，不计入本版），外加**插件改名 `dsh-plugin-memory` → `neural-mind`**（entry id / 设置命名空间 / 存储域名 / 注入来源 kind / 数据路由全量同步，旧数据自动迁移）。逐条见 [CHANGELOG](CHANGELOG.md)。

## 一句话

给 DSH 加一个**长期记忆池**：自动记住、自动想起、可显式记住 / 回忆 / 忘掉，并带 SOUL 人格层与用户画像。

## 现在能做什么

- 回合结束后原文进 L0 热缓冲（秒级可检索），后台提炼成 L2 事实 / 经验 / 话题摘要，并建立印证与矛盾关系；
- 每轮 step 1 检索并注入相关记忆；工具 `memory_remember` / `memory_recall` / `memory_forget` / `soul_update`；
- 主侧栏「记忆」→ 7 页签记忆控制台（总览 / 记忆 / 召回 / 配置 / 画像 / SOUL / 审计）；
- 隐私：`privateWorkspaces` 只进不出；sensitive 标记默认不自动产生（0.6.6 R4），打开 `sensitiveNoCross` 后才做跨域拦截；密钥形态拒收。
- **使用观测（0.6.7）**：注入 / 跳过 / 提炼 / 召回计数与注入质量元数据按天落盘（独立域 `neural_mind_usage`），总览可见「使用量」与最近注入的相关/可信；只记录，不改变注入结果。

## 质量现状（全仓数字唯一来源）

2026-11-10 实测：

| 项目 | 结果 |
|---|---|
| 单测（逐文件 `node --test`） | **394 测试 / 391 通过 / 0 失败 / 3 跳过**（37 个测试文件） |
| `check:ledger` | §10 配置账本 **70/70**，零差异 |
| `check:seams` | **12 项**（volatile 28 双侧闭合；bundle 311,964 B） |
| `check:design` | **10 份设计文档 / 索引 15 行 / 代码归属 27 条**：front-matter 与索引双向一致；漂移检查（P1）走 `verify:release --strict` |
| `check:conform` | **39 条 / 0 不符** |
| `check:host` | **51/51**（本机 DSH Desktop 0.2.2-rc.1） |
| `check:shapes` | **10/10**（0.2.2-rc.1 的 `app.asar.unpacked` 布局） |

**0.6.7 候选发布门禁（2026-11-10 从最终 HEAD 重跑）**：`verify:release` **PASS**（EXIT=0）——npm test **380/377/0/3**、`check:host` 51/51、`check:shapes` 10/10、`check:conform` 39/0、`check:design` P0+P1（6 提交 / 0 漂移）、E2E **24/24**（源码 + tarball 各一次）、升级 smoke PASS（0.5.0 → 0.6.7，记忆保留且被新版读到）、默认配置冒烟 **26/26**、N1 默认提炼 PASS、`release-matrix` PASS（60 文件 tarball）。原始日志：[bench-results/verify-release-0.6.7.log](bench-results/verify-release-0.6.7.log)（已脱敏）。

**0.6.6 候选发布门禁（2026-11-09 改名 + 重打包后从最终 HEAD 重跑）**：`verify:release` **PASS**（EXIT=0）——npm test **367/364/0/3**、`check:shapes` **10/10**、E2E **24/24**（源码 + tarball 各一次）、升级 smoke PASS（0.5.0 → 0.6.6，记忆经旧域迁移保留且被新版读到）、默认配置冒烟 **26/26**、N1 默认提炼 PASS、`release-matrix` PASS（59 文件 tarball）。原始日志：[bench-results/verify-release-0.6.6.log](bench-results/verify-release-0.6.6.log)（已脱敏）。

## 验证与复现

```powershell
npm test                              # 配置账本 + 接缝 + 设计文档 P0 + 单测
npm run verify:release                # 全量发布门禁（host / shapes / conform / 设计 P1 strict / E2E / release-matrix）
node tools/check-config-ledger.mjs    # 单独跑某一项（其余换成对应 tools/*.mjs）
node tools/check-design.mjs --history # 只查"代码改了、对应设计文档没改"的漂移（不带 --strict 只告警）
```

- 沙箱内直接 `node --test` 可能报 `spawn EPERM` 假失败：改用 `node --test --test-isolation=none test/*.test.mjs` 逐文件跑。
- `check:host` 自动探测本机 DSH 安装位置；探测不到时用 `$env:DSH_ASAR` 指向 `app.asar`。
- 3 项 skip 都有判据：建 symlink 需开发者模式（2 项，探测而非猜平台）、sidecar 看门狗依赖 POSIX shell（Windows 1 项）。
- 评估 / 性能命令与冻结指标（frozen-v1/v2、20k p95、UI 视觉验收）见[历史验证记录](docs/legacy/VERIFICATION-2026-11.md)。

## 发布资产

`bench-results/artifacts/`：

| 文件 | 用途 | 大小 |
|---|---|---:|
| `neural-mind-0.6.7-candidate.tgz` | 0.6.7 已发布候选（60 文件，含 MIT LICENSE；即 v0.6.7 Release asset） | 353,521 B |
| `neural-mind-0.6.6-candidate.tgz` | 0.6.6 已发布候选（59 文件，含 MIT LICENSE；即 v0.6.6 Release asset） | 339,282 B |
| `dsh-plugin-memory-0.5.0-pre-f0ec867.tgz` | 升级 / 回滚基线（0.5.0，**文件名保留改名前的旧名**，是真实历史产物） | 160,967 B |
| `SHA256SUMS` | 校验和 | — |

> 发布前会从最终 HEAD 重新打包，届时同步更新尺寸 / SHA / `SHA256SUMS`。

## 安装与启用

- 桌面 profile 当前用源码链接：`neural-mind -> link:<本仓库绝对路径>`；重载 DSH 即使用工作树代码。
- 用发布包安装：桌面端在应用内「插件」页添加 tarball；命令行 `dsh plugin ...` 只适用于自建 web / headless profile（桌面 profile 由宿主独占，装不进去）。

## 已知限制

1. **headless 一次性任务**：进程先于后台提炼退出，该回合可能不进记忆；长驻 profile（web / tui / acp）无此问题。N1 已用 SDK stdio 长驻 profile 做确定性验收。
2. **D2b 未做**：关系护栏（D2a）已交付；冻结关系集扩展、决策指标与阈值调优留到 0.7.0。
3. **owner 设置页 / API 与热重建**：有单元测试，缺隔离 profile 的集成矩阵，排到 0.8+。
4. **C / E 暂缓**：20k hybrid 检索 p95 ≈ 35 ms，远低于 300 ms 预算；E1/E2 等宿主证据与需求。
5. 记忆池是本机明文存储；hard forget 不能撤回已经发送到外部 embedding 服务的向量。
6. 认证明细：本机宿主为 DSH Desktop 0.2.2-rc.1，认证基线同时覆盖 0.2.1-rc.3 / 0.2.2-rc.1。
7. **tokenMeter 压力门当前实际不生效**：调用已接线（`measure(session)`、50ms 让路、常驻例外），但 0.2.2-rc.1 的 `measure()` 无 `ratio/pressure/limit/contextWindow` 字段 → 占比恒 `undefined`，`injectPauseThreshold` 不触发；需适配宿主 `contextPressure()` 后才兑现（见 [§7](docs/design/06-lifecycle-degradation.md)）。

## 下一个里程碑

**0.7.0 记忆质量（下一步）**：先做 S13 数据积累——解除日常使用工作区的停用（保留隐私 / 测试工作区），正常使用 1–2 周，让 0.6.7 的使用观测攒出样本；达到 [NEXT_STEPS](NEXT_STEPS.md) §1.1 start gate 后进 S16（R19 / R23 调参）。S14/S15 的确定性工程项可与积累期并行。

## 更新触发

发布 / 验证 / 里程碑完成 / 已知限制变化时重写本文。数字与状态只写在这里，其他文档引用而不复述。
