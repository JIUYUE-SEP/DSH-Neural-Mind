#!/usr/bin/env node
/**
 * B3 升级 smoke:固定上一版 tarball → 写一条记忆 → 覆盖安装候选 tarball
 * → 用候选版再跑一轮,断言记忆还在、且候选版读到了它(注入日志)。
 *
 * 全程隔离 DSH_HOME;不碰真实 profile;不 push / 不建 release。
 *
 * 用法:
 *   node tools/upgrade-smoke.mjs
 *   node tools/upgrade-smoke.mjs --previous <old.tgz> --candidate <new.tgz>
 *   node tools/upgrade-smoke.mjs --keep          # 成功也保留临时 home
 *   node tools/upgrade-smoke.mjs --home <dir>    # 指定空目录(必须不存在或为空)
 */
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolveAsarPath } from './lib/host-asar.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = argv.indexOf(name)
  return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : fallback
}
const keep = argv.includes('--keep')
const profile = flag('--profile', 'neural-mind-upgrade')
/**
 * 上一版固定用**改名前的 0.5.0 包**(文件名保留旧名,它是真实历史产物):
 * 升级路径要覆盖"旧包写入旧域名 storages/memory → 新包改名 + 迁移读入 storages/neural_mind"。
 */
const previous = resolve(flag('--previous', join(REPO, 'bench-results', 'artifacts', 'dsh-plugin-memory-0.5.0-pre-f0ec867.tgz')))
const candidate = resolve(flag('--candidate', join(REPO, 'bench-results', 'artifacts', 'neural-mind-0.6.7-candidate.tgz')))
/**
 * 版本断言从候选包文件名里取(而不是写死某个版本):
 * npm pack 产物叫 `…-0.6.7.tgz`,artifacts 里叫 `…-0.6.7-candidate.tgz`,两种都要认。
 */
const candidateVersion = /neural-mind-(\d+\.\d+\.\d+)/.exec(basename(candidate))?.[1] ?? ''
const mockBundle = join(REPO, 'test', 'fixtures', 'mock-llm-bundle')
const reportPath = flag('--report', undefined)

for (const [label, path] of [['previous', previous], ['candidate', candidate], ['mock bundle', mockBundle]]) {
  if (!existsSync(path)) {
    console.error(`UPGRADE SMOKE FAILED: 找不到 ${label}: ${path}`)
    process.exit(1)
  }
}

const asar = resolveAsarPath()
if (asar === '') {
  console.error('UPGRADE SMOKE FAILED: 找不到 DSH app.asar')
  process.exit(1)
}
const installRoot = dirname(dirname(asar))
const exe = process.env.DSH_E2E_EXE ?? join(installRoot, 'DeepSeek Harness.exe')
const cli = process.env.DSH_E2E_CLI_JS ?? join(asar, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
if (!existsSync(exe)) {
  console.error(`UPGRADE SMOKE FAILED: 找不到 DSH 可执行文件: ${exe}`)
  process.exit(1)
}

const requestedHome = flag('--home', undefined)
let home
if (requestedHome === undefined) {
  home = mkdtempSync(join(tmpdir(), 'dsh-upgrade-'))
} else {
  home = resolve(requestedHome)
  if (existsSync(home) && readdirSync(home).length > 0) {
    console.error(`UPGRADE SMOKE FAILED: --home 必须不存在或为空: ${home}`)
    process.exit(1)
  }
  mkdirSync(home, { recursive: true })
}
const workspace = join(home, 'workspace')
const mockLog = join(home, 'mock.log')
mkdirSync(workspace, { recursive: true })
writeFileSync(mockLog, '', 'utf8')

const env = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: '1',
  DSH_HOME: home,
  DSH_MOCK_LLM_LOG: mockLog,
}
const commands = []
function run(label, args) {
  commands.push({ label, args })
  const result = spawnSync(exe, ['--expose-internals', cli, ...args], {
    cwd: workspace,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  console.log(`[${label}] exit=${result.status}`)
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-4000)
    throw new Error(`${label} failed\n${detail}`)
  }
  return result
}

