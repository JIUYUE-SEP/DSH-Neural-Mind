---
id: 1
title: "记忆模型:热缓冲 + 四层 + 暂存区"
status: 现行
since: 0.1.0
verified: 2026-11-09
code: [lib/schema.js, lib/hotbuffer.js, lib/text.js]
supersedes: []
superseded_by: null
---

# §1 记忆模型:热缓冲 + 四层 + 暂存区


```
L0  热缓冲(Hot Buffer)      —— 即时层。回合正文(助手代码块折叠、工具摘要/失败截断,
                                单轮超 32K 字符截断),零 LLM,秒级可被检索
                                带"新鲜未消化"标记;被慢速通道吸收后退出检索池
L1  Profile(用户画像层)     —— 用户偏好、项目约定、长期不变的东西
                                固定注入系统提示词,缓存友好
                                MVP:用户手编(只读);V2:提炼晋升(§3.2)
L2  Facts(事实层)           —— 三类:
                                fact   "发生了什么"("项目用 pnpm")
                                lesson "学到什么"("用户讨厌 emoji")
                                episode 话题摘要(MVP 暂落 L2,V2 升 L3)
L3  Episodes(经历层)        —— 话题/会话摘要带 importance(V2 独立成层;当前 episode 落 L2、无 TTL)
L4  Archive(仓库层)         —— 原始对话不复制存储,自持"引用索引"
                                (sessionId + 事件 seq 区间);读原文走 DSH 会话日志
Staging 暂存区              —— 显式通道落点(§3.3),低信任起步,可转正
```

**非记忆层:SOUL(自我设定)**——不在这张图里。人格不是记忆:不进提炼流水线、不参与检索排序、不受遗忘机制处置(SOUL 文件本身;提炼产出的"提议"是另一回事——它以 `entity='soul'`、`status='staged'` 落在 memories 池里,可被检索/动态注入,常驻 lesson 与设置页采纳通道除外)。四层各归其位:

| 层 | 装什么 | 谁写 | 归属 |
|---|---|---|---|
| 规矩 `$DSH_HOME/AGENTS.md` + 项目链 | "你要怎么做"(祈使句、项目命令、代码规范) | 用户 | DSH 原生 `@deepseek-ai/dsh-agent-instructions`(dsh-base 默认启用,65536 字节预算) |
| 角色 preset persona | "你此刻是谁"(编码 / 编排 / 极简) | 装配时定 | DSH 原生;会话内不可改;`complete: true` 的身份抑制一切插件段 |
| 人格 `$DSH_HOME/SOUL.md` | "我是个什么样的人"(性格、价值观、口吻、信条) | agent 自己 + 用户 | 本插件(§4.4) |
| 事实 记忆 L0/L2 | 经历(数据,不是指令) | 回合管道(L0)/ 提炼流水线(L2) | 本插件 |

### 每条记忆(L2/L3)的数据模型

