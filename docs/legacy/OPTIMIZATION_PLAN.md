# 记忆插件优化与 DeepSeek Harness 适配规划

> **遗留文档**：本文是 2026-10-27 审计后的规划原始版，不反映当前状态；正文冻结，不再修改。
> 实施状态：**部分实施**（D1/D3 已交付；B1–B3 未闭环；C/E 未做；§13 的完成状态已被后续计划取代）。
> 现行入口：[STATUS.md](../../STATUS.md) · [NEXT_STEPS.md](../../NEXT_STEPS.md) · 历史索引 [README](README.md)。

> 文档版本：v1.5  
> 规划日期：2026-10-26  
> 插件基线：`dsh-plugin-memory 0.5.0`  
> 代码基线：`f0ec867eeb41bfcf7f07f3375be7e74883d25f38`  
> 当前认证宿主：`@deepseek-ai/dsh-desktop 0.2.1-rc.3`，build `be72761ee1a6`，Node `24.21.0`  
> 文档状态：**第一批（A1-A10 + B1-B3）已实现并通过门禁；C/D/E 未开始**
>
> **2026-10-27 独立审计后修正**：§13 的“B1-B3 已完成”不再成立（B1 无冻结集、B2 无基线、B3 未覆盖升级/热重建/默认提炼）；A9/A10 仍有未闭环路径。后续实施顺序、修复方案与验收以 `FOLLOWUP_PLAN.md` 为准。

本文用于指导后续提高记忆写入、检索和上下文注入的效率与准确度，并把当前 DeepSeek Harness 的安装、启动和真实对话兼容性作为每个阶段的发布门禁。

相关文档分工：

- `DESIGN.md`：产品机制与设计合同。
- `IMPLEMENTATION.md`：历史实现、实验和评审记录。
- `HANDOFF.md`：当前宿主兼容修复、接缝事实和升级注意事项。
- `README.md`：安装、配置、使用与验证入口。
- 本文：后续优化的实施顺序、量化指标、验收矩阵和回滚纪律。

若本文与当前代码或真实宿主行为不一致，以代码和可复现的宿主验证为准，并同步修订本文。

---

## 1. 执行摘要

当前插件已经具备完整的热缓冲、慢速提炼、混合检索、动态注入和证据生命周期机制，并已在本机当前 Harness 上通过隔离安装与真实对话测试。因此，后续不采用重写架构、替换数据库或引入重型向量索引作为起点。

优化按以下顺序推进：

```text
P0 正确性修复
  → 可信评估、性能基准、打包发布门禁
  → 有证据的局部性能优化
  → 保守去重与关系裁决
  → 检索/注入参数调优
  → 当前 Harness 全矩阵发布验收
```

核心原则：

1. **先修正确性，再谈效率和调参。**测试全绿不等于工具可见性、预算账目和索引一致性没有问题。
2. **先对齐评估仪器，再比较优化前后。**评估脚本自身的 MRR 错误和 live pool 漂移必须先解决。
3. **优化不得绕过隐私、主体和时间边界。**语义相似度不能单独成为合并记忆的依据。
4. **所有性能索引都必须可差分验证。**原全量扫描实现暂时保留为测试 oracle。
5. **每个阶段独立交付、独立回滚。**第一阶段不迁移存储格式，不改变公开工具参数。
6. **只认证实际验证过的宿主。**当前门禁针对 `0.2.1-rc.3`，不外推为未来 Harness 的兼容承诺。

---

## 2. 目标、非目标与约束

### 2.1 优化目标

#### A. 记忆效率

覆盖三个层面，而不只关注检索耗时：

- **写入效率**：减少重复记录、无效 reinforce、重复 embedding 和不必要的存储增长。
- **检索效率**：降低全量扫描、重复向量范数计算和无效候选过滤带来的 CPU 与延迟。
- **上下文效率**：在相同或更低注入字符预算下，提高有效记忆占比，减少重复、过期和弱相关注入。

#### B. 记忆准确度

- 提高真实注入路径的 Recall@1、Recall@5、MRR 和困难负例表现。
- 保持不同主体、不同时间和冲突事实的边界，降低错误合并与错误取代。
- 修复 recall/forget、注入渲染二次引用、关系写回、hard forget 级联、待提炼 outbox 和 embedding 出站的工作区与隐私语义，确保“能查到”“能遗忘且不复活/不出站”“能引用”都符合同一作用域合同。
- 保证任何持久写回后持久记录与当前进程的检索索引一致。

#### C. 当前 Harness 适配

- 候选包必须能在当前 DSH Desktop 上安装、加载、重启和热重建。
- 默认配置不得依赖外部 embedding 服务才能正常启动。
- 注入消息必须继续通过 Session V4 编解码器，历史 V3 数据保持读侧兼容。
- 设置页、volatile 配置、存储降级和 embedding 降级不得因优化而失效。

### 2.2 非目标

本轮不默认开展以下工作：

- 不重写 L0/L1/L2、SOUL 或证据生命周期架构。
- 不替换为 SQL/向量数据库，不引入原生 ANN 或重型运行时依赖。
- 不用 LLM 重排替代当前 BM25 + 向量 + RRF 基线。
- 不改变“记忆不物理删除”的既有威胁模型和审计语义。
- 不进行设置页大规模改版。
- 不在没有基线时承诺固定百分比的准确率或性能提升。
- 不宣称兼容尚未验证的 Harness 版本。

这些方向只有在本文规定的基准证明现有局部优化仍不足时，才可另行立项。

### 2.3 必须保持的兼容约束

1. **Session 接缝**：写侧使用 V4 生产者来源 `plugin:dsh-plugin-memory`；读侧继续接受历史 V3 包装形状。
2. **宿主服务纪律**：必需服务继续走 `ctx.inject`，可选服务继续走 `ctx.get` 并保留降级行为。
3. **浏览器产物**：`lib/client.js` 是宿主直接读取的成品字节；改动 `lib/client/` 后必须重新构建并验证 bundle 新鲜度。
4. **存储兼容**：domain 当前版本 2、兼容版本 1；第一阶段不做破坏性迁移，不假设跨表事务。
5. **公开工具合同**：优先保持 `memory_recall`、`memory_remember`、`memory_forget` 的参数和返回语义稳定。
6. **owner 与 agent 分离**：设置页的 owner 全池管理不能被误套用 agent 的 `eligible` 过滤；owner 搜索必须走显式全池模式，不能用空 `current` 冒充；agent 工具也不能通过空 `current` 获得跨域能力。
7. **暂不添加 `engines.dsh`**：prerelease semver 容易误挡后续 rc；如未来添加，必须单独用 `dsh plugin add` 实测精确范围。
8. **不猜宿主字段**：特别是 tokenMeter/contextWindow，必须有当前宿主接缝证据和形状测试。
9. **遗忘闭环**：hard forget 必须覆盖 L0、待提炼 outbox、trajectory/expandOriginal 和 embedding 出站；不能只改记录状态。
10. **隐私路径规范化**：`privateWorkspaces` 与 workspaceId 使用同一规范化（分隔符、大小写、realpath），Windows 正斜杠/尾随反斜杠都必须生效。

### 2.4 产品决策：检索固定 global（2026-10-27）

- 删除 `scope` 配置与 `scope='workspace'` 检索分支，检索固定为 global；不再提供“只搜当前 workspace”的模式。
- workspace 仍保留为来源标签、排序（remoteFactor/coldStart/entity）和 `privateWorkspaces` / `sensitiveNoCross` 的边界；它不是会话隔离，跨会话和跨项目记忆照常可召回。
- 旧配置里残留的 `scope: workspace` 必须验证加载行为：忽略并留一行 stderr/审计，或提供一次性迁移；不能让旧 profile 因未知字段启动失败。若 Schemastery 对未知键报错，需保留一次性兼容解析。
- 同步修改 `lib/config.js`、`lib/search.js`、设置页配置卡/客户端产物、README、DESIGN 配置账本和 `check-config-ledger` 计数；客户端源码改动后必须重建 `lib/client.js`。
- 本决策**不**包含删除 `privateWorkspaces` 或 `sensitiveNoCross`；它们仍负责“只进不出/敏感不跨域”。若也要删除，需另立产品决策并同步威胁模型与文档。

---

## 3. 当前架构与已验证基线

### 3.1 关键链路

```text
session/event
  → TurnTracker 归一回合
  → outbox.register
  → L0 hotbuffer.writeTurn + 检索 corpus
  → 后台 extract/LLM 关系裁决
  → L2 memories + BM25/向量 corpus
  → agent/pre-step 检索、预算、锚核验
  → Session V4 动态消息注入
```

检索当前由 BM25、可选 embedding 向量路、RRF 融合和证据/时间/工作区系数组成。显式工具路径包括 remember、recall、forget；这些路径必须和动态注入遵守一致的隐私与作用域边界。

### 3.2 本次实际验证结果

| 验证项 | 当前结果 | 证明范围 |
|---|---:|---|
| 单元/集成测试 | 174 通过 / 0 失败 / 3 跳过，共 177 项 | 插件内部合同、客户端契约、存储降级等 |
| 宿主静态接缝 | 46/46 | 当前 app.asar 中所需 API、声明和 Session 接缝存在 |
| Session V4 形状门禁 | 9/9 | 插件写侧消息被真实宿主编解码器接受，读侧 fixture 匹配 |
| 隔离安装与真实对话 E2E | 24/24 | 本地包安装、remember、跨会话注入、日志持久化、turn 完成 |
| 默认配置冒烟 | 26/26 | extract/SOUL 开启；SOUL system 消息断言；headless 后台提炼仍有固有时序限制 |
| 代码与文档声明检查 | 28 项，0 不一致 | 现有机械声明未漂移 |
| 配置账本 / 接缝 / client bundle | 零差异 / 12 项通过 / 最新 | 配置、接线和浏览器产物未漂移 |
| release matrix | tarball 安装 + 两轮 E2E 通过 | npm pack → 隔离 DSH → 对话 + 默认配置冒烟 |
| 工作树 | 实施后存在代码改动 | 基线验证在改动前完成；当前改动待提交 |

