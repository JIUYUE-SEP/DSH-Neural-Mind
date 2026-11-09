import assert from 'node:assert/strict'
import { test } from 'node:test'
import { relationCompatibility } from '../lib/relation.js'

const base = {
  workspaceId: '/repo/a',
  sessionId: 's1',
  entity: 'proj-a',
  temporal: 'pattern',
  source: 'user',
  eventTime: '2026-09-10T10:00:00+08:00',
  createdAt: '2026-09-10T10:00:00+08:00',
  filePaths: undefined,
  validUntil: undefined,
  expiresAt: undefined,
}
const target = { ...base }
const created = { ...base, eventTime: '2026-09-15T10:00:00+08:00' }

test('D2a:同 workspace/entity/temporal 且新不早于旧 → 允许', () => {
  for (const type of ['reinforce', 'contradict', 'dispute']) {
    assert.equal(relationCompatibility(created, target, type).ok, true, type)
  }
})

test('D2a:不同 entity / 一方缺失 entity → reinforce、dispute 拒绝', () => {
  assert.equal(relationCompatibility({ ...created, entity: 'proj-b' }, target, 'reinforce').ok, false)
  assert.equal(relationCompatibility({ ...created, entity: 'proj-b' }, target, 'dispute').ok, false)
  assert.equal(relationCompatibility({ ...created, entity: '' }, target, 'reinforce').ok, false)
})

test('D2a:跨 workspace 只允许 user 级 reinforce,不允许取代/争议', () => {
  const userTarget = { ...target, entity: 'user', workspaceId: '/repo/a' }
  const userCreated = { ...created, entity: 'user', workspaceId: '/repo/b' }
  assert.equal(relationCompatibility(userCreated, userTarget, 'reinforce').ok, true)
  assert.equal(relationCompatibility(userCreated, userTarget, 'contradict').ok, false)
  assert.equal(relationCompatibility(userCreated, userTarget, 'dispute').ok, false)
  assert.equal(relationCompatibility({ ...created, workspaceId: '/repo/b' }, target, 'reinforce').ok, false)
})

test('D2a:temporal/有效期不同不写关系', () => {
  assert.equal(relationCompatibility({ ...created, temporal: 'state' }, target, 'reinforce').ok, false)
  assert.equal(relationCompatibility({ ...created, validUntil: '2027-01-01' }, target, 'reinforce').ok, false)
})

test('D2a:过期 state 不再被强化/取代', () => {
  const expired = { ...target, temporal: 'state', expiresAt: '2020-01-01T00:00:00.000Z' }
  const next = { ...created, temporal: 'state' }
  assert.equal(relationCompatibility(next, expired, 'reinforce').ok, false)
  assert.equal(relationCompatibility(next, expired, 'contradict').ok, false)
})

test('D2a:无 entity 的调试假设链只在同 session/source/14 天内放行', () => {
  const t = { ...target, entity: '', source: 'assistant' }
  const c2 = { ...t, eventTime: '2026-09-15T10:00:00+08:00', source: 'assistant' }
  assert.equal(relationCompatibility(c2, t, 'contradict').ok, true, '同 session/source/5 天')
  assert.equal(relationCompatibility({ ...c2, sessionId: 's2' }, t, 'contradict').ok, false, '跨 session 拒绝')
  assert.equal(relationCompatibility({ ...c2, source: 'user' }, t, 'contradict').ok, false, 'source 不同拒绝')
  assert.equal(relationCompatibility({ ...c2, eventTime: '2026-08-01T10:00:00+08:00' }, t, 'contradict').ok, false, '旧于 target 拒绝')
  assert.equal(relationCompatibility({ ...c2, eventTime: '2026-10-01T10:00:00+08:00' }, t, 'contradict').ok, false, '超过 14 天拒绝')
})

test('D2a:无 entity 的代码锚只有 filePaths 交集才放行', () => {
  const t = { ...target, entity: '', source: 'tool', filePaths: ['src/a.js'] }
  const c = { ...created, entity: '', source: 'code', filePaths: ['src/a.js'] }
  assert.equal(relationCompatibility(c, t, 'contradict').ok, true)
  assert.equal(relationCompatibility({ ...c, filePaths: ['src/b.js'] }, t, 'contradict').ok, false)
})
