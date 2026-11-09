import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDuplicate, withMemoryWrite } from '../lib/dedupe.js'
import { normalizeContent } from '../lib/text.js'

const base = {
  content: '  项目  A   使用 pnpm  ',
  workspaceId: '/repo/a',
  entity: 'Proj-A',
  kind: 'fact',
  temporal: 'pattern',
  sessionId: 's1',
}

test('D1 规范化:只折叠 Unicode/空白,不删否定词、不改大小写', () => {
  assert.equal(normalizeContent('  项目\tA  '), '项目 A')
  assert.equal(normalizeContent('不要用 pnpm'), '不要用 pnpm')
  assert.notEqual(normalizeContent('Use pnpm'), normalizeContent('use pnpm'))
})

test('D1 同事实判定:同主体/同内容命中;不同主体或一方为空不合并', () => {
  assert.equal(isDuplicate(base, { ...base, content: '项目 A 使用 pnpm', entity: 'proj-a' }), true)
  assert.equal(isDuplicate(base, { ...base, entity: 'proj-b' }), false, '不同主体不合并')
  assert.equal(isDuplicate(base, { ...base, entity: '' }), false, '一方有 entity、一方为空不合并')
  assert.equal(isDuplicate(base, { ...base, kind: 'lesson' }), false, '同 entity 但 kind 不同不合并')
  assert.equal(isDuplicate(base, { ...base, validUntil: '2027-01-01' }), false, '有效期不同不合并')
  assert.equal(isDuplicate({ ...base, entity: '' }, { ...base, entity: '', kind: 'lesson' }), false, '空 entity 时 kind 不同不合并')
  assert.equal(isDuplicate({ ...base, entity: '', temporal: 'state' }, { ...base, entity: '', temporal: 'pattern' }), false, '空 entity 时 temporal 不同不合并')
})

test('D1 (unknown) 只能同 session 合并', () => {
  const unknown = { ...base, workspaceId: '(unknown)', sessionId: 's1' }
  assert.equal(isDuplicate(unknown, { ...unknown }), true)
  assert.equal(isDuplicate(unknown, { ...unknown, sessionId: 's2' }), false)
})

test('D1 写队列串行:两个查重+写入不会并发进入临界区', async () => {
  const order = []
  const first = withMemoryWrite(async () => {
    order.push('a-start')
    await new Promise((resolve) => setTimeout(resolve, 20))
    order.push('a-end')
  })
  const second = withMemoryWrite(async () => {
    order.push('b-start')
    order.push('b-end')
  })
  await Promise.all([first, second])
  assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end'])
})
