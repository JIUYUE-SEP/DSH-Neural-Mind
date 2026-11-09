#!/usr/bin/env node
/**
 * N1:默认提炼长驻验收。
 *
 * 问题:release-matrix 的 headless 一次性任务退出时,后台提炼还没轮到,
 * 只能看到 `extract request=false`。这不等于提炼坏了,但也没有确定性证据。
 *
 * 本工具改用 **SDK stdio profile**(长驻进程):
 *  1. 隔离 DSH_HOME 建 sdk profile,装 mock LLM 与候选插件;
 *  2. 发 initialize,再连发 6 个 prompt(默认 extractBatchTurns=6);
 *  3. 等长驻 runtime 里的后台提炼真的发出 LLM 请求;
 *  4. 断言 L2 落盘、L0 digested、outbox 消费、无 extract-failed;
 *  5. 断言 mock 侧确实见过 reason=extract 的请求。
 *
 * 用法:
 *   node tools/default-extract-smoke.mjs --plugin <tarball> [--keep] [--home <dir>] [--report <file>]
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolveAsarPath, hostIdentity } from './lib/host-asar.mjs'

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)))
const MOCK_BUNDLE_DIR = join(REPO, 'test', 'fixtures', 'mock-llm-bundle')
const PROFILE = 'memory-n1'
const SESSION_ID = 's-n1-default-extract'
const FACT = 'N1-EXTRACTED-FACT'

const argv = process.argv.slice(2)
const argValue = (flag) => {
  const index = argv.indexOf(flag)
  if (index < 0) return undefined
  return argv[index + 1]
}
const keep = argv.includes('--keep')
const pluginPath = resolve(argValue('--plugin') ?? process.env.DSH_E2E_PLUGIN ?? REPO)
const reportPath = argValue('--report')
const home = resolve(argValue('--home') ?? mkdtempSync(join(tmpdir(), 'dsh-memory-n1-')))
const assertions = []
const commands = []
const logs = []
const note = (name, ok, detail) => {
  assertions.push({ name, ok: ok === true, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) process.exitCode = 1
}
const log = (line) => {
  logs.push(line)
  console.log(line)
}
const fatal = (message) => {
  console.error(`N1 HARNESS ERROR: ${message}`)
  process.exit(1)
}
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

const ASAR = resolveAsarPath(process.env.DSH_E2E_ASAR)
if (ASAR === '') fatal('找不到已安装的 DSH 桌面壳;用 DSH_E2E_ASAR 指定 resources/app.asar')
const installRoot = dirname(dirname(ASAR))
const DSH_EXE = process.env.DSH_E2E_EXE ?? join(installRoot, 'DeepSeek Harness.exe')
const DSH_CLI_JS = process.env.DSH_E2E_CLI_JS
  ?? join(ASAR, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
if (!existsSync(DSH_EXE)) fatal(`找不到 DSH 可执行文件:${DSH_EXE}`)
// CLI 在 asar 内,普通 fs 看不到;只要 EXE 存在就交给 Electron-as-node 加载。
if (!existsSync(MOCK_BUNDLE_DIR)) fatal(`找不到 mock bundle:${MOCK_BUNDLE_DIR}`)
if (!existsSync(pluginPath)) fatal(`找不到插件:${pluginPath}`)
if (!existsSync(home)) mkdirSync(home, { recursive: true })
if (readdirSync(home).length > 0) fatal(`--home 必须为空:${home}`)
const workspace = join(home, 'workspace')
const logsDir = join(home, 'n1-logs')
mkdirSync(workspace, { recursive: true })
mkdirSync(logsDir, { recursive: true })
const mockLog = join(home, 'mock-llm.log')
writeFileSync(mockLog, '', 'utf8')

const env = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: '1',
  DSH_HOME: home,
  DSH_MOCK_LLM_LOG: mockLog,
  DSH_MOCK_EXTRACT_FACT: FACT,
}
const cliEnv = { ...env, ELECTRON_RUN_AS_NODE: '1' }

function runSync(label, args) {
  commands.push({ label, args })
  const result = spawnSync(DSH_EXE, ['--expose-internals', DSH_CLI_JS, ...args], {
    cwd: workspace,
    env: cliEnv,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  writeFileSync(join(logsDir, `${label}.out`), result.stdout ?? '', 'utf8')
  writeFileSync(join(logsDir, `${label}.err`), result.stderr ?? '', 'utf8')
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** Read all JSON records under storages/neural_mind; ids/content/status are enough for N1. */
function readMemoryRecords() {
  const root = join(home, 'storages', 'neural_mind')
  const records = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { walk(path); continue }
      if (!entry.name.endsWith('.json')) continue
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'))
        if (parsed !== null && typeof parsed === 'object') records.push({ path, record: parsed.record ?? parsed })
      } catch { /* non-record sidecar; ignore */ }
    }
  }
  walk(root)
  return records
}

