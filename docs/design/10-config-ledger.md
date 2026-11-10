---
id: 10
title: "配置项清单(Schemastery schema,可调不许硬编码)"
status: 现行
since: 0.1.0
verified: 2026-11-09
code: [lib/config.js]
supersedes: []
superseded_by: null
---

# §10 配置项清单(Schemastery schema,可调不许硬编码)


**暴露分层(v1.8;v1.9 增 SOUL 两项;固定 global 后删 `scope`)**:schema 全量收录不变(纪律不动),用户面分两层——**常用层 12 项**(首启引导与 README 只讲这些):`disabledWorkspaces`、`autoRecall`、`privateWorkspaces`、`sensitiveNoCross`、`semanticSearch`(开关+模型)、`extractEnabled`、`injectMaxChars`、`toolOutputOverrides`、`openingDigest`、`profileFile`、`soulEnabled`、`soulSelfEditEnabled`(v1.14 增前两项);**其余全部标"高级"**,默认值即全场景起点,不读文档也可不改。**v1.8.1 补录**:L1 用户画像两项随实现回流进账(原文遗漏,§13 有记录);其中 L1 画像收口为文件单入口(§4.1):设置页渲染 `profileFile` 与 `profilePollSeconds`,原先的 `profileText` 已删(v1.9 收口);固定 global 后当前常用层为 **12 项**。

> **v1.10 补:两层分类法别混为一谈**。「常用/高级」是**文档与话术**分层(首启引导与 README 只讲常用层);
> **可编辑面**是另一件事——0.2.0 起由 `.volatile()` 决定,共 **28 项**(配置卡 26 + SOUL 卡 2),
> 与常用层**不重合**:双向都有差集。`injectMaxItems`/`excerptChars`/`profilePollSeconds` 等标了 volatile
> 但属高级层(设置页能改,文档不展开);`openingDigest` 是**常用层里唯一未标 volatile 的一项**
> (只能改 profile 的 `cordis.patch.yml`,改动会整插件重挂载)——它没进设置页是 GROUPS 清单成型时的既有
> 取舍,不是本轮适配引入的;要收口需同时补 GROUPS 行、locale 与 README 表,属功能改动,记此待定。
> 机械对账:`check-seams` ③ 守"设置页要改的字段宿主认不认",⑦ 守"宿主认改的字段设置页给不给改"。

**`[未实现]` 标注(V1.1 收口,2026-09-18)**:曾经只落了字段、机制尚未接线的 10 项**已全部接线,账本清零**(逐步撕除:V1.1 第 1 步撕 `lessonResidentItems`/`openingDigest`/`openingDigestDays`,第 4 步撕 `scoring.entityBoost`/`scoring.entityWindowTurns`/`coldStartMinLocal`,第 5 步撕 `verifyBeforeInject`/`verifyIntervalDays`/`nonTextExts`,第 6 步撕 `injectPauseThreshold`)。**双向机械对账继续生效**(`tools/check-config-ledger.mjs`,已挂进 `npm test`):今后再出现"标了却被 `lib/`(除 config.js 外)消费"或"零消费却没标"都会直接红——空开关不会随迭代悄悄长回来。(注:`sessionInjectMaxChars` 有消费,只是带压缩回冲子特性,不属未实现项;`scoring.remoteFactor` 已全接线,§9 第 24 条。)

