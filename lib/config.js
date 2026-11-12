/**
 * 配置(§10 全量收录;分层暴露:description 前缀「常用」的 12 项是用户面,
 * 其余标「高级」,默认值即全场景起点;常用/高级划分以 §10 账本为准)。Schemastery;禁 plain object(§8 工程纪律)。
 *
 * 与 §10 的两处实现性增补(设计未列出但机制必需):
 *  - semanticSearch.baseUrl / apiKeyEnv:embedding 无官方接缝,自建 HTTP 通道需要
 *    endpoint 与凭据引用(§5);凭据经 credentials 服务解析,env 直读兜底。
 *  - profileFile:L1 用户画像层的唯一录入口(§4.1;v1.9 收口:原先还有 profileText,
 *    两个入口写同一份画像必然重复,已删——旧配置里残留的 profileText 会被忽略并留痕提醒迁移)。
 *  - timeDecayBands 末档 3650 天 ≈ ∞(YAML 无法表达 Infinity)。
 */
import z from '@deepseek-ai/schemastery'
import { markVolatile } from './compat.js'

/**
 * 记忆页可编辑 = 打 volatile 标记(§8 v2.0 接缝)。
 *
 * 0.2.0 的设置服务按 Schemastery 的 `meta.volatile` 划分可编辑字段:entry 里**一个
 * volatile 字段都没有**,该 entry 就不会进 `settings.describe()` 的镜像,记忆页连
 * 配置表单都看不到(不是报错,是静默缺席——所以这里必须真的打上)。
 *
 * 两条硬约束(来自 Schemastery 的 `validateVolatileSchema`),决定标记粒度:
 *  - volatile 字段必须落在**固定对象路径**上,不能被另一个 volatile 字段包住
 *    → 要么标容器、要么标叶子,不能两者都标;
 *  - 数组 / dict 的**内部**元素路径被强制 blocked
 *    → 标数组/dict 这一层本身,不标它的元素。
 *
 * 因此本文件的纪律:`live()` 只包"记忆页 GROUPS 里真的出现的字段"这一份清单,
 * 标的是叶子(嵌套字段逐个标),数组与 dict 标节点本身。高级层(约 50 项)不进记忆页,
 * 一律不标——它们仍走 profile 的 cordis.patch.yml,改动走整插件重挂载。
 *
 * 旧 Schemastery(无 `.volatile()`)上 `live()` 原样返回:配置照常工作,只是记忆页
 * 看不到配置表单(降级而非故障)。
 */
const live = (schema) => markVolatile(schema)

