# 下一步执行清单

> **本文是"接下来怎么一步步做"的唯一入口**（执行文档）：本期步骤 + 待设计池 + 最近完成 + 工作规矩。
> **最后更新**：2026-11-10（S12 完成并发布 **0.6.7**；下一步 S13 数据积累）
> 现状数字看 [STATUS.md](STATUS.md)；版本历史看 [CHANGELOG.md](CHANGELOG.md)；设计合同见 [DESIGN.md](DESIGN.md) 与 [docs/design/](docs/design/)；R 项定义见 [docs/legacy/REVIEW.md](docs/legacy/REVIEW.md)。
> **发布纪律**：tag / GitHub Release / push 必须由用户明确确认；本文件不授权任何对外动作。

## 1. 本期：0.6.7 观测落盘（S12 已发布）→ 0.7.0 记忆质量（S13–S16）

**目标**：先把 0.6.6 的使用情况变成**可跨重启观测**的数据，单独发 **0.6.7**（行为不变，纯观测）；再用一段时间真实使用攒出样本；最后按数据调记忆质量（关系判断 / 相关性门槛 / 画像晋升）。**S12 已实现、验收并随 0.6.7 发布**（重打包 candidate → `verify:release` PASS → tag/Release）。

**起点**：0.6.6 已发布（tag `v0.6.6` + GitHub Release，2026-11-09，不发 npm）；**S12 已随 0.6.7 发布**（tag `v0.6.7` + Release，2026-11-10，用户授权），S13–S16 归 0.7.0。0.6.6 的任务表已移入 §2.1。

| # | 任务 | 设计依据 | 验收 | 状态 |
|---|---|---|---|---|
| S12 | **观测落盘（尺子先行，发 0.6.7）**：R3 使用情况持久化（按天汇总 + 按轮次滚动记录，跨重启保留）+ **注入质量元数据（只记录，不拦截）**；R9 只读统计（条数 / 体积估算 / 重复 / 过期 / 待整理队列） | [R3 / R9](docs/legacy/REVIEW.md) §9.1、[§14 设计](docs/design/14-observability.md) | 注入 / 跳过计数与原因重启后仍在；质量元数据可跨重启回看；统计接口只读、不改存储语义；套件 380/377/0/3、各门禁全绿 | 完成（0.6.7 已发布：tag `v0.6.7` + Release，asset SHA 校验一致） |
| S12f | **0.6.7 发版**：升版本 → 从最终 HEAD 重打包 candidate → 更新尺寸 / SHA / `SHA256SUMS` → 从最终 HEAD 跑 `verify:release` → tag `v0.6.7` + GitHub Release（不发 npm）→ 下载 asset 校验 SHA | 用户授权（2026-11-10） | `verify:release` PASS；Release asset 353,521 B、SHA256 与本地一致 | 完成 |
| S13 | **数据积累期**：只解除日常使用工作区的停用（隐私 / 测试工作区继续停用），确认 `autoRecall` 与提炼参数；正常使用 1–2 周，不刻意造数据 | §1.1 start gate | start gate 达成；期间不改行为、不发版 | 未开始 |
| S14 | **B 类确定性工程项**（与数据量无关，可并行）：R27 / R28 / R29 / R30 / R31 / R15b / R20 / R21 / R22 / R8b | 各自 REVIEW 条目 + `docs/design/` 设计文档 | 一项一 commit；行为变更加测试；设计文档同提交或 `Design: none` | 未排期 |
| S15 | **C 类产品功能**：R2a 导出 / R1b 编辑 / R1c 反馈 / R5 零配置引导 / R7 设置上移 / R6 画像晋升 | 同上 | 同上 | 未排期 |
| S16 | **D 类数据依赖项**（等 S13 数据）：R19 对象覆盖门槛、R23 关系候选与 D2b 阈值调优（冻结关系集 ≥ 20 条）、R9 清理触发 | R19 / R23 | 评估集指标达标；关键负例零违规；指标不达标宁可不上 | 未排期 |