```ts
{
  id: string
  content: string
  kind: 'fact' | 'lesson' | 'episode'
  source: 'user' | 'assistant' | 'code' | 'tool' | 'quote' | 'unknown'
                          // 来源分类(渲染措辞依据,§4.2)。**R13b 起不听模型自报**:
                          // user/assistant 由会话原文角色判定(整理)或用户原话核对
                          // (remember.userQuote)决定;code/tool/quote 是内容分类;
                          // unknown = 旧记录且无可复核 provenance("来源查不清",不猜)
  confirmedByUser?: boolean
                          // R13b:用户在界面点过确认(工具之外的可信信号,措辞"你确认过";
                          // 可选字段,不升存储格式版本)
  stagedBy?: 'user' | 'model'
                          // 写入通道的来源(§3.3):confirm=true → 直落 active、stagedBy='user'
                          // (注入特征只挂 suspect,密钥仍拒收;受 §6 的 TTL/negativeSince 归档);
                          // confirm=false → 落 staged、stagedBy='model'(严检、30 天未印证归档)。
                          // 注意:**不存在"user-explicit 先暂存再转正"的流程**——confirm 直接写
                          // active;只有 model-auto 的 staged 被 confirm 时才会转正。
  entity?: string           // 关联主体(项目/模块/人物/资料名;'user' 是用户本人的
                            // 规范字面值,提炼 prompt 负责归一);参与排序(§5.4)
  soulMode?: 'append' | 'replace'
                            // SOUL 提议形态(0.7.0 §4.4):'replace' = agent 提的整篇新文本,
                            // 采纳时整篇替换;缺省 = 'append' = 提炼器提的一句(采纳时追加)。
                            // 只对 entity='soul' 的暂存条有意义;可选字段,不升存储格式版本
  soulReason?: string       // SOUL 提议的理由(agent 通道必填;进提议列表与审计)
  soulNote?: string         // 用户忽略 SOUL 提议时填的理由(周回顾 prompt 用它讲"被拒过、为什么",
                            // 避免重复提);可选字段,不升存储格式版本——同 confirmedByUser 先例
  soulDecision?: 'adopted' | 'ignored'
                            // SOUL 提议的最终处理(0.7.0):adopted = 用户采纳并落笔,
                            // ignored = 用户忽略;只对 entity='soul' 的归档记录有意义。
                            // 可选字段,不升存储格式版本——老记录没有它时按审计
                            // soul-proposal-ignored(detail 以记录 id 开头)兜底判定,不猜
  filePaths?: string[]      // 文件锚(§4.2 注入前核验);代码/配置的值类事实必须带(§3.2 铁律;
                            // 提炼 prompt 只写了代码/配置域,办公产物锚规则尚未写进 prompt)
  anchorRoot?: string       // filePaths 锚的物理根 = 提炼时的 **git 根**(worktree 已归并为主仓根);
                            // 核验以锚根为准。跨**仓库**(当前 git 根 ≠ 锚根)时不记 challenge;
                            // 同仓不同 worktree 当前无法区分(anchorRoot 不保留 worktree 路径,§4.2)
  sensitive?: boolean       // 内容级敏感标记(可选,0.6.6 R4 起默认不自动产生):
                            // 健康/情绪/亲密关系/薪酬/人事/合同/未公开经营数据(§2/§3.2);
                            // 打开 sensitiveNoCross 后不跨 workspace 注入(默认关);
                            // L0 关键词初筛默认不启用(sensitiveKeywords 默认空),打开词表后恢复
  hidden?: boolean          // forget --hard 的访问屏蔽(§4.3):对检索、recall 及一切注入通道
                            // (含 openingDigest、常驻 lesson)不可见;trajectory 为尽力遮蔽
                            // (无 sourceRange 且正文对不上时仍可能回放);级联对应 L0 副本;审计保留
                            // (L1 晋升候选是 V2 机制,当前无代码)
  importance: 1..10         // ≥8 视为 high(配额防刷分带最小名额,§3.4)。
                            // **刻意不参与排序公式**(§5):防 LLM 自评刷分主导排序;
                            // 用于衰减豁免/配额/开场平局决胜,以及常驻 lesson 选择
                            // (证据系数×importance)与纯时间/会话 recall 的同时间排序
  confidence: number        // ≤0.5 不落盘;无文件锚的代码/配置值类事实上限 0.7(§3.2,
                            // 仅限代码域;生活/知识/偏好类不受此限)
  temporal: 'pattern' | 'state' | 'episode'
                          // 提炼指引(§3.2):知识论断/周期安排/长期偏好/关系状态
                          // 默认 pattern;项目进度/进行中生活状况默认 state;
                          // 一次性未来事件必带 validUntil
  todo?: boolean            // validUntil 的子类标记:行动项/承诺(deadline 类)。
                            // 事件类过期=结束(降权移区);行动项逾期≠完成,
                            // 不降权,渲染"原定 <date>,未见完成确认"(§6)
  eventTime: string         // 锚点换算(§3.2);未来事件锚到事件发生日
  expiresAt?: string        // state 类有效期(分档:含数值默认 stateTtlNumericDays,
                            // 其余 stateTtlDays,§6);召回即续期;核验通过亦续期;
                            // 带 validUntil 者取 max(正常 TTL, validUntil + 7 天宽限);
                            // importance≥8 且 E≥0 的 state 免 TTL(仍可被取代/质疑)
  lastVerifiedAt?: string   // 注入前核验通过的时间(§4.2);存在性级对比基准取
                            // max(eventTime, lastVerifiedAt)——核验通过可摘"待核实"帽;
                            // 二进制锚 mtime 更新时在**本轮注入核验**里以当前时刻重设
                            // (不是 mtime;recall 续期只改 expiresAt,不碰本字段)
  validUntil?: string       // 一次性未来事件/行动项的日期(§6)
  supersededBy?: string     // 被新事实取代的即时标记(§6):降权+措辞;不因 supersede 本身归档,
                            // 平反入口待 V2(当前无清除 supersededBy 的代码路径);
                            // 适用于带文件锚的漂移、同主体改口、被说服更新(§3.2)
  workspaceId: string       // 籍贯:git 仓库根 canonical 路径 + 相对子路径
                            //(monorepo 二级籍贯,§2);worktree 经 git-common-dir 归并;
                            // 非 git 目录回退 canonical cwd
  sessionId: string
  sourceRange?: { startSeq: number; endSeq: number }  // 原文引用(L4);可选(旧数据/热缓冲条目可能没有)
  evidence: { ts: string; weight: number; kind: 'reinforce' | 'challenge'; targetId?: string }[]
                          // 证据事件明细账(上界裁剪,evidenceMaxEntries 默认 64);
                          // weight:用户显式 1.0 / 系统推断 0.5(§5.3);
                          // targetId(v2 新增,可选):争议对互记 challenge 时指对端记忆 id,
                          // 渲染"存在争议"与成对注入不计续期的依据(§3.2 ②,§6)
  negativeSince?: string    // E ≤ −2 时记录(已是负值不清零、保持原时间);
                            // E 升回 > −2 即清零;归档判定见 §6
  status: 'active' | 'staged' | 'archived'
                          // archived:退出一切注入通道,但 recall 可见(渲染"已归档")
  chunks?: { text: string; embedding: number[] }[]
                          // 向量按段存储:≤chunkPlainMaxChars(默认 8K 字符,8192;按
                          // text.length 计,不是字节)短记录单段;
                          // 超长记录按 chunkSize/chunkOverlap 切段(§5)
                          // 段是检索粒度,父记忆是本体:籍贯/证据/重要性都在父身上
  embeddingModel?: string   // 指纹:换模型后旧向量作废,触发重嵌入或忽略向量路

  // ── 实现字段(v1.9 复核补录:自首版即在 lib/schema.js 的 memoryRecord 里,原文 §1 漏列)──
  createdAt: string         // 落盘时刻:时间衰减基准(与最近 reinforce 取新者,§5.2)、
                            // state TTL 起算点(§6)、model-auto 暂存 30 天自动归档的起算点(§3.3)
  workspaceLabel?: string   // 渲染用短名(仓库名/子路径);唯一键仍是 workspaceId,label 只给眼睛看(§2)
  batchKey?: string         // 提炼批次幂等键 sha1(sessionId + ':' + 本批 **outbox 条目 id** 升序 join(',')):
                            // 崩溃重提炼防重复落盘(§3.2)
  noExemption?: boolean     // pattern 超配额:保留分类但取消时间衰减豁免(§3.4"只降 importance 不改 temporal"的落点)
  suspect?: boolean         // user-explicit(confirm=true)命中**注入特征**时的软标记(§3.3:注入特征不硬拦,渲染"内容可疑,待确认";密钥形态仍拒收)
}
```

