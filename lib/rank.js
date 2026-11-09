/**
 * 排序与生命周期数学(§5.2/§5.3/§5.4/§6)。纯函数;§5.5 算例集即本模块的回归测试。
 *
 * 最终分 = 相关度(RRF) × 时间衰减 × 证据系数 × 籍贯系数 × entity 加权(MVP 恒 1,V1.1)
 *         × supersededFactor × validUntilFactor × stagedFactor
 * importance 刻意不在公式里(§1:防 LLM 自评刷分主导排序)。
 */
import { ageDays, DAY_MS } from './util.js'

// ── 证据系数(§5.3:事件明细账 → 衰减求和 → logistic)────────────────────────

export function evidenceNetScore(record, nowMs, cfg) {
  let R = 0
  let C = 0
  for (const ev of record.evidence ?? []) {
    const age = ageDays(ev.ts, nowMs)
    if (ev.kind === 'reinforce') R += ev.weight * Math.pow(0.5, age / cfg.reinforceHalfLifeDays)
    else if (ev.kind === 'challenge') C += ev.weight * Math.pow(0.5, age / cfg.challengeHalfLifeDays)
  }
  return { R, C, E: R - C }
}

export function evidenceCoefficient(record, nowMs, cfg) {
  const { E } = evidenceNetScore(record, nowMs, cfg)
  return 2 / (1 + Math.exp(-E * cfg.evidenceLogisticSlope))
}

// ── 时间衰减(§5.2:阶梯,基准 = 最近 reinforce 或创建)────────────────────────

export function lastTouchMs(record) {
  let latest = Date.parse(record.createdAt ?? record.eventTime)
  if (Number.isNaN(latest)) latest = 0
  for (const ev of record.evidence ?? []) {
    if (ev.kind !== 'reinforce') continue // challenge 不刷新新鲜度
    const t = Date.parse(ev.ts)
    if (!Number.isNaN(t) && t > latest) latest = t
  }
  return latest
}

export function timeDecayFactor(record, nowMs, cfg) {
  // 豁免:pattern(配额降级者除外)或高重要性 → 恒 1.0
  if (record.temporal === 'pattern' && record.noExemption !== true) return 1
  if ((record.importance ?? 0) >= cfg.highImportanceMin) return 1
  const age = (nowMs - lastTouchMs(record)) / DAY_MS
  const bands = cfg.timeDecayBands
  for (let i = 0; i < bands.length; i++) {
    const [days, factor] = bands[i]
    if (age < days || i === bands.length - 1) return factor // 末档即保底
  }
  return 0.3
}

// ── 状态/事件有效期 ─────────────────────────────────────────────────────────

/** "含数值"含日期与中文数字(§3.2)。 */
const NUMERIC_RE = /[0-9]|[零一二三四五六七八九十百千万亿两]|\d{4}[-/年]\d{1,2}/

export function isNumericState(content) {
  return NUMERIC_RE.test(content ?? '')
}

/** state 的 TTL 分档(§6);带 validUntil 者取 max(正常 TTL, validUntil + 7 天宽限)。 */
export function computeExpiresAt({ temporal, content, validUntil, nowIso }, cfg) {
  if (temporal !== 'state') return undefined
  const ttlDays = isNumericState(content) ? cfg.stateTtlNumericDays : cfg.stateTtlDays
  let expiresMs = Date.parse(nowIso) + ttlDays * DAY_MS
  if (typeof validUntil === 'string' && validUntil !== '') {
    const grace = Date.parse(validUntil) + 7 * DAY_MS
    if (!Number.isNaN(grace) && grace > expiresMs) expiresMs = grace
  }
  return new Date(expiresMs).toISOString()
}

/** 该 state 是否处于"重大事件免 TTL"状态(§6:importance≥8 且 E≥0)。 */
export function isTtlExempt(record, E, cfg) {
  return (record.importance ?? 0) >= cfg.highImportanceMin && E >= 0
}

/** 召回即续期(§6);返回更新后的 expiresAt(不变则返回原值)。 */
export function renewStateExpiry(record, nowIso, cfg) {
  if (record.temporal !== 'state') return record.expiresAt
  return computeExpiresAt(
    { temporal: record.temporal, content: record.content, validUntil: record.validUntil, nowIso },
    cfg,
  )
}

// ── 降权因子(§5.4)──────────────────────────────────────────────────────────