### 1.1 数据积累 start gate（够条件才进 S16）

| 指标 | 门槛 | 采集方式 |
|---|---|---|
| L2 记忆条数 | ≥ 100 条，其中 `source: user` ≥ 20 条 | R9 统计接口 / 存储只读统计 |
| 跨重启观测 | 按天汇总覆盖 ≥ 7 天、≥ 5 次重启 | R3 |
| 真实召回 | 注入 / 跳过记录 ≥ 50 次，跳过原因分布可解释 | R3 注入日志 |
| 关系标注集 | ≥ 20 条 same / update / conflict / unrelated（含关键负例），脱敏或合成 | 冻结评估集 |
| 池子规模（R19） | ≥ 300 条 active | R9 |

> 纪律：评估集只用**脱敏或合成**内容，真实记忆正文不进仓库。

### 1.2 顺序裁决（2026-11-09 讨论结论）

- **先尺子后数据**：0.6.6 的注入日志与 `stats` 都是**进程内**的——[lib/injectionlog.js](lib/injectionlog.js) 明示"环形缓冲，不落盘"，桌面应用一重启就归零。先做 R3，积累期才有可复盘的数据，否则"攒了多久"无法回答"有没有用"。
- **多数条目不必等数据**：0.7.0 池里 R27–R31、R15b、R20–R22、R8b 是确定性工程，R1b / R1c / R2a / R5 / R7 是产品功能；真正依赖真实规模的只有 R19 / R23（R19 原文即"需要用真实规模的记忆库再验证"）。
- **版本归属已定（2026-11-10 用户裁决）**：S12（观测，行为不变）**单独发 0.6.7**；R19 / R23 一旦调阈值必须单独升版（归 0.7.0）。

## 2. 最近完成

> **历史说明**：S1–S10e 的 commit 列指向**旧仓库历史**（公开前已压缩为单提交，仅本地 `backup/pre-rewrite` 分支可查）；新公开仓库从 S10f 的单提交开始，commit 列不再可点。

### 2.1 0.6.6 发布收尾（S8–S11，2026-11-09，已归档）

| # | 任务 | 设计依据 | 验收 | 状态 | commit |
|---|---|---|---|---|---|
| S8 | 本文件重写 + 删除 ROADMAP（内容并入待设计池） | — | 本文；全仓无失效链接 | 完成 | `e9076c6` |
| S9 | README 重构为公开主页（安装 / 上手 / 隐私 / FAQ / 已知限制），保留门禁依赖的声明 | README 骨架：`.scratch/docs-audit/BLUEPRINT.md` | `check:conform` 0 不符；19 个 `tools/*.mjs` 全被提到；`常用层(N 项` 与 `再跑 N 项` 声明仍在 | 完成 | `a450f34` |
| S10 | 从最终 HEAD 重打包 candidate → 更新尺寸 / SHA / `SHA256SUMS` → 翻转状态 → 重跑 `verify:release` 并存原始日志 | [§10 配置账本](docs/design/10-config-ledger.md)、`tools/release-matrix.mjs` | `bench-results/` 里有 0.6.6 原始日志；STATUS / CHANGELOG 才标 PASS | 完成 | `dc96c20` |
| S10b | 源码逐条抽查：6 组并行审计 `docs/design/` + DESIGN / STATUS / 账本，修正与代码不符的断言（含 3 处契约级错误） | 各设计文档 front-matter `code:` 清单 | `npm test` 门禁全绿；`check:design --history --strict` 0 漂移；本文件/STATUS 状态同步 | 完成 | 旧历史 |
| S10d | **R26**：`profileFile` 支持 `~/…` 展开；光写 `~` 拒绝并留痕；配了但文件缺失 → 按空画像 + 一次提示；画像页显示"文件不存在"警告；保存自动建父目录（含测试与文档） | [§4.1](docs/design/04-inject.md)、[§10 账本](docs/design/10-config-ledger.md) | 新增 5 项测试全绿；`check:ledger` / `check:design` 通过 | 完成 | `9e13340` |
| S10e | R26 后重打包 candidate → 更新尺寸 / SHA / `SHA256SUMS` / STATUS / CHANGELOG → 重跑 `verify:release` 并存脱敏日志 | 同 S10 | `verify:release` PASS（EXIT=0）；`bench-results/` 日志与 SHA 一致 | 完成 | `655b0dd` |
| S10f | **用户裁决改名 `neural-mind`**：包名 / entry id / 设置命名空间 / 存储域名 / 注入来源 kind / 数据路由全量同步 + 旧存储域一次性迁移；旧仓库删除后重建 public 单提交仓库 | [§1 版本纪律](docs/design/01-memory-model.md)、`lib/schema.js`、`lib/store.js` | 367/364/3 全绿；ledger / seams / design / conform / host / shapes 通过；`verify:release` PASS；仓库 public 单提交 | 完成 | 公开仓库首个提交 |
| S11 | tag `v0.6.6` + GitHub Release（不发 npm；Release asset = 候选 tarball） | — | 用户已明确授权（2026-11-09）；tag / Release / asset 均已创建并核对 | 完成 | tag `v0.6.6` |