> **表与字段的真相源**:上面只列 L2/L3 记忆本体;同域另有 `hotbuffer`(L0,§3.1)、`outbox`(§3.0/§3.2)、`audit`(§8)、`soul_history`(§4.4)、`soul_signals`(§4.4「节奏:信号 → 周回顾」,`{ id, ts, sessionId, quote, note?, status: 'open' | 'consumed' }`:平时的用户原话候选证据,quote 写入侧截断 200 字符)**五张表**——`soul_signals` 是**纯新增一张表,不升 domain 版本**(记录格式没变,升版只会给降级上锁);另有**独立存储域 `neural_mind_extract`**(A10 起,`batches` 表存批次答卷,与主域 `neural_mind` 分开、不改主域版本)与 **`neural_mind_usage`**(0.6.7 §14 起,`days`/`recent` 两表存使用遥测——只有计数与质量元数据,不含记忆正文,同样不升主域版本),逐字段定义以 `lib/schema.js` 为准(新增字段同样走本节的版本纪律);域 spec 与改名前的旧域 spec 分别见 `domainSpec()` / `legacyDomainSpec()`(旧域只读迁移用,新写入一律用新域名)。

**版本纪律**:记录的**破坏性/语义**变更走 domain `version` 升版 + `compatibleVersions` 声明;**新增可选字段若旧记录仍合法、双向读取不受影响,可不升**(0.6.6 前半段的 `confirmedByUser` 与 `source:'unknown'` 即如此,当时 domain 仍为 2);纯新增一张表不升——记录格式没变,升了反而给降级上锁(§4.4);第一版即立规矩,不攒迁移债。V2 的 tool-guard 所需 `precondition` 字段届时按同一裁决处理(不预留空字段)。**已执行(2026-09-18,V1.1 第 3 步)**:`evidenceEvent` 新增可选 `targetId`(争议对对端,§3.2)→ version **1 → 2**、`compatibleVersions: [1]`;当时 1183 条既有记录按新 schema 校验 0 失败(**历史快照,仓库内不可复算**)。**已执行(2026-11-09,改名)**:域名 `memory` → `neural_mind`、`globalState` 新增可选 `migratedDomains` → version **2 → 3**、`compatibleVersions: [1, 2]`,启动时把旧域记录一次性补进新域(只读旧域,旧目录保留可回滚)。

---


## 修订记录

- 2026-11-09：从 DESIGN.md §1 原样拆出（内容未改语义）
- 2026-11-10：独立域清单补 `neural_mind_usage`（0.6.7 §14 使用观测；`days`/`recent` 两表，不升主域版本）
- 2026-11-12：`memoryRecord` 新增可选 `soulMode` / `soulReason`（0.7.0 §4.4 提议通道；只对 `entity='soul'` 有意义，**不升 domain 版本**——同 `confirmedByUser` 先例）
- 2026-11-12：新增可选 `soulNote`（用户忽略 SOUL 提议时填的理由，周回顾 prompt 用来避免重复提，**不升 domain 版本**）；同域新增 `soul_signals` 表（§4.4 信号 → 周回顾，字段见上文表与字段说明，**纯新增一张表、不升 domain 版本**）
- 2026-11-12：新增可选 `soulDecision`（`adopted` / `ignored`，SOUL 提议的最终处理；老记录缺该字段时按 `soul-proposal-ignored` 审计前缀兜底判定，**不升 domain 版本**——读侧只加不减，同 `confirmedByUser` 先例）