验证使用隔离 `DSH_HOME` 和本地 mock LLM，没有安装或修改真实桌面 profile。当前三个跳过项实际构成为：1 项是 Windows 无 `/bin/sh`（sidecar 预热用例），2 项是本机不能建 symlink；不允许借本次优化新增无理由跳过。`README` 对跳过项的说明需同步修正。

### 3.3 尚未建立的基线

以下数字当前不能视为已测量结论：

- 优化前后的 Recall@1、Recall@5、MRR 和负例误注入率。
- 不同语料规模下 search/inject 的 p50、p95、CPU 和 RSS。
- 每百轮对话的提炼调用数、embedding 调用数和重复记录增长率。
- 默认配置打包产物的完整安装矩阵。
- 本轮单独重跑真实桌面设置页的浏览器 E2E；`HANDOFF.md` 中既有 16/16 记录不能替代候选版本复验。

因此，性能与准确率调参必须在第 5 阶段所述基准完成后开始。

---

## 4. 问题清单与优先级

优先级定义：

- **P0**：正确性、隐私、预算或索引一致性缺陷；必须先修。
- **P1**：直接影响效率、准确度和发布可信度；完成 P0 后实施。
- **P2**：需要额外宿主证据或基准证明的增强；不阻塞第一批修复。

| ID | 级别 | 代码事实与位置 | 主要影响 |
|---|---|---|---|
| A1 | P0 | `lib/tools.js:109-159` 普通 recall 未传 `current`；search 默认 workspace 为空 | private/sensitive 被误过滤，排序/coldStart 失真；`scope=workspace` 下全空（该模式按 §2.4 在 A1 移除） |
| A1 | P0 | `lib/tools.js:121-146,293-353` ID recall、ID forget、related forget 直读/直写；ID recall 还会 `expandOriginal` 展开来源会话原文 | 绕过 `lib/search.js:100-120` 的统一可见性判断，可能跨域回显、展开原文或修改 |
| A1 | P1 | `lib/tools.js:149-160` 允许 time/session-only；`lib/search.js:180-188` 空 query 只走 BM25；`lib/bm25.js:79-80` 空 token 返回空 | 纯时间窗/纯 session 的 recall 实际不可用，与工具描述不符 |
| A1 | P1 | `lib/workspace.js:65-67` 与 `lib/search.js:36-39` 的 private 判定只认 `/`；`lib/workspace.js:28-30` cwd 缺失共享 `(unknown)` | Windows 正斜杠/尾随反斜杠下 privateWorkspaces 失效；`(unknown)` 跨会话边界失效 |
| A2 | P0 | `lib/inject.js:462-463,487-488` 同一文本重复累加 `usedChars`；常驻 lesson 每轮追加并计入；压力路径不登记 `injectedMsgs`；`injectedMsgs` 以全文 sha1 为键 | 会话预算提前耗尽且会长期漂移，压缩回冲不准，长会话后期普通记忆断供 |
| A2 | P0 | `test/pipeline.test.mjs:884-910` 使用高证据 confirm 记忆 | 高证据例外绕过 session 上限，现有测试对重复计账假绿 |
| A2 | P1 | `lib/inject.js:377-379,419-429` 兜底消息与核验后变长的文本未计入；`sessionState` 在热重建/agent disposed 后重置 | 预算可被漏记文本顶破；重启后重复注入与压缩回冲失效 |
| A3 | P0 | `lib/embed.js:174-200` 重嵌入只更新 store；`lib/index.js:224-227` 未传 search；`lib/tools.js:186-195`、`lib/inject.js:465-486` 续期只写 store | store 与 corpus 不一致（旧向量/旧 expiresAt），直到重启或偶发写回刷新 |
| A4 | P0 | `lib/config.js:122-124` 分块参数交叉约束不足；`lib/embed.js:9-20` 依赖正 stride | 非法配置可能造成循环不前进或倒退 |
| A5 | P0 | `lib/inject.js:90-107` `supersededBy`、争议对端经裸 `search.get` 读取；`supersededBy` 只查 hidden，dispute 查 hidden+archived | 二次引用绕过 private/sensitive/workspace/archived，跨域正文可泄露；soft-forgotten/archived 取代者仍可能被引述 |
| A5 | P1 | `lib/search.js:309-361` residentLessons/openingDigest 绕过 `renderHit`；`lib/inject.js:455-459` 直接输出 content | 已取代 lesson、过期 state、超期 episode、逾期 todo 仍以“约定/近期动态”展示 |
| A6 | P0 | `lib/tools.js:303-307` + `lib/hotbuffer.js:131-139` hard forget 对无 `sourceRange` 的记忆级联隐藏整会话 L0 | 只想忘一条却屏蔽同会话全部近期上下文；sourceRange 是批次级，可能隐藏整批 |
| A7 | P0 | `lib/extract.js:293-345` 关系写回按 LLM `targetId` 直写，无候选 allowlist/同域/可见性检查；`reinforce` 与 `contradict` 的 challenge 分支都不要求 `created` | 可越权修改任意已知 ID；私有/敏感目标被改写；被过滤事实仍能刷证据 |
| A8 | P1 | `lib/api.js:137-143` owner 搜索传空 `current`，`lib/search.js:157-166` 触发 coldStart；`rowOf` 缺 private/workspaceId | private/sensitive 搜不到；global 小池也会因 coldStart 掉同域结果；客户端无法标记 private |
| A9 | P0 | `lib/tools.js:317-333` 只改 hotbuffer.hidden；`lib/extract.js:82-100` turnText 不检查 hidden；outbox 未 skip | hard-forgotten L0 会被待提炼 outbox 复活为 active L2 |
| A9 | P0 | `lib/tools.js:28-107` trajectory/expandOriginal 直读 sessionQuery，不查 hidden | hard-forgotten 原文仍可经 trajectory 或 sourceRange 展开读出 |
| A9 | P0 | `lib/embed.js:183-195` 重嵌入遍历全部；`lib/util.js:173-185` 无 hidden/private 检查 | hidden/private 内容在重嵌入或 L2 写入时被发送到外部 embedding 服务 |
| A10 | P0 | `lib/extract.js:427-547` 任一记忆带 `batchKey` 即跳过整批；`lib/outbox.js:47,104-114` 退避后重启不重试 | 崩溃半批丢剩余事实；瞬时失败后提炼可能永久停住，outbox 却被标完成 |
| B1 | P1 | `tools/inject-eval.mjs:71` 只在 `idx > 0` 时累计 MRR；失手分类把“目标不在池”和“未进候选路”混在一起；另有死代码 | top-1 命中未计入 MRR；候选路准入没有被真正测量 |
| B1 | P1 | `tools/eval-fixtures.mjs:13` `loadPool` 固定 `~/.dsh`、不尊重 `DSH_HOME`；绑定 live pool ID；`loadPool` 只收 active | 评估可能读真实池、无法在隔离 home 复现；staged 路径缺席 |
| B3 | P1 | 当前 E2E 从仓库目录安装并关闭 extract/SOUL；mock 不返回提炼 JSON，默认 6 轮才提炼，临时 home 无 SOUL 文件，也无上一发布包 | “默认配置 extract/SOUL 冒烟”当前不可执行；打包/升级场景未被证明 |
| C1 | P1 | `lib/search.js:155-166,208-224` 每轮统计和向量路全量扫描，范数重复计算 | 语料和向量维度增大时 CPU、延迟和超预算率上升 |
| C2 | P1 | outbox、hotbuffer、batchKey 等路径存在全表查找 | 可能在写入和提炼积压时放大成本；需 profile 确认 |
| D1 | P1 | remember 与跨批 extract 没有统一内容/语义去重 | 重复存储、重复 embedding、检索噪声和证据膨胀 |
| D3 | P1 | 同一事实的 L0 全文与 L2 原子事实可在同轮注入（当前 E2E 已出现）；D3 还负责检索/注入调参 | 重复展示、上下文效率下降；D1 的写入去重无法覆盖 L0 |
| E1 | P2 | 当前 tokenMeter 返回无 ratio/limit，`pressureRatio` 通常无法计算 | `injectPauseThreshold` 结构性不生效，字符预算仍是主要兜底 |
| E2 | P2 | sidecar watchdog 依赖 `/bin/sh`，Windows 默认未提供 | 仅影响显式启用 autoStart 的场景；默认空命令不影响普通安装 |

A5-A7 是上一轮审核新增的 P0；A9-A10 是第三轮审核新增的 P0；A2/A3/A5/A6/A8/B1/B3 的范围已扩大；C3 的正确性部分并入 A10，C3 仅保留性能索引；D4 并入 D3。A9/A10 必须在第一阶段与 A5-A7 同批完成。

第三轮审核的 P2 补充：A6 的 `sourceRange` 是批次级、A5 需断言 hidden 对端 ID 不出现、A7 的 `contradict` 同样缺 `created` 校验、B1 的 `loadPool` 无视 `DSH_HOME`、store open 超时晚成功不关闭、`sessionState` 热重建后重置、`missingStreak` 无清理、API list/stats/related 全表扫描、release matrix 缺上一发布包。分别归入对应工作包与测试矩阵，不单列为 P0。

