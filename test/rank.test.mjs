import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeExpiresAt,
  computeFinalScore,
  evidenceCoefficient,
  evidenceNetScore,
  isNumericState,
  negativeSinceUpdate,
  reconcileArchiveState,
  renewStateExpiry,
  rrfFuse,
  shouldArchive,
  timeDecayFactor,
} from '../lib/rank.js'
import { DAY_MS } from '../lib/util.js'

/** §10 默认值的 rankCfg(decay + scoring 合并)。 */
const rankCfg = {
  reinforceHalfLifeDays: 30,
  challengeHalfLifeDays: 180,
  evidenceWeights: { user: 1, system: 0.5 },
  evidenceLogisticSlope: 1,
  evidenceMaxEntries: 64,
  archiveThreshold: -2,
  archiveDurationDays: 14,
  stagingAutoArchiveDays: 30,
  stateTtlDays: 30,
  stateTtlNumericDays: 10,
  timeDecayBands: [[7, 1], [30, 0.8], [90, 0.5], [3650, 0.3]],
  highImportanceMin: 8,
  highQuotaRatio: 0.2,
  workspaceBoost: 1,
  remoteFactor: 0.8,
  stagedFactor: 0.7,
  supersededFactor: 0.3,
  validUntilFactor: 0.3,
  entityBoost: 1.1,
  entityWindowTurns: 3,
}

const NOW = Date.parse('2026-09-15T12:00:00Z')
const isoDaysAgo = (days) => new Date(NOW - days * DAY_MS).toISOString()

// ── §5.5 算例:排序回归测试(§5.6 纪律:新增/调整系数必须扩充算例)──────────────

