/**
 * domain spec 契约测试:表名/域名必须通过存储层的命名规则。
 *
 * 为什么单独有这个文件:`@deepseek-ai/dsh-storage` 的 `UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/`
 * (packages/storage/storage/src/backend.ts:10)不允许驼峰,而 `storageDomain.open()` 对不合规的表名
 * **抛错**——插件的 `openStore` 会因此静默降级成纯内存态(重启失忆)。
 * 这条真实事故发生在 v1.9 第 1 步(表名写成 `soulHistory`),只在真机 e2e 里暴露;
 * 这里补一条无依赖的断言,把同类错误挡在单测阶段。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  domainSpec, DOMAIN_NAME, DOMAIN_VERSION, batchDomainSpec, BATCH_DOMAIN_NAME, globalState,
  legacyDomainSpec, LEGACY_DOMAIN_NAME, LEGACY_DOMAIN_VERSION,
  legacyBatchDomainSpec, LEGACY_BATCH_DOMAIN_NAME,
  usageDomainSpec, USAGE_DOMAIN_NAME, usageDayRecord, usageRecentRecord,
} from '../lib/schema.js'

/** 与 @deepseek-ai/dsh-storage 的 UNIT_NAME_RE 保持一致(域名与表名共用同一条规则)。 */
const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/

test('domain spec:域名与每个表名都符合存储层命名规则(禁驼峰/连字符)', () => {
  const spec = domainSpec()
  assert.match(spec.name, UNIT_NAME_RE, `域名不合规: ${spec.name}`)
  for (const name of Object.keys(spec.tables)) {
    assert.match(name, UNIT_NAME_RE, `表名不合规(会被 storageDomain.open 拒绝): ${name}`)
  }
  assert.equal(spec.name, DOMAIN_NAME)
})

test('domain spec:声明了本次用到的五张表,版本纪律按 §1 执行', () => {
  const spec = domainSpec()
  assert.deepEqual(
    Object.keys(spec.tables).sort(),
    ['audit', 'hotbuffer', 'memories', 'outbox', 'soul_history'],
  )
  // v1 → v2(V1.1 第 3 步):evidenceEvent 新增可选 targetId(争议对对端)——首个字段级升版;
  // v2 → v3(2026-11-09 改名):global 增可选 migratedDomains,域名换新。记录形状不变。
  assert.equal(spec.version, 3, '字段变更才升版本(§1 版本纪律)')
  assert.deepEqual(spec.compatibleVersions, [1, 2])
  assert.equal(spec.layout, 'per-record')
})

test('legacy domain spec:改名前的 memory 域按旧名字/旧版本开域,只用于迁移读取', () => {
  assert.equal(LEGACY_DOMAIN_NAME, 'memory')
  assert.equal(LEGACY_DOMAIN_VERSION, 2)
  const legacy = legacyDomainSpec()
  assert.equal(legacy.name, 'memory')
  assert.match(legacy.name, UNIT_NAME_RE)
  assert.equal(legacy.version, 2, '旧目录里的记录停在 v2')
  assert.deepEqual(legacy.compatibleVersions, [1])
  assert.deepEqual(Object.keys(legacy.tables).sort(), Object.keys(domainSpec().tables).sort())
})

test('batch domain spec:独立 neural_mind_extract 域,不改主域版本', () => {
  const spec = batchDomainSpec()
  assert.equal(spec.name, BATCH_DOMAIN_NAME)
  assert.match(spec.name, UNIT_NAME_RE)
  assert.equal(LEGACY_BATCH_DOMAIN_NAME, 'memory_extract')
  assert.equal(legacyBatchDomainSpec().name, 'memory_extract')
  assert.equal(legacyBatchDomainSpec().version, spec.version, '旧批次域与新版只有名字不同')
  assert.equal(spec.version, 1)
  assert.deepEqual(Object.keys(spec.tables), ['batches'])
  assert.match(Object.keys(spec.tables)[0], UNIT_NAME_RE)
  assert.equal(spec.layout, 'per-record')
  assert.equal(spec.invalidRecords, 'backup-and-skip')
})

/**
 * global 记录必须**声明** seenWorkspaces:storageDomain 打开域时用本 schema 校验 global,
 * zod 默认 strip 未声明的键——漏声明会让"见过的工作区"在每次热重建/重启后被剥光,
 * 配置页的「已知工作区」回到 0,下一次写入也只剩刚记的一条(真实事故)。
 */
/**
 * §14 使用观测域(0.6.7):独立短命域 + 两表。与 batch 域同一裁决——不升主域版本,
 * 旧插件回滚时忽略它即可。
 */
test('usage domain spec:独立 neural_mind_usage 域,两表合法且不跟主域升版', () => {
  const spec = usageDomainSpec()
  assert.equal(spec.name, USAGE_DOMAIN_NAME)
  assert.equal(spec.name, 'neural_mind_usage')
  assert.match(spec.name, UNIT_NAME_RE)
  assert.equal(spec.version, 1)
  assert.equal(spec.layout, 'per-record')
  assert.equal(spec.invalidRecords, 'backup-and-skip')
  assert.deepEqual(Object.keys(spec.tables).sort(), ['days', 'recent'])
  for (const name of Object.keys(spec.tables)) assert.match(name, UNIT_NAME_RE)
  assert.notEqual(spec.name, DOMAIN_NAME, '不能写进主域')
  // 记录形状:日汇总 / 明细各一条最小合法样本
  assert.equal(usageDayRecord.parse({ id: 'u_2026-11-10', date: '2026-11-10', counters: { 'inject.inject': 1 }, updatedAt: '2026-11-10T00:00:00.000Z' }).date, '2026-11-10')
  const recent = usageRecentRecord.parse({
    id: 'r_1794238785501_1', ts: '2026-11-10T00:19:45.000Z', mode: 'inject', records: 3, chars: 420, sessionId: 'sess',
    items: [{ id: 'm_1', r: 0.72, s: 0.41, c: 0.8, e: 1.3, src: 'user', k: 'fact', v: true }],
  })
  assert.equal(recent.items[0].src, 'user')
  assert.throws(() => usageRecentRecord.parse({ id: 'x', ts: 't', mode: 'nope', records: 0, chars: 0, sessionId: '' }), /mode/)
})

test('global schema:seenWorkspaces 必须被保留(不能被 zod strip)', () => {
  const seen = [{ id: 'A:\\proj\\dsh-memory', label: 'dsh-memory', lastSeenMs: 1_700_000_000_000 }]
  const parsed = globalState.parse({ version: 1, onboardedAt: '2026-11-07T00:00:00.000Z', seenWorkspaces: seen })
  assert.equal(Object.hasOwn(parsed, 'seenWorkspaces'), true, '未声明就会被 strip → 重启后列表清空')
  assert.deepEqual(parsed.seenWorkspaces, seen)
  // 老 profile(没有该字段)仍然合法:向后兼容
  assert.deepEqual(globalState.parse({ version: 1 }), { version: 1 })
  // v3 迁移标记:可选;有值时原样保留(不能被 strip,否则会重复迁移)
  const migrated = globalState.parse({ version: 1, migratedDomains: ['memory'] })
  assert.deepEqual(migrated.migratedDomains, ['memory'])
})