```ts
{
  // ── 隐私与作用域(§2)──
  privateWorkspaces: string[]          // 默认 [],只进不出(含 L0);检索固定 global
  disabledWorkspaces: string[]         // 默认 []=全部启用(v1.14):停用记忆的工作区(workspaceId 或其前缀);
                                       // 命中 = 完全不介入(不写/不提炼/不召回/不注入)。这是运行开关,不是检索域隔离(§2)
  sensitiveNoCross: boolean            // 默认 false(0.6.6 R4 改):打开后 sensitive 条目不跨 workspace(含 L0 初筛与常驻补位)
  sensitiveKeywords: string[]          // 默认 [](0.6.6 R4 改):L0 初筛词表;空 = 不自动标;预设清单见 lib/text.js DEFAULT_SENSITIVE_KEYWORDS
  injectToSubagents: boolean           // 默认 false(编码子代理上下文紧)
  coldStartMinLocal: number            // 默认 10,低于此数收紧异地准入(§2/§5.4)

  // ── 注入与治理(§4.2)──
  injectMaxItems: number               // 默认 5
  injectMaxChars: number               // 默认 1500,单轮上限,超限丢整条
  sessionInjectMaxChars: number        // 默认 6000,会话级总量(含开场动态);压缩折叠回冲
  injectPauseThreshold: number         // 默认 0.85,上下文用量占比超过即跳过动态注入
  autoRecall: boolean                  // 默认 true(v1.14):自动召回注入总开关;false = 不自动注入,
                                       // 但照常写记忆;手动 memory_recall 工具不受影响(画像/SOUL 常驻段不属"召回")
  inlineBudgetMs: number               // 默认 300,内联总预算
  lessonResidentItems: number          // 默认 2,常驻 lesson 条数(0=关闭);选择=本地优先,组内按 证据系数×importance 降序、同分取最近;entity='user' 异地补位排后
  openingDigest: boolean               // 默认 false(v1.13 改;旧默认 true):无关闲聊零命中时也会注入近期动态,属错误注入;要"主动记挂"再打开
  openingDigestDays: number            // 默认 7(窗口;本地 ≥3 条启用)
  excerptChars: number                 // 默认 300,查询相关片段预算(BM25 路/未分段长条目)
  recallFullMaxChars: number           // 默认 16384,recall 整条展开上限(不限代码块)
  verifyBeforeInject: boolean          // 默认 true,带锚事实注入前核验(存在性级每轮;内容级双条件)
  verifyIntervalDays: number           // 默认 14,内容级核验的周期触发档(与临期档并列)
  nonTextExts: string[]                // 默认 ['.xlsx','.docx','.pptx','.pdf']:二进制锚只做 mtime 对比
  verifyContentReserveMs: number       // 默认 50,内容级核验的内联预算保留(剩余低于此不读文件)
  digestLineChars: number              // 默认 100,开场动态单行截断
  digestBlockChars: number             // 默认 300,开场动态区块总上限
  residentLineChars: number            // 默认 120,常驻 lesson 行截断
  soulProposalImportance: number       // 默认 6,SOUL 提议落盘的重要度
  soulProposalConfidence: number       // 默认 0.7,SOUL 提议落盘的置信度
  pastStateDays: number                // 默认 7("过去的事"分区)
  pastEpisodeDays: number              // 默认 3

  // ── 写入(§3)──
  hotBufferTtlHours: number            // 默认 48,仅清死信(死信=outbox 重试耗尽,或单回合自身超 extractMaxInputChars 被整粒跳过;LLM 缺席期/服务临时降级不过期)
  hotBufferTurnMaxChars: number        // 默认 32768,单轮全文防爆保险丝
  hotBufferMaxEntries: number          // 默认 500,条数保险丝(超限强制提炼)
  hotBufferRetainDays: number          // 默认 7,已消化条目物理保留期
  hotBufferUndigestedTtlHours: number  // 默认 168:关掉提炼后未消化 L0 副本的上限(0=不删;删前确认会话日志可读回,读不回保留并告警)
  toolOutputStorage: 'summary' | 'head'// 默认 'summary';'head' 则成功调用各存前 500 字符
  toolOutputOverrides: Record<string, 'summary' | 'head'>  // 默认 {},按工具名分流
  failedToolOutputChars: number        // 默认 1000,失败调用输出截断
  extractBatchTurns: number            // 默认 6,按会话攒批
  extractIdleMinutes: number           // 默认 5
  extractEnabled: boolean              // 默认 true(慢速通道总开关)
  extractIncludeThinking: boolean      // 默认 false:提炼输入不含思考块
  extractMaxInputChars: number         // 默认 65536:提炼批量输入上限,超出按回合整粒舍弃
  extractToolOutputMaxChars: number    // 默认 8000:提炼输入里单个工具输出的上限(R8a;成功留头、失败留头留尾,正文不截)
  extractMaxFacts: number              // 默认 5,单批原子事实上限
  relationCandidateTopK: number        // 默认 8,关系判断候选集:以本批回合原文检索取 top-K 进提炼 prompt(§3.2)
  outboxMaxRetries: number             // 默认 5(→ dead-letter)
  stagingAutoArchiveDays: number       // 默认 30,仅 stagedBy='model'

  // ── 检索(§5)──
  semanticSearch: {
    enabled: boolean                   // 默认 true;需配置 baseUrl + modelId 才生效(providerId 未采用)
    baseUrl: string                    // 默认空=纯 BM25;OpenAI 兼容端点(实现增补,§13-①)
    modelId: string                    // 默认空,必须可配不硬编码;即向量指纹(换模型旧向量作废)
    apiKeyEnv: string                  // 默认空;凭据引用名,经 credentials 解析(实现增补,§13-①)
    apiKeyOptional: boolean            // 默认 false;本地无鉴权端点允许空凭据且不发 Authorization(§13-⑤)
    timeoutMs: number                  // 默认 150,超时降级纯 BM25(占检索保底份额)
    reembedBatchSize: number           // 默认 64,换模型重嵌入分批大小(单并发、后台跑,§5)
    autoStartCommand: string           // 默认空=不管;本地服务随 dsh 进程生灭的启动命令(§5,§13-⑤);**仅 POSIX**(看门狗走 /bin/sh,Windows 起不来,只记 embed-sidecar-failed)
    autoStartWaitMs: number            // 默认 20000;就绪审计窗口(超时记 unready,继续等到 3× 再 late-ready)
    autoStartWarmup: boolean           // 默认 false;就绪后预热一次,第一条检索不再冷启动降级(§5,§13-⑤)
  }
  // providerId 未采用(实现以 baseUrl 直连,§13-①);上表与 lib/config.js 顶层 70 项机械对账一致
  chunkPlainMaxChars: number           // 默认 8192,向量分段阈值(≤此整条单向量)
  chunkSize: number                    // 默认 1000,向量分段长度(字符)
  chunkOverlap: number                 // 默认 100,段间重叠
  bm25: {                              // 展开成块只为让 §10 对账可机械执行(此前写成一行,脚本读不到子项)
    k1: 1.5
    b: 0.75
    minScore: 0.1                      // 单路及格线(绝对)
    minScoreTopRatio: 0                // 相对及格线(§5),默认 0=关闭;>0 时取 top1 得分 × 该系数,与 minScore 取较严者
  }
  relevanceGate: {                     // 绝对相关性闸门(§5 v1.9;v1.13 默认开):只卡注入;recall 不受影响
    enabled: boolean                   // 默认 true(v1.13 改;旧默认 false → 负例也注满 5 条)
    consensusCos: number               // 默认 0.35,共识线·向量(两路都过即放行)
    consensusBm25: number              // 默认 2,共识线·BM25 原始分
    soloCos: number                    // 默认 0.55,单路线·向量(只有该路命中时的更高门槛)
    soloBm25: number                   // 默认 10,单路线·BM25(混合路)
    bm25OnlyMin: number                // 默认 10(0.6.6 R18 从 2 校准),纯 BM25(无向量路)时的注入准入门槛(原始分;recall 不受影响)
    bm25OnlyMinPoolSize: number        // 默认 30,纯 BM25 门槛的最小池子条数(小于此不启用,防小池误杀)
  }
  vectorMinScore: number               // 默认 0.2
  rrfK: number                         // 默认 60
  candidateMultiplier: number          // 默认 2

  // ── 排序系数(§5/§5.4)──
  scoring: {
    workspaceBoost: number             // 默认 1.0
    remoteFactor: number               // 默认 0.8,当前 workspace 之外一律按此
                                       // (收紧期 ×0.625≈0.5、及格线 ×2;只分两档,
                                       //  不做同仓亲和派生档——2026-09-17 裁决,§9 第 24 条)
    stagedFactor: number               // 默认 0.7
    supersededFactor: number           // 默认 0.3
    validUntilFactor: number           // 默认 0.3(事件过期;todo 不适用)
    entityBoost: number                // 默认 1.1(entity 与当前子路径重合或近 N 轮提及)
    entityWindowTurns: number          // 默认 3
  }

  // ── 生命周期(§6)──
  decay: {
    reinforceHalfLifeDays: number      // 默认 30
    challengeHalfLifeDays: number      // 默认 180
    evidenceWeights: { user: 1.0, system: 0.5 }
    evidenceLogisticSlope: number      // 默认 1.0,证据 logistic 斜率阀(§5.3;先调它再动权重)
    evidenceMaxEntries: number         // 默认 64
    archiveThreshold: number           // 默认 -2(净分;E>−2 即清零 negativeSince)
    archiveDurationDays: number        // 默认 14(连续)
    stateTtlDays: number               // 默认 30,state 类有效期(召回/核验续期)
    stateTtlNumericDays: number        // 默认 10,含数值/日期 state 的有效期;
                                       // 到期先宽限降权(×0.3+"已过期"),宽限 2×TTL 后才归档
    timeDecayBands: [number, number][] // 默认 [[7,1.0],[30,0.8],[90,0.5],[3650,0.3]](3650 天≈∞;YAML 无 Infinity)
    highImportanceMin: number          // 默认 8(豁免阈值;≥8 且 E≥0 的 state 免 TTL)
    highQuotaRatio: number             // 默认 0.2(防刷分配额;每批至少 1 条 ≥8 与 1 条 pattern;
                                       // 降级只降 importance 数值,不改 temporal)
  }

  // ── 注入防御(§3.4)──
  injectionGuard: {
    enabled: boolean                   // 默认 true
    extraPatterns: string[]            // 默认 [],用户可追加正则
  }

  // ── L1 用户画像(§4.1;MVP 只读手编,固定注入系统提示词)──
  profilePollSeconds: number             // 默认 5,画像文件外部手改的探测最小间隔(§4.1;
                                         //   装配期零文件 I/O → 段只读内存镜像,读盘只发生在启动与 pre-step 轮询)
  profileFile: string                    // 默认 '',画像文件路径(**支持 ~/… 展开;光写 ~ 非法,启动时拒绝并留痕**;
                                         //   配置了但文件不存在 → 按空画像处理并留一次 profile-file-missing 审计);
                                         // 唯一录入口;设置页渲染路径与轮询间隔(§4.1 v1.9 收口)

  // ── SOUL 自我设定(§4.4;人格层,agent 可自改)──
  soulEnabled: boolean                   // 常用:默认 true,SOUL 层总开关(注入 + 自改)
  soulSelfEditEnabled: boolean           // 常用:默认 true;关掉后 soul_update 拒绝写入(设置页仍可改)
  soulFile: string                       // 高级:默认 ''(= $DSH_HOME/SOUL.md,真相源);支持 ~/… 展开;
                                         //   **光写 "~" 非法**(指家目录,读必失败):启动时拒绝该取值、
                                         //   回退默认并留 stderr + 审计 soul-path-rejected(§4.4)
  soulMaxChars: number                   // 高级:默认 2000,写入与注入上限
                                         // (写入超限拒绝;注入超长截断并留"(已截断)"标记;刷新时记 soul-oversize 审计)
  soulEditDailyBudget: number            // 高级:默认 5,每天成功自改次数上限(被拒不计数)
  soulHistoryMaxEntries: number          // 高级:默认 50,版本快照保留条数;
                                         // 实际下界 10,且当日条目不裁(当日行是日预算依据)
  storageOpenTimeoutMs: number           // 高级:默认 5000;storageDomain.open 超时即按「降级纯内存态」处理
                                         // (后端异常时 open 可能既不 resolve 也不 reject → 启动静默卡死)
  soulPollSeconds: number                // 高级:默认 5,外部手改的探测最小间隔(内容逐字比对,不用 mtime)

  // ── 使用观测(§14;0.6.7 S12)──
  usageLog: boolean                      // 高级:默认 true,使用遥测落盘(注入/跳过/提炼/召回计数 + 注入质量元数据;
                                         //   只含元数据不含正文);关掉 = 退回纯进程内(重启归零)
  usageRetentionDays: number             // 高级:默认 30,使用遥测日汇总保留天数(0=不清理;明细固定 7 天/2000 条)
}
```

(配置分组同时是 V2 设置页的分组依据;设置页当前已呈现其中 6 组——隐私与作用域 / 向量检索(embedding)/ 写入与提炼 / 注入 / L1 用户画像 / SOUL 自我设定,其余组待 V2 卡片化。)

---


## 修订记录

- 2026-11-09：从 DESIGN.md §10 原样拆出；同日源码逐条抽查后校正描述——`autoStartCommand` 仅 POSIX、死信定义补"单回合超批量上限"、常驻 lesson 选择改为"本地优先+组内权重降序"、`semanticSearch.enabled` 生效条件改为 baseUrl+modelId；随后 R26 把 `profileFile` 改为支持 `~/…` 展开（光写 `~` 非法、缺失文件留一次提示）；`check-config-ledger` 已同步读取本文