test('§5.5 算例:本地高证据 pattern 以约 4.6 倍胜出异地无证据 episode', () => {
  const relevanceX = 1 / 61 + 1 / 62 // BM25 第 1 + 向量第 2(RRF k=60)
  const relevanceY = 1 / 64 // 仅 BM25 第 4
  const X = {
    content: '项目统一用 pnpm',
    temporal: 'pattern',
    importance: 5,
    evidence: [{ ts: isoDaysAgo(3), weight: 1, kind: 'reinforce' }], // 3 天前用户显式确认
    createdAt: isoDaysAgo(30),
    eventTime: isoDaysAgo(30),
    workspaceId: '/repo/A',
    status: 'active',
  }
  const Y = {
    content: '上次用 npm 装包报了个警告',
    temporal: 'episode',
    importance: 5,
    evidence: [],
    createdAt: isoDaysAgo(20),
    eventTime: isoDaysAgo(20),
    workspaceId: '/repo/B',
    status: 'active',
  }
  const fx = computeFinalScore({ relevance: relevanceX, record: X, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/repo/A' })
  const fy = computeFinalScore({ relevance: relevanceY, record: Y, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/repo/A' })

  assert.ok(Math.abs(fx.parts.time - 1) < 1e-9, 'pattern 恒 1.0')
  // E = 0.5^(3/30) ≈ 0.933 → 系数 ≈ 1.435
  assert.ok(Math.abs(fx.parts.E - 0.933) < 0.01, `E≈0.93,实际 ${fx.parts.E}`)
  assert.ok(Math.abs(fx.parts.evidence - 1.435) < 0.01, `证据系数≈1.43,实际 ${fx.parts.evidence}`)
  assert.ok(Math.abs(fx.score - 0.0465) < 0.0005, `X≈0.0465,实际 ${fx.score}`)
  assert.ok(Math.abs(fy.parts.time - 0.8) < 1e-9, '20 天 → 0.8 档')
  assert.ok(Math.abs(fy.parts.workspace - 0.8) < 1e-9, '异地 ×0.8')
  assert.ok(Math.abs(fy.score - 0.01) < 0.0005, `Y≈0.0100,实际 ${fy.score}`)
  const ratio = fx.score / fy.score
  assert.ok(ratio > 4 && ratio < 5.4, `X 以约 4.6 倍胜出,实际 ${ratio}`)
})

// ── 边界算例组(§5.6:至少覆盖"本地弱相关 vs 异地高相关""高证据老 vs 无证据新")──

test('边界算例:异地高相关被籍贯系数拉回,不倒挂', () => {
  const local = { content: 'x', temporal: 'episode', importance: 5, evidence: [], createdAt: isoDaysAgo(2), eventTime: isoDaysAgo(2), workspaceId: '/A', status: 'active' }
  const remote = { ...local, workspaceId: '/B' }
  const a = computeFinalScore({ relevance: 1 / 63, record: local, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A' })
  const b = computeFinalScore({ relevance: 1 / 61, record: remote, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A' })
  assert.ok(a.score > b.score, `本地弱相关(${a.score})应胜异地高相关(${b.score})`)
})

test('边界算例:高证据老记忆 vs 无证据新记忆', () => {
  const old = { content: 'x', temporal: 'episode', importance: 5, createdAt: isoDaysAgo(40), eventTime: isoDaysAgo(40), workspaceId: '/A', status: 'active', evidence: [{ ts: isoDaysAgo(5), weight: 1, kind: 'reinforce' }] }
  const fresh = { ...old, createdAt: isoDaysAgo(1), eventTime: isoDaysAgo(1), evidence: [] }
  const a = computeFinalScore({ relevance: 1 / 61, record: old, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A' })
  const b = computeFinalScore({ relevance: 1 / 61, record: fresh, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A' })
  // 老记忆:最近 reinforce 5 天前 → 1.0 档;证据 ≈1.51;新记忆 1.0 × 1.0
  assert.ok(a.score > b.score, `高证据老记忆(${a.score})应胜无证据新记忆(${b.score})`)
})

// ── 单项机制 ────────────────────────────────────────────────────────────────

test('RRF:k=60,未进榜不贡献,两路都沾边赢过单路冠军(§5.1)', () => {
  const fused = rrfFuse([
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'b' }, { id: 'c' }],
  ], 60)
  assert.ok(fused.get('b') > fused.get('a'))
  assert.ok(fused.get('a') > fused.get('c'))
  assert.ok(Math.abs(fused.get('a') - 1 / 61) < 1e-12)
})

test('时间衰减:阶梯与豁免(§5.2)', () => {
  const base = { evidence: [], importance: 5, temporal: 'episode', createdAt: isoDaysAgo(10), eventTime: isoDaysAgo(10) }
  assert.equal(timeDecayFactor(base, NOW, rankCfg), 0.8)
  assert.equal(timeDecayFactor({ ...base, temporal: 'pattern' }, NOW, rankCfg), 1)
  assert.equal(timeDecayFactor({ ...base, temporal: 'pattern', noExemption: true }, NOW, rankCfg), 0.8, '配额降级取消豁免')
  assert.equal(timeDecayFactor({ ...base, importance: 9 }, NOW, rankCfg), 1, 'importance≥8 豁免')
  // 基准是最近 reinforce 而非创建
  const reinforced = { ...base, evidence: [{ ts: isoDaysAgo(2), weight: 0.5, kind: 'reinforce' }] }
  assert.equal(timeDecayFactor(reinforced, NOW, rankCfg), 1)
  // challenge 不刷新新鲜度
  const challenged = { ...base, evidence: [{ ts: isoDaysAgo(2), weight: 0.5, kind: 'challenge' }] }
  assert.equal(timeDecayFactor(challenged, NOW, rankCfg), 0.8)
})

test('证据系数:logistic 映射与半衰期(§5.3)', () => {
  const neutral = { evidence: [] }
  assert.equal(evidenceCoefficient(neutral, NOW, rankCfg), 1, 'E=0 恰 1.0')
  const hit = { evidence: [{ ts: isoDaysAgo(0), weight: 1, kind: 'reinforce' }] }
  const coeff = evidenceCoefficient(hit, NOW, rankCfg)
  assert.ok(Math.abs(coeff - 2 / (1 + Math.exp(-1))) < 1e-9, `单次显式印证 ≈1.46(§5.3;原文一度写 1.54),实际 ${coeff}`)
  const { E } = evidenceNetScore({ evidence: [{ ts: isoDaysAgo(180), weight: 1, kind: 'challenge' }] }, NOW, rankCfg)
  assert.ok(Math.abs(E + 0.5) < 1e-9, 'challenge 半衰期 180 天')
})

test('降权因子:superseded/staged/过期事件/过期 state;todo 逾期不降权(§5.4/§6)', () => {
  const base = { content: 'x', evidence: [], importance: 5, temporal: 'episode', createdAt: isoDaysAgo(1), eventTime: isoDaysAgo(1), workspaceId: '/A', status: 'active' }
  const score = (r) => computeFinalScore({ relevance: 0.01, record: r, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A' }).score
  const ref = score(base)
  assert.ok(Math.abs(score({ ...base, supersededBy: 'm_x' }) - ref * 0.3) < 1e-12)
  assert.ok(Math.abs(score({ ...base, status: 'staged' }) - ref * 0.7) < 1e-12)
  assert.ok(Math.abs(score({ ...base, validUntil: '2026-09-01' }) - ref * 0.3) < 1e-12)
  assert.equal(score({ ...base, validUntil: '2026-09-01', todo: true }), ref, 'todo 逾期不降权')
  const expiredState = { ...base, temporal: 'state', expiresAt: isoDaysAgo(1), content: '无数值' }
  assert.ok(Math.abs(score(expiredState) - ref * 0.3) < 1e-12, 'state 宽限期降权')
  const exempt = { ...expiredState, importance: 9 }
  assert.equal(score(exempt), computeFinalScore({ relevance: 0.01, record: { ...base, importance: 9 }, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A' }).score, 'importance≥8 且 E≥0 免 TTL 处置')
})

test('state TTL:数值分档、validUntil 联姻、召回续期(§6)', () => {
  assert.ok(isNumericState('预算 50 万'))
  assert.ok(isNumericState('下周三交报告'))
  assert.ok(!isNumericState('喜欢简洁的回答'))
  const plain = computeExpiresAt({ temporal: 'state', content: '天气转凉了', nowIso: '2026-09-15T00:00:00Z' }, rankCfg)
  assert.equal(Date.parse(plain) - Date.parse('2026-09-15T00:00:00Z'), 30 * DAY_MS)
  const numeric = computeExpiresAt({ temporal: 'state', content: '体重 70kg', nowIso: '2026-09-15T00:00:00Z' }, rankCfg)
  assert.equal(Date.parse(numeric) - Date.parse('2026-09-15T00:00:00Z'), 10 * DAY_MS)
  const future = computeExpiresAt({ temporal: 'state', content: '3 个月后的体检', validUntil: '2026-12-01', nowIso: '2026-09-15T00:00:00Z' }, rankCfg)
  assert.equal(Date.parse(future), Date.parse('2026-12-01') + 7 * DAY_MS, '取 max(TTL, validUntil+7 天)')
  assert.equal(computeExpiresAt({ temporal: 'pattern', content: 'x', nowIso: '2026-09-15T00:00:00Z' }, rankCfg), undefined)
  const renewed = renewStateExpiry({ temporal: 'state', content: '进度 50%' }, '2026-09-15T00:00:00Z', rankCfg)
  assert.equal(Date.parse(renewed) - Date.parse('2026-09-15T00:00:00Z'), 10 * DAY_MS)
})

test('negativeSince 与归档硬规则(§6)', () => {
  const base = { evidence: [], importance: 5, temporal: 'episode', createdAt: isoDaysAgo(1), status: 'active' }
  const down = negativeSinceUpdate(base, -2.5, '2026-09-15T00:00:00Z', -2)
  assert.ok(down.changed && down.negativeSince === '2026-09-15T00:00:00Z')
  const stays = negativeSinceUpdate({ ...base, negativeSince: '2026-09-01T00:00:00Z' }, -3, '2026-09-15T00:00:00Z', -2)
  assert.ok(!stays.changed, '已是负值保持原时间')
  const cleared = negativeSinceUpdate({ ...base, negativeSince: '2026-09-01T00:00:00Z' }, -1, '2026-09-15T00:00:00Z', -2)
  assert.ok(cleared.changed && cleared.negativeSince === undefined, '升回 >−2 清零')

  const long14 = { ...base, negativeSince: isoDaysAgo(15), evidence: [{ ts: isoDaysAgo(15), weight: 1, kind: 'challenge' }, { ts: isoDaysAgo(15), weight: 1, kind: 'challenge' }, { ts: isoDaysAgo(15), weight: 1, kind: 'challenge' }, { ts: isoDaysAgo(15), weight: 1, kind: 'challenge' }] }
  assert.equal(shouldArchive(long14, NOW, rankCfg), 'negative-since')
  const grace = { ...base, temporal: 'state', content: '进度 50%', expiresAt: isoDaysAgo(21) }
  assert.equal(shouldArchive(grace, NOW, rankCfg), 'state-grace-expired', '数值 state 宽限 2×TTL(20 天)后归档')
  const graceHigh = { ...grace, importance: 9 }
  assert.equal(shouldArchive(graceHigh, NOW, rankCfg), null, 'importance≥8 且 E≥0 免 TTL 归档')
  const stale = { ...base, status: 'staged', stagedBy: 'model', createdAt: isoDaysAgo(31) }
  assert.equal(shouldArchive(stale, NOW, rankCfg), 'staged-unverified')
  const staleUser = { ...stale, stagedBy: 'user' }
  assert.equal(shouldArchive(staleUser, NOW, rankCfg), null, 'user-explicit 豁免自动归档')
})

test('升级对账:被质疑过的条目后来被印证,E 升回阈值以上必须清零 negativeSince(§6)', () => {
  // 5 次系统 challenge(weight 0.5,半衰期 180 天)→ E ≈ −2.3 ≤ −2,记上 negativeSince
  const challenges = [20, 19, 18, 17, 16].map((d) => ({ ts: isoDaysAgo(d), weight: 0.5, kind: 'challenge' }))
  const record = {
    content: '项目统一用 pnpm',
    evidence: challenges,
    importance: 5,
    temporal: 'pattern',
    createdAt: isoDaysAgo(20),
    eventTime: isoDaysAgo(20),
    negativeSince: isoDaysAgo(15),
    status: 'active',
  }
  const { E } = evidenceNetScore(record, NOW, rankCfg)
  assert.ok(E <= -2, `前置不成立:E=${E} 应 ≤ −2`)
  assert.equal(shouldArchive(record, NOW, rankCfg), 'negative-since')

  // 回归:旧实现只在 challenge() 之后调 negativeSinceUpdate,于是这条"已被印证"的记忆
  // 仍带着 15 天前的 negativeSince,下一次清扫就会把它归档。
  const reinforced = { ...record, evidence: [...record.evidence, { ts: isoDaysAgo(0), weight: 1, kind: 'reinforce' }] }
  const patch = reconcileArchiveState(reinforced, NOW, rankCfg)
  assert.ok(patch !== null, 'E 升回 > −2 必须报出清零')
  assert.equal(patch.negativeSince, undefined)
  const live = { ...reinforced, ...patch }
  assert.ok(evidenceNetScore(live, NOW, rankCfg).E > -2)
  assert.equal(shouldArchive(live, NOW, rankCfg), null, '清零后不得再按 negative-since 归档')

  // 另一半不能反掉:E 仍在阈值以下时不许清
  assert.equal(reconcileArchiveState(record, NOW, rankCfg), null, 'E ≤ −2 时无变化')
})

test('staged 不适用 negative-since 归档;confirm 转正后 challenge 归档路径保留(§3.3/§6)', () => {
  // 修复前 shouldArchive 的 negative-since 判定排在 staged 提前返回之前:
  // 暂存区条目被反复 challenge 到 E ≤ −2、negativeSince 超 14 天也会被通用硬规则归档,
  // user-explicit 的"豁免自动归档"承诺被架空。
  const challenges = [20, 19, 18, 17, 16].map((d) => ({ ts: isoDaysAgo(d), weight: 0.5, kind: 'challenge' }))
  const stagedUser = {
    content: '帮我记住:过敏原是花生',
    evidence: challenges,
    negativeSince: isoDaysAgo(15),
    importance: 5,
    temporal: 'pattern',
    createdAt: isoDaysAgo(20),
    status: 'staged',
    stagedBy: 'user',
  }
  assert.ok(evidenceNetScore(stagedUser, NOW, rankCfg).E <= -2, '前置不成立:E 应 ≤ −2')
  assert.equal(shouldArchive(stagedUser, NOW, rankCfg), null, 'user-explicit 豁免一切自动归档(§3.3)')
  const stagedModel = { ...stagedUser, stagedBy: 'model' }
  assert.equal(shouldArchive(stagedModel, NOW, rankCfg), null, 'model-auto 只走 30 天未印证路径,不适用 negative-since')
  // 另一半不能反掉:confirm 转正(active)后,challenge 归档路径按设计保留(§3.3)
  const promoted = { ...stagedUser, status: 'active' }
  assert.equal(shouldArchive(promoted, NOW, rankCfg), 'negative-since', 'confirm 转正后 challenge 归档路径保留')
})

test('entity 加权:命中 ×entityBoost、未命中 ×1(§5.4,V1.1 接线;§5.6 算例纪律)', () => {
  const base = { content: 'x', evidence: [], importance: 5, temporal: 'episode', createdAt: isoDaysAgo(1), eventTime: isoDaysAgo(1), workspaceId: '/A', status: 'active' }
  const score = (entityHit) => computeFinalScore({ relevance: 0.01, record: base, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A', entityHit }).score
  assert.ok(Math.abs(score(true) - score(false) * 1.1) < 1e-12, `命中 ×1.1,实际 ${score(true)} vs ${score(false)}`)
  assert.equal(computeFinalScore({ relevance: 0.01, record: base, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A', entityHit: true }).parts.entity, 1.1)
  assert.equal(computeFinalScore({ relevance: 0.01, record: base, nowMs: NOW, cfg: rankCfg, currentWorkspaceId: '/A', entityHit: false }).parts.entity, 1)
})