### 2.2 文档体系重整（S1–S7）

| # | 内容 | commit |
|---|---|---|
| S1 | DESIGN 事实修正：按源码核实 v1.26 / 认证基线，修 8 错 15 过时 3 部分 | `a2e060a` |
| S2 | 删除失效的 `test/settings-e2e.mjs`；`acp-driver.mjs` 移入 `tools/` | `079f9ce` |
| S3 | 旧文档迁入 `docs/legacy/`（实施状态横幅 + 索引）；删除 `DOCS.md` | `d6cf4ac` |
| S4 | STATUS 重写为唯一事实来源（90 行）；VERIFICATION 拆入 legacy | `8aacc05` |
| S5 | CHANGELOG 修正：0.6.6 验证状态诚实化 + MIT / 公开 / 脱敏条目 | `90fba19` |
| S6 | DESIGN 拆分：总览 141 行 + `docs/design/` 8 份 + 历史三节归 legacy | `6c82cac` |
| S7 | 新增 `check:design`：P0 进 `npm test`；P1 同提交纪律进 `verify:release --strict` | `b1997fb` |

0.6.6 的功能项（R4 / R18 / R13a / R8a / R14 / R16 / R16b / R13b / R15a / R1a / R26 + 改名 `neural-mind`）逐条记在 [CHANGELOG.md](CHANGELOG.md)，本文件不再重复。

## 3. 待设计池

> 规则：进池 ≠ 排期。本表是 0.7.0 / 0.8+ 的候选池；任何一项开工前，必须先在 `docs/design/` 有对应设计文档（或 REVIEW 条目定义），并在 §1 登记。

### 3.1 0.7.0 记忆质量（20 项）

R5、R1b、R1c、R2a、R3、R6、R7、R8b、R9、R15b、R19、R20、R21、R22、R23（定义见 [docs/legacy/REVIEW.md](docs/legacy/REVIEW.md) §9.1），外加本轮源码逐条抽查新增的 **R27–R31**（定义见 §3.1.1；R26 已随 0.6.6 交付）。

按依赖分成四类（与 §1 的 S12–S16 对应）：

| 分类 | 条目 | 依赖 |
|---|---|---|
| **A 观测底座** | R3、R9（只读统计部分） | 无 → S12，最先做 |
| **B 确定性工程** | R27、R28、R29、R30、R31、R15b、R20、R21、R22、R8b | 无 → S14，可与积累期并行 |
| **C 产品功能** | R2a、R1b、R1c、R5、R7、R6 | 实现不依赖数据，验收最好有真实数据 → S15 |
| **D 数据依赖** | R19、R23、R9（清理触发部分） | S13 start gate 达成 → S16 |

