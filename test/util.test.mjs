import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { embedAfterWrite, expandUserPath, writeFileAtomic } from '../lib/util.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function fakeDeps({ available = true, fail = false } = {}) {
  const calls = { update: [], upsert: [], embed: [] }
  const store = {
    memories: {
      update: async (id, fn) => {
        calls.update.push(id)
        return fn({ id, content: 'x' })
      },
    },
  }
  const search = { upsertMemory: (r) => calls.upsert.push(r) }
  const embedder = {
    model: 'test-model',
    available: async () => available,
    embedChunks: async (c) => { calls.embed.push(c); return fail ? undefined : [[0.1, 0.2]] },
  }
  const logger = { info: () => {} }
  return { calls, deps: { embedder, store, search, logger } }
}

test('embedAfterWrite:回填 chunks 与模型指纹并同步语料;各降级路径零动作(D2)', async () => {
  // 正常:chunks 与 embeddingModel 写回记录,内存语料同步
  const ok = fakeDeps()
  await embedAfterWrite(ok.deps, { id: 'm_1' }, '内容', 'test')
  await flush()
  assert.deepEqual(ok.calls.embed, ['内容'])
  assert.deepEqual(ok.calls.update, ['m_1'])
  assert.equal(ok.calls.upsert.length, 1)
  assert.equal(ok.calls.upsert[0].embeddingModel, 'test-model')
  assert.deepEqual(ok.calls.upsert[0].chunks, [[0.1, 0.2]])

  // embed 失败(chunks === undefined):不回填,留给重嵌入兜底
  const failed = fakeDeps({ fail: true })
  await embedAfterWrite(failed.deps, { id: 'm_2' }, '内容', 'test')
  await flush()
  assert.equal(failed.calls.update.length, 0)

  // 向量路不可用:零动作
  const off = fakeDeps({ available: false })
  await embedAfterWrite(off.deps, { id: 'm_3' }, '内容', 'test')
  await flush()
  assert.equal(off.calls.embed.length, 0)
  assert.equal(off.calls.update.length, 0)

  // 记录已并发删除(update → undefined):不同步语料,也不抛
  const gone = fakeDeps()
  gone.deps.store.memories.update = async () => undefined
  await embedAfterWrite(gone.deps, { id: 'm_4' }, '内容', 'test')
  await flush()
  assert.equal(gone.calls.upsert.length, 0)
})

test('embedAfterWrite:hidden/archived/private/skip 不发送 embedding 请求', async () => {
  const d = fakeDeps()
  await embedAfterWrite(d.deps, { id: 'm_hidden', hidden: true }, 'HIDDEN', 'test')
  await embedAfterWrite(d.deps, { id: 'm_arch', status: 'archived' }, 'ARCHIVED', 'test')
  await embedAfterWrite({ ...d.deps, skip: true }, { id: 'm_priv' }, 'PRIVATE', 'test')
  await flush()
  assert.deepEqual(d.calls.embed, [], 'hidden/archived/private 均不出站')
  assert.equal(d.calls.update.length, 0)
})

test('writeFileAtomic:成功覆盖、不留临时文件、内容逐字一致', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'util-atomic-'))
  try {
    const file = join(dir, 'SOUL.md')
    await writeFile(file, '旧内容', 'utf8')
    await writeFileAtomic(file, '新内容\n')
    assert.equal(await readFile(file, 'utf8'), '新内容\n', '内容被替换')
    const leftovers = (await readdir(dir)).filter((n) => n.includes('.tmp-'))
    assert.deepEqual(leftovers, [], '不该留下临时文件')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('writeFileAtomic:目标不存在时也能建立(画像首写路径)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'util-atomic-new-'))
  try {
    const file = join(dir, 'profile.md')
    await writeFileAtomic(file, '## 本人\n')
    assert.equal(await readFile(file, 'utf8'), '## 本人\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('writeFileAtomic:写入失败时清掉临时文件,并把错误抛给调用方', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'util-atomic-fail-'))
  try {
    // 目标是一个**目录**:rename 到已存在的非空目录必然失败(EXDEV/EPERM/EISDIR 视平台)
    const target = join(dir, 'adir')
    await (await import('node:fs/promises')).mkdir(target)
    await writeFile(join(target, 'inner'), 'x', 'utf8') // 非空,确保 rename 不被允许
    await assert.rejects(() => writeFileAtomic(target, '内容'), '错误必须抛出去,不能静默')
    const leftovers = (await readdir(dir)).filter((n) => n.includes('.tmp-'))
    assert.deepEqual(leftovers, [], '失败路径也必须清掉半成品')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('R26:配置路径展开 ~/…;光写 ~ 判非法;空串表示未配置', () => {
  const home = homedir()
  assert.deepEqual(expandUserPath(''), { path: '', invalid: false })
  assert.deepEqual(expandUserPath('   '), { path: '', invalid: false })
  assert.deepEqual(expandUserPath('~'), { path: '~', invalid: true })
  assert.deepEqual(expandUserPath('~/'), { path: '~/', invalid: true })
  assert.deepEqual(expandUserPath('~\\'), { path: '~\\', invalid: true })
  assert.deepEqual(expandUserPath('~/neural-mind-profile.md'), { path: join(home, 'neural-mind-profile.md'), invalid: false })
  assert.deepEqual(expandUserPath('~\\neural-mind-profile.md'), { path: join(home, 'neural-mind-profile.md'), invalid: false })
  assert.deepEqual(expandUserPath('/abs/path.md'), { path: '/abs/path.md', invalid: false })
  assert.equal(expandUserPath(undefined).path, '')
})
