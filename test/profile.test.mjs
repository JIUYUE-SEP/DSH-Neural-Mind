/**
 * L1 用户画像(§4.1 v1.9):文件手改自动跟上。
 *
 * 两条硬约束必须在这层锁住:
 *  - 段 provider 只读**内存镜像**(装配期零文件 I/O);
 *  - 轮询按 `profilePollSeconds` 限流,内容逐字比对(不用 mtime)。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile, unlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerProfile } from '../lib/inject.js'

const logger = { info: () => {} }

/** 假 ctx:inject 直接给一个能收集段注册的 systemPrompt。 */
function fakeCtx(sections) {
  return {
    inject: (deps, fn) => {
      fn({ systemPrompt: { section: (def) => { sections.push(def); return () => {} } } })
      return { dispose: async () => {} }
    },
  }
}

async function withDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'profile-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('画像:启动读文件进镜像;段只读镜像,不碰盘', async () => {
  await withDir(async (dir) => {
    const file = join(dir, 'profile.md')
    await writeFile(file, '- 示例偏好\n')
    const sections = []
    const profile = await registerProfile({
      ctx: fakeCtx(sections), cfg: { profileFile: file, profilePollSeconds: 5 }, logger,
    })

    assert.equal(sections.length, 1, '段始终注册(空文本也不提前 return)')
    assert.equal(sections[0].name, 'memory:profile')
    assert.equal(sections[0].interpolate, false, '画像里的 {{…}} 必须原样保留')
    assert.match(sections[0].text(), /示例偏好/)

    // 手改文件但**不轮询** → 段文本不变(证明装配期没读盘)
    await writeFile(file, '- 现在喜欢别的东西\n')
    assert.match(sections[0].text(), /示例偏好/, '未轮询前段文本不动')

    profile.dispose()
  })
})

test('画像:轮询限流 + 变更生效;手改下一轮才出现', async () => {
  await withDir(async (dir) => {
    const file = join(dir, 'profile.md')
    await writeFile(file, '第一版\n')
    const sections = []
    const profile = await registerProfile({
      ctx: fakeCtx(sections), cfg: { profileFile: file, profilePollSeconds: 5 }, logger,
    })

    await writeFile(file, '第二版\n')
    // 距上次(启动时 lastPollMs=0)已过很久 → 首次轮询放行
    assert.equal(await profile.refreshIfDue(10_000_000), true, '内容变了 → 返回 true')
    assert.match(sections[0].text(), /第二版/)

    // 紧接着再轮询:被最小间隔挡住,即便文件又改了也不重读
    await writeFile(file, '第三版\n')
    assert.equal(await profile.refreshIfDue(10_000_001), false, '间隔内不重读')
    assert.match(sections[0].text(), /第二版/, '仍停在上一版')

    // 过了间隔 → 放行
    assert.equal(await profile.refreshIfDue(10_000_000 + 5000), true)
    assert.match(sections[0].text(), /第三版/)
    profile.dispose()
  })
})

test('画像:文件不存在(ENOENT)视为有意清空 → 空段;其它读错保留旧镜像', async () => {
  await withDir(async (dir) => {
    const file = join(dir, 'profile.md')
    await writeFile(file, '内容还在\n')
    const sections = []
    const profile = await registerProfile({
      ctx: fakeCtx(sections), cfg: { profileFile: file, profilePollSeconds: 1 }, logger,
    })
    assert.match(sections[0].text(), /内容还在/)

    // 删掉文件 = 用户有意清空 → 段变空(注册表会丢弃空段)
    await unlink(file)
    await profile.refreshIfDue(Date.now() + 10_000)
    assert.equal(sections[0].text(), '', 'ENOENT → 空段')
    assert.equal(profile.current(), '')

    // 非 ENOENT 的读错(把路径换成目录 → EISDIR):保留旧镜像,不因一次抖动抹掉画像
    await writeFile(file, '回来了\n')
    await profile.refreshIfDue(Date.now() + 20_000)
    assert.match(sections[0].text(), /回来了/)
    await unlink(file)
    await mkdir(file)
    await profile.refreshIfDue(Date.now() + 30_000)
    assert.match(sections[0].text(), /回来了/, '读错(非 ENOENT)→ 保留上一版')
    profile.dispose()
  })
})

