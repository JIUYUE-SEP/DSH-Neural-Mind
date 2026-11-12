# Changelog

格式：版本 — 日期 / 主题；未发布版本置顶并标注「未发布」。只记录版本级事实（改了什么、为什么），当前数字与验证状态以 [STATUS.md](STATUS.md) 为准；详细实现见对应提交。

## 0.7.0 — 未发布

> **主题**：SOUL 写入权收缩。agent 从"能整篇重写自己"改成"**只能提议，你在记忆页采纳才落笔**"——SOUL 是每轮注入的常驻指令面，落笔这一步不该由它单方面完成（2026-11-12 用户裁决）。**破坏性接口变更**：工具 `soul_update` → `soul_propose`（旧名删除，不留别名）。不改记忆检索 / 注入 / 存储语义——提议复用暂存区，新增两个**可选**字段与一张 `soul_signals` 表（纯新增），**domain 版本不动**。
> 发布物：本次尚未发布（发布前跑 `verify:release` 并把实测数字补进本节）。

- **`soul_update` → `soul_propose`（破坏性）**：调用只产生一条**整篇提议**（暂存区 `entity='soul'`、`soulMode='replace'`、`soulReason`），不写文件、不产生版本；回话明确写"**没有**写入 SOUL——采纳后才生效"。旧工具名删除：留着它只会让"调了却没生效"变成新的困惑。
- **提议落盘复用暂存区，零迁移**：新增 `soulMode`（`replace` / 缺省 `append`）与 `soulReason` 两个可选字段；提炼器原有的句子提议继续按 `append` 处理。**不升 domain 版本**（可选字段，读侧按缺省，同 `confirmedByUser` 先例）。
- **采纳分形态**：`soulAdoptProposal` 对 `replace` 走**整篇替换**、对 `append` 保持追加；两者都是用户通道（内容三关照过、不受提议额度限制），成功后提议归档 + 审计带形态。界面里整篇提议的「采纳」**先开 diff 覆盖层**，看过再点确认——一份 400 字的人格的覆盖不该是一键盲操作。
- **检查与预算搬进提议通道**：`soul.checks()` 收窄为内容三关（密钥 / 注入特征 / 长度）；总开关、允许提议、日额度改由工具侧判定。新增两条拒绝：「与当前 SOUL 相同」「已有相同的待采纳提议」。**预算口径改为"今日提议次数"**（`soulEditDailyBudget` 同一个键；按 UTC 日界数当日 `entity='soul'` 记录，采纳不占额度）——旧口径数的是 `author=agent` 的版本行，agent 不再写版本后它恒为 0。
- **界面**：`允许自改` → `允许提议`，`今日自改` → `今日提议`，空态与总闸提示去掉"自改"措辞；提议行渲染形态徽章 / 理由 / 字符数变化（整篇不再把 400 字塞进一行省略号里）。
- **SOUL 内容形态写死：判断，不是规范**：`soul_propose` 的工具描述与提炼器 `soulProposal` 规则改成同一口径——写「冲突时选哪边 + 依据 + 它什么时候会害我」「瞧不起什么」「改过的主意」，允许写没解决的矛盾；明确排除情形规则（"遇到 X 就做 Y"）、复述角色/工具用法、零成本表态（"我重视质量""我保持好奇"）。四条判据（选边 / 外推 / 代价 / 反例）写进 §4.4，工具描述契约与提示词契约各补断言——否则下一版会滑回"性格、价值观、口吻、信条"这种清单。
- **设计**：§4.4 的「自改通道」整节改写为「提议通道（agent 只提，用户落笔）」，并新增「内容形态」小节；§6 降级表两行口径同步；§10 账本三条描述同步（键不变）。
- **提议降频为周回顾（信号 + 周归纳）**：提炼器常态只收「人格信号」（`soulSignal` = 用户原话，写入侧截 200 字符，落新表 `soul_signals`，保留 30 天 + 保留期内同句去重），`soulProposal` 常态恒为 null 且被忽略；只有**周回顾**那一次（满 `soulProposalIntervalDays`=7 天 + 保留期内信号 ≥2 条 + 跨 ≥2 个 UTC 日）才允许把信号归纳成一句判断进暂存区，并记 `soul-review-run` 推进间隔（没提议也记，否则"这周没东西可提"会让下一批对话立刻又进回顾态）。纯函数在 `lib/soulreview.js`（间隔/保留期/跨天/prompt 块，无 I/O）；周回顾 prompt 带过去提议的结局（新增可选字段 `soulNote` = 用户忽略理由；本切片只读，记忆页忽略动作接上后才写）。**纯新增一张表，不升 domain 版本**。
- **测试**：407 项 / 404 通过 / 0 失败 / 3 跳过（+9：周回顾纯函数 6、信号→周回顾与降频落盘 2；提示词契约用例改在周回顾态下断言）。

## 0.6.8 — 2026-11-12