另有一个观察项：`storageDomain.open` 超时后底层异步打开是否可能晚成功并遗留句柄，需要专门测试证实。在获得证据前，不把“资源泄漏已发生”写成事实，也不为此重写存储层。

### 4.1 P1 问题说明与排序

P1 不直接构成隐私或正确性阻断，但会决定效率、准确度与发布可信度。按外部表现分三组：

**用户直接感知**

- **A8 owner 搜索**：列表能看到 private/sensitive 记忆，搜索却找不到；global 小池还可能被 coldStart 压掉同域结果。用户会认为“记忆明明在，却丢了”。
- **A1 filter-only/路径**：纯时间窗或纯 session 的 recall 实际返回空；Windows 正斜杠/尾随反斜杠下 privateWorkspaces 失效，`(unknown)` 又可能让不同会话共享边界。
- **A5 常驻/摘要渲染**：已取代的旧 lesson 仍作为“一直在场的约定”，过期 state/逾期 todo 仍作为“近期动态”展示。
- **D1 写入去重**：同一事实重复 remember 或被多次提炼后留下多条近似记录；表现为记忆越用越多、越搜越乱、存储和 embedding 成本上升。
- **D3 L0/L2 跨层重复**（原 D4）：同一事实以 L2 原子事实和 L0 整轮副本同轮注入两次；表现为同一件事被说两遍、上下文预算被浪费。
- **A2 预算漏记**：兜底消息、核验后变长文本未计入；`sessionState` 在热重建后重置，可能造成重启后重复注入或回冲失效。

**评估与发布可信度**

- **B1 评估仪器**：MRR 漏算 top-1，失手分类把“目标不在池”和“未进候选路”混在一起，live pool 漂移、`loadPool` 无视 `DSH_HOME` 且 staged 不在评估池；表现为指标变了却说不清是检索变好还是仪器变了。
- **B3 发布门禁**：当前 E2E 从仓库目录安装且关闭 extract/SOUL；mock 不返回提炼 JSON、默认 6 轮才提炼、无 SOUL 文件、无上一发布包。打包漏文件、默认提炼/SOUL 坏掉可能不被发现，且默认冒烟当前跑不起来。

**规模与性能**

- **C1 检索全扫描**：语料和向量维度增大后每轮检索变慢，内联预算超时会让整轮动态注入跳过；表现为记忆时有时无、池子越大越卡。
- **C2 写路径全表查找**：outbox/hotbuffer/batchKey 全表扫描会在积压时放大写入、提炼和启动对账成本；表现为记忆多了以后写入和提炼变卡，需 profile 确认。
- **C3 查找索引（仅性能）**：outbox/hotbuffer/batchKey 的索引优化只有在 profile 证明瓶颈后才做；batchKey 半批正确性已拆到 A10，不再作为性能项。

排序建议：A8 随 A1 第一批交付；A1 的 filter-only/private 路径、A2 的预算漏记、A5 的常驻/摘要渲染随对应 P0 包一起修；D1/D3 在 A/B 稳定后做；B1/B3 是调参和发布前必须完成的仪器与门禁；C1/C2/C3 等 B2 基准证明瓶颈后再动，不做无数据的提前优化。

---

## 5. 分阶段实施计划

### 阶段 A：P0 正确性修复

阶段目标：消除已知语义缺陷，为后续基准提供可信实现。阶段 A 包含 A1-A10：A1-A7、A9、A10 为 P0，A8 为与 A1 同批交付的 P1 owner 正确性项。每个工作包独立变更、独立回滚，不迁移数据。

#### A1. 统一 agent 工具的 current、可见性、filter-only 与固定 global 检索

**关键文件**：`lib/tools.js`、`lib/search.js`、`lib/workspace.js`、`lib/config.js`、`lib/index.js`、`lib/client/`、`README.md`、`DESIGN.md`、`test/tools.test.mjs`、`test/search.test.mjs`、`test/client.test.mjs`、`tools/check-config-ledger.mjs`、`tools/check-seams.mjs`。

实施内容：

1. 在 recall/forget 执行入口从 `exec.agent.session` 派生 sessionId/cwd，经 `workspace.resolve` 构造统一 `current`。
2. forget 注册处把执行上下文传入 `forgetExecute`。
3. 将 `eligible` 的核心判断以明确的 search helper 暴露，普通搜索、ID 直达和 related 候选复用同一实现。
4. ID recall 保持 `includeArchived: true` 的合法归档读取语义；hidden 仍全域不可见。
5. session/cwd 缺失时不得被解释成跨域通配符；隐私敏感路径采用可诊断的保守拒绝。
6. owner 设置页/API 的 list、confirm、reject 保持显式全池管理语义，不把 agent 过滤无差别套到管理视图；owner 搜索的 `current` 语义单列 A8，不得再用空 `current` 冒充全池。
7. `query` 为空且仅给 `time`/`session` 时走显式的 filter-only 检索：按 `eligible` 枚举语料，按时间/重要度排序并受 limit 约束，不能依赖空 query 的 BM25。
8. ID recall 的 `expandOriginal` 与 query 命中展开必须校验来源会话/区间与当前域一致；不得仅凭 `sourceRange` 读取其他 workspace 的会话原文。
9. `privateWorkspaces` 与 search 的 private 判定统一为同一路径规范化（分隔符、大小写、realpath），Windows 正斜杠/尾随反斜杠都必须生效。
10. cwd/session 缺失或 `workspaceId='(unknown)'` 时不得视为同一域；对已落盘的 `(unknown)` 记录采用保守策略并留审计。
11. 按 §2.4 删除 `scope` 配置与 `search.js` 的 `workspace` 分支，检索固定 global；workspace 继续用于来源/排序/private 边界；旧配置 `scope: workspace` 忽略并留警告/迁移；同步 config、设置页、client bundle、README、DESIGN 配置账本，以及 `check-config-ledger`/`check-seams` 的可编辑面计数。

测试矩阵：

- 固定 global 下的同域与跨域 recall；确认不存在 workspace-scope 分支。
- 旧 profile 含 `scope: workspace` 时正常启动并留警告；设置页不再出现 scope 控件；client bundle 新鲜。
- 本域和跨域 private、sensitive、hidden、archived。
- ID recall、ID forget、query forget、related forget 的文字回显与副作用。
- L0 hot 与 L2 memory 两条 store 兜底路径。
- 纯 time、纯 session、time+session 三种 filter-only recall。
- Windows 三种 privatePaths 写法（反斜杠、正斜杠、尾随反斜杠）、`(unknown)` 跨会话、跨域 expandOriginal。
- owner 列表、确认、拒绝和审计行为不回归。
- 渲染二次引用见 A5；hard forget 级联范围见 A6；关系写回目标边界见 A7；owner 搜索见 A8；hidden 原文/复活/出站见 A9。

完成标准：所有 agent 工具路径使用同一作用域合同，关键跨域负例零泄露、零越权修改；filter-only recall 与 private 路径规范化可用；检索固定 global，旧 `scope: workspace` 配置可兼容加载，设置页/客户端不再提供 scope 控件。

回滚点：工具可见性/过滤补丁可单独回滚；`scope` 配置移除与客户端重建作为一个独立子变更回滚，不涉及存储数据。

#### A2. 修正注入字符账目和回归测试

**关键文件**：`lib/inject.js`、`test/pipeline.test.mjs`。

**决策已定**：常驻 lesson 按 DESIGN“约 200 字符/会话”改为**会话首次注入一次；compaction shadow 后重新注入一次并回冲**。不再维持“每轮注入 + 每轮计费”。如果产品后续要改回每轮注入，必须先变更 DESIGN 与本节，并单列 `residentChars`、独立上限和逐次回冲；本工作包不保留双分支。

实施内容：

- 删除第二次 `state.usedChars += text.length` 和重复的 ID 登记。
- 以最终注入消息文本为唯一事实来源：包裹头、分区标题、行首 `- `、常驻块、检索不可用兜底消息和核验后变长的标记都要被记录；单轮 `injectMaxChars`、会话 `sessionInjectMaxChars` 与压缩回冲使用同一份最终文本账目。
- 常驻块按决策改为会话一次；被 compaction shadow 后重注并回冲，不得每轮重复占用动态预算。
- 压力路径注入同样登记 `injectedMsgs` 与字符数，压缩时可回冲；不能只加 `usedChars`。
- `injectedMsgs` 不再以全文 sha1 作为唯一键：每条注入消息独立登记，保留文本哈希用于压缩匹配，并支持多条相同文本分别回冲。
- 保留召回续期、争议对豁免和实际消息记录。
- 明确并测试 `sessionState` 在热重建/`agent/disposed` 后重置的语义：允许重置，但不得导致预算回冲错账；若产品要求跨重建续算，必须单独设计持久化。
- 为 `missingStreak` 增加清理或上限（agent/disposed 或记录删除时清理），避免缺失锚记录长期增长。
- 用低证据、active、非 staged 记录构造边界：正确账目允许第二轮，双倍账目会拒绝。
- 增加真正超限、staged 例外、highEvidence 例外、常驻块、压力路径、兜底消息、核验标记、包裹头/分隔符和 compaction 回冲用例；压缩后断言预算残余为零。
- 现有 `pipeline.test.mjs` 中常驻、压力、compaction 等使用 `confirm:true` 的用例同样属于高证据路径，应纳入假绿排查，不能只改 `:884-910` 一处。
- 直接断言账目等于受预算约束的实际注入文本总量，不只断言消息数量。内部 `usedChars` 目前不可观测，需增加测试缝或把账目抽成纯函数后单测。

