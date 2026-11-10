---
id: 14
title: "使用观测与容量统计（R3 / R9 只读部分）"
status: 现行
since: 0.6.7
verified: 2026-11-10
code: [lib/usage.js, lib/api.js]
supersedes: []
superseded_by: null
---

# §14 使用观测与容量统计（R3 / R9 只读部分）

> 状态：**现行**（0.6.7 S12 已实现并验收，待发版）。`code` 两条即实现落点：`lib/usage.js`（计数 / 落盘 / 裁剪 / `poolStats`）与 `lib/api.js`（`usage` / `pool` 动作）。
> 覆盖节号：§14.1 目标与边界、§14.2 数据模型、§14.3 计数键（含注入质量元数据）、§14.4 写路径、§14.5 保留与清理、§14.6 读路径、§14.7 R9 统计口径、§14.8 配置与存储影响、§14.9 降级矩阵、§14.10 测试计划。

## 14.1 目标与边界（R3）

**问题（实测）**：注入日志（`lib/injectionlog.js`）是**进程内环形缓冲、不落盘**；`stats.lastExtract` / `drops` 也是进程内字段；审计里没有"注入 / 跳过"事件。桌面应用一重启，所有"它到底有没有用"的计数归零——积累期结束后无法回答质量决策所需的问题（见 [NEXT_STEPS](../NEXT_STEPS.md) §1.1 的 start gate）。

**目标**：把使用情况变成**跨重启可读**的数据——按天汇总（`days`）+ 按轮次的滚动记录（`recent`），供记忆页与后续质量评估读取。

**边界（明确不做）**：

- 不存注入正文、用户查询、命中记忆正文；只存元数据（白名单见 §14.3，与 §4.2 注入日志同一纪律）。
- 不在注入热路径做同步 I/O：`record()` 只改内存，落盘异步节流，失败不影响注入与对话。
- 不做用户行为分析：只统计插件自身的注入 / 跳过 / 提炼 / 召回。
- **不改变记忆生命周期**：本域是遥测（无记忆正文），按保留期清理不属于 DESIGN §9.9 的"记忆不物理删除"约束；也不进入检索、注入、关系判断的任何输入。
- **不做实时拦截**：低相关 / 低可信条目的"检测并拒注"是行为变更（改变注入结果，需要评估集证明不误杀），不在本设计内。已登记为**待定条目 R32**（[NEXT_STEPS](../NEXT_STEPS.md) §3.1.2）；本文件只记录质量元数据，不参与注入选择。

## 14.2 数据模型（D1：独立短命域，不升主域版本）

| 项 | 决定 |
|---|---|
| 域名 | `neural_mind_usage`，`version: 1`，`layout: 'per-record'`，`invalidRecords: 'backup-and-skip'` |
| 表 `days` | 每天一条：`{ id: 'u_<YYYY-MM-DD>', date, counters, updatedAt }` |
| 表 `recent` | 最近 **7 天**的**成功注入 + 诊断类跳过**（分层与采样见 §14.3；硬上限 `USAGE_RECENT_MAX` = 2000 条防爆）：`{ id: 'r_<epochMs 13 位>_<seq>', ts, mode, reason, records, chars, sessionId, workspaceLabel, hitIds, items, quality }`；`items` / `quality` 定义见 §14.3 末尾 |
| 计数字段 | `counters: z.record(z.string(), z.number().int().nonnegative())`；键空间见 §14.3。新增键**不升域版本**（值仍是 number），删除键也不影响旧记录读取 |
| 迁移 | 无。新域从空开始；旧版本没有该域 |

**D1 理由**：主域的 `version` 是"旧插件可读性"开关（§1 版本纪律）；为一个诊断域把主域 v3 → v4，会让回滚到 0.6.x 时主域记录被 per-record 后端当 absent 丢弃。独立域 + 打开失败降级，收益相同、风险更小——与 A10 `neural_mind_extract` 的裁决同一理由（见 [§1](01-memory-model.md) 表与字段真相源一段）。

