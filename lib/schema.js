/**
 * 数据模型(§1)与 storageDomain spec。zod 仅用于 open() 时的落盘记录校验
 * (写路径不校验——本插件在 put 前自行 parse,见各写入点)。
 *
 * 版本纪律(§1):任何字段变更升 version 并把旧版本列入 compatibleVersions;
 * 老记录缺的新字段一律 optional。当前为首版,无兼容负担。
 */
import { z } from 'zod'

export const evidenceEvent = z.object({
  ts: z.string(),
  weight: z.number(),
  kind: z.enum(['reinforce', 'challenge']),
  /** 争议对标记(v1.1 升版新增):互记 challenge 时指对端记忆 id,渲染"存在争议"与成对不计续期用(§6)。 */
  targetId: z.string().optional(),
})

/** L2/L3 记忆(§1 数据模型;末五个为实现字段,首版即入 schema)。 */
export const memoryRecord = z.object({
  id: z.string(),
  content: z.string(),
  kind: z.enum(['fact', 'lesson', 'episode']),
  // R13b(0.6.6):来源不再听模型自报。user/assistant 由原文角色判定;code/tool/quote 是内容
  // 分类;`unknown` = 旧记录且没有可复核的 provenance(来源查不清,不猜)。
  source: z.enum(['user', 'assistant', 'code', 'tool', 'quote', 'unknown']),
  /** R13b:用户在界面点过确认(工具之外的可信信号;措辞"你确认过")。可选,不升存储格式版本。 */
  confirmedByUser: z.boolean().optional(),
  stagedBy: z.enum(['user', 'model']).optional(),
  entity: z.string().optional(),
  filePaths: z.array(z.string()).optional(),
  anchorRoot: z.string().optional(),
  sensitive: z.boolean().optional(),
  hidden: z.boolean().optional(),
  importance: z.number().int().min(1).max(10),
  confidence: z.number(),
  temporal: z.enum(['pattern', 'state', 'episode']),
  todo: z.boolean().optional(),
  eventTime: z.string(),
  expiresAt: z.string().optional(),
  lastVerifiedAt: z.string().optional(),
  validUntil: z.string().optional(),
  supersededBy: z.string().optional(),
  workspaceId: z.string(),
  sessionId: z.string(),
  sourceRange: z.object({ startSeq: z.number(), endSeq: z.number() }).optional(),
  evidence: z.array(evidenceEvent),
  negativeSince: z.string().optional(),
  status: z.enum(['active', 'staged', 'archived']),
  chunks: z.array(z.object({ text: z.string(), embedding: z.array(z.number()) })).optional(),
  embeddingModel: z.string().optional(),
  // ── 实现字段 ──
  createdAt: z.string(),
  workspaceLabel: z.string().optional(),
  /** 提炼批次幂等键(sha1(sessionId + 回合键列表)),崩溃重提炼防重复落盘。 */
  batchKey: z.string().optional(),
  /** pattern 超配额:保留分类但取消时间衰减豁免(§3.4 降级语义写死)。 */
  noExemption: z.boolean().optional(),
  /** user-explicit 命中注入特征的软标记(§3.3:永不硬拦,仅挂"内容可疑,待确认")。 */
  suspect: z.boolean().optional(),
})

/** L0 热缓冲条目(§3.1)。 */
export const hotEntry = z.object({
  id: z.string(),
  sessionId: z.string(),
  workspaceId: z.string(),
  workspaceLabel: z.string().optional(),
  turn: z.number(),
  startSeq: z.number(),
  endSeq: z.number(),
  /** 可检索正文:用户/助手全文(代码块折叠)+ 工具摘要/失败截断。 */
  content: z.string(),
  /** 思考块:仅 recall 可查,不进自动注入池(§3.1)。 */
  thinking: z.string().optional(),
  sensitive: z.boolean().optional(),
  hidden: z.boolean().optional(),
  /** "未消化"标记;被吸收后退出检索池(§1)。 */
  digested: z.boolean(),
  /** 死信标记:outbox 重试耗尽;TTL 只清死信(§3.1)。 */
  deadLettered: z.boolean().optional(),
  createdAt: z.string(),
  chunks: z.array(z.object({ text: z.string(), embedding: z.array(z.number()) })).optional(),
  embeddingModel: z.string().optional(),
})

/** 慢速通道 outbox 任务(§3.0/§3.2)。 */
export const outboxItem = z.object({
  id: z.string(),
  sessionId: z.string(),
  workspaceId: z.string(),
  workspaceLabel: z.string().optional(),
  gitRoot: z.string().optional(),
  turn: z.number(),
  startSeq: z.number(),
  endSeq: z.number(),
  status: z.enum(['pending', 'extracting', 'dead', 'skipped']),
  retries: z.number(),
  createdAt: z.string(),
  lastError: z.string().optional(),
  nextRetryAt: z.string().optional(),
})