完成标准：单轮、会话累计、常驻块和压缩回冲四类账目一致；动态预算不会被常驻块重复挤占；兜底/核验文本不漏记；既有 staged/highEvidence 例外语义不变。

#### A3. 统一持久写回与内存 corpus 的同步

**关键文件**：`lib/embed.js`、`lib/index.js`、`lib/tools.js`、`lib/inject.js`、`test/embed.test.mjs`、`test/search.test.mjs`、`test/tools.test.mjs`、`test/pipeline.test.mjs`。

实施内容：

- 向 `createReembedder` 注入 search；store 更新成功后，按表类型调用 `upsertMemory` 或 `upsertHot`；更新失败不得覆盖旧索引。
- 新增统一的 memory 写回 helper(或等价纪律)：store 更新成功后才同步 corpus；召回续期、注入命中续期、openingDigest 续期、核验回写、质疑、惰性归档和周期清扫全部走同一实现。
- 保持现有单并发、后台让路和模型指纹逻辑；记录被删除、归档、hidden、digested 或热重建交错时，索引内容与 store 保持一致。
- 嵌入失败、存储更新失败仍可降级并可重试；不得用旧对象覆盖新 store。

测试矩阵：

- 模型切换后无需重启即可用新向量检索。
- state 召回续期、注入命中续期、openingDigest 续期后，`search.get()` 中的 `expiresAt` 与 store 一致。
- 重嵌入遇到归档、hidden、digested、删除或并发写回。
- store 更新失败时不污染 corpus；失败后可重试。

完成标准：任何持久化写回成功后，当前进程的检索 corpus 与 store 一致；模型切换无需重启；失败路径仍可降级。

#### A4. 分块配置与运行时 stride 防线

**关键文件**：`lib/config.js`、`lib/embed.js`、`test/embed.test.mjs`。

实施内容：

- 在配置边界保证 chunkSize 为正、overlap 非负且小于 chunkSize，reembedBatchSize 为正整数。
- 运行时仍保证每次前进步长大于零，防止绕过 schema 的调用形成死循环。
- 非法配置给出可诊断错误；默认配置行为不变。
- 覆盖零、负数、overlap 等于/大于 chunkSize、长文本无遗漏和必然终止。

#### A5. 注入渲染的统一可见性与状态语义

**关键文件**：`lib/inject.js`、`lib/search.js`、`test/pipeline.test.mjs`、`test/search.test.mjs`。

实施内容：

- 为 `supersededBy` 与争议 `targetId` 提供与普通检索一致的二次可见性判断：hidden、archived、private、sensitive、scope 和当前 workspace 全部适用。
- 不可见时只渲染中性标记(如“已被新记录取代”/“存在争议”)，不引述正文、不泄露对端 ID；软遗忘/归档的取代者也不得引述正文。
- 可见的同域对端保持现有“已被新记录取代/存在争议”措辞。
- 渲染引用的查询复用统一 helper，不再使用裸 `search.get()` 绕过 eligible。
- 常驻 lesson 与 openingDigest 不再手工拼接 content：复用 `renderHit` 或共享同一状态渲染函数，至少应用 supersededBy、state 过期、todo 逾期、past 分区和 staged 标记；常驻异地 entity='user' 需标明来源。
- 常驻/摘要若出于缓存原因不参与排序，也必须保留状态语义，不能把已取代的旧约定当作“一直在场的约定”展示。

测试矩阵：

- 同域可见取代者对端正常引述。
- 跨 workspace、private、sensitive、archived、hidden 对端不得出现正文，也不得出现可用于 ID recall 的对端 ID。
- 争议对端与 supersededBy 分别覆盖；固定 global 下的同域/跨域、private/sensitive/archived/hidden。
- 软遗忘取代者、hard hidden 对端和 compact 后的重新注入。
- 常驻 lesson 覆盖 superseded、expired state、staged、异地 entity='user'；digest 覆盖过期 state、超 pastEpisodeDays 的 episode、逾期 todo。
- 断言常驻/digest 不重复显示同一条已被命中通道注入的内容。

完成标准：二次引用零跨域正文/ID 泄露；常驻/digest 不再展示已被取代或已过期的状态；可见对端的渲染语义不回归。

回滚点：仅回滚渲染可见性与状态补丁，不改变存储和关系数据。

#### A6. hard forget 的 L0 级联范围与批次语义

**关键文件**：`lib/tools.js`、`lib/hotbuffer.js`、`test/tools.test.mjs`、`test/pipeline.test.mjs`。

实施内容：

- 明确级联合同：有 `sourceRange` 时只隐藏与该 seq 区间重叠的 L0；`sourceRange` 是提炼批次的首尾 seq，可能覆盖多回合，必须在文档中写明“按来源批次级联”，不能宣称单条事实级精确。
- 无 `sourceRange` 时不得隐藏整会话；优先按同会话内容匹配定位对应 L0，无法定位时只保证记忆本体 hidden，并在审计中说明未级联，禁止“整会话兜底”。
- 若产品要求对 remember 记录也绝对覆盖 L0，必须先为 remember 记录补来源/回合定位，再按定位级联，不能以扩大隐藏面替代定位。
- 级联跨会话/跨 workspace 时加边界判断；审计记录隐藏条数、命中依据和 sessionId。
- L0 被 hard forget 后的 outbox 复活、派生 L2、trajectory/expandOriginal 和 embedding 出站统一由 A9 处理，A6 不单独宣称“遗忘闭环”。
- 补测试：remember 记录 + 两条无关 L0、内容匹配的 L0、extract 记录的 sourceRange 重叠（含批次多回合）、hidden 热条目、跨会话记忆。

完成标准：hard forget 不误伤无关 L0；有范围的级联按批次语义可解释；无范围路径可诊断且不扩大隐藏面；A6 与 A9 同批验收后才能宣称 hard forget 闭环。

#### A7. 关系写回的候选允许列表与可见性

**关键文件**：`lib/extract.js`、`lib/search.js`、`test/pipeline.test.mjs`、`test/search.test.mjs`。

实施内容：

- 关系候选检索结果形成显式 allowlist；LLM 返回的 `targetId` 不在 allowlist 内时跳过并记审计，不得按裸 ID 直写。
- 目标再经过 relation purpose 的 eligible 检查：hidden/archived 拒绝，private/sensitive/scope 规则与普通检索一致。
- 所有关系类型(包括 reinforce 和 contradict 的 challenge 分支)都要求 `created !== undefined`；被清洗/拒收的新事实不得给目标加证据。
- 当前 global scope 下允许跨 workspace 的公共关系时，必须保留上述可见性；D2 若收紧为同 workspace，再单独评估兼容性。
- 目标缺失、已归档、不可见、非 allowlist 分别记可诊断审计；正常关系结果不回归。
- 补测试：allowlist 外 target、跨 workspace private/sensitive target、hidden/archived target、被过滤事实的 reinforce 与 contradict、正常同域 reinforce/contradict/dispute。

完成标准：关系写回零越权、零私有/敏感目标修改；被过滤事实零证据写入；合法关系语义不回归。

回滚点：仅回滚关系写回补丁；不删除既有关系数据。

#### A8(P1). owner 设置页搜索的 current 语义

**关键文件**：`lib/api.js`、`lib/client/browse-card.js`、`test/settings.test.mjs`、`test/client.test.mjs`。

**合同已定**：按 §2.3 第 6 条固定为**显式全池**，与 list/audit 的所有者视图一致；不再保留“agent 可见性”分支。若未来要改成 agent 可见性，必须先改 §2.3、§6.2 和本节的验收标准。

实施内容：

- 不得再用 `current: { workspaceId: '', sessionId: '' }` 冒充全池；owner 搜索走独立的 `purpose:'owner'` 或等价显式模式。
- owner 模式必须显式关闭 coldStart、remoteTighten 和 entityBoost，或传入真实的“管理视图当前工作区”；不能让空 workspace 把 global 小池的同域结果压掉。
- 检索固定 global 后，owner 搜索仍不得让管理视图受 agent 的 current/冷启动影响；不得重新引入 workspace-scope 分支。
- `rowOf` 增加 private/workspaceId（或等价标记）字段，客户端按合同展示 hidden/private/sensitive 标记。
- 明确 hidden 在 owner 管理视图中的例外：`trajectory/recall/inject` 仍全域不可见，但 owner list/search 可展示并标记；同步修订 DESIGN 与 README 的 hidden 全域规则表述。

测试矩阵：

- global 小池（coldStart 边界）、private/sensitive/hidden；owner 搜索结果与 owner list 的可见集合一致。
- 同一语料在 owner 与 agent 两种模式下的结果差异符合合同；owner 模式不受 coldStart/remoteFactor 影响。
- rowOf 字段与客户端标记；API 同源校验不回归。

完成标准：owner 搜索与 owner 列表语义一致；global 小池不被 coldStart 误压；不会把 agent 的 eligible 过滤误套到管理视图。

#### A9. hard forget / private 的全通道闭环

**关键文件**：`lib/tools.js`、`lib/extract.js`、`lib/turns.js`、`lib/embed.js`、`lib/util.js`、`lib/hotbuffer.js`、`test/tools.test.mjs`、`test/pipeline.test.mjs`、`test/embed.test.mjs`。

这是第三轮审核新增的 P0。A6 只处理 L2 → L0 的级联；A9 负责 L0 → outbox/L2、会话原文读取和 embedding 出站。

实施内容：