`recent` 的键用 13 位毫秒时间戳保证字典序=时间序，清理时按序删最旧；`seq` 只解决同毫秒冲突。

## 14.3 计数键（canonical keys）

| 键 | 含义 | 触发点（实现时接线） |
|---|---|---|
| `inject.inject` / `inject.resident` / `inject.digest` | 各模式成功次数 | `createInjectionLog().record()` 的 sink |
| `inject.records` / `inject.chars` | 注入条数与字符数合计 | 同上 |
| `inject.relevanceSum` / `inject.relevanceCount` | 注入条目的相关度合计 / 条数（用于算日均相关度） | 成功注入时按 `items[].r` 累加 |
| `inject.confSum` / `inject.confCount` | 可信度（`confidence`）合计 / 条数 | 同上（按 `items[].c`） |
| `inject.lowTrust` / `inject.unverified` | 低可信条数 / 核验未通过条数 | 同上（判定口径见 §14.3 末尾质量元数据） |
| `skip.<reason>` | 跳过次数，`reason` ∈ `SKIP_REASONS` 白名单（`workspace-disabled` / `auto-recall-off` / `no-query` / `pressure` / `inline-timeout` / `search-unavailable` / `no-hits` / `subagent` / `inject-error`） | 同上（`mode:'skip'`） |
| `extract.runs` / `extract.ok` / `extract.failed` | 批次提炼次数 | `lib/extract.js` 落定处（成功 / 失败 / 死信） |
| `extract.facts` / `extract.lessons` / `extract.episodes` / `extract.deduped` | 提炼产物计数 | 同上 |
| `extract.relationAccepted` / `extract.relationRejected` | 关系裁决计数 | 同上（与 `relation-accepted` / `relation-target-rejected` 审计同点） |
| `drop.lowConfidence` / `drop.injection` / `drop.secret` / `drop.oversized` | 过滤丢弃计数 | 现有 `drops` 计数处 |
| `recall.calls` / `recall.expanded` | `memory_recall` 使用次数 / 展开次数 | `lib/tools.js` recall 路径 |

纪律：键名一旦发布即视为契约（面板与评估脚本按名读）；新增键要加进本表，未知键在读取侧原样透传、不报错。`turn.*` 之类后续可选计数不进 S12 范围（加键不需要升版本）。

**跳过原因分层（决定明细怎么写）**：`recent` 按时间只保留 7 天（硬上限 2000 条）。实测本机真实用户回合约 40–90 次/天（开发日峰值 93），加上子代理回合，注入决策约 50–100 次/天——若不分层、每个回合都 1:1 记一条，**停用工作区 / 关掉自动召回 / 子代理**这些"环境类"跳过会迅速占满明细，真正想排查的异常反而被挤掉。所以按原因分两层：

| 层 | 原因 | 日汇总 `days` | 明细 `recent` |
|---|---|---|---|
| 环境类（预期内、低信息量） | `workspace-disabled`、`auto-recall-off`、`subagent` | 计数（回答"今天有 N 个回合因为这个原因没注入"） | **不写**（避免刷屏；也避免把停用工作区名写进遥测） |
| 诊断类（值得回看单次） | `no-hits`、`pressure`、`inline-timeout`、`search-unavailable`、`inject-error` | 计数 | 写；`no-hits` 每天最多 `USAGE_RECENT_NO_HITS_DAILY_MAX`（20）条，超出只计数；其余原因不设额外上限（本来就稀少） |
| 成功注入 | `inject` / `resident` / `digest` | 计数 | 全部写（这是最有价值的样本） |

推论：停用工作区仍会出现在日汇总的 `skip.workspace-disabled` 里（否则"这个工作区为什么一条注入都没有"无法解释），但**不产生每回合明细**；按工作区看注入量用 `recent` 里的 `workspaceLabel`（只含启用工作区）。高频但仍需采样的 `no-hits` 也不会把明细挤爆。

**注入质量元数据（R3 扩展，2026-11-10 定）**：成功注入的明细额外带逐条质量分量——**只记录、不参与排序与过滤**（实时拦截见 R32 待定）。字段直接取检索 / 记录里已有的原始量，不另造"可信度公式"：