let passed = false
try {
  console.log(`home=${home}`)
  run('init-profile', ['--profile', profile, '--from-default-profile', 'headless', '--dump-config'])
  run('install-mock', ['plugin', '--profile', profile, 'add', mockBundle])
  run('install-previous', ['plugin', '--profile', profile, 'add', previous])

  const profileDir = join(home, 'profiles', profile)
  if (!existsSync(profileDir)) throw new Error(`profile 未创建: ${profileDir}`)
  const patchHead = `- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: mock
    model: mock-1

`
  const patchTail = `
- id: session-title-llm
  disabled: true
`
  // ① 旧包(:旧 entry id / 旧配置)
  writeFileSync(join(profileDir, 'cordis.patch.yml'), `${patchHead}- id: memory
  name: dsh-plugin-memory
  config:
    extractEnabled: false
    soulEnabled: false
${patchTail}`, 'utf8')

  run('run-old', ['--profile', profile, '--json', 'Remember this fact: BLUE-FALCON-42'])
  // 旧包落在改名前的域名里(0.5.0 没有 neural_mind 域)。
  const legacyMemoriesDir = join(home, 'storages', 'memory', 'memories')
  const memoriesDir = join(home, 'storages', 'neural_mind', 'memories')
  let before = existsSync(legacyMemoriesDir) ? readdirSync(legacyMemoriesDir).filter((n) => n.startsWith('m_')) : []
  if (before.length === 0) {
    // 0.5.0 的 apply 是"发起 boot 后立即返回";DSH 0.2.2 启动更快,首轮工具集在
    // memory_remember 注册前就解析完了(UNKNOWN_TOOL)。旧包不能改,这里按**旧版存储格式**
    // (storage format v2 / memoryRecord)直接种一条,继续验证"升级不丢数据 + 新版能读到"。
    console.warn('warn: 旧版没有落下记忆(旧版冷启动竞态);按旧版格式种一条后继续')
    mkdirSync(legacyMemoriesDir, { recursive: true })
    const now = new Date().toISOString()
    const id = `m_${randomUUID()}`
    const record = {
      id,
      content: 'The secret code is BLUE-FALCON-42.',
      kind: 'fact',
      source: 'user',
      importance: 6,
      confidence: 0.9,
      temporal: 'pattern',
      eventTime: now,
      workspaceId: workspace,
      workspaceLabel: 'workspace',
      sessionId: 'session-upgrade-seed',
      evidence: [{ ts: now, weight: 1, kind: 'reinforce' }],
      status: 'active',
      createdAt: now,
    }
    writeFileSync(join(legacyMemoriesDir, `${id}.json`), `${JSON.stringify({ version: 2, record }, null, 2)}\n`, 'utf8')
    before = readdirSync(legacyMemoriesDir).filter((n) => n.startsWith('m_'))
  }
  console.log(`memories-before-upgrade=${before.length}`)
  if (before.length === 0) throw new Error('旧版没有落下记忆,无法验证升级')

  run('install-candidate', ['plugin', '--profile', profile, 'add', candidate])
  // ② 新包:禁用旧 entry、给新 entry 写同样的配置(旧 entry 来自上一包的 bundle 层,
  //    不显式禁用会和新插件同时加载,两边各写一份记忆池)。
  writeFileSync(join(profileDir, 'cordis.patch.yml'), `${patchHead}- id: memory
  disabled: true

- id: neural-mind
  config:
    extractEnabled: false
    soulEnabled: false
${patchTail}`, 'utf8')
  const profilePkg = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
  const dep = String(profilePkg.dependencies?.['neural-mind'] ?? '')
  console.log(`profile-dep=${dep}`)
  if (!dep.includes('candidate') && (candidateVersion === '' || !dep.includes(candidateVersion))) {
    throw new Error(`profile 依赖没有切到候选包(${candidateVersion || '版本未知'}): ${dep}`)
  }

  const logOffset = readFileSync(mockLog, 'utf8').length
  run('run-candidate', ['--profile', profile, '--json', 'What is the secret code?'])
  const newLog = readFileSync(mockLog, 'utf8').slice(logOffset)
  const injected = newLog.includes('"injectedMemorySeen":true')
  const after = existsSync(memoriesDir) ? readdirSync(memoriesDir).filter((n) => n.startsWith('m_')) : []
  console.log(`memories-after-upgrade=${after.length} injected=${injected}`)
  if (after.length === 0) throw new Error('升级后记忆丢失(新域名里没有记录)')
  if (after.length < before.length) throw new Error(`迁移条数变少:${before.length} → ${after.length}`)
  if (!injected) throw new Error('候选版没有读到上一版记忆(注入日志 missing)')

  const report = {
    generatedAt: new Date().toISOString(),
    home,
    profile,
    previous,
    candidate,
    memoriesBefore: before.length,
    memoriesAfter: after.length,
    injected,
    commands,
  }
  if (reportPath !== undefined) writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  passed = true
  console.log('UPGRADE SMOKE PASS')
} catch (error) {
  console.error(`UPGRADE SMOKE FAILED: ${error.message}`)
  process.exitCode = 1
} finally {
  if (passed && !keep) {
    rmSync(home, { recursive: true, force: true })
  } else {
    console.log(`keep home=${home}`)
  }
}