1. **隐藏区间与复活防护**：
   - hard forget L0 时，除 `hotbuffer.hidden=true` 外，必须把同 session/turn/seq 的待提炼 outbox 置为 `skipped`（或等价终止态），并从 `TurnTracker` 丢弃该回合缓存；`extract.turnText`/`flushSession` 遇到 hidden L0 或 forgotten 标记必须跳过。
   - hard forget L2 时，从 `sourceRange` 派生隐藏区间；remember 记录今后写入时补来源/回合定位，老记录无范围时按规范化内容匹配并在审计中说明。
   - 优先从已有 hidden 热缓冲、hidden 记忆的 `sourceRange` 和 outbox 状态派生隐藏区间；若必须新增持久字段/表，按 domain version + compatibleVersions 纪律单独评估，并保证旧插件可读，不能混入第一批静默升版。
2. **会话原文读取**：
   - `trajectory` 与 `expandOriginal` 在渲染前收集该 session 的隐藏区间，剔除被 hard forget 的事件/片段；整个请求区间都隐藏时返回“已屏蔽/不可考”的诊断，不回显正文或可用于 ID recall 的引用。
   - 可见记忆的 `sourceRange` 若跨到隐藏区间，只返回未隐藏片段，并记审计；不能借“另一条可见记忆的原文展开”绕过 hard forget。
3. **embedding 出站**：
   - `createReembedder` 与 `embedAfterWrite` 必须跳过 `hidden`、`status='archived'` 和 private workspace 的记录；L0 写入已有的 private 跳过逻辑要在重嵌入时同样生效。
   - 审计记录跳过条数与原因；不得把 hidden/private 正文放进 embedding 请求体。文档明确：已经发送到外部服务的 embedding 无法撤回，hard forget 不能撤回外部日志。
4. **测试矩阵**：
   - hard forget L0 → 延迟提炼 → 不产生新的 active L2。
   - hard forget L2/批次 → `trajectory`、ID recall 原文、query hit 原文均不出现正文/ID。
   - remember hard forget 无 sourceRange → 内容匹配打码或保守拒绝，不出现原句。
   - 重嵌入与 L2 写入时，hidden/archived/private 记录不出现在 embedding 请求体；默认 embedding 关闭时不触发。
   - 跨会话/跨 workspace、热重建、outbox 崩溃重放。

完成标准：hard-forgotten 内容不复活、不出现在 trajectory/expandOriginal、不进入 embedding 出站；private 内容不因重嵌入或 L2 写入外发；审计可诊断。

回滚点：优先纯代码变更；若涉及持久字段，必须单独发布并保留旧版本读取/回滚方案。

#### A10. 提炼批次完整性与 outbox 重试

**关键文件**：`lib/extract.js`、`lib/outbox.js`、`lib/index.js`、`test/pipeline.test.mjs`、`test/outbox.test.mjs`（拟新增/扩展）。

这是第三轮审核从 C3 拆出的正确性 P0；C3 只保留性能索引。

实施内容：

- 批次完成语义改为“整批产物 + 关系 + SOUL 提议都处理完才完成”：不能用“任意一条记忆带 `batchKey`”判定整批已完成；采用批次完成标记或逐条幂等键，崩溃重放要补齐剩余事实。
- 失败在中途时，不得提前把 outbox 标完成或把 L0 标 digested；重放必须识别已落盘条目并避免重复，同时补齐未落盘条目。
- outbox 退避重试：启动时清理/尊重 `nextRetryAt`，并为退避到期安排定时重试；`flushAll` 不能只跑一次就结束。用户不再产生新回合时也要能恢复。
- 失败耗尽进入 dead-letter 的路径保持可诊断；不得用无限重试掩盖坏输入。
- 优先用现有 `batchKey`/outbox 状态实现批次完成标记；若需新增持久字段/表，按 A9 同一 domain version 纪律单独评估。
- 测试矩阵：
  - 第一个 `put` 成功后第二次 `put` 抛错 → 重启 → 剩余事实补齐，已落盘事实不重复。
  - 无新回合的情况下，退避到期自动重试。
  - `batchKey` 重用、崩溃重放、dead-letter、L0 digested/outbox 完成顺序。
  - 关系/SOUL 提议在中途失败时的重放。

完成标准：半批不丢失、已落盘不重复、退避后能自动恢复；outbox 完成状态与实际产物一致。

回滚点：仅代码与索引补丁；不改变既有记忆内容。

### 阶段 B：可信评估、性能基准和发布门禁

阶段目标：后续任何“更快”或“更准”的结论都能被复现。

#### B1. 修正并固定准确度评估

**关键文件**：`tools/inject-eval.mjs`、`tools/eval-fixtures.mjs`、`tools/fusion-ab.mjs`、`tools/gate-sweep.mjs`。

实施内容：

1. MRR 改为所有 `idx >= 0` 的命中均贡献 `1 / (idx + 1)`，三个评估工具共享同一指标实现。当前只有 `inject-eval` 的 MRR 有缺陷，`fusion-ab` 与 `gate-sweep` 已正确；统一实现时不得改写它们或引入回归。
2. 失手分类必须真正采集候选路准入：当前 `inCorpus` 只判断目标是否在池里，不能把“目标不在池”和“未进入候选路”混在一起；需要为 search 增加 lane admission 诊断或等价 oracle，再区分“不在池 / 未进路 / 过线后被 top-K 挤出”。
3. 新增冻结、版本化的评估池与查询标注；固定数据集作为发布比较口径。`loadPool` 目前固定 `~/.dsh/storages/memory`、不尊重 `DSH_HOME`，且只收 active；冻结集必须使用合成/脱敏数据并显式覆盖 staged、archived 和 L0，避免评估口径与真实注入不一致或误读真实个人池。
4. live pool 评估保留为手工诊断，不作为跨时间绝对指标，不触碰或改写真实记忆；运行时显式设置 `DSH_HOME` 并核对读取路径。
5. 分别报告纯 BM25 与 BM25+向量结果，向量路不可用必须中止对应语义评估，不能冒充混合检索结果。
6. 明确区分“检索候选命中”与“最终渲染注入”：前者是 search 返回，后者还要经过字符预算、会话预算、`injectedIds`、核验和渲染；发布比较必须说明使用哪一种口径，不能把 search 结果称为最终注入。
7. 清理 `inject-eval` 的死代码（`if (...) { /* noop */ }`），并固定 embedding 模型指纹，避免不同模型下的数字被混在一张表里。

冻结数据集至少覆盖：

- 中文原词、中文改写、跨语言查询。
- 同义事实、困难负例和完全无关负例。
- 同主体不同时间、不同主体相似表述。
- reinforce、superseded、dispute、expired state、staged。
- 固定 global 下的同域/跨域、private/sensitive/hidden/archived。
- 短事实、长文本 chunk、代码/路径/中英文混合内容。
- L0 全文与 L2 原子事实同事实重复、常驻 lesson 与检索命中去重。

#### B2. 建立确定性性能基准

**拟新增工具**：`tools/search-bench.mjs`（名称可在实施时按现有工具风格调整）。

要求：

- 使用 `node:perf_hooks` 和固定合成数据，不依赖真实个人记忆池。
- 向量使用固定维度、固定种子的测试向量；网络 embedding 单独测量，不与本地扫描混为一项。
- 按多档记录数、chunk 数、workspace 分布和冷/热缓存运行。
- 分别测 remember、extract 候选准备、search、inject 的 p50/p95、inline 超预算率、CPU 和 RSS。
- inject 基准要覆盖命中、常驻 lesson、openingDigest、L0/L2 同事实重叠和压缩回冲，避免只测空池或单条命中。
- 每轮保留原始结果、配置、宿主版本、Node 版本和代码提交，报告多轮离散度。
- 单次 wall-clock 波动不作为确定性 CI 硬门禁；预算超时的行为语义由确定性测试守住。

#### B3. 建立 `verify:release` 发布门禁

**关键文件**：`package.json`、`tools/e2e-conversation.mjs`，以及拟新增的 release-matrix 驱动。

门禁至少组合：

```sh
npm test
npm run check:host
npm run check:shapes
npm run check:conform
npm run test:e2e
npm run test:release-matrix  # 拟新增，不是当前已有脚本
```

新增 release-matrix 必须从实际打包产物安装到全新临时 `DSH_HOME`，覆盖默认配置启动、重启、热重建和升级场景。默认配置冒烟不能用当前 E2E 的“关闭 extract/SOUL”代替，且当前 fixture 还跑不起来：mock 对提炼请求（`source.kind=plugin:dsh-plugin-memory`）返回普通文本而非合法 JSON，默认 `extractBatchTurns=6`、`extractIdleMinutes=5`，短对话不触发提炼，临时 home 也没有 SOUL 文件。必须同时改造 mock：识别插件提炼请求并返回合法提炼 JSON、记录 `system` 用于断言 SOUL/画像段、运行 6 轮或显式覆盖 `extractBatchTurns:1` 并在报告中标注非默认批次、在临时 `DSH_HOME` 写入 SOUL 文件。release-matrix 还要覆盖 owner 设置页搜索、client bundle 新鲜度、`/memory/api` 同源校验，以及“上一发布包 → 候选包”的固定 artifact 来源（npm/registry 版本或固定 tarball）；当前仓库没有上一发布包，升级场景不可复现。性能报告单独输出，不用噪声较大的单次性能数字掩盖确定性安装失败。

本机 PATH 没有 npm 时，可使用 DSH 自带的普通 Node 执行等价脚本。读取/抽取 `app.asar` 的工具应使用普通 Node；不要直接用 Electron-as-node 的 ASAR 文件钩子代替普通文件读取。