/** 审计条目(§8:写自有存储,不碰会话日志)。 */
export const auditEntry = z.object({
  id: z.string(),
  ts: z.string(),
  kind: z.string(),
  detail: z.string(),
  sessionId: z.string().optional(),
})

/**
 * SOUL 版本快照(§4.4):每次内容变化存一版。
 * 回滚 = 把旧内容写回并产生**新版本**,历史不删(与记忆"不物理删除"同一纪律)。
 * author 是变化来源:agent(自改工具)/ user(记忆页或回滚)/ external(检测到文件被手改)。
 * 注:存储层的表名必须匹配 `^[a-z][a-z0-9_]*$`(见 @deepseek-ai/dsh-storage 的 `UNIT_NAME_RE`),
 * 所以域内表名是 `soul_history`(下划线),JS 侧 store 键仍叫 `soulHistory`。
 */
export const soulEntry = z.object({
  id: z.string(),
  ts: z.string(),
  author: z.enum(['agent', 'user', 'external']),
  reason: z.string().optional(),
  sessionId: z.string().optional(),
  /** 回滚专用:被恢复的那一版的 id。 */
  fromVersionId: z.string().optional(),
  prevContent: z.string(),
  nextContent: z.string(),
})

export const globalState = z.object({
  version: z.number(),
  onboardedAt: z.string().optional(),
  /**
   * 工作区选择器的"见过的工作区"(v1.15)。
   *
   * 必须在这里声明:`storageDomain` 打开域时用本 schema 校验 global 记录,zod 默认
   * **strip 未声明的键**——不声明的话,每次 open(含每次热重建)都会把 seenWorkspaces
   * 从内存态里剥掉:重启后配置页的「已知工作区」回到 0,下一次写入也只剩刚记的那一条。
   * 字段本身仍是可选(老 profile 没有它,向后兼容)。
   */
  seenWorkspaces: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    lastSeenMs: z.number().optional(),
  })).optional(),
  /**
   * R13b:旧记录来源回填的完成标记(1 = 已回填)。必须在这里声明——同 seenWorkspaces,
   * 不声明会被 zod 在 open 时 strip,导致每次启动重扫一遍旧记录。
   */
  sourceRemapVersion: z.number().optional(),
  /**
   * 域名迁移标记(v3,2026-11-09 插件改名):记下已经把哪些旧域名(如 `memory`)的记录
   * 补进本域,避免每次启动重复打开旧域。旧记录缺此字段(optional 向后兼容)。
   */
  migratedDomains: z.array(z.string()).optional(),
})

/**
 * A10 方案 A 的短命“批次答卷”:LLM 返回后先落这里,再写事实/关系/SOUL;
 * 重放直接复用,避免第二次 LLM 换措辞造成重复。批次完成即删,启动时清 7 天孤儿。
 *
 * 独立域 `neural_mind_extract`,不改变主域版本——旧插件回滚时只会忽略这个域,
 * 不会因为不认识的版本戳把主域记录当 absent 丢掉。
 */
export const batchRecord = z.object({
  id: z.string(),
  batchKey: z.string(),
  sessionId: z.string(),
  payload: z.string(),
  createdAt: z.string(),
})

export const BATCH_DOMAIN_NAME = 'neural_mind_extract'
/** 改名前的独立域名:只读迁移用,新写入一律用 BATCH_DOMAIN_NAME。 */
export const LEGACY_BATCH_DOMAIN_NAME = 'memory_extract'
export const BATCH_DOMAIN_VERSION = 1

/** 独立域 spec:version 固定 1;后续若改字段/表,单独升这个域的版本,不动主域。 */
export function batchDomainSpec() {
  return {
    name: BATCH_DOMAIN_NAME,
    version: BATCH_DOMAIN_VERSION,
    layout: 'per-record',
    invalidRecords: 'backup-and-skip',
    tables: {
      batches: { valueSchema: batchRecord },
    },
  }
}

/** 改名前的域 spec:只有名字不同,其余字段与 batchDomainSpec 一致(openStore 迁移时只读)。 */
export function legacyBatchDomainSpec() {
  return { ...batchDomainSpec(), name: LEGACY_BATCH_DOMAIN_NAME }
}

/**
 * §14 使用观测(0.6.7,R3):**独立短命域** `neural_mind_usage`,不升主域版本。
 *
 * 记录的是"插件自己干了什么"的遥测(注入/跳过/提炼/召回计数 + 注入质量元数据),
 * 不含记忆正文与用户查询。7 天/2000 条上限的明细 + 按天汇总(默认 30 天)。
 * 与 A10 批次答卷域同一裁决:旧插件回滚时只会忽略这个新域,不会波及主域。
 */
export const usageDayRecord = z.object({
  id: z.string(),
  /** 本地日期 `YYYY-MM-DD`(按用户所在时区,便于看"今天")。 */
  date: z.string(),
  /** 计数键 → 次数/合计,键空间见 docs/design/14-observability.md §14.3。 */
  counters: z.record(z.string(), z.number()),
  updatedAt: z.string(),
})