export function statusFactors(record, nowMs, cfg, E) {
  let factor = 1
  if (record.supersededBy !== undefined && record.supersededBy !== null) {
    factor *= cfg.supersededFactor
  }
  if (record.status === 'staged') {
    factor *= cfg.stagedFactor
  }
  if (typeof record.validUntil === 'string' && record.validUntil !== '' && record.todo !== true) {
    // 事件类过期 → 降权;todo 行动项逾期不降权(§6:该提醒不该埋葬)
    if (nowMs > Date.parse(record.validUntil)) factor *= cfg.validUntilFactor
  }
  if (
    record.temporal === 'state'
    && typeof record.expiresAt === 'string'
    && nowMs > Date.parse(record.expiresAt)
    && !isTtlExempt(record, E, cfg)
  ) {
    factor *= cfg.validUntilFactor // 数值到期先宽限降权(§6)
  }
  return factor
}

// ── RRF 融合(§5.1:k=60,未进榜不贡献)───────────────────────────────────────

/**
 * @param lanes [[{ id }], ...] 每一路按名次排序的命中
 * @returns Map<string, number> id → RRF 分
 */
export function rrfFuse(lanes, k) {
  const fused = new Map()
  for (const lane of lanes) {
    lane.forEach((hit, index) => {
      fused.set(hit.id, (fused.get(hit.id) ?? 0) + 1 / (k + index + 1))
    })
  }
  return fused
}

// ── 最终分(§5)──────────────────────────────────────────────────────────────

/**
 * @returns { score, parts } parts 供审计/调试与 §5.5 回归断言。
 */
export function computeFinalScore({ relevance, record, nowMs, cfg, currentWorkspaceId, entityHit = false }) {
  const { E } = evidenceNetScore(record, nowMs, cfg)
  const time = timeDecayFactor(record, nowMs, cfg)
  const evidence = 2 / (1 + Math.exp(-E * cfg.evidenceLogisticSlope))
  const workspace = record.workspaceId === currentWorkspaceId ? cfg.workspaceBoost : cfg.remoteFactor
  const entity = entityHit ? cfg.entityBoost : 1
  const status = statusFactors(record, nowMs, cfg, E)
  const score = relevance * time * evidence * workspace * entity * status
  return { score, parts: { relevance, time, evidence, workspace, entity, status, E } }
}

// ── 生命周期判定(§6,惰性路径:检索/渲染时发现满足即回写)────────────────────

/** E ≤ threshold 记 negativeSince(已是负值保持原时间);E 升回 > threshold 即清零(§6)。 */
export function negativeSinceUpdate(record, E, nowIso, threshold) {
  if (E <= threshold && record.negativeSince === undefined) {
    return { changed: true, negativeSince: nowIso }
  }
  if (E > threshold && record.negativeSince !== undefined) {
    return { changed: true, negativeSince: undefined }
  }
  return { changed: false, negativeSince: record.negativeSince }
}

/**
 * §6 读时对账(2026-09-17 一致性复核补):归档判定前先把"E 升回 > 阈值即清零"这一半兑现。
 *
 * 起因:`negativeSinceUpdate` 原先只在 `challenge()` 之后调用过一次——被质疑过的条目后来被
 * 反复印证、E 早已升回阈值以上,却仍带着旧的 negativeSince,满 14 天照旧被归档(与 §6
 * "E 升回 > −2 即清零"的连续口径相抵,且是静默的:归档发生在惰性路径里)。
 * 现在所有**要判归档**的地方(惰性注入、周期清扫、印证写入)都先对账一次。
 *
 * @returns 需要合并回记录的字段(无变化返回 null,调用方可据此省一次写盘)。
 */
export function reconcileArchiveState(record, nowMs, cfg) {
  const { E } = evidenceNetScore(record, nowMs, cfg)
  const upd = negativeSinceUpdate(record, E, new Date(nowMs).toISOString(), cfg.archiveThreshold)
  return upd.changed ? { negativeSince: upd.negativeSince } : null
}

/**
 * R14(0.6.6):该条目是否有"用户级"质疑(weight ≥ `evidenceWeights.user` 的 challenge)。
 *
 * 系统推断出来的 challenge(提炼关系判断、注入前核验发现锚消失)不算——**重复出现再多
 * 也只能算系统印证,不能替用户翻案**(docs/legacy/REVIEW.md R14)。判定按权重而不新增字段:0.6.6
 * 不升存储格式(§1),且权重本来就是"用户显式 / 系统推断"的分档(§5.3)。
 * 当前版本还没有用户质疑入口(R1c 在 0.7.0),这条保护给未来入口与手工导入的证据留;
 * 在此之前没有 user 权重的 challenge,等于空转(测试会构造出来锁住行为)。
 */