### 阶段 C：基准驱动的局部性能优化

阶段前提：A1-A10、B 完成，已有可重复的基准数据。若某一项没有稳定收益，则不合入。

#### C1. 增量统计与向量范数缓存

**关键文件**：`lib/search.js`、`lib/embed.js`、`test/search.test.mjs`、`test/embed.test.mjs`。

- 将 localActive 每轮全量统计改为 upsert/remove/rebuild 时维护的增量计数（当前统计只在 `coldStartMinLocal > 0` 时执行，增量实现必须保持该条件）。
- 缓存查询向量范数和 chunk 向量范数；缓存必须随记录、chunks 或 embedding 模型更新而失效。
- 第一阶段优先使用内存缓存，不向持久记录新增必填字段。
- 用原 `cosine` 和全量统计作 oracle，覆盖浮点误差、空向量、维度不一致和模型切换。

#### C2. 受限候选集索引

仅在 C1 后仍有明确瓶颈时实施：

- 按 workspace/status/model 等低基数字段维护内存候选集。
- private、sensitive、session、timeWindow 等仍在最终 eligible 中逐条执行，索引只能缩小候选，不能替代授权判断。
- archived/hidden/digested、rebuild、reembed 和配置热重建必须同步失效。
- 对每个查询 Fixture 比较“原全扫描结果”和“索引结果”，要求 ID、顺序、分数和过滤语义一致。
- API 的 list/stats、forget 的同 entity 枚举、redactAudit 也属于线性扫描；先纳入 B2 profile，只有证明显著成本后再优化。

#### C3. 写入与提炼查找索引（仅性能）

仅当 profile 表明显著成本时，为 outbox、hotbuffer、batchKey 增加 Map/组合键索引。正确性部分（batchKey 半批恢复、outbox 退避重试）已拆到 A10，不在本工作包处理。必须覆盖：

- pending/extracting/done/dead-letter 状态转换与索引失效。
- 同 session/seq 去重、batchKey 重用、删除、清理、重试和热重建后的索引一致性。
- 索引与原全表扫描的差分测试；索引不是唯一数据源。

#### C4. 协作式预算中断（可选）

若同步向量扫描仍导致 `inlineBudgetMs` 无法约束实际耗时，可在循环中按固定批次检查 deadline。超时沿用“整体跳过本轮动态注入”的语义，不返回容易被误解为完整结果的半批排序。recall 等非内联路径不套用过短预算。

### 阶段 D：保守去重与检索/注入准确度优化

#### D1. 精确规范化去重与幂等写入

**关键文件**：`lib/tools.js`、`lib/extract.js`、`lib/search.js`、`test/tools.test.mjs`、`test/pipeline.test.mjs`。

第一版规范化保持保守：Unicode 规范化、trim、空白折叠；不删除数字、标点、否定词、时间表达，不做激进词干化或大小写忽略。

候选桶至少包含 workspace、规范化 entity 和规范化内容。entity 缺失时只允许受限的精确匹配；entity 不同的记录不得直接合并。kind、temporal、有效期或状态不一致时，不直接判为同一事实，应进入关系裁决或保留独立记录。

去重实现还必须写死：

- 并发 remember 必须有串行化或唯一键机制，避免两个请求同时查不到后双写。
- 同一内容先进入 staged、后以 `confirm=true` 重试时，必须明确是返回既有 ID 并补用户证据/转正，还是新建；不能静默留下两条相同事实。
- `workspaceId='(unknown)'` 时采用更严格的匹配并在审计中标记，避免不同会话误合并。
- L0 全文与 L2 原子事实的重复展示不在 D1 的写入去重范围内，必须与 D3 联合处理。

行为要求：

- 同一 remember 请求重复执行返回既有 ID，不创建重复记录，不重复 embedding。
- 重放或重复写入本身不自动增加 reinforce；只有确认来自独立新证据时才按现有关系逻辑 reinforce。
- 去重决策记录候选 ID 和关系结果，不扩大正文在审计中的暴露。
- 不物理删除原记录，不把去重变成不可逆内容压缩。

#### D2. 语义近似的保守关系裁决

- 语义候选只在同 workspace、同非空 entity、相容时间语义内选取。注意：当前 global scope 下关系候选可以跨 workspace，这是**行为收紧**，不是既有语义；实施前必须有冻结集对比、DESIGN 更新和回滚方案。
- A7 的候选 allowlist 和可见性边界必须先落地；D2 只在其上收紧语义，不能用 D2 替代 P0 写回边界。
- 复用现有 relation 候选与 reinforce/contradict/dispute/supersededBy/unrelated 机制。
- 相似度只负责提供候选，不能直接决定 same 或 superseded。
- 不同主体、不同有效期、并行有效的相似事实必须保留。
- 冲突双方及证据链必须可回溯；不得仅保留高分的一条而删除另一条的语义。

重点负例：同名不同人、同项目不同环境、同主题不同日期、计划与既成事实、用户改口与暂时争议。

#### D3. 基于冻结数据的检索/注入调参与 L0/L2 跨层去重

- 先固定 `rrfK=60`，一次只调整一类及格线或系数。
- relevanceGate 的开启与阈值必须分别评估纯 BM25、混合检索、跨语言和困难负例。
- 调整 scoring 时扩充 `test/rank.test.mjs` 的期望排序算例。
- 注入侧只去除同一事实的重复展示；必须覆盖 L0 全文与 L2 原子事实的跨层重复（当前 E2E 已出现同一事实两份展示），按规范化内容、session/sourceRange 和时间语义去重，只保留信息量更高的一份或折叠 L0；争议对、被取代依据、不同时间和不同主体的相似内容不得合并。
- 常驻 lesson 按 A2 已定决策处理；D3 不得用“每轮重复展示”换取前缀缓存。
- 去重决策可诊断（审计或统计），不得改写 L0/L2 记录，不物理删除；与常驻 lesson 的去重分开计量。
- 测试覆盖：同事实 L0+L2、不同时间/主体、争议对、extract 关闭与开启两种配置、压缩后重新注入。
- 任一总体指标提升都必须附逐查询差分，检查是否以关键负例、主体或时间错误为代价。

完成标准：同事实不重复展示；合法的时间、主体、争议边界不被误删；调参结论有逐查询差分；上下文效率指标可复现。

### 阶段 E：额外宿主适配（按证据启用）

#### E1. tokenMeter 压力门

当前 measure 形状没有 ratio/limit。`HANDOFF.md` 已记录候选来源：`dsh-agent-loop` 的 `request/context` 会话事件带 `contextWindow`。

实施前必须：

1. 用当前宿主真实事件确认字段位置、类型、生命周期和缺失行为。
2. 为事件折叠和 per-session 状态清理补测试，避免无界缓存。
3. 用 `totalTokens / contextWindow` 驱动压力门；事件缺席或形状不符继续回退字符预算。
4. 通过 host/shape/E2E 后才能启用，不把该增强作为第一批 P0 修复的阻塞项。

#### E2. Windows sidecar

只有确需支持 Windows `autoStartCommand` 时单独立项。默认空命令的普通安装不因此受阻；不得为支持该可选功能给所有用户新增 shell 或原生依赖。

---

## 6. 指标体系与 Go/No-Go 口径

### 6.1 指标定义

| 维度 | 指标 | 口径 |
|---|---|---|
| 检索准确度 | Recall@1、Recall@5、MRR | 在冻结查询集上，分别报告 search 候选与最终渲染注入两种口径；top-1 必须计入 MRR |
| 负例质量 | 负例误注入率、平均误注入条数 | 无相关记忆时应不注入；困难负例单独报告 |
| 关键正确性 | 主体/时期/隐私违规数 | 关键负例中出现错误主体、错误时间或越权内容的数量 |
| 边界安全 | 二次引用泄露数、hard forget 复活/原文/出站数、L0 级联误伤数、关系写回越权数、半批丢失数 | 跨域正文引用、hidden 内容复活或经 trajectory/expandOriginal/embedding 泄露、无关 L0 被隐藏、allowlist 外/私有敏感目标写入、半批丢失的数量；必须为零 |
| 关系准确度 | 错误合并率、错误取代率、冲突保留率 | 由带标注的 same/update/conflict/unrelated 用例计算 |
| 写入效率 | 重复记录率、每百轮存储增长、证据重复率 | 同一会话集和同一写入策略下比较；含 A10 批次完整性与 outbox 重试 |
| 外部调用成本 | 每百轮 LLM/embedding 调用数 | 区分提炼、查询向量、写入向量和重嵌入 |
| 检索性能 | search/inject p50、p95、超预算率 | 分语料规模、冷热缓存和 BM25/混合检索报告 |
| 资源占用 | CPU、RSS、索引额外内存 | 与基线同机同配置测量 |
| 上下文效率 | 有效记忆字符占比、同事实重复展示率 | 标注相关的实际注入字符 / 动态注入总字符；含 L0/L2 跨层重复 |
| 会话预算 | 重复注入率、usedChars 与实际文本差值 | 包含包裹头/分隔符、常驻块、compaction 回冲和高证据/staged 例外 |

### 6.2 发布判断

#### 必须满足