/** 注入明细里的逐条质量分量(只记录,不参与排序/过滤,§14.3)。 */
export const usageItem = z.object({
  id: z.string(),
  /** relevance:BM25 + 向量 RRF 融合相关度。 */
  r: z.number(),
  /** score:乘过时间衰减 / 证据 / 籍贯 / 状态的最终分。 */
  s: z.number(),
  /** confidence:模型自报可信度(0–1)。 */
  c: z.number(),
  /** E:证据净值。 */
  e: z.number(),
  /** source:user / code / tool / assistant / quote / unknown。 */
  src: z.string(),
  /** kind:fact / lesson / episode。 */
  k: z.string(),
  /** 代码类记忆的锚核验结果(不适用则省略)。 */
  v: z.boolean().optional(),
})

/** 一次注入的质量聚合(面板展示与日均统计用;阈值只用于分档展示)。 */
export const usageQuality = z.object({
  n: z.number(),
  rAvg: z.number(),
  rMin: z.number(),
  sAvg: z.number(),
  cAvg: z.number(),
  cMin: z.number(),
  eAvg: z.number(),
  lowTrust: z.number(),
  unverified: z.number(),
})

/** 滚动明细:成功注入 + 诊断类跳过(环境类跳过只进日汇总,§14.3)。 */
export const usageRecentRecord = z.object({
  id: z.string(),
  ts: z.string(),
  mode: z.enum(['inject', 'resident', 'digest', 'skip']),
  reason: z.string().nullable().optional(),
  records: z.number(),
  chars: z.number(),
  sessionId: z.string(),
  workspaceLabel: z.string().optional(),
  hitIds: z.array(z.string()).optional(),
  items: z.array(usageItem).optional(),
  quality: usageQuality.optional(),
})

export const USAGE_DOMAIN_NAME = 'neural_mind_usage'
export const USAGE_DOMAIN_VERSION = 1

/** 独立域 spec:版本固定 1;后续改表/字段单独升这个域,不动主域。 */
export function usageDomainSpec() {
  return {
    name: USAGE_DOMAIN_NAME,
    version: USAGE_DOMAIN_VERSION,
    layout: 'per-record',
    invalidRecords: 'backup-and-skip',
    tables: {
      days: { valueSchema: usageDayRecord },
      recent: { valueSchema: usageRecentRecord },
    },
  }
}

export const DOMAIN_NAME = 'neural_mind'
/** 改名前的域名:只读迁移用,新写入一律用 DOMAIN_NAME。 */
export const LEGACY_DOMAIN_NAME = 'memory'
/** 改名前的域版本:旧目录里的记录就停在 v2,迁移读取时按这个版本开域。 */
export const LEGACY_DOMAIN_VERSION = 2
/**
 * v2(2026-09-18,V1.1 第 3 步):`evidenceEvent` 新增可选 `targetId`(争议对对端 id)。
 * 老记录缺此字段(optional 向后兼容),v1 列入 compatibleVersions——首个按 §1 版本纪律升版的字段变更。
 * v3(2026-11-09,插件改名 dsh-plugin-memory → neural-mind):域名从 `memory` 改为
 * `neural_mind`,同时 `globalState` 增可选 `migratedDomains`(旧域名迁移标记)。
 * 记录形状不变;v1/v2 都列入 compatibleVersions——旧记录(含旧域名下的记录)照常读。
 */
export const DOMAIN_VERSION = 3

/**
 * 手写 spec 字面量:`storageDomain.open` 运行时只读这些字段。
 * 官方 `defineDomain` 会做同样的形状校验并在模块加载期抛错(插件为保持依赖最小没有引入它),
 * 所以**取值必须自己守住规则**:name/表名匹配 `^[a-z][a-z0-9_]*$`、version 非负、
 * compatibleVersions 每项 < version、layout 与 invalidRecords 取值合法、global schema 不得接受 null。
 * (test/schema.test.mjs 就是这条纪律的断言。)
 */
export function domainSpec() {
  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    layout: 'per-record',
    compatibleVersions: [1, 2],
    invalidRecords: 'backup-and-skip',
    global: { schema: globalState, initial: { version: 1 } },
    tables: {
      memories: { valueSchema: memoryRecord },
      hotbuffer: { valueSchema: hotEntry },
      outbox: { valueSchema: outboxItem },
      audit: { valueSchema: auditEntry },
      soul_history: { valueSchema: soulEntry },
    },
  }
}

/** 改名前的域 spec:只有名字/版本不同,表与字段 schema 与 domainSpec 完全一致(迁移时只读)。 */
export function legacyDomainSpec() {
  return { ...domainSpec(), name: LEGACY_DOMAIN_NAME, version: LEGACY_DOMAIN_VERSION, compatibleVersions: [1] }
}