export function hasUserChallenge(record, cfg) {
  const userWeight = cfg.evidenceWeights.user
  return (record.evidence ?? []).some((ev) => ev.kind === 'challenge' && (ev.weight ?? 0) >= userWeight)
}

/**
 * R14/R13b:生成一条"新鲜"的印证时间戳——不早于 now,且严格大于该记录已有证据的最晚 ts。
 *
 * 为什么需要:applyReinforce 用 (ts + 系统权重) 做幂等键防止同批重放重复记;但同一毫秒里
 * 先后发生两次真实印证(创建时的 confirm + 紧随其后的重复 remember)会被误判成"同一次"。
 * 工具侧没有重放语义,所以用这个函数保证时间戳唯一;提炼侧重放仍传批首回合的稳定 ts。
 */
export function freshReinforceTs(record, nowMs = Date.now()) {
  let latest = 0
  for (const ev of record.evidence ?? []) {
    const t = Date.parse(ev?.ts)
    if (!Number.isNaN(t) && t > latest) latest = t
  }
  return new Date(Math.max(nowMs, latest + 1)).toISOString()
}

/**
 * R14(0.6.6):同一内容"又出现一次" = 一次系统权重印证(§5.3 事件明细账)。
 *
 * 纯函数,返回新记录;无变化(重放幂等)时返回**原对象**,调用方可据此省一次写盘。
 * 规则:
 *  - 只作用于 active 条目(调用方保证;这里再防一道,staged/archived/hidden 不改);
 *  - state 类顺带续期(`renewStateExpiry`,与召回续期同口径);
 *  - **用户质疑过的条目不动 `negativeSince`**——系统重复不能替用户翻案;
 *  - 其余走 §6 通用对账(E 升回阈值即清零)。
 * `ts` 可传同一值做幂等键:同一批重放不会重复记(docs/legacy/REVIEW.md R14"同批只记一次")。
 * 幂等判定要求"同一 ts **且**同为系统权重"——用户权重的印证(remember confirm)
 * 与系统印证在同一毫秒里先后落盘时不能互相吞掉。
 */
export function applyReinforce(record, ts, nowMs, cfg) {
  if (record.status !== 'active' || record.hidden === true) return record
  const systemWeight = cfg.evidenceWeights.system
  if ((record.evidence ?? []).some((ev) => ev.kind === 'reinforce' && ev.ts === ts && ev.weight === systemWeight)) {
    return record
  }
  const next = {
    ...record,
    evidence: [...(record.evidence ?? []), { ts, weight: systemWeight, kind: 'reinforce' }]
      .slice(-cfg.evidenceMaxEntries),
  }
  if (next.temporal === 'state') next.expiresAt = renewStateExpiry(next, ts, cfg)
  if (!hasUserChallenge(record, cfg)) {
    const patch = reconcileArchiveState(next, nowMs, cfg)
    if (patch !== null) Object.assign(next, patch)
  }
  return next
}

/**
 * 是否应归档(§6 硬规则,连续口径):
 *  - E ≤ −2 连续 ≥ archiveDurationDays 天(staged 不适用——§3.3 自有路径,
 *    user-explicit 豁免自动归档,故该判定放在 staged 提前返回之后)
 *  - state 过宽限期(2×TTL)且不免 TTL
 *  - stagedBy='model' 的暂存条目 stagingAutoArchiveDays 天未印证(无 reinforce)
 * @returns 归档原因字符串 | null
 */
export function shouldArchive(record, nowMs, cfg) {
  if (record.status === 'archived') return null
  const { E } = evidenceNetScore(record, nowMs, cfg)
  if (record.status === 'staged') {
    if (record.stagedBy === 'model' && ageDays(record.createdAt, nowMs) >= cfg.stagingAutoArchiveDays) {
      const reinforced = (record.evidence ?? []).some((ev) => ev.kind === 'reinforce')
      if (!reinforced) return 'staged-unverified'
    }
    return null // staged 不适用其余硬规则(§3.3;含 negative-since)
  }
  if (record.negativeSince !== undefined && ageDays(record.negativeSince, nowMs) >= cfg.archiveDurationDays) {
    return 'negative-since'
  }
  if (
    record.temporal === 'state'
    && typeof record.expiresAt === 'string'
    && !isTtlExempt(record, E, cfg)
  ) {
    const expiresMs = Date.parse(record.expiresAt)
    const ttlDays = isNumericState(record.content) ? cfg.stateTtlNumericDays : cfg.stateTtlDays
    if (nowMs > expiresMs + 2 * ttlDays * DAY_MS) return 'state-grace-expired'
  }
  return null
}