- 所有 P0 合同测试和关键隐私/主体/时期负例 100% 通过。
- A5-A10 边界负例 100% 通过：二次引用零跨域正文/ID、hard forget 零无关 L0 误伤且不复活/不出站、关系写回零 allowlist 外/私有敏感目标/被过滤事实证据、批次零半批丢失。
- 当前 162 项基线及后续新增测试无失败；新增 skip 必须有明确平台或外部条件判据。
- host、shapes、conform、对话 E2E、打包 release-matrix 全通过；默认配置至少有一次 extract/SOUL 开启的确定性对话冒烟（mock 必须能返回提炼 JSON 并可观测 SOUL 段）。
- B1 评估口径修正、B3 打包 release-matrix 完成前，不得用新旧指标做调参结论；A10 的 batchKey 半批恢复与 outbox 退避重试测试必须通过。
- 不出现非预期 `SessionFormatError`、unhandled rejection、插件启动 stderr 或会话 checkpoint 失败。
- 不出现错误合并、重复证据无限增长，或任何持久化写回后 store 与 corpus 不一致。
- owner 搜索与 owner 列表语义一致；global 小池不被 coldStart 误压。

#### 性能与准确度的比较规则

- 总体 Recall@1/@5、MRR 不得低于同一冻结数据集上的基线；任何有意权衡必须逐查询审查并明确记录。
- 关键隐私、主体和时期负例不得用总体平均分抵消，必须零违规。
- 性能收益必须在多轮测量中稳定超过运行噪声，同时准确率不回归、索引额外内存可接受。
- 未测基线前不设固定提升百分比；完成 B 阶段后，再把具体数值目标补入实施记录。
- 无稳定收益、只在单一大池或单一模型下获益、或导致结果顺序意外变化的优化，不合入。

---

## 7. 当前 Harness 适配与发布测试矩阵

### 7.1 认证边界

本规划的强制认证目标是：

```text
@deepseek-ai/dsh-desktop 0.2.1-rc.3
build be72761ee1a6
Node 24.21.0
Session format V4
```

README 中既有旧版本支持范围不因本文自动扩大或缩小；旧版本如需继续认证，必须单独运行同一矩阵。未来 Harness 升级后按“host → shapes → conversation E2E → 全测试 → 隔离 profile → 浏览器设置页”的顺序重新认证。

### 7.2 发布矩阵

| 场景 | 必测内容 | 通过标准 |
|---|---|---|
| 静态宿主接缝 | `check:host` | 所有必需 API、声明和包存在；不得为变绿删除旧断言 |
| Session 形状 | `check:shapes` | V4 注入被接受，V3 历史读取不回归 |
| 仓库目录安装 | 当前 `test:e2e` | 现有 24 项链路不退化 |
| 打包产物安装 | 实际 pack 后在全新 DSH_HOME 安装 | 从 tarball 安装（不是仓库目录）；文件齐全、依赖可解析、client bundle 最新、默认配置启动成功 |
| 默认配置 | 不配 embedding、不启用 sidecar；至少一次 extract/SOUL 开启；mock 能返回提炼 JSON 并记录 system | 可安装、可对话、可 BM25 检索；提炼落盘/消化、SOUL 段注入正常，外部服务缺席不崩溃 |
| 插件升级 | 固定上一发布包 artifact → 候选包，使用同一隔离数据；旧 profile 含 `scope: workspace` | 记录可读、配置可解、重启与热重建成功；旧 scope 配置被忽略/迁移并留警告；artifact 来源可复现 |
| 存储版本 | fresh v2、v1 升级、坏记录 | 合法记录不丢失；坏记录按 backup-and-skip 处理并可诊断 |
| 存储异常 | 打开失败、读写失败、恢复；outbox 退避后重启；open 超时晚成功 | 按声明降级，不死循环重建，不产生未处理异常；退避到期能自动重试；晚成功域不遗留句柄/锁 |
| embedding | 就绪、缺席、超时、HTTP 错误、shape 错误、模型切换；hidden/private/archived 出站 | 降级符合合同；重嵌入后索引一致；召回续期后 corpus 同步；hidden/private 不出现在请求体 |
| 工具 recall | 纯 time、纯 session、time+session；三种 Windows privatePaths；`(unknown)` | filter-only 可命中；private 路径形式均生效；`(unknown)` 不跨会话泄露 |
| 动态注入 | remember → 跨会话 recall/inject → checkpoint；含二次引用、hard forget 级联、常驻/digest 状态 | turn 完成、日志继续增长、消息来源正确、无 SessionFormatError；跨域二次引用零正文/ID、无关 L0 不被隐藏；常驻/digest 不展示已取代/过期 |
| 遗忘闭环 | hard forget L0 + pending outbox；trajectory/expandOriginal；reembed/embedAfterWrite | 不产生新 active L2；原文不可读；hidden/private 不出站 |
| 批次恢复 | batchKey 半批、outbox 退避、重启无新回合 | 剩余事实补齐、已落盘不重复、退避到期自动重试 |
| 隐私边界 | private/sensitive 取代者、争议对端；hard forget 无 sourceRange；关系 allowlist 外 target；private 路径形式 | 零跨域正文/ID、零无关 L0 隐藏、零越权关系写入、private 不失效 |
| 设置页客户端 | 页面路由、五张卡、API、同源校验、owner 搜索、coldStart、rowOf 标记；无 scope 控件 | 页面可见、console 无错误、API 行为正确；owner 搜索与全池列表一致，global 小池不被 coldStart 误压 |
| volatile 配置 | 设置修改、热重建、重启 | 配置生效，旧 domain 关闭，无重复监听和句柄泄漏 |
| Windows 默认路径 | 默认 sidecar 关闭、权限条件、private 路径形式 | 普通安装不依赖 `/bin/sh`；既有跳过判据仍准确；private 判定对正/反斜杠均正确 |

所有自动化安装和升级只使用临时 `DSH_HOME`。真实桌面 profile 的手动安装不是自动测试的附带副作用；如确需执行，必须单独确认并先备份。

### 7.3 宿主升级时的适配顺序

1. 运行 `check:host`，先确认 API 和声明是否仍存在。
2. 运行 `check:shapes`，确认真实宿主编解码器接受插件输出。
3. 运行隔离安装与对话 E2E，验证 checkpoint 和 turn 完整链路。
4. 运行全部测试、存储升级矩阵和设置页浏览器验证。
5. 只有全部通过后，才更新 README 的支持范围和插件描述。
6. 不通过时保持上一认证版本，不通过删断言或放宽错误检查来制造兼容假象。

---

## 8. 变更、回滚与数据安全

### 8.1 变更粒度

- A1-A10 分别为独立变更集；A5/A6/A7/A9/A10 的边界修复不得与 D2 的语义收紧合并。
- B1/B2/B3 先建立门禁，C/D 的每个优化都附前后对比报告。
- C 的索引优化与 D 的去重/调参不得混成一个无法归因的大改动。
- 任何配置默认值变化都必须同步 README、DESIGN 配置账本和客户端说明。
- 任何客户端源码变化都必须重新生成 `lib/client.js`。

### 8.2 回滚策略

- 第一阶段优先纯代码变更，无破坏性存储迁移；A9 若确需新增持久隐藏区间，必须单独成包、升 domain version 并保证旧插件可读，不得混入其他补丁。
- 索引优化必须能通过重建恢复原全扫描语义；索引不是唯一数据源。
- 去重不做物理删除，关系与审计保留回溯依据。
- 若后续确需增加持久字段，必须先证明旧插件能读取新数据，或提供显式迁移与恢复方案；否则不得发布。
- 升级前备份隔离或目标环境的 `storages/memory` 与对应 profile patch。
- 发布失败时回退上一认证包及必要的数据备份，不使用删除用户记忆的方式清理故障。

### 8.3 不得采用的“修复”方式

- 删除或削弱 failing test、宿主断言、隐私负例。
- 把异常静默吞掉以换取启动表面成功。
- 通过提高超时或关闭全部注入掩盖性能问题。
- 通过全局相似度合并减少记录数。
- 用“隐藏整会话 L0”作为 hard forget 无 sourceRange 时的省事实现。
- 把 hard forget 只做成记录/L0 的 hidden 状态，不处理 outbox 复活、trajectory/expandOriginal 和 embedding 出站。
- 让 hidden/private/archived 内容进入重嵌入或 `embedAfterWrite` 的 embedding 请求体。
- 让注入渲染的 supersededBy/争议对端继续用裸 `search.get()` 绕过 eligible。
- 让 LLM 返回的任意 `targetId` 直接写关系，或用空 `current` 冒充 owner 搜索。
- 用 live pool 的历史数字或仓库目录安装结果代替发布基准；只用关闭 extract/SOUL 的 E2E 证明默认配置。
- 把 batchKey 任意命中当成整批已完成，或让 `nextRetryAt` 永久挡住启动重试，以此宣称崩溃恢复完成。
- 为通过安装而引入未声明的全局工具、shell 或原生依赖。

---

## 9. 实施顺序与交付物

### 9.1 依赖顺序

```text
A1-A10（同批交付；A5-A7/A9/A10 边界修复 + A8 owner 搜索）
       ↓
B1 评估基线 + B2 性能基线 + B3 发布门禁
       ↓
C1 增量统计/范数缓存 → C2/C3（仅性能，基准证明需要）
       ↓
D1 精确去重 → D2 语义关系裁决 → D3 检索/注入调参 + L0/L2 跨层去重
       ↓
当前 Harness 全矩阵发布验收
```

E1 tokenMeter 可在宿主接缝证据齐备后独立进行，不阻塞第一批正确性修复。E2 仅按实际 sidecar 需求排期。

### 9.2 建议交付批次