export const Config = z.object({
  // ── 隐私与作用域(§2)──
  privateWorkspaces: live(z.array(z.string()).default([]))
    .description('常用:只进不出的隐私目录(workspaceId 或其前缀;含 L0 热缓冲)'),
  disabledWorkspaces: live(z.array(z.string()).default([]))
    .description('常用:停用记忆的工作区(workspaceId 或其前缀,每行一个;留空=全部启用)。停用后该工作区不写记忆、不提炼、不召回、不注入'),
  autoRecall: live(z.boolean().default(true))
    .description('常用:自动召回注入(关闭后仍正常写记忆,但对话里不自动注入;手动 memory_recall 工具照常可用)'),
  // R4(0.6.6,2026-11-08 定):个人单人使用场景不做敏感自动标记——默认关。
  // 字段、开关与手动标记保留:想按敏感内容隔离时自己打开并填词表 / 手动标记。
  // 背景:prescreenSensitive 是"包含就算",实测 emo⊂memory、NDA⊂standard、
  // 诊断⊂诊断卡 把技术记忆误标,导致跨工作区带入被拦(docs/legacy/REVIEW.md R4)。
  sensitiveNoCross: live(z.boolean().default(false))
    .description('常用:打开后 sensitive 条目不跨 workspace 注入(默认关;sensitive 标记默认也不自动产生)'),
  sensitiveKeywords: live(z.array(z.string()).default([]))
    .description('高级:L0 落盘 sensitive 初筛词表(默认空=不自动标;要开启可参考 lib/text.js 的预设清单)'),
  injectToSubagents: z.boolean().default(false)
    .description('高级:是否向编码子代理注入记忆(默认否:上下文最紧,噪声大于收益)'),
  coldStartMinLocal: z.number().default(10)
    .description('高级:本地 active 记忆低于此数时收紧异地准入(及格线 ×2、系数 ×0.625)'),

  // ── 注入与治理(§4.2)──
  injectMaxItems: live(z.number().default(5)).description('高级:单轮注入条数上限'),
  injectMaxChars: live(z.number().default(1500)).description('常用:单轮注入总字符上限,超限丢整条'),
  sessionInjectMaxChars: live(z.number().default(6000))
    .description('高级:会话级注入总量(用尽后仅放行 staged/高证据新记忆;压缩回冲 V1.1)'),
  injectPauseThreshold: z.number().default(0.85)
    .description('高级:上下文用量占比超过即跳过动态注入(tokenMeter 压力自适应)'),
  inlineBudgetMs: z.number().default(300).description('高级:每轮内联延迟总预算'),
  lessonResidentItems: z.number().default(2).description('高级:常驻 lesson 条数,0=关闭'),
  openingDigest: z.boolean().default(false)
    .description('常用:无有效命中时注入近期动态摘要(默认关:与当前问题无关的闲聊也会被塞进近期动态,属噪声;想要"主动记挂"再打开)'),
  openingDigestDays: z.number().default(7).description('高级:开场动态窗口(本地 ≥3 条启用)'),
  excerptChars: live(z.number().default(300)).description('高级:查询相关片段裁剪预算'),
  recallFullMaxChars: z.number().default(16384).description('高级:recall 整条展开上限(不限代码块)'),
  verifyBeforeInject: z.boolean().default(true).description('高级:带锚事实注入前核验(存在性每轮;内容级双条件)'),
  verifyIntervalDays: z.number().default(14).description('高级:内容级核验周期触发档'),
  nonTextExts: z.array(z.string()).default(['.xlsx', '.docx', '.pptx', '.pdf'])
    .description('高级:二进制锚扩展名,只做 mtime 对比'),
  verifyContentReserveMs: z.number().default(50)
    .description('高级:内容级核验的内联预算保留(剩余预算低于此不读文件)'),
  digestLineChars: z.number().default(100).description('高级:开场动态单行截断'),
  digestBlockChars: z.number().default(300).description('高级:开场动态区块总上限'),
  residentLineChars: z.number().default(120).description('高级:常驻 lesson 行截断'),
  soulProposalImportance: z.number().min(1).max(10).default(6).description('高级:SOUL 提议落盘的重要度'),
  soulProposalConfidence: z.number().default(0.7).description('高级:SOUL 提议落盘的置信度'),
  pastStateDays: z.number().default(7).description('高级:"过去的事"分区:state 超此天数移区'),
  pastEpisodeDays: z.number().default(3).description('高级:"过去的事"分区:episode 超此天数移区'),

  // ── 写入(§3)──
  hotBufferTtlHours: z.number().default(48)
    .description('高级:热缓冲 TTL(仅清死信;未消化不过期,LLM 缺席期不过期)'),
  hotBufferTurnMaxChars: z.number().default(32768).description('高级:单轮全文防爆保险丝'),
  hotBufferMaxEntries: z.number().default(500).description('高级:条数保险丝(超限强制触发一次提炼)'),
  hotBufferRetainDays: z.number().default(7).description('高级:已消化条目物理保留期(供对账)'),
  // R16(0.6.6,2026-11-08 定):用户主动关掉提炼后,未消化的 L0 副本也该有上限——
  // 否则"只是省模型调用"会变成"历史原文永远参与查找与自动带入"(§3.1)。0 = 关掉该上限;
  // 删除前必须先确认会话日志读得回,读不回就保留并告警(那时它可能是唯一副本,§9.9)。
  // 只对"用户主动关掉提炼"生效:模型服务临时降级时仍按"未消化不过期"处理。
  hotBufferUndigestedTtlHours: z.number().min(0).default(168)
    .description('高级:关掉提炼后,未消化 L0 副本的保留上限(小时;0=不删;删前确认会话日志可读回,读不回则保留并告警)'),
  toolOutputStorage: live(z.union(['summary', 'head']).default('summary'))
    .description('高级:工具输出存法;head 则成功调用各存前 500 字符'),
  toolOutputOverrides: live(z.dict(z.union(['summary', 'head'])).default({}))
    .description('常用:按工具名分流(如搜索/表格工具单独开大)'),
  failedToolOutputChars: live(z.number().default(1000)).description('高级:失败调用输出截断字符数'),
  extractBatchTurns: live(z.number().default(6)).description('高级:按会话攒批轮数'),
  extractIdleMinutes: live(z.number().default(5)).description('高级:空闲多少分钟后触发提炼'),
  extractEnabled: live(z.boolean().default(true)).description('常用:慢速通道(LLM 提炼)总开关'),
  extractIncludeThinking: z.boolean().default(false).description('高级:提炼输入是否含思考块'),
  extractMaxInputChars: z.number().default(65536)
    .description('高级:提炼批量输入上限,超出按回合整粒舍弃'),
  // R8a(0.6.6,2026-11-09 定):只截"送去整理"这条路的工具输出——本机 5 条 L0 里有 3 条
  // 因单回合 >65,536 字符被整粒丢掉(docs/legacy/REVIEW.md R8)。用户/助手正文不截;失败调用留头留尾
  // 保住报错特征;`memory_recall` 展开原文不受影响(它走 recallFullMaxChars)。
  extractToolOutputMaxChars: z.number().default(8000)
    .description('高级:提炼输入里单个工具输出的上限(默认 8000;成功输出留头部、失败输出留头留尾,用户/助手正文不截)'),
  extractMaxFacts: z.number().default(5).description('高级:单批原子事实上限'),
  relationCandidateTopK: z.number().default(8)
    .description('高级:关系判断候选集——检索取 top-K 相似既有记忆进提炼 prompt'),
  outboxMaxRetries: z.number().default(5).description('高级:提炼重试上限(耗尽 → dead-letter)'),
  stagingAutoArchiveDays: z.number().default(30).description('高级:model-auto 暂存未印证自动归档天数'),

  // ── 检索(§5)──
  semanticSearch: z.object({
    enabled: live(z.boolean().default(true)).description('常用:向量路开关(需配置 baseUrl/modelId 才生效)'),
    baseUrl: live(z.string().default(''))
      .description('常用:OpenAI 兼容 embedding 端点(如 https://api.openai.com/v1);空 = 纯 BM25'),
    modelId: live(z.string().default('')).description('常用:embedding 模型名(换模型旧向量作废)'),
    apiKeyEnv: live(z.string().default(''))
      .description('常用:凭据环境变量名(经 credentials 服务解析;.env/进程环境兜底)'),
    apiKeyOptional: live(z.boolean().default(false))
      .description('常用:本地无鉴权端点(自建/Ollama)允许空密钥;开启后 apiKeyEnv 可留空,且不发 Authorization 头'),
    timeoutMs: live(z.number().default(150)).description('高级:查询 embed 内联份额,超时降级纯 BM25'),
    reembedBatchSize: z.number().min(1).default(64).description('高级:换模型重嵌入分批大小(单并发、批间让路 1 秒,不抢内联预算)'),
    autoStartCommand: live(z.string().default(''))
      .description('常用:本地 embedding 服务的启动命令(空=不管);dsh 起时拉起、dsh 退出即回收,端口已有人监听则不插手;仅 POSIX(/bin/sh),Windows 不可用'),
    autoStartWaitMs: live(z.number().default(20000))
      .description('高级:拉起后等待端口就绪的审计窗口(超时只记一条 unready,向量路继续降级纯 BM25)'),
    autoStartWarmup: live(z.boolean().default(false))
      .description('高级:就绪后立刻预热一次(把模型拉进显存)——第一条检索不再冷启动降级,代价是 dsh 一起就占显存'),
  }).default({}).description('常用:向量检索(研究/跨语言用法强烈建议配置)'),
  chunkPlainMaxChars: z.number().min(0).default(8192).description('高级:向量分段阈值(≤此整条单向量)'),
  chunkSize: z.number().min(1).default(1000).description('高级:向量分段长度(字符)'),
  chunkOverlap: z.number().min(0).default(100).description('高级:段间重叠'),
  bm25: z.object({
    k1: z.number().default(1.5),
    b: z.number().default(0.75),
    minScore: z.number().default(0.1).description('高级:BM25 单路及格线(绝对)'),
    minScoreTopRatio: z.number().default(0)
      .description('高级:BM25 相对及格线(top1 得分 × 系数,与绝对线取较严者);0=关闭'),
  }).default({}),
  /**
   * 绝对相关性闸门(§5 v1.9,默认开自 v1.13):只作用于**注入**路径。
   * 混合路用「共识线 / 单路线」;纯 BM25(向量路不可用)用 `bm25OnlyMin` 单路准入——
   * 旧行为是"纯 BM25 时整条闸门不生效",于是没有 embedding 的用户每轮都会被
   * 弱词面命中铺满注入预算(2026-11-07 用户反馈:注入过多 + 错误注入)。
   */
  relevanceGate: z.object({
    enabled: z.boolean().default(true)
      .description('高级:注入前的绝对相关性闸门(默认开;开启后"两路互相印证"或"单路信号足够强"才允许注入;纯 BM25 时按 bm25OnlyMin)'),
    consensusCos: z.number().default(0.35)
      .description('高级:共识线·向量——两路都过共识线即放行'),
    consensusBm25: z.number().default(2)
      .description('高级:共识线·BM25(原始分)'),
    soloCos: z.number().default(0.55)
      .description('高级:单路线·向量——只有向量路命中时必须达到的更高门槛'),
    soloBm25: z.number().default(10)
      .description('高级:单路线·BM25——只有关键词路命中时必须达到的更高门槛(混合路)'),
    // 0.6.6 R18:2 → 10。纯 BM25 是绝大多数用户(没配 embedding)的默认档,frozen-v2 上
    // 负例注入 6/13 → 2/13、R@1 0.973 → 1.000,前 5 条命中率不变。绝对分随语料规模漂移,
    // 见 DESIGN §5.6 的校准纪律;池子 < bm25OnlyMinPoolSize 时仍不启用,防小池误杀。
    bm25OnlyMin: z.number().default(10)
      .description('高级:纯 BM25(未配 embedding / 向量路降级)时的注入准入门槛(原始分,默认 10;0.6.6 R18 从 2 校准);低于此不注入,recall 不受影响'),
    bm25OnlyMinPoolSize: z.number().default(30)
      .description('高级:纯 BM25 准入门槛的最小池子条数——池子小于此不启用(小池子误杀风险大于噪声风险,且绝对分随语料规模漂移)'),
  }).default({}).description('高级:绝对相关性闸门(见 DESIGN §5;recall 不受影响)'),
  vectorMinScore: z.number().default(0.2).description('高级:向量路单路及格线(余弦)'),
  rrfK: z.number().default(60).description('高级:RRF 融合常数(校准纪律:不动它,调及格线与系数)'),
  candidateMultiplier: z.number().default(2).description('高级:各路候选取 injectMaxItems 的倍数'),

  // ── 排序系数(§5/§5.4)──
  scoring: z.object({
    workspaceBoost: z.number().default(1).description('高级:当前 workspace 系数'),
    remoteFactor: z.number().default(0.8).description('高级:异地系数,非当前 workspace 的记忆一律乘此'),
    stagedFactor: z.number().default(0.7).description('高级:暂存条目专属降权'),
    supersededFactor: z.number().default(0.3).description('高级:被取代条目降权'),
    validUntilFactor: z.number().default(0.3).description('高级:事件过期/state 宽限期降权(todo 不适用)'),
    entityBoost: z.number().default(1.1).description('高级:entity 重合加权'),
    entityWindowTurns: z.number().default(3).description('高级:entity 提及窗口轮数'),
  }).default({}),

  // ── 生命周期(§6)──
  decay: z.object({
    reinforceHalfLifeDays: z.number().default(30).description('高级:印证半衰期'),
    challengeHalfLifeDays: z.number().default(180).description('高级:质疑半衰期(一次打脸记很久)'),
    evidenceWeights: z.object({
      user: z.number().default(1).description('高级:用户显式证据权重'),
      system: z.number().default(0.5).description('高级:系统推断证据权重'),
    }).default({}),
    evidenceLogisticSlope: z.number().default(1).description('高级:证据 logistic 斜率阀(先调它再动权重)'),
    evidenceMaxEntries: z.number().default(64).description('高级:证据明细账上界裁剪'),
    archiveThreshold: z.number().default(-2).description('高级:归档净分阈值(E ≤ 此记 negativeSince)'),
    archiveDurationDays: z.number().default(14).description('高级:negativeSince 连续天数 → 归档'),
    stateTtlDays: z.number().default(30).description('高级:state 有效期(召回/核验续期)'),
    stateTtlNumericDays: z.number().default(10)
      .description('高级:含数值/日期 state 的有效期;到期先宽限降权,宽限 2×TTL 后才归档'),
    timeDecayBands: z.array(z.array(z.number())).default([[7, 1], [30, 0.8], [90, 0.5], [3650, 0.3]])
      .description('高级:时间衰减阶梯 [距今上限天数, 系数];末档为保底(3650 ≈ 永久)'),
    highImportanceMin: z.number().default(8).description('高级:高重要性阈值(豁免衰减/免 TTL 归档)'),
    highQuotaRatio: z.number().default(0.2)
      .description('高级:importance≥8 与 pattern 的批次配额(每批保底各 1 条;降级只降数值不改 temporal)'),
  }).default({}),

  // ── 注入防御(§3.4)──
  injectionGuard: z.object({
    enabled: z.boolean().default(true).description('高级:注入防御总开关'),
    extraPatterns: z.array(z.string()).default([]).description('高级:用户追加的拦截正则'),
  }).default({}),

  // ── L1 用户画像层(§4.1:MVP 只读手编)──
  profilePollSeconds: live(z.number().default(5))
    .description('高级:画像文件外部手改的探测最小间隔(内容逐字比对,不用 mtime;装配期零文件 I/O)'),
  profileFile: live(z.string().default(''))
    .description('常用:L1 用户画像文件路径(支持 ~/… 展开;光写 ~ 非法;手改后下一轮生效)'),

  // ── SOUL 自我设定(§4.4;人格层,agent 只能提议、不能直接落笔)──
  soulEnabled: live(z.boolean().default(true))
    .description('常用:SOUL 层总开关(注入 + 提议通道);关掉=整层停用,soul_propose 不注册'),
  soulSelfEditEnabled: live(z.boolean().default(true))
    .description('常用:允许 agent 提议改写 SOUL(它不会直接落笔;采纳仍在记忆页;关掉后 soul_propose 拒绝)'),
  soulFile: z.string().default('')
    .description('高级:SOUL 文件路径;空 = $DSH_HOME/SOUL.md(支持 ~/… 展开;光写 "~" 非法,启动时拒绝并回退默认)'),
  soulMaxChars: z.number().default(2000)
    .description('高级:写入与注入上限(写入超限拒绝;注入超长截断并标记)'),
  soulEditDailyBudget: z.number().default(5)
    .description('高级:每天 SOUL **提议**次数上限(采纳不占额度;被拒不计数;按 UTC 日界)'),
  soulHistoryMaxEntries: z.number().default(50)
    .description('高级:版本快照保留条数;实际下界 10,且**当日条目不裁剪**'),
  storageOpenTimeoutMs: z.number().default(5000)
    .description('高级:storageDomain.open 的超时(ms);超时按"降级纯内存态"处理,避免启动静默卡死'),
  soulPollSeconds: z.number().default(5)
    .description('高级:外部手改的探测最小间隔(秒);按内容逐字比对,不用 mtime'),

  // ── 使用观测(§14;0.6.7 S12)──
  usageLog: z.boolean().default(true)
    .description('高级:使用遥测落盘(注入/跳过/提炼/召回计数 + 注入质量元数据;只含元数据不含正文);关掉=退回纯进程内'),
  usageRetentionDays: z.number().default(30)
    .description('高级:使用遥测日汇总保留天数(0=不清理;明细固定 7 天/2000 条上限)'),
})

/**
 * 跨字段配置防线(Schemastery 无 object.refine):
 * chunkSize/overlap 的非法组合会让 chunkText 不前进;reembedBatchSize 非正会让重嵌入死循环。
 */
export function validateChunkConfig(cfg) {
  const size = cfg?.chunkSize
  const overlap = cfg?.chunkOverlap
  const batch = cfg?.semanticSearch?.reembedBatchSize
  const plain = cfg?.chunkPlainMaxChars
  if (!Number.isInteger(size) || size <= 0) throw new Error(`chunkSize 必须是正整数(当前 ${String(size)})`)
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= size) {
    throw new Error(`chunkOverlap 必须是非负整数且小于 chunkSize(当前 ${String(overlap)} / ${String(size)})`)
  }
  if (!Number.isInteger(batch) || batch <= 0) throw new Error(`reembedBatchSize 必须是正整数(当前 ${String(batch)})`)
  if (!Number.isInteger(plain) || plain < 0) throw new Error(`chunkPlainMaxChars 必须是非负整数(当前 ${String(plain)})`)
}