function mockRows() {
  try {
    return readFileSync(mockLog, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

async function waitFor(predicate, timeoutMs, label) {
  const started = Date.now()
  for (;;) {
    const value = predicate()
    if (value) return value
    if (Date.now() - started > timeoutMs) throw new Error(`等待超时:${label}`)
    await sleep(100)
  }
}

let child
let stderr = ''
let stdoutBuffer = ''
const pending = new Map()
let nextId = 1

function writeFrame(frame) {
  child.stdin.write(`${JSON.stringify(frame)}\n`)
}

function request(method, params, timeoutMs = 60_000) {
  const id = `n1-${nextId++}`
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      rejectPromise(new Error(`JSON-RPC 超时:${method}`))
    }, timeoutMs)
    pending.set(id, { resolve: resolvePromise, reject: rejectPromise, timer })
    try {
      writeFrame({ jsonrpc: '2.0', id, method, params })
    } catch (error) {
      clearTimeout(timer)
      pending.delete(id)
      rejectPromise(error)
    }
  })
}

function handleLine(line) {
  if (line.trim() === '') return
  let frame
  try { frame = JSON.parse(line) } catch { return }
  if (frame !== null && typeof frame.id === 'string' && pending.has(frame.id)) {
    const entry = pending.get(frame.id)
    clearTimeout(entry.timer)
    pending.delete(frame.id)
    if (frame.error !== undefined) entry.reject(new Error(`JSON-RPC ${String(frame.error.code)}: ${String(frame.error.message)}`))
    else entry.resolve(frame.result)
  }
}