| 批次 | 范围 | 交付物 |
|---|---|---|
| 第一批：正确性与门禁 | A1-A10、B1-B3 | 修复补丁、A5-A10 边界负例、owner 搜索合同、合同测试、遗忘闭环/批次恢复测试、冻结评估、性能基线、`verify:release`、打包矩阵 |
| 第二批：低风险提效 | C1，按基准选择 C2/C3 | 差分测试、前后性能报告、内存成本说明；C3 仅做索引性能，不含 batchKey 正确性 |
| 第三批：记忆质量 | D1-D3 | 去重合同、关系负例、L0/L2 跨层去重、逐查询准确度差分、注入质量报告 |
| 第四批：额外适配 | E1/E2（按需） | 当前宿主事件证据、平台专项测试、独立发布说明 |

每一批都必须可以独立发布或独立放弃，后续批次不阻塞前一批已验证收益。C3 只保留性能索引；批次正确性（A10）已在第一批，不再存在“C3 是否提升为 P0”的分支。

### 9.3 每个工作包的完成定义

- [ ] 代码改动限于本工作包范围，没有顺手重写无关模块。
- [ ] 新增正常路径、边界、失败路径和回归测试。
- [ ] 现有测试无失败，新增 skip 有明确判据。
- [ ] 隐私/主体边界工作包附跨域、私有、敏感、隐藏、归档负例结果。
- [ ] A9 附 hard forget 复活/原文/embedding 出站负例；A10 附半批恢复与退避重试结果。
- [ ] 对性能/准确率有影响的改动附同基线对比，而非只给结论。
- [ ] host/shapes/conform/E2E 按影响范围执行；发布前完整执行。
- [ ] 打包产物安装、默认配置启动，以及 extract/SOUL 开启的默认冒烟通过。
- [ ] 无意外 stderr、未处理异常、Session/checkpoint 错误。
- [ ] 配置、README、DESIGN、IMPLEMENTATION 或 HANDOFF 按实际行为同步。
- [ ] 回滚方式和数据兼容影响已记录。

---

## 10. 暂缓事项与重新立项条件

| 暂缓方向 | 暂缓原因 | 重新评估条件 |
|---|---|---|
| SQL/向量数据库、持久 ANN | 新依赖、安装和迁移成本大，当前未证明局部优化不足 | 多档基准持续超预算，且 C1-C4 后仍无法达标 |
| LLM 重排 | 增加内联延迟、成本和新的不确定性 | 冻结数据证明当前融合排序是主要误差来源，并有独立预算方案 |
| 全局语义硬合并 | 容易误杀不同主体、时期和冲突事实 | 不作为默认方向；仅可研究带人工确认的管理工具 |
| 激进提高 relevance gate | 可能降低 BM25-only 和跨语言召回 | 困难负例收益明显且所有正例维度不回退 |
| 提前 topK/粗糙截断 | 可能在 eligible、gate 或系数排序前误删目标 | 有候选级差分证明结果等价或收益大于可解释损失 |
| tokenMeter 强制启用 | 当前 measure 无直接 limit | `request/context.contextWindow` 经真实宿主合同验证 |
| 添加 `engines.dsh` | prerelease 范围可能误挡 rc | 精确范围经当前及目标版本的实际插件安装验证 |
| Windows sidecar 重做 | 只影响可选 autoStart，不应增加默认安装复杂度 | 明确需要该功能且有独立平台测试矩阵 |
| 持久化隐藏区间 / 遗忘审计表 | 可能触发 domain 升版，影响旧插件兼容与回滚 | A9 无法从现有 hidden 记录、热缓冲和 outbox 派生，且真实数据证明必要 |

---

## 11. 实施记录模板

每完成一个工作包，在 PR、交接或实施记录中填写：

```text
工作包 ID：
代码提交：
宿主版本 / build / Node：
变更摘要：
涉及公开合同或配置：
新增测试：
单测 / host / shapes / conform / E2E 结果：
二次引用 / L0 级联 / 关系写回边界负例结果：
hard forget 复活 / 原文 / embedding 出站结果：
批次半批 / 退避重试 / outbox 完成状态结果：
打包产物与默认配置安装结果：
默认配置 extract/SOUL 冒烟结果：
准确度数据集版本：
优化前指标：
优化后指标：
逐查询或逐用例差分：
性能环境与迭代次数：
内存/存储影响：
已知限制：
回滚方式：
是否更新 README / DESIGN / IMPLEMENTATION / HANDOFF：
最终 Go / No-Go 决定及理由：
```

---

## 12. 第一批启动清单

后续开始实施时，按以下顺序执行，不直接进入检索调参：

- [ ] A1：为 recall/forget 写工作区、private、sensitive、hidden、archived 合同测试并修复；补 filter-only recall、Windows privatePaths、`(unknown)`、跨域 expandOriginal；按 §2.4 删除 `scope=workspace` 并同步 config/client/docs/ledger；owner 搜索语义转 A8。
- [ ] A2：删除重复 usedChars 计账，按“常驻会话一次”口径实现，补兜底/核验/sessionState 测试。
- [ ] A3：统一所有持久写回与 corpus 同步，覆盖重嵌入、召回续期和注入续期。
- [ ] A4：补分块配置交叉约束和运行时正 stride 防线。
- [ ] A5：渲染 supersededBy/争议对端复用可见性 helper，补跨域正文/ID、常驻/digest 状态负例。
- [ ] A6：收紧 hard forget 的 L0 级联，补批次语义和“无关 L0 不被隐藏”回归。
- [ ] A7：关系写回加候选 allowlist、可见性与 `created` 校验，补 reinforce/contradict 越权负例。
- [ ] A8：固定 owner 全池合同，修复空 `current`/coldStart/rowOf 标记，补 API/客户端测试。
- [ ] A9：实现 hard forget 全通道闭环：L0 复活、trajectory/expandOriginal、embedding 出站。
- [ ] A10：改批次完成标记与 outbox 退避重试，补半批恢复和重启重试测试。
- [ ] B1：修 MRR 与失手分类，隔离评估池（尊重 DSH_HOME/合成池），覆盖 staged/L0。
- [ ] B2：记录首份性能与写入成本基线。
- [ ] B3：改造 mock 与 release-matrix，加入 extract/SOUL 默认冒烟、固定上一发布包 artifact，并接入 `verify:release`。
- [ ] 第一批全矩阵通过后，再决定 C1/C2 和 D1 的具体实施范围。

---

## 13. 实施状态（2026-10-27）

- **已完成**：A1-A10（可见性/固定 global/filter-only/路径归一、预算账目、corpus 同步、配置防线、渲染状态、L0 级联、关系 allowlist、owner 全池、hard forget 全通道、批次恢复）与 B1-B3（评估仪器、search-bench、release matrix）。全量测试 177/174/0/3；host/shapes/conform/ledger/seams/release-matrix 通过。
- **未开始**：C（增量统计/索引，按 B2 基准决定）、D（去重/关系调优，按冻结集决定）、E（tokenMeter/Windows sidecar，按宿主证据/需求）。
- **已知限制**：headless one-shot 仍可能在后台提炼完成前退出；默认配置冒烟当前确定性断言 SOUL，提取背景链路需长驻 profile 复验；C/D/E 未实施。

## 变更记录

- v1.5（2026-10-27）：第一批 A1-A10 + B1-B3 实现完成；检索固定 global；测试基线更新为 177/174/0/3；新增 release-matrix/search-bench，默认配置冒烟断言 SOUL；C/D/E 标记未开始。
- v1.4（2026-10-27）：产品决策：检索固定 global，删除 `scope` 配置与 `scope=workspace` 模式；workspace 仅保留来源/排序/private 边界，跨会话与跨项目记忆不受影响。A1 增加配置/客户端/DESIGN/README/ledger 同步与旧配置兼容；A8 去掉 workspace-scope 测试；发布矩阵与启动清单同步。`privateWorkspaces`/`sensitiveNoCross` 不在本决策内，仍保留。
- v1.3（2026-10-27）：第三轮审核回流。新增 A9（hard forget/private 全通道闭环：L0 复活、trajectory/expandOriginal、embedding 出站）和 A10（batchKey 半批恢复 + outbox 退避重试）两个 P0；A1 增加 filter-only recall、Windows privatePaths、`(unknown)`、跨域 expandOriginal；A5 增加常驻/digest 状态渲染；A6 明确批次级 sourceRange；A8 固定 owner 全池并处理 coldStart/rowOf；A2 固定常驻 lesson 会话一次；B1/B3 补充隔离评估池和 mock/默认冒烟可执行性；C3 拆为纯性能索引，D4 并入 D3；基线 skip 说明、指标、Go/No-Go、发布矩阵、批次和启动清单同步更新。
- v1.2（2026-10-26）：补充 §4.1 P1 问题说明与排序；发布判断新增 B1/B3/C3 的 P1 门禁；§8.3 增加不得用 live pool、仓库目录 E2E 或关闭 extract/SOUL 的对话代替发布基准，以及不得把 batchKey 任意命中当作整批完成的纪律。
- v1.1（2026-10-26）：审核回流。问题清单新增 A5（渲染二次引用泄露）、A6（hard forget L0 级联过宽）、A7（关系写回越权）三个 P0；扩大 A2（常驻块/包裹头/压力路径/压缩残余）与 A3（所有持久写回与 corpus 同步）的修复范围；新增 A8（owner 搜索）、C3（batchKey 半批恢复）、D4（L0/L2 跨层重复）三个 P1；B1/B2/B3 补充评估口径、场景与默认配置冒烟；发布判断、发布矩阵、第一批和启动清单同步更新。
- v1.0（2026-10-26）：基于插件 `0.5.0`、当前 DSH `0.2.1-rc.3` 和已验证测试基线，建立首版优化与适配规划。