| 字段 | 含义 | 来源 |
|---|---|---|
| `r` | `relevance`：BM25 + 向量 RRF 融合相关度 | `search()` 命中行 |
| `s` | `score`：乘过时间衰减 / 证据 / 籍贯 / 状态的最终分 | 命中行 `parts` |
| `c` | `confidence`：提炼 / 模型自报可信度（0–1） | 记忆记录 |
| `e` | `E`：证据净值（印证 − 质疑，带时效） | `parts.E` |
| `src` | `source`：user / code / tool / assistant / quote / unknown | 记忆记录 |
| `k` | `kind`：fact / lesson / episode | 记忆记录 |
| `v` | 代码类记忆的锚核验结果（通过 = `true` / 未通过 = `false`；不适用则省略该字段） | 注入前核验 |

聚合到 `quality`：`{ n, rAvg, rMin, sAvg, cAvg, cMin, eAvg, lowTrust, unverified }`。判定口径（写死，供面板分档与统计）：

- **低可信**：`src` ∈ {assistant, unknown, quote}，或 `c < 0.5`，或 `e < 0`；
- **高可信**：`src` ∈ {user, code, tool} 且 `c ≥ 0.6` 且 `e ≥ 0`；
- 其余为中等。

展示分级只用于面板提示，**不进排序、不进过滤、不改注入结果**；阈值是初值，随评估数据校准（校准时只改展示，不改行为）。不记录闸门余量（gate margin）：那需要把检索切到诊断模式、给热路径多加映射拷贝，留到 R19 需要时再评估。

## 14.4 写路径（失败隔离）

- `record(mode, payload)`：同步更新内存日计数 + 内存环形缓冲，然后**只**设置 dirty 标记；绝不 await、绝不抛错（整体 `try/catch` + `bestEffort`）。明细是否入 `recent` 按 §14.3 的分层与采样上限判定（环境类只进日汇总）。
- 落盘：debounce `USAGE_FLUSH_DEBOUNCE_MS`（3 s）合并写入——`days.put` 当天那条、`recent.put` 增量条目；dispose 时再同步 flush 一次（超时 1 s，不阻塞退出）。
- 写入失败：保留内存计数，下个 flush 重试；进程内首次失败写一行 stderr + `health.warnings` 一条 + 审计 `usage-write-failed`（每天至多一条，防刷）。
- 域不可用（打开失败 / `usageLog=false`）：观测退回纯进程内（即 0.6.6 现状），`/neural-mind/api` 的 `usage` 动作报 `available:false`，页面显示"用量未落盘"。

## 14.5 保留与清理（D2）

| 数据 | 频率 | 上限 | 清理时机 | 审计 |
|---|---|---|---|---|
| `days` | 每天一条 | `usageRetentionDays`（默认 30 天；`0` = 不清理） | 启动 + `USAGE_TRIM_INTERVAL_MS`（6 h）定时 | 每次实际删除写一条 `usage-pruned`（天数 / 条数） |
| `recent` | 每次成功注入 / 诊断类跳过一条（§14.3 分层） | **7 天**（`USAGE_RECENT_DAYS`）+ 硬上限 `USAGE_RECENT_MAX`（2000 条） | 每次 flush 后：先删超龄，再删超量的最旧 | 合并进同一条 `usage-pruned` |

体积预算：`days` 约 1–2 KB/天 × 30 天 ≈ 60 KB；`recent` 每条约 0.75 KB（含质量元数据），正常一周 350–700 条约 0.3–0.5 MB，硬上限 2000 条约 1.5 MB。设计不引入"体积上限"配置——上限由天数与条数表达。

**D2 理由**：R3 的价值在"最近一段时间的趋势"，不是无限归档；汇总 30 天 + 明细 7 天覆盖"积累期 + 回看一周"的判读需求（7 天与 start gate 的跨重启观测窗口对齐），且清理规则可审计、可解释。

## 14.6 读路径（API / UI）