> **R32（注入质量实时拦截）不在上表 20 项内**：用户提出但未裁决，登记在 §3.1.2 待定条目；本池不排期。

其中 **R23 = D2b 关系调优 + 冻结关系集扩展**：

- 规则：候选只在同 workspace、同非空 entity、相容时间语义内选；相似度只提供候选，不直接判 `same` / `superseded`；两派观点保留并判 `dispute`；
- 评估：`relations.json` ≥ 20 条（same / update / conflict / unrelated），固定 `rrfK=60`，一次只调一类阈值，逐查询差分；关键负例零违规；
- 发布：行为变化单独升版；指标不达标宁可不上。

**R9（记忆清理与容量）**：先只做只读统计（条数 / 磁盘占用）与待整理队列清理；不自动删记忆，显式清理工具要用户明确要求。

### 3.1.1 源码逐条抽查新增（R26–R31）

> R26 已随 0.6.6 交付；其余 5 项经用户裁决**不进 0.6.6**，登记在 0.7.0。定义暂记于此（REVIEW.md 已冻结，保持 R 编号唯一、不复用）。

- **R26（已交付 0.6.6）画像路径**：`profileFile` 支持 `~/…`；光写 `~` 拒绝并留痕；缺失文件按空画像 + 一次提示；画像页 `exists:false` 警告。
- **R27 关系死分支清理**：D2a 护栏后 `extract.js` 的"其余对立 → 非对称 challenge"不可达——删分支并补负例测试；或按 R23/D2b 放宽护栏让跨主体 `dispute` 可达（后者需重跑关系评估集）。
- **R28 tokenMeter 压力门适配**（= §3.3 E1 的具体化）：现 `measure()` 在认证宿主上无容量字段 → 占比恒 `undefined`、压力门不生效；适配 `contextPressure()`、双形状兼容 + 真实形状 fixture 回归。
- **R29 worktree 锚根**：`workspace.resolve` 暴露 worktree 顶层，写记忆时 `anchorRoot` 记 worktree 路径（旧记录=git 根，按 legacy 处理），核验时相对锚解析到正确副本、跨 worktree 只提示不记 challenge；补 worktree 测试。
- **R30 L0 密钥/外发边界**：L0 写入不做 `detectSecret`，原文可能进外部 embedding 请求——加检测（命中跳过 embedding 并审计；是否打码另行定），补"不出站"负例。
- **R31 办公产物 filePaths**：提炼 prompt 只要求代码/配置带锚，办公文档/表格/演示无规则；补 prompt 规则 + 契约测试。

### 3.1.2 待定条目（不进 0.7.0 排期）

> 用户提出、尚未裁决是否做、做也还没定判据的条目。**与 §3.1 的 20 项分开**，不算已排期。

- **R32 注入质量实时拦截（待定，2026-11-10 提出）**：在注入前用"相关度 / 可信度"做准入——低相关或低可信的条目不注入。
  - **暂不进 S12 / §14**：§14 只**记录**质量元数据（逐条 `r/s/c/e/src/k/v` + 日汇总 `quality`），不参与排序与过滤。
  - 待定内容：①做不做；②判据（绝对阈值，还是与 `relevanceGate` 的余量组合）；③误杀代价（可能砍掉有用的常驻 lesson 或用户级记忆）；④评估集（需要"该拦 / 不该拦"的标注样本，关键负例零违规）。
  - 若做：按"行为变化单独升版"纪律，先冻结评估集并证明不误杀，再考虑上线；指标不达标宁可不上。

### 3.2 0.8.0+（7 项 + 测试矩阵）

- R2b、R10、R11、R12、R17、R24、R25。
- owner API / 设置页 / 热重建进入隔离 profile 自动化矩阵（原 N2 / N3；现在只有单元测试与手工 `tools/probe-api.mjs`）。