test('画像:唯一录入口是文件;两者都空 → 空段(不注入空标题)', async () => {
  await withDir(async (dir) => {
    const file = join(dir, 'profile.md')
    await writeFile(file, '来自文件\n')
    const sections = []
    const profile = await registerProfile({
      ctx: fakeCtx(sections), cfg: { profileFile: file, profilePollSeconds: 5 }, logger,
    })
    assert.match(sections[0].text(), /来自文件/)
    profile.dispose()
  })

  const sections = []
  const empty = await registerProfile({
    ctx: fakeCtx(sections), cfg: { profileFile: '', profilePollSeconds: 5 }, logger,
  })
  assert.equal(sections[0].text(), '', '都为空 → 空段')
  empty.dispose()
})

test('画像:旧配置残留的 profileText 不静默丢——stderr 一行 + 审计一条', async () => {
  await withDir(async (dir) => {
    const file = join(dir, 'profile.md')
    await writeFile(file, '来自文件\n')
    const sections = []
    const rows = []
    const audit = { write: async (kind, detail) => { rows.push({ kind, detail }) } }
    const stderr = []
    const original = process.stderr.write.bind(process.stderr)
    process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true }
    try {
      const profile = await registerProfile({
        ctx: fakeCtx(sections),
        cfg: { profileText: '旧配置里的残留文本', profileFile: file, profilePollSeconds: 5 },
        logger, audit,
      })
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(sections[0].text().includes('旧配置里的残留文本'), false, '旧键内容不再注入')
      assert.match(sections[0].text(), /来自文件/, '文件仍然生效(唯一来源)')
      assert.ok(stderr.some((line) => line.includes('profileText 已停用')), 'stderr 留一行')
      assert.deepEqual(rows.map((r) => r.kind), ['profile-text-deprecated'])
      assert.match(rows[0].detail, /迁移/, '审计说明怎么迁')
      profile.dispose()
    } finally {
      process.stderr.write = original
    }
  })
})

test('R26:光写 "~" 判非法——按未配置处理,只留一次痕,不静默当空画像', async () => {
  const sections = []
  const rows = []
  const stderr = []
  const original = process.stderr.write.bind(process.stderr)
  process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true }
  try {
    const profile = await registerProfile({
      ctx: fakeCtx(sections),
      cfg: { profileFile: '~', profilePollSeconds: 5 },
      logger,
      audit: { write: async (kind, detail) => { rows.push({ kind, detail }) } },
    })
    assert.equal(sections[0].text(), '', '非法路径按未配置处理,不注入')
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(stderr.filter((line) => line.includes('profileFile')).length, 1, 'stderr 只留一行')
    assert.deepEqual(rows.map((r) => r.kind), ['profile-path-rejected'], '审计写明拒绝原因')

    // 轮询不再重复提醒(同一进程只留一次)
    await profile.refreshIfDue(Date.now() + 10_000)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(stderr.filter((line) => line.includes('profileFile')).length, 1, '不重复刷 stderr')
    assert.equal(rows.filter((r) => r.kind === 'profile-path-rejected').length, 1, '不重复刷审计')
    profile.dispose()
  } finally {
    process.stderr.write = original
  }
})

test('R26:配置了但文件不存在 → 空画像 + 一次 profile-file-missing;文件回来后恢复', async () => {
  await withDir(async (dir) => {
    const file = join(dir, 'profile.md') // 故意不创建
    const sections = []
    const rows = []
    const stderr = []
    const original = process.stderr.write.bind(process.stderr)
    process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true }
    try {
      const profile = await registerProfile({
        ctx: fakeCtx(sections),
        cfg: { profileFile: file, profilePollSeconds: 5 },
        logger,
        audit: { write: async (kind, detail) => { rows.push({ kind, detail }) } },
      })
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(sections[0].text(), '', '文件不存在 → 空画像(不注入)')
      assert.deepEqual(rows.map((r) => r.kind), ['profile-file-missing'], '审计把"配了但找不到"记下来')
      assert.equal(stderr.filter((line) => line.includes('不存在')).length, 1, 'stderr 留一行提示路径')

      await writeFile(file, '后来出现\n')
      await profile.refreshIfDue(Date.now() + 10_000)
      assert.match(sections[0].text(), /后来出现/, '文件创建后正常读取')

      await unlink(file)
      await profile.refreshIfDue(Date.now() + 20_000)
      assert.equal(sections[0].text(), '', '删除文件仍按"有意清空"处理')
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(rows.filter((r) => r.kind === 'profile-file-missing').length, 1, '同一进程不重复刷审计')
      profile.dispose()
    } finally {
      process.stderr.write = original
    }
  })
})