async function main() {
  log(`宿主:${hostIdentity(ASAR).name} ${hostIdentity(ASAR).version}`)
  log(`DSH_HOME(隔离):${home}`)
  log(`plugin:${pluginPath}`)

  const init = runSync('01-init-profile', ['--profile', PROFILE, '--from-default-profile', 'sdk', '--dump-config'])
  if (init.status !== 0) fatal(`建 sdk profile 失败:${init.stderr.slice(-2000)}`)
  note('profile-init', existsSync(join(home, 'profiles', PROFILE, 'package.json')))

  const addMock = runSync('02-add-mock', ['plugin', '--profile', PROFILE, 'add', MOCK_BUNDLE_DIR])
  if (addMock.status !== 0) fatal(`装 mock 失败:${addMock.stderr.slice(-2000)}`)
  note('install-mock', addMock.stdout.includes('neural-mind-test-mock-llm'))

  const addPlugin = runSync('03-add-plugin', ['plugin', '--profile', PROFILE, 'add', pluginPath])
  if (addPlugin.status !== 0) fatal(`装插件失败:${addPlugin.stderr.slice(-2000)}`)
  note('install-plugin', addPlugin.stdout.includes('neural-mind'))

  // 默认提炼:不覆盖 extractBatchTurns,保持 6;SOUL 关闭以缩小变量。
  writeFileSync(join(home, 'profiles', PROFILE, 'cordis.patch.yml'), `# N1: SDK stdio 长驻 profile,默认提炼批次。
- id: neural-mind
  name: neural-mind
  config:
    extractEnabled: true
    soulEnabled: false
`, 'utf8')
  const dump = runSync('04-dump-config', ['--profile', PROFILE, '--dump-config'])
  if (dump.status !== 0) fatal(`dump-config 失败:${dump.stderr.slice(-2000)}`)
  note('compose-memory-config', /- id: neural-mind[\s\S]{0,200}extractEnabled: true/.test(dump.stdout))
  note('default-batch-kept', !/extractBatchTurns/.test(dump.stdout), 'dump 中不出现 extractBatchTurns 覆盖')

  child = spawn(DSH_EXE, ['--expose-internals', DSH_CLI_JS, '--profile', PROFILE], {
    cwd: workspace,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk
    for (;;) {
      const newline = stdoutBuffer.indexOf('\n')
      if (newline < 0) break
      const line = stdoutBuffer.slice(0, newline)
      stdoutBuffer = stdoutBuffer.slice(newline + 1)
      handleLine(line)
    }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.on('error', (error) => { stderr += `${String(error)}\n` })

  const initialized = await request('initialize', { cwd: workspace, provider: 'mock', model: 'mock-1' })
  note('initialize', initialized?.serverInfo?.name === 'deepseek-harness-sdk-runtime', initialized?.serverInfo?.name)

  for (let turn = 1; turn <= 6; turn++) {
    await request('session/prompt', {
      sessionId: SESSION_ID,
      contentBlocks: [{ type: 'text', text: `N1 default extraction turn ${turn}` }],
    })
    await request('session/wait', { sessionId: SESSION_ID })
    log(`✓ turn ${turn}/6 idle`)
  }
  note('six-turns-idle', true)

  await waitFor(() => mockRows().some((row) => row.reason === 'extract'), 30_000, 'extract LLM request')
  const extractCalls = mockRows().filter((row) => row.reason === 'extract').length
  note('extract-request-observed', extractCalls > 0, `extract calls=${extractCalls}`)

  await waitFor(() => {
    const records = readMemoryRecords()
    return records.some(({ record }) => record.content === FACT)
  }, 30_000, 'L2 fact persisted')
  await waitFor(() => {
    const rows = readMemoryRecords()
    const hot = rows.filter(({ record }) => typeof record.id === 'string' && record.id.startsWith('hb_'))
    const pending = rows.filter(({ record }) => record.status === 'pending' || record.status === 'extracting')
    return hot.length > 0 && hot.every(({ record }) => record.digested === true) && pending.length === 0
  }, 30_000, 'L0 digested + outbox drained')
  const records = readMemoryRecords()
  const factRecord = records.find(({ record }) => record.content === FACT)?.record
  note('l2-fact-persisted', factRecord !== undefined, factRecord?.id)
  const hotRecords = records.filter(({ record }) => typeof record.id === 'string' && record.id.startsWith('hb_'))
  note('l0-digested', hotRecords.length > 0 && hotRecords.every(({ record }) => record.digested === true), `hot=${hotRecords.length}`)

  const audit = records.filter(({ record }) => typeof record.kind === 'string' && record.kind.startsWith('extract-'))
    .map(({ record }) => record.kind)
  note('no-extract-failed', !audit.includes('extract-failed'), JSON.stringify(audit))
  const outbox = records.filter(({ record }) => record.status === 'pending' || record.status === 'extracting')
  note('outbox-drained', outbox.length === 0, `pending/extracting=${outbox.length}`)

  try {
    await request('shutdown', {})
  } catch { /* process may close before responding */ }
  await new Promise((resolvePromise) => {
    if (child.exitCode !== null) return resolvePromise()
    const timer = setTimeout(() => { child.kill(); resolvePromise() }, 5000)
    child.once('exit', () => { clearTimeout(timer); resolvePromise() })
  })

  note('no-fatal-plugin-stderr', !/\[memory\].*(启动失败|不可用|Error)|SessionFormatError/.test(stderr), stderr.split('\n').filter((line) => line.includes('[memory]')).slice(0, 3).join(' | '))
  writeFileSync(join(logsDir, 'sdk.stderr.log'), stderr, 'utf8')

  const report = {
    generatedAt: new Date().toISOString(),
    profile: PROFILE,
    plugin: pluginPath,
    sessionId: SESSION_ID,
    extractCalls,
    assertions,
    stdoutBytes: stdoutBuffer.length,
    commands,
  }
  if (reportPath !== undefined) writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const failed = assertions.filter((item) => !item.ok)
  log(`\n${failed.length === 0 ? 'N1 DEFAULT-EXTRACT PASS' : `N1 DEFAULT-EXTRACT FAIL (${failed.length})`}`)
  if (failed.length > 0) process.exitCode = 1
}

try {
  await main()
} catch (error) {
  console.error(`N1 HARNESS ERROR: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  if (child !== undefined && child.exitCode === null) {
    child.kill()
    await new Promise((resolvePromise) => {
      const timer = setTimeout(resolvePromise, 3000)
      child.once('exit', () => { clearTimeout(timer); resolvePromise() })
    })
  }
  if (!keep) rmSync(home, { recursive: true, force: true })
  else log(`保留临时目录:${home}`)
}