沿用现有同源 + `x-neural-mind-client` 头校验；不改路由。

| action | 参数 | 返回（形状契约） |
|---|---|---|
| `usage` | `{ days?: 1..90 (默认 14), recent?: 1..100 (默认 20) }` | `{ ok, available, days: [{ date, counters }], totals: { counters, quality: { rAvg, cAvg, lowTrust, unverified } }, recent: [{ ts, mode, reason, records, chars, sessionId, workspaceLabel, items, quality }], retention: { days, recentMax } }` |
| `pool` | `{ refresh?: boolean }` | R9 只读统计，见 §14.7 |
| `stats` | 不变 | 增加 `usage: { available, today: { counters } }` |
| `overview` | 不变 | 增加 `usage: { available, today, lastInjectAt }`（总览卡用） |

UI（最小改动，全部只读）：

- 总览卡「最近注入」的数据源优先用 `usage.recent`（跨重启可读）；不可用时退回进程内 `injectionLog.list()`（首次启动 / 域故障）；
- 总览卡新增「用量」小组件：今日注入 / 跳过 / 提炼计数 + 保留策略一行；不做图表、不做导出；
- 「最近注入」每条显示质量摘要：`相关 0.72 · 可信 0.81（高）`——相关度用 `rAvg`、可信度用 `cAvg` 与 §14.3 的三档判定，**只做展示**；
- 记忆 / 召回页签不改语义（本版只加统计，不加编辑入口）。

隐私口径：`recent` 沿用进程内日志的字段集，**不新增** workspaceId / 路径；`sessionId` 落盘时截短为末 8 位（面板本来也只显示短 id）；`hitIds` 是记忆 id，不含正文；`items` 只有 id + 数字 / 枚举（相关度、最终分、可信度、证据净值、来源、类型、核验结果），**不含任何正文或查询文本**；`workspaceLabel` 与审计同级。

## 14.7 R9 只读统计口径（`pool`）

| 指标 | 口径 | 成本控制 |
|---|---|---|
| 条数 | `memories` 按 active/staged/archived/hidden、`hotbuffer` 未消化数、`outbox` pending/dead、`audit` 总数与最早时间 | 全表 O(n)，结果缓存 `USAGE_QUERY_CACHE_MS`（60 s） |
| 体积估算 | 每表 Σ `Buffer.byteLength(JSON.stringify(value))`，标注"估算，非磁盘占用" | 同上；扫描超过 50k 条即停并标 `partial:true` |
| 重复候选 | 按 `kind + normalized(entity) + content 前 40 字符` 分组，只报组数与最大组条数（**不列正文、不在结果里回溯内容**） | 同上 |
| 过期候选 | `state` 超宽限期、`validUntil` 超期 + 7 天、`archived` 超 `archiveDurationDays` 的计数 | 同上 |
| 队列健康 | `outbox` 最老 pending / dead 年龄、`hotbuffer` 未消化数 | 同上 |

**纪律（写死）**：

- 只读：不 `update` / 不 `delete` / 不写审计；缓存只在内存，不落盘。
- 不在注入 / 写入 / 检索路径调用；只有 API 动作与页面打开触发。
- 清理动作（R9 后半"待整理队列清理 / 彻底失败重放"）**不在本设计内**：S16 另立设计，显式工具 + 用户确认，且不自动删记忆。

## 14.8 配置与存储影响

- 新增 **2 项配置**（实现时同提交更新 `lib/config.js` 与 [§10 账本](10-config-ledger.md)，**68 → 70**）：
  - `usageLog`（boolean，默认 `true`，高级）：使用遥测落盘总开关；关闭 = 退回纯进程内（0.6.6 行为）。
  - `usageRetentionDays`（number，默认 `30`，高级）：汇总保留天数，`0` = 不清理。
  - 常用层不变（README 的"常用层"声明不受影响）。