### 3.3 条件触发

- **C 性能**：当前 20k 合成基线 hybrid search p95 ≈ 35 ms、inject 候选 ≈ 33 ms、openingDigest 80–94 ms，预算 300 ms → **不启动**。
  触发条件（全部满足）：B2 有多轮可复现数据；search / inject p95 > 100 ms 或出现 inline 超时；池子 > 20k 且用户可感知；差分测试能证明索引 / 缓存不改变结果顺序与过滤语义。
  触发后顺序：openingDigest 同步全表扫描 → C1 增量统计 + 向量范数缓存 → C2 候选集索引 → C3 写入 / outbox / hotbuffer 索引 → C4 协作式预算中断。
- **E 宿主适配**：E1 tokenMeter 压力门需要宿主 `request/context` 稳定带 `contextWindow` 字段证据（缺席或形状不符继续回退字符预算）；E2 Windows sidecar 只在确实需要 `autoStartCommand` 时做。宿主升级认证顺序：`check:host` → `check:shapes` → E2E → 全量测试 → 隔离 profile。
- **1.0 远期**：跨宿主矩阵、发布流程、长期兼容承诺。

### 3.4 决策点

| 决策 | 触发条件 | 默认选择 |
|---|---|---|
| 0.7.0 是否先做观测（R3/R9） | — | 是，先做（否则积累期数据重启即失） |
| 做不做 R32 注入质量实时拦截 | S12 有质量元数据 + 有"该拦/不该拦"标注样本 | 待定；先看数据，再做取舍 |
| S12 观测版本归属 | — | **已裁决 2026-11-10：单独发 0.6.7** |
| 解除哪些工作区的停用 | 用户操作 | 只解除日常使用的工作区，隐私 / 测试工作区保持停用 |
| 做不做 D2 | 有"关系判断错"反馈，或 0.6.x 稳定 | 做，但单独 0.7.0 |
| 做不做 C | 20k 数据 p95 > 100 ms / inline 超时 | 先测 openingDigest |
| 做不做 E1 | 宿主字段证据齐 | 先加形状测试 |
| 做不做 E2 | Windows 需要 autoStart | 单独立项 |
| 是否清理旧记忆 | 用户明确要求 | 只做显式工具，不自动删 |

### 3.5 明确不做

- 不重写成 SQL / 向量数据库；不引入原生 ANN、重依赖、LLM 重排；不做激进语义合并；
- 不物理删除记忆；不宣称兼容未验证的 Harness 版本；没有冻结数据 / 性能基线时不承诺百分比提升。

## 4. 工作规矩

- **一个 commit 一项**：每步独立提交，可单独 `git revert`。
- **先写测试再写实现**，至少同提交；没有回归测试的行为算没做完。
- **文档随步更新**：改机制必须同提交改对应 `docs/design/*.md`（`check:design` P1 会查）；改不变量 / 不做清单 / 决策改 DESIGN；数字只写 STATUS；版本事实只写 CHANGELOG。
- **不擅自 push / 打 tag / 发 Release**：每步给用户看 diff + 门禁结果，确认后才继续；tag 需单独明确授权。
- **豁免通道**：确实不必同步设计文档的提交（纯措辞 / 构建脚本 / 测试夹具），在提交信息里写独占一行 `Design: none`，P1 会放行并计数。

## 5. 每步怎么验收

```powershell
# 全量测试（沙箱里 npm test 因 spawn EPERM 失败时，逐文件跑）
Get-ChildItem test/*.test.mjs | ForEach-Object { node $_.FullName }
npm test                       # 配置账本 + 接缝 + 设计 P0 + 单测
npm run verify:release         # 发布门禁（host / shapes / conform / 设计 P1 strict / E2E / matrix）
```

一步完成 = 相关用例通过 + 门禁全绿 + 文档同步 + 独立 commit。发布前额外要求 `bench-results/` 里有对应原始日志——**没有日志不算 PASS**。