> **主题**：0.6.7 使用中发现的两处 SOUL 提议问题——手滑忽略后恢复会卡在中间态；流程 / 偏好类内容被误判为人格提议。本版修正这两处，并把设计侧 §15（项目规则）与 R33 落到草稿 / 原语；**不改记忆检索、注入与存储语义**。
> 发布物：tag [`v0.6.8`](https://github.com/JIUYUE-SEP/DSH-Neural-Mind/releases/tag/v0.6.8) + GitHub Release（**不发 npm**）；Release asset = 候选包 `neural-mind-0.6.8-candidate.tgz`（61 文件，含 MIT LICENSE，356,538 B，SHA256 `50865C9A…82C7`；见 [bench-results/artifacts/SHA256SUMS](bench-results/artifacts/SHA256SUMS)）。
> **验证状态**：2026-11-12 从 0.6.8 最终 HEAD 重跑 `verify:release` **PASS**（EXIT=0）——npm test **394/391/0/3**、`check:host` 51/51、`check:shapes` 10/10、`check:conform` 39/0、`check:design` P0+P1（16 提交 / 0 漂移）、E2E 24/24（源码 + tarball 各一次）、升级 smoke 0.5.0→0.6.8 PASS、默认冒烟 26/26、N1 PASS、`release-matrix` PASS（61 文件 tarball）。原始日志：[bench-results/verify-release-0.6.8.log](bench-results/verify-release-0.6.8.log)（已脱敏）。

- **修复：SOUL 提议「手滑」恢复路径**：`restore` 对 `entity='soul'` 的记录回到 `staged`（待采纳），不再落到 `active` 中间态——此前恢复到 `active` 后既不在 SOUL 提议列表（要求 staged），也不能按普通记忆确认。审计写明「恢复为 SOUL 提议」，新增回归测试。
- **收紧 `soulProposal` 判据（R33 前哨）**：只收真正的自我人格（跨项目 / 跨任务仍成立的身份、原则、边界），明确排除流程 / 协作要求、单项目约定、任务级偏好、用户事实与模型自我反思；提示词契约测试同步加断言。回应「这些提议不像 SOUL」的实测问题。
- **设计侧（无运行时行为）**：新增 §15 项目规则与 `AGENTS.md` 托管块设计草稿 + `lib/rules.js` 纯函数原语（13 条测试，未接线）；R33 / R34 设计与决策进入 `NEXT_STEPS` 待设计池。
- **测试**：394 项 / 391 通过 / 0 失败 / 3 跳过（37 个测试文件）。

## 0.6.7 — 2026-11-10

> **主题**：S12 使用观测（R3 + R9 只读部分），**不改记忆行为**——只把"插件自己干了什么"落成可跨重启读的数据，供 0.7.0 攒数据与调参（NEXT_STEPS §1.1 的 start gate 靠它）。设计合同：[§14 使用观测与容量统计](docs/design/14-observability.md)。
> 发布物：tag [`v0.6.7`](https://github.com/JIUYUE-SEP/DSH-Neural-Mind/releases/tag/v0.6.7) + GitHub Release（**不发 npm**）；Release asset = 候选包 `neural-mind-0.6.7-candidate.tgz`（60 文件，含 MIT LICENSE，353,521 B，SHA256 `DA3F45B8…D93120`；见 [bench-results/artifacts/SHA256SUMS](bench-results/artifacts/SHA256SUMS)）。
> **验证状态**：2026-11-10 从 0.6.7 最终 HEAD 重跑 `verify:release` **PASS**（EXIT=0）——npm test **380/377/0/3**、`check:host` 51/51、`check:shapes` 10/10、`check:conform` 39/0、`check:design` P0+P1（6 提交 / 0 漂移）、E2E 24/24（源码 + tarball 各一次）、升级 smoke 0.5.0→0.6.7 PASS、默认冒烟 26/26、N1 PASS、`release-matrix` PASS（60 文件 tarball）。原始日志：[bench-results/verify-release-0.6.7.log](bench-results/verify-release-0.6.7.log)（已脱敏）。

- **R3 使用情况持久化（新增独立域 `neural_mind_usage` v1，不升主域版本）**：注入 / 跳过 / 提炼 / 召回计数按天汇总（默认保留 30 天，`usageRetentionDays`）+ 明细滚动记录（7 天 / 2000 条上限）；跳过原因分层——`workspace-disabled` / `auto-recall-off` / `subagent` 等环境类只进日汇总，`no-hits` 每日采样 20 条，`pressure` / `inline-timeout` / `search-unavailable` / `inject-error` 与成功注入写明细。落盘走 3 秒 debounce + read-merge-write，失败下轮重试、域打不开整体退化为进程内（等价 0.6.6 行为），清理写 `usage-pruned` 审计。**不存正文与查询原文**：只有计数、记忆 id 与分数/枚举。
- **注入质量元数据（只记录，不拦截）**：成功注入的明细附逐条 `r`（RRF 融合相关度）/ `s`（最终分）/ `c`（可信度）/ `e`（证据净值）/ `src` / `k` / `v`（代码锚核验结果）与聚合 `quality`；**不参与排序、过滤与注入结果**（有测试断言遥测开关下注入文本一致）。低相关/低可信的实时拦截未做，登记为待定条目 R32（[NEXT_STEPS](NEXT_STEPS.md) §3.1.2）。
- **R9 只读容量统计**：`/neural-mind/api` 新增 `usage` 与 `pool` 动作——日汇总 / 明细 / 保留策略，以及条数、体积估算（JSON 字节，标注"估算"）、重复候选组（只报组数不列正文）、过期候选、队列健康；只读（不 update/delete/写审计）、60 秒缓存、5 万条扫描上限 + `partial` 标记。清理动作（显式工具）留 S16。
- **配置 +2 项**：`usageLog`（默认 true）、`usageRetentionDays`（默认 30），均在高级层；账本 68 → 70，常用层不变。
- **总览卡**：最近注入优先读落盘明细（跨重启可看，失败退回进程内注入日志）；新增只读「使用量」卡（今日注入 / 跳过 / 提炼 / 召回 + 质量均值 + 保留策略）；注入行显示「相关 0.72 · 可信 0.81」与低可信条数。`lib/client.js` 重建：306,621 → 311,964 B。
- **测试**：380 项 / 377 通过 / 0 失败 / 3 跳过（+13：观测核心 9、域 spec 1、sink/API 3、客户端 1）。

## 0.6.6 — 2026-11-09

> **仓库重建（2026-11-09，用户裁决）**：旧仓库（含全部历史提交与旧 tag/Release）已删除，重建为 `JIUYUE-SEP/neural-mind` 的 **public 单提交仓库**（内容 = 改名后的 0.6.6 工作树）。0.6.5 及更早的 tag / Release 不再存在；下方历史条目里的旧 Release 链接仅作历史记录。
> 发布物：tag [`v0.6.6`](https://github.com/JIUYUE-SEP/DSH-Neural-Mind/releases/tag/v0.6.6) + GitHub Release（**不发 npm**）；Release asset 即候选包 `neural-mind-0.6.6-candidate.tgz`（59 文件，含 MIT LICENSE，339,282 B；SHA256 见 [bench-results/artifacts/SHA256SUMS](bench-results/artifacts/SHA256SUMS)）。
> **验证状态**：2026-11-09 改名 + 重打包后从最终 HEAD 重跑 `verify:release` **PASS**（EXIT=0）——npm test 367/364/0/3、`check:host` 51/51、`check:shapes` 10/10、`check:conform` 39/0、`check:design` P0+P1（`ROOT` 基线：0 提交 / 0 漂移）、E2E 24/24（源码 + tarball 各一次）、升级 smoke 0.5.0→0.6.6 PASS、默认冒烟 26/26、N1 PASS、`release-matrix` PASS（59 文件 tarball）。原始日志：[bench-results/verify-release-0.6.6.log](bench-results/verify-release-0.6.6.log)（已脱敏）；候选包 339,282 B，SHA256 见 [bench-results/artifacts/SHA256SUMS](bench-results/artifacts/SHA256SUMS)。

**主题：正确性补丁 + 插件改名**（REVIEW §0.2 的 9 项中 R0 已随 0.6.5 发布，其余 8 项落在本版；R13 拆 a/b、R16 追加 b 属于实施拆分，不改变项数。另含一处发布工具修复；R26 为源码逐条抽查新增；改名为发布前用户裁决）

- **插件改名 `dsh-plugin-memory` → `neural-mind`（2026-11-09，用户裁决：原名太像 DSH 官方插件）**：包名 / 仓库名 / `export const name` / 客户端 `definition.id` / `cordis.patch.yml` entry id（`memory` → `neural-mind`）/ 设置命名空间 / 注入消息来源 kind（`plugin:neural-mind`）/ 页面数据路由（`/neural-mind/api`，自定义头 `x-neural-mind-client`）/ 默认画像示例路径全部同步；**存储域名** `memory` → `neural_mind`、`memory_extract` → `neural_mind_extract`。**迁移**：domain `version` 2 → 3（`globalState` 增可选 `migratedDomains`，`compatibleVersions: [1, 2]`），首次启动把旧 `storages/memory` 的记录按 key 补进新域（只读旧域、旧目录保留可回滚；失败不写标记并在下次启动重试；批次答卷域是 7 天短命缓存，不迁移）。迁移实现见 `lib/store.js` 的 `openStore` / `migrateLegacyDomain`，旧域 spec 见 `lib/schema.js` 的 `legacyDomainSpec()`。**兼容**：读侧继续认改名前的 `plugin:dsh-plugin-memory`（V4）与 `{kind:'plugin', plugin:'dsh-plugin-memory'}`（V3）——历史会话日志不追溯；旧包回滚仍读旧域。测试：**367 项 / 364 通过 / 0 失败 / 3 跳过**（新增存储迁移 3、域 spec 契约 1，并补旧来源兼容断言）。

- **R26 画像路径展开与缺失提示（源码逐条抽查新增）**：`profileFile` 支持 `~/…` / `~\…` 展开；光写 `~`（指家目录，永远不是文件）启动时**拒绝并留 stderr + 审计 `profile-path-rejected`**；配置了但文件不存在时按空画像处理，并留**一次** stderr + 审计 `profile-file-missing`——此前是静默空画像，路径写错的用户完全无感；设置页快照新增 `exists`，画像页据此显示"文件不存在"警告；保存时自动创建父目录。测试：**363 项 / 360 通过 / 0 失败 / 3 跳过**（新增路径展开、非法 `~`、缺失提示、页面警告等 5 项）。

- **R4 敏感自动标记默认关闭**：`sensitiveKeywords` 默认 `[]`、`sensitiveNoCross` 默认 `false`；整理提示词不再要求模型标 `sensitive`（字段保留兼容，旧记录/旧模型输出照常解析）。理由：`prescreenSensitive` 是"包含就算"，实测本机 5/5 条 L0 被误标（emo⊂memory、NDA⊂standard、诊断⊂诊断卡），而 `sensitiveNoCross` 默认开着，技术记忆因此失去跨工作区带入资格；单人本机使用不需要这层隔离。字段、开关、手动标记（R1a）全部保留，要隔离时自己打开并填词表。测试（R4 完成时）：**312 项 / 309 通过 / 0 失败 / 3 跳过**（新增 5 项：默认值 3、默认不误标 1、默认不拦跨域 1）；`check:ledger` / `check:seams` / `check:conform` 通过。

- **R18 纯 BM25 默认相关性门槛校准**：`relevanceGate.bm25OnlyMin` 默认 **2 → 10**（绝大多数用户没配 embedding，实际走纯 BM25；旧默认在 frozen-v2 上负例注入 6/13、R@1 0.973）。`tools/eval-frozen.mjs` 增加 `--lane bm25|hybrid|both`，两条评估路径分开报；`bench-results/frozen-v2.json` 同时存两组指标。结果：纯 BM25 路径负例注入 **6/13（均 2.15 条）→ 2/13（均 0.77 条）**、R@1 **0.973 → 1.000**、R@5 不变；混合路不受影响（2/13、R@1 1.0）；小池子保护 `bm25OnlyMinPoolSize=30` 保留。测试：**313 项 / 310 通过 / 0 失败 / 3 跳过**（新增默认值断言 1 项 + eval 双路径断言）；`check:ledger` / `check:seams` / `check:conform` 通过。

- **R13a 工具接口小修（不碰来源判定，来源判定在 R13b）**：① `memory_recall` 结果**不再静默截断**——新增 `limit`（1–20，默认 10），内部多取 1 条，被截断时末尾标注"共显示前 N 条，还有更多；可用 time / session / 更具体的 query 收窄，或调大 limit"；② `memory_forget` 的"同 entity 相关记忆"回显加上限（最多 10 条 + 总数 + 未列出条数），库越大回显不再无限涨；③ **自动带入的长期记忆行带 `[m_…]` 编号**（计入 `injectMaxChars` 额度），模型可对刚看到的事实直接 forget / 纠错；④ **画像截断保护**：外部画像文件超过 20,000 字符时快照只返回前 20,000 字符，此时 `profileSave` 直接拒绝、记忆页保存按钮禁用——修复"一保存就把截断版写回、尾部永久丢失"。测试：**316 项 / 313 通过 / 0 失败 / 3 跳过**（新增 recall limit、forget 上限、注入编号、画像拒写 4 项）；`check:ledger` / `check:seams` / `check:conform` 通过。

- **R8a 长回合不再整粒丢弃**：新增 `extractToolOutputMaxChars`（默认 8000），**只截"送去后台整理"这条路的工具输出**——成功输出留头部、失败输出留头留尾保住报错特征，用户/助手正文不截；截短后整回合再按现成的 `hotBufferTurnMaxChars`（32768）截断（记审计 `extract-turn-truncated`），单回合因此恒能进 64K 批输入，旧行为"超 `extractMaxInputChars` 整条跳过、48h 后删除"降级为配置矛盾时的安全网。`renderOriginal` 新增可选 `opts`，工具层 `memory_recall` 展开原文不传（仍只受 `recallFullMaxChars` 约束）。**顺带修掉一个静默丢失**：`renderOriginal` 直接迭代 `eventsToTurnParts` 产出的 Map（拿到的是 `[callId, call]` 数组），导致展开原文里的工具产出一直被丢掉——新增 `toolCallsOf()` 归一数组/Map 两种形状。本机证据：5 条 L0 里 3 条曾因单回合 >65,536 字符被删。测试：**320 项 / 317 通过 / 0 失败 / 3 跳过**（新增整理输入截断 1、正文超限截断 1、上限只对显式传参生效 1、展开原文不受影响 1）；`check:ledger`（§10 +1 键）/ `check:seams` / `check:conform` 通过。

- **R14 去重即印证**：同一内容再次出现不再只写"重复跳过"，而是补一条**系统权重（0.5）**的 `reinforce` 证据——反复出现的事实不会再随时间降权被吃掉。提炼去重命中 `active` 条目、`memory_remember` 命中已生效条目各记一条（remember 返回"已印证（第 N 次）"）；**同批同内容只记一次**（本批新建记录不补、内容键去重、批首回合 outbox `createdAt` 作幂等键，半批重试不会重复记）；`state` 类顺带续期。`negativeSince` 只在该条目**没有用户级质疑**（weight ≥ `evidenceWeights.user` 的 challenge）时才由通用对账清除——系统重复不能替用户翻案。按权重判定而非新增字段，不升存储格式；新增纯函数 `applyReinforce`/`hasUserChallenge`（rank.js）。测试：**324 项 / 321 通过 / 0 失败 / 3 跳过**（新增连续 3 次出现证据 +2、无质疑清 negativeSince + 续期、有质疑保留、同批只记一次 4 项）；`check:ledger` / `check:seams` / `check:conform` 通过。

- **R16 关掉提炼后的缓存上限**：`extractEnabled=false`（用户主动关掉整理）时，未消化的 L0 副本此前**永不过期**——用户以为只是省模型调用，实际历史原文一直参与查找与自动带入。新增 `hotBufferUndigestedTtlHours`（默认 168 小时，0=关掉该上限）：超期副本在删除前必须确认**原文仍能从会话日志读回**，读得回 → 删副本 + 审计 `hot-dropped-undigested`（写明"提炼已关闭"）；读不回/`sessionQuery` 缺席 → **保留** + 审计 `hot-retained-undigested` + 告警（同一进程只告警一次）。**服务临时降级（`extractEnabled` 仍为 true）不适用**，仍按"未消化不过期"处理。DESIGN §9.9"不物理删除"例外扩到两处且都只删副本。测试：**328 项 / 325 通过 / 0 失败 / 3 跳过**（新增可读回删除、读不回保留并告警、服务降级不删、0=不删 4 项）；`check:ledger`（§10 +1 键）/ `check:seams` / `check:conform` 通过。

- **R16b 重新打开提炼时补提炼**（2026-11-09 用户裁决"选 C"）：关掉提炼期间写下的回合只有 L0 副本、从没登记过 outbox，重新打开后**不会自动补做提炼**。现在启动时（`extractEnabled=true`）把"未消化、没有任何 outbox 引用"的 L0 副本按时间顺序补登记、按正常攒批补做一次提炼（审计 `hot-orphans-backfilled` + 一行日志）。不重复登记：已有 outbox 行（含 dead/skipped）不动；hidden/死信/已消化跳过；停用工作区跳过。积压由 R16 的 168h 上限兜底（最多约一周的回合）；补提炼的模型调用成本是明确接受的代价。测试：**331 项 / 328 通过 / 0 失败 / 3 跳过**（新增孤儿补提炼、停用工作区跳过、已有 outbox/已消化/hidden 不重复登记 3 项）；`check:ledger` / `check:seams` / `check:conform` 通过。

- **R13b 来源三段判定（不再听模型自报）**：`memory_remember` 原先一律写 `source:"user"`、整理侧采信模型自报——而 `confirm` / `stagedBy` / `source` 都是模型可填参数。现在：① **整理写入**按 `sourceRange` 回看会话原文角色判定，**整批全都来自用户消息才记 user**，混合/助手/工具一律 assistant（`code`/`tool`/`quote` 保留为内容分类）；② `memory_remember` 新增可选参数 **`userQuote`**（用户原话引用），工具用 NFKC+空白折叠核对它确实出现在本会话用户消息里，通过才记 user，否则 assistant；`confirm` 不再给用户权重证据；③ 控制台确认写 `confirmedByUser`（工具之外的可信信号），措辞"你确认过"；④ 渲染措辞三档：你之前说过 / 助手之前记下的 / 你确认过，旧数据无 provenance 标 `source:"unknown"`（来源查不清）；⑤ 启动时一次性回填旧记录（`sourceRemapVersion` 防重跑）：有 sessionId+sourceRange 的按原文角色重算，没有的标 unknown，审计 `source-backfilled`。存储只加可选字段 `confirmedByUser`、source 枚举加 `unknown`，不升 domain 版本。测试：**343 项 / 340 通过 / 0 失败 / 3 跳过**（新增 provenance 6、pipeline 3、tools 3；原"不带引用即用户"的用例按新语义改断言）；`check:ledger` / `check:seams` / `check:conform` 通过；客户端 bundle 重建。

- **R15a 整理过程可见**：原先整理失败、找不到可用模型路由都只写 `logger.info`，用户只感觉"没记住"，也答不出"上次整理什么时候、为什么失败、丢了多少条"。现在 `/neural-mind/api` 的 `stats` 增加 `lastExtract:{at, ok, reason, batchTurns, chars}`（最近一次落定的整理）与 `drops:{lowConfidence, injection, secret, oversized}`（本次运行被过滤/丢掉的候选条目，按原因分开）；失败按批次限频写审计 `extract-failed`（第一次失败一条、重试耗尽转死信再一条，中间重试不刷屏；首次即耗尽时只留最终一条；找不到模型路由按会话限频一条）；总览健康检查显示"上次整理什么时候、成功没、为什么失败"（失败优先于积压/死信提示），丢弃计数非零时单独一行按原因列出。状态是**进程内**的（重启归零，持久线索看审计）。测试：**349 项 / 346 通过 / 0 失败 / 3 跳过**（新增 extract-visibility 5 项、client-overview 1 项）；`check:conform` 37 → **38 条**；客户端 bundle 重建。

- **R1a 记忆管理操作与来源追溯**：控制台从"看得见、改不动"变成能动手——详情页新增 **停用 / 恢复、标为敏感 / 取消、彻底隐藏（二次确认）、展开来源轮次**；后台 `/neural-mind/api` 新增 `archive` / `restore` / `sensitive` / `hide` / `expandSource`，沿用现有存储与操作记录（`memory-archived` / `memory-restored` / `memory-sensitive-set`；彻底隐藏沿用 `forget-hard`），不升存储格式、不物理删除。**单一实现**：新增 `lib/ops.js`，把 `forget` 的 hard 处理（级联 L0 / 终止同源 outbox / 审计正文打码）从 `lib/tools.js` 抽出，`memory_forget(hard=true)` 与控制台「彻底隐藏」共用；`memory_recall` 按 id 展开与控制台「展开来源轮次」共用 `expandOriginal`（控制台不套"同工作区"的工具跨域闸门）。**恢复语义**：清 `negativeSince`、`state` 续期，避免下一次清扫立刻再归档；`hidden` 不可恢复。**来源追溯**：`detail` 返回 `sessionId` / `sourceRange` / `sourceExpandable`，`hb_…` 临时原文缓存支持只读详情；展开时过滤 hard forget 区间与正文。测试：**358 项 / 355 通过 / 0 失败 / 3 跳过**（新增 r1a-ops 5 项、client-memories 4 项）；`check:conform` 38 → **39 条**；客户端 bundle 重建。

- **发布工具修复（0.6.6 候选包验证时发现）**：`tools/upgrade-smoke.mjs` 里"profile 是否切到候选包"的断言原先硬编码 `0.6.5`，而 `release-matrix` 的 `npm pack` 产物名是 `neural-mind-0.6.6.tgz`（不带 `-candidate`），导致升级 smoke 误报失败。现在从候选包文件名解析版本号（`-candidate` 与非 `-candidate` 两种命名都认）；修后 `release-matrix` 在 0.6.6 上 PASS。

**发布准备（文档与许可，不改运行时代码）**

- **门禁适配历史压缩**：公开前历史重写为**单提交**，`docs/design/.baseline` 改用 `ROOT` 哨兵（`tools/check-design.mjs` 解析成仓库根提交），P1 从根提交起算——当前 HEAD 即根时区间为空（0 提交 / 0 漂移），之后的新提交照常按"同提交纪律"检查。旧仓库历史只保留在本地 `backup/pre-rewrite` 分支，不随公开仓库发布。
- 加入 **MIT LICENSE**，仓库转为 **public**（`740dc8f`），候选包重打包含 LICENSE；公开前脱敏——移除个人信息、本机路径与用户名（`ae77dff`），当前 HEAD 不含这些信息。
- 文档体系重整：旧文档冻结进 `docs/legacy/`（带实施状态索引）、`STATUS.md` 收敛为唯一事实来源、设计文档按 § 编号拆分进 `docs/design/`、README 重写为公开主页。

## 0.6.5 — 2026-11-09

> Release：<https://github.com/JIUYUE-SEP/neural-mind/releases/tag/v0.6.5>（tag `v0.6.5`；仓库于 2026-11-09 转为 public）

**主题：冷启动注册竞态修复 + DSH 0.2.2-rc.1 兼容核查（v1.17）**

- **修复冷启动首轮"记忆工具缺失 / 注入为 0"**：`apply` 原来是"发起 boot 后立即返回"，工具与注入的注册都在异步 boot 里完成；DSH 0.2.2-rc.1 启动更快，首轮 pre-step 在注册落地前就解析了工具集——实测 `memory_remember` 返回 `UNKNOWN_TOOL`、第二轮注入 0。现在 `apply` 改为 async 并 `await` 第一次 boot 再返回（boot 失败仍由 `reboot()` 内部吞掉并记 health/stderr，不阻断宿主）。E2E 在 0.2.2-rc.1 上从 20/24 回到 **24/24**。
- **宿主静态核查**：`check:host` **51/51**、`check:shapes` **9/9**。4 条接缝断言改为兼容 0.2.1 / 0.2.2 两种内部写法（`entry.fiber.effectiveConfig`、apply 前解析后的 config、`readClientBundle` 包装）；`tools/lib/host-asar.mjs` 支持 `app.asar.unpacked` 条目（0.2.2 把 tslib 等整包 unpacked，旧读取器会误判"包不存在"）。
- **升级 smoke**：0.5.0 旧包同样有冷启动竞态且不能改，旧版写不进时按旧版存储格式（v2）种一条后继续验证"升级保留 + 新版读取"；`release-matrix` 在 0.2.2-rc.1 上 PASS。
- 测试：**307 项 / 304 通过 / 0 失败 / 3 跳过**；`npm run verify:release` 在 DSH 0.2.2-rc.1 上整体通过（含 E2E 24/24、升级 smoke、release-matrix、N1）。

**主题：记忆控制台重设计（v1.15）+ 工作区选择器三源合并与回合管道降级自愈（v1.16）**

- 配置页「停用的工作区」不再只依赖 `seenWorkspaces`：选择器合并 **DSH 工作区注册表**（`ctx.get("workspaceRegistry").list()`，0.2.x；带标题与顺序）、插件记录过的 `seenWorkspaces`、记忆池里的 `workspaceId` 三个来源。全新安装 / 还没处理过回合 / 回合管道曾失效过，都能看到用户已有的工作区。行 id 仍是路径（`disabledWorkspaces` 写入口径），label 优先注册表标题；monorepo 子路径记忆并入仓库根行计数；注册表缺席或抛错时静默退回旧口径。
- 修复 `globalState` 未声明 `seenWorkspaces` 的 schema bug：`storageDomain` 每次 open 都用 zod 校验 global，未声明键会被 **strip**——真实表现是「保存一次设置（触发热重建）后已知工作区归零、下次写入只剩一条」。现已声明为可选数组，老 profile 向后兼容。
- 启动顺序改为「先接回合管道，再跑可降级的后置步骤」：`handleTurnFn` 在 API / 工具 / SOUL 注册后立即激活并消化 `pendingPkgs`；`outbox` 对账、清扫、重嵌入调度、首启引导失败只记 `health.warnings` + `boot-degraded` 审计，不再让插件变成「页面能开、回合永远不记录」的静默僵尸。boot 彻底失败时落 `boot-failed` 审计，并把 `{state,error,at,warnings}` 放进 `/neural-mind/api` 的 `stats.health`。
- 配置页「需要关注」新增「记忆回合管道未启动：{error}」告警（`stats.health.state === "failed"`），把此前只能靠 stderr 发现的失效摆到页面上。
- 测试：**307 项 / 304 通过 / 0 失败 / 3 跳过**；新增 global schema 保留 `seenWorkspaces` 一例、选择器注册表合并 / 注册表异常降级两例。

**主题：记忆控制台重设计（v1.15）**

- 主面板从"五张卡页签"升级为 **7 页签记忆控制台**：总览 / 记忆 / 召回 / 配置 / 画像 / SOUL / 审计（默认总览；页签首次切到才挂载、之后保持挂载）；页头有全局状态条（存储 / 向量路 / 自动召回 / 工作区范围）与「刷新」。
- **总览**：健康检查清单（存储/向量/提炼/自动召回/工作区/画像/SOUL）+ KPI（长期记忆、热缓冲、提炼队列、向量覆盖、本次运行注入、工作区）+ **最近注入**（注入了什么、多少条字符、被跳过时的原因）+ 记忆构成 + 最近审计。
- **记忆管理台**：搜索 250ms 防抖、状态/类型/工作区筛选（带 facets 计数）、排序（最新/最早/重要度）、独立详情（完整正文、字段网格、证据时间线、复制 ID/正文、暂存确认/拒绝）、加载更多、三态空态。
- **召回试验台（新）**：按**注入路径**跑一次 `search.diagnose`，展示候选池、BM25/向量两路命中与原始分、闸门判据、系数明细与命中片段，以及**注入预览与字符预算**；只读，不写记忆、不改状态。
- **配置页重设计**：分组折叠（带「已改 n 项」）+ 关键词搜索 + 「需要关注」诊断卡 + 数字有限性校验 + 逐项「已覆盖/重置」+ 工作区选择器升级（搜索/全部启用/全部停用/条数/最近出现/手动兜底）；26 个字段与 `configForms` 写入通道不变。
- **画像 / SOUL / 审计**：视觉与信息层级重排，画像/SOUL 行为与 API 调用序列不变；审计支持类型下拉 + 关键词筛选。
- **宿主 API 扩展（只增不改）**：新增 `overview`（首屏聚合）、`injections`（注入日志）、`detail`（单条详情，不返回向量本体）、`recallPreview`（注入路径诊断 + 预览）；`list` 增加 `kind` / `workspaceId` / `sort` 与 `facets`。
- **注入日志** `lib/injectionlog.js`：进程内环形缓冲 60 条，记录 `mode`/`reason`/条数/字符/会话短 id/工作区/`hitIds`；**不记注入正文、不记用户查询原文**；`skip` 原因码 9 种（workspace-disabled / auto-recall-off / no-query / pressure / inline-timeout / search-unavailable / no-hits / subagent / inject-error）。
- 浏览器半按"外壳 + 共享原子组件 + 每面板"拆分（`shell.js`/`components.js`/`css/*`/`i18n/*`），`lib/client.js` 产物重建（约 293 KB / 26 个模块）；测试从单文件拆成 `client-shell`/`client-locale`/各面板，新增 `test/api-console.test.mjs`；`check:conform` 32 → **34 条**。
- 测试：**304 项 / 301 通过 / 0 失败 / 3 跳过**；UI 视觉验收用离线渲染 + 无头 Edge 截图（7 页签 × 亮/暗 × 四态，见 docs/legacy/VERIFICATION-2026-11.md §8）。

**主题：工作区启用范围 + 召回总开关（v1.14）**

- 新增 `disabledWorkspaces`：按工作区**完全停用**记忆（不写 L0/outbox、不提炼、不召回、不注入，记忆工具明确拒绝并说明去哪启用）；记忆页新增「工作区」选择器（勾选启用 + 手动路径兜底；数据源是插件记录过的 `seenWorkspaces`，**停用的工作区也保留**，否则停用后无法再启用）。这是**运行开关，不是检索域隔离**：检索仍固定 global。
- 新增 `autoRecall`：自动召回注入总开关；关闭后照常写记忆、照常提炼，只是不在对话里自动注入；手动 `memory_recall` 工具不受影响，画像/SOUL 常驻段不受影响。
- `/neural-mind/api` 新增 `workspaces` action；配置页可编辑面 26 → 28（配置卡 26 + SOUL 2）。
- 测试：229 项 / 226 通过 / 0 失败 / 3 跳过；`check:conform` 31 → 32 条。

**主题：注入质量默认值（注入过多 / 错误注入修复，v1.13）**

- `relevanceGate.enabled` 默认 `false` → `true`：注入前按两路原始分做绝对相关性准入。冻结集（frozen-v1，16 条池子）负例注入 **5/5 → 1/5**、正例平均注入 **4.6 → 1.4 条**（R@1 0.75 → 0.875、R@5 1.00 → 0.875；真池子 2026-09-17 实测 R@5 持平、负例 5.0 → 0.25~0.3）。
- 新增纯 BM25 单路准入：`bm25OnlyMin`（默认 2）+ `bm25OnlyMinPoolSize`（默认 30）。旧行为“纯 BM25 时整条闸门不生效”，没配 embedding 的用户享受不到任何降噪；现在池子够大时按关键词路绝对分准入，`recall` 不受影响。
- `openingDigest` 默认 `true` → `false`：开闸门后“零有效命中”变常见，旧默认会把近期动态塞给无关闲聊（错误注入的第二个来源）；要“主动记挂”再打开。
- 向量维度防呆：嵌入响应当场校验维度——同批不等长按 `shape` 降级；**跨响应维度变化**（端点换了模型但 `modelId` 没改）记 `dim-mismatch` 并降级纯 BM25，绝不混用两种维度。检索侧发现库中向量维度与当前查询不符时**跳过该段并记账**（此前 `cosine()` 对不等长静默返回 0，表现只是“向量路聋了”零告警），并触发后台重嵌入自愈（`modelId` 未改也能修好）。零 schema 变更、零配置新增。
- 评估集升级：新增 **`frozen-v2`**（215 条记忆 + 20 条 L0，37 正例 / 13 负例，含 4 条困难负例与 3 条隐私负例；确定性 **1024 维**向量，对齐 bge-m3/qwen3-embedding 等真实模型维度——插件本身不限定维度，端点返回多少维就存多少），**固定评估基准时间**（时间衰减不再随真实运行日期漂移）；`frozen-v1` 保留作历史对照（`node tools/eval-frozen.mjs --dataset frozen-v1`）。v2 基线：R@1/R@5/MRR 1.0/1.0/1.0、闲聊负例 0 注入、困难负例 2/4、关系候选召回 0.375（含 superseded 后验降权说明）。
- 测试：新增“无关查询不注入 / 相关查询照常注入”端到端用例、纯 BM25 门槛与池子护栏两例、向量维度防呆三例；`eval-frozen` 断言负例注入 ≤1、无关查询零注入、正例平均注入 ≤3；`check:conform` 28 → 31 条。223 项 / 220 通过 / 0 失败 / 3 跳过。

**主题：记忆入口搬到主侧栏**

- 「记忆」从设置弹窗搬到主侧栏，排在「自动化任务」之后（`sidebar.panellist` order 20）；点击在右侧主区域打开页面（`main` 槽 key `memory`，与侧栏 id 同源；0.6.6 改名后为 `neural-mind`）。
- 记忆页内部改为五个页签：浏览 / 配置 / 画像 / SOUL / 审计；五张卡片原样复用，非当前页签隐藏但保持挂载。
- 设置弹窗不再登记 `settings.section`，入口只有侧栏一处；配置写入仍走 `ctx.configForms.get('memory')`。
- 页内版式对齐宿主管理页（居中 960px、页内滚动、`--dsw-alias-*` 主题令牌）；侧栏图标为自带内联 SVG，不引入宿主 Client 包。
- `check:host` 增加 5 条主侧栏接缝断言（`sidebar.panellist` 声明/渲染/点击、`main` keyed 选择、`selectPanel` 未注册校验），46 → 51 条。
- **浏览页重设计（同日）**：工具栏（全宽搜索 + 刷新）、带计数的状态筛选；列表只留两行正文与一行元数据，可扫读；点行进入独立详情（完整正文 + 工作区/时间语义/重要度/有效期/ID 等结构化字段），暂存条目的确认/拒绝在列表与详情都可操作；空态区分「池空 / 搜索无匹配 / 该状态无记忆」。
- 版式细节：标题下加一句页面简介；页签改为分段控件；卡片、审计行重新排版；画像编辑器在页面里加高。
- 修复：画像编辑器是块级排版，textarea 原来按默认 `cols` 缩成一小条（不撑满卡片）；改为 `textarea.mem-profile-text` 显式 `width:100%`，字号 12/20。
- 测试：218 项 / 215 通过 / 0 失败 / 3 跳过。

## 0.6.4 — 2026-11-02

**主题：配置页逻辑布局重排**

- 设置页配置卡重排：Embedding 改成“端点 → 模型 → 凭据名 → 只写 Key → 免密钥 → 测试连接 → 高级选项”的顺序；其他组按“写入与提炼 / 注入 / 隐私 / 画像”折叠，默认只展开前两组。
- 测试：216 项 / 213 通过 / 0 失败 / 3 跳过。

## 0.6.3 — 2026-11-02

**主题：只写 API Key 输入框 + embedding 凭据后补修复**

- 设置页：新增只写不显示的「API Key」输入框；先填凭据变量名，再保存 Key 到 DSH credentials；页面只显示已配置/来源。
- embedding 凭据：去掉进程内 key 缓存；启动后补 credentials 文件/环境变量即可生效，无需重启插件。
- 设置页：凭据状态接口失败时显示错误，不再永久停在“加载中”。
- 测试：216 项 / 213 通过 / 0 失败 / 3 跳过。

## 0.6.2 — 2026-10-27

**主题：设置页交互优化 + embedding 连接测试 + N1 验收**

- N1：新增 `tools/default-extract-smoke.mjs`，用 SDK stdio 长驻 profile 验证默认批次提炼；已接进 `release-matrix`。
- 测试夹具：mock LLM 支持通过 `DSH_MOCK_EXTRACT_FACT` 返回一条可断言的提炼产物。
- 设置页：搜索防抖 + 丢弃过期响应；加载/空态区分；确认/拒绝失败可见；画像未保存时禁止重载并提供“放弃修改”；SOUL 覆盖层内补上回滚确认条。
- 设置页：新增“测试 embedding 连接”，显示模型、向量维度和延迟；失败时显示可读错误。
- 测试：214 项 / 211 通过 / 0 失败 / 3 跳过。

## 0.6.1 — 2026-10-27

**主题：D2a 关系安全护栏**

- 跨 workspace 只允许 `user` 级 `reinforce`；取代/争议一律不跨域。
- `reinforce`/`dispute` 必须有同主体 entity；`contradict` 同主体且新不早于旧才可取代。
- `temporal` / `validUntil` 不一致不写关系；过期 state 不再被强化/取代。
- 无 entity 的调试假设链：同 session、同 source、14 天内放行；代码锚按 `filePaths` 交集放行。
- 关系候选先按同 workspace（或 user 级）过滤；接受/拒绝都写审计。
- 测试：209 项 / 206 通过 / 0 失败 / 3 跳过。

## 0.6.0 — 2026-10-27

**主题：可信化收口（A9/A10 + B1-B3 + D1/D3）**

- A9：hard forget 与提炼并发时整批放弃；hidden L0 不被 7 天清扫误删；重嵌入 TOCTOU 修复。
- A10：退避按 `nextRetryAt` 续排；独立 `neural_mind_extract` 域保存批次答卷；关系写失败不被批次完成掩盖。
- W3：L0 注入转义；excerpt 单 chunk；resident/digest 状态；openingDigest 可见性；storage 超时清理。
- A7：LLM 超产 facts 时关系不塌缩到 lesson。
- B1：frozen-v1 冻结评估集。
- B2：1k/5k/20k 确定性基准。
- B3：固定 artifact + 升级 smoke + release-matrix。
- D1：规范化去重 + 可选 `entity` + 并发 remember 幂等 + staged→confirm 复用。
- D3：L0/L2 同一事实跨层去重；争议/被取代/staged 不折叠。
- 测试：201 项 / 198 通过 / 0 失败 / 3 跳过。
- Release：`v0.6.0`。

## 0.5.0 — 2026-10-26

**主题：DSH 0.2.1-rc.3 / Session 格式 V4 兼容修复**

- 注入消息改用 V4 生产者来源 `plugin:neural-mind`；
- `tool/result` 按 V4 tool 角色消息解析；
- 压缩回冲匹配两代兼容；
- 移除退役的 `dsh.client.inject` 包；
- 扩大 `check:host` 到 46 条接缝；
- 对话 E2E 24/24。

## 0.4.1 及更早

见 `git log`、`docs/legacy/HANDOFF.md`、`docs/legacy/IMPLEMENTATION.md`。这些文档保留历史细节，不再逐版维护。