- 存储：新增独立域 `neural_mind_usage`（v1），不升主域版本，无迁移。
- 常数组（不进配置）：`USAGE_RECENT_DAYS=7`、`USAGE_RECENT_MAX=2000`、`USAGE_RECENT_NO_HITS_DAILY_MAX=20`、`USAGE_FLUSH_DEBOUNCE_MS=3000`、`USAGE_TRIM_INTERVAL_MS=6h`、`USAGE_QUERY_CACHE_MS=60_000`。

## 14.9 降级矩阵

| 故障 | 表现 | 留痕 |
|---|---|---|
| `storageDomain` 服务缺席 | 观测退化为纯进程内（与 0.6.6 一致） | 启动 stderr 一行（现有路径） |
| usage 域打开失败 / 超时 | 同上；主域读写照常 | stderr 一行 + `health.warnings` |
| 写盘失败 | 内存计数继续，下个 flush 重试 | 首次 stderr + 审计 `usage-write-failed`（每天至多一条） |
| `usageLog=false` | 不落盘、域可空开 | 无（配置即意图） |
| API 动作抛错 | 该动作 500，其余动作不受影响 | 现有 API 错误路径 |

## 14.10 测试计划（实现验收）

- 单测：本地日键跨天边界；计数字段与键白名单；debounce 合并（注入假时钟/手动 tick，不 sleep）；`days` 保留天数、`recent` 按 7 天裁剪与 2000 条硬上限；trim 审计只写一条；**停用工作区 / 关召回 / 子代理只进日汇总、不写明细**；**`no-hits` 明细每日采样上限**；**质量元数据：逐条字段齐全（`r/s/c/e/src/k/v`）、`quality` 聚合正确、低可信 / 未核验计数、只记录不影响注入结果（同一批命中在遥测开/关时注入文本一致）**；域打开失败 / 写失败降级；`usage` 与 `pool` 动作的形状；`partial` 与缓存行为。
- 客户端：`pretest` 的 bundle 新鲜度 + 总览卡契约测试（数据源切换与 fallback）。
- 门禁：`npm test` 全绿；`check:ledger` **70/70**；`check:design` P0 + P1（本文件与代码同提交）；`check:seams` 无变化；`verify:release` 照常。
- 不做：定时器真实等待、无边界压力测试（体积预算按明细天数 + 条数硬上限表达）。

## 修订记录

- 2026-11-10：初稿（S12 设计；R3 全量 + R9 只读部分）。待用户确认后实现；R9 的清理动作留 S16。
- 2026-11-10：v2——补**注入质量元数据**（逐条 `r/s/c/e/src/k/v` + `quality` 聚合，只记录不拦截）；版本归属定为 **0.6.7**（用户裁决，单独发布）；R32「实时拦截」登记为待定（NEXT_STEPS §3.1.2）。
- 2026-11-10：**S12a 落地存储核心**——`lib/schema.js` 新增 `neural_mind_usage` 域 spec（`days`/`recent`，v1）、`lib/store.js` 按独立域打开（失败退化进程内）、`lib/usage.js` 计数 / 明细分层 / read-merge-write 落盘 / 保留裁剪 / 快照 / `poolStats`；新增测试 8 条。API 与页面接线见 S12b/S12c。
- 2026-11-10：**S12b 接线**——2 项配置（`usageLog`/`usageRetentionDays`，账本 68→70）；`injectionlog` 旁路 sink；`inject` 附质量元数据；`extract`/`tools` 计数；`/neural-mind/api` 新增 `usage`、`pool`，`stats`/`overview` 带 usage 块；boot 装配与 dispose 补 flush。
- 2026-11-10：**S12c 客户端与验收**——总览卡「最近注入」优先读落盘明细（失败退回进程内）、新增只读「使用量」卡（今日计数 + 质量均值 + 保留策略）、注入行显示「相关 / 可信 / 低可信」；`lib/client.js` 重建（311,964 B）；全套测试 **379/376/0/3**。
- 2026-11-10：**关停期静默**——宿主可能先关存储域再走插件 cleanup；`dispose()` 改为 quiet flush，域已关闭时只记 `status.error` 不写 stderr（E2E `plugin-stderr-empty` 回归），并补一条单测。
