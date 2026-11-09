#!/usr/bin/env node
/**
 * e2e-conversation.mjs —— 隔离 DSH 上的**真实对话**端到端(本地 mock LLM:零账号、零网络、不碰用户 DSH)。
 *
 * 回答的问题:插件修好的会话 V4 形状,在"真的开一轮对话、真的走 checkpoint 持久化"时还成立吗?
 * 只是单测/浏览器 e2e 覆盖不到"agent/pre-step → 注入消息 → Session V4 编码 → checkpoint flush"这条链。
 *
 * 机制:
 *  1. 建一个全新 `%TEMP%` DSH_HOME(拒绝任何含 `.dsh/profiles` 的路径);
 *  2. `--from-default-profile headless --dump-config` 建一次性 headless profile;
 *  3. `plugin add` 装两个本地包:`test/fixtures/mock-llm-bundle`(测试专用,注册 provider `mock`/`mock-1`)
 *     和本仓库插件;
 *  4. profile patch:默认模型指向 mock;插件关掉提炼/SOUL(让 mock 调用序列确定);关掉标题 LLM;
 *  5. 同一 DSH_HOME / workspace 连跑两次 headless 一次性任务:
 *       run1 让模型 `memory_remember` 一条事实(mock 发出 tool call → 插件同步落盘);
 *       run2 问同一事实 → 插件 `agent/pre-step` 召回并注入;
 *  6. 解压两次会话的 Session V4 JSONL.zstd(多帧 zstd,Node 只解第一帧,需自己走帧),
 *     断言:run2 退出 0 + turn/end completed + 日志里有 `source.kind == "plugin:neural-mind"`
 *     的注入消息且内容含事实 + 无 SessionFormatError/producer-owned 错误 + 插件 stderr 无启动失败。
 *
 * 用法:
 *   node tools/e2e-conversation.mjs                 # 自动探测本机 DSH,默认临时 home,跑完删除
 *   node tools/e2e-conversation.mjs --keep          # 保留 home 供排查
 *   node tools/e2e-conversation.mjs --home <空目录>  # 指定 home(必须不存在或为空,且不在真实 ~/.dsh 下)
 *   node tools/e2e-conversation.mjs --report <file> # 额外写一份 JSON 报告
 * 环境变量:`DSH_E2E_ASAR` / `DSH_E2E_EXE` / `DSH_E2E_CLI_JS` 可覆盖宿主定位(非标准安装时用)。
 *
 * 退出码:0 = 全部断言通过;2 = 断言/步骤失败(home 保留);1 = harness 自身错误。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { resolveAsarPath, hostIdentity } from './lib/host-asar.mjs'

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)))
const MOCK_BUNDLE_DIR = join(REPO, 'test', 'fixtures', 'mock-llm-bundle')
const PROFILE = 'memory-e2e'
const FACT = 'The secret code is BLUE-FALCON-42.'
const RUN1_TASK = `Remember this fact: ${FACT}`
const RUN2_TASK = 'What is the secret code? Answer in one short sentence.'

const assertions = []
const commands = []
/** 记录一条断言。 */
function record(name, ok, detail) {
  assertions.push({ name, ok: ok === true, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}
/** harness 级致命错误(缺宿主/参数非法):退出码 1。 */
function die(message) {
  console.error(`E2E HARNESS ERROR: ${message}`)
  process.exit(1)
}

// ── 宿主定位:桌面壳 app.asar → <install>/resources/app.asar;CLI 入口在 asar 内,由 Electron 以 node 模式加载 ──
const ASAR = resolveAsarPath(process.env.DSH_E2E_ASAR)
if (ASAR === '') die('找不到已安装的 DSH 桌面壳;用 DSH_E2E_ASAR 指定 resources/app.asar 路径')
const installRoot = dirname(dirname(ASAR))
const DSH_EXE = process.env.DSH_E2E_EXE ?? join(installRoot, 'DeepSeek Harness.exe')
const DSH_CLI_JS = process.env.DSH_E2E_CLI_JS
  ?? join(ASAR, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
if (!existsSync(DSH_EXE)) die(`找不到 DSH 可执行文件:${DSH_EXE}(可用 DSH_E2E_EXE 覆盖)`)
if (!existsSync(MOCK_BUNDLE_DIR)) die(`找不到测试 mock bundle:${MOCK_BUNDLE_DIR}`)
const identity = hostIdentity(ASAR)

// ── 参数 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const argValue = (flag) => {
  const index = argv.indexOf(flag)
  if (index < 0) return undefined
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) die(`${flag} 需要一个值`)
  return value
}
const keep = argv.includes('--keep')
const defaultSmoke = argv.includes('--default-smoke')
const reportPath = argValue('--report')
const pluginPath = resolve(argValue('--plugin') ?? process.env.DSH_E2E_PLUGIN ?? REPO)
let home = argValue('--home')
if (home === undefined) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  home = join(tmpdir(), `dsh-memory-e2e-${stamp}-${process.pid}`)
} else {
  home = resolve(home)
  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true })
  } else if (readdirSync(home).length > 0) {
    die(`--home 必须不存在或为空:${home}`)
  }
}
const homeLower = home.toLowerCase()
if (homeLower.includes('\\.dsh\\') || homeLower.includes('/.dsh/') || homeLower.includes('\\.dsh/profiles')) {
  die(`拒绝使用真实 DSH home 路径:${home}`)
}
mkdirSync(home, { recursive: true })
const workspace = join(home, 'workspace')
mkdirSync(workspace, { recursive: true })
const logsDir = join(home, 'e2e-logs')
mkdirSync(logsDir, { recursive: true })
const mockLog = join(home, 'mock-llm.log')
writeFileSync(mockLog, '', 'utf8')
if (defaultSmoke) writeFileSync(join(home, 'SOUL.md'), '# E2E SOUL\n\nE2E-SOUL-PERSONA: 回答保持简短。\n', 'utf8')
console.log(`宿主:${identity.name} ${identity.version}(build ${identity.build})`)
console.log(`DSH_HOME(隔离):${home}`)
console.log(`mock bundle:${MOCK_BUNDLE_DIR}`)
console.log(`plugin:${pluginPath}`)
if (defaultSmoke) console.log('模式:default-smoke(extractBatchTurns=1,非默认批次;SOUL 开启)')

// ── 命令执行:直接以 Electron-as-node 跑 asar 内的 CLI 入口(asar 对普通 Node 不可见) ──
function run(label, args, { logFile } = {}) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: home,
    ...(logFile === undefined ? {} : { DSH_MOCK_LLM_LOG: logFile }),
  }
  commands.push({
    label,
    command: `"${DSH_EXE}" --expose-internals "${DSH_CLI_JS}" ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
    env: { DSH_HOME: home, DSH_MOCK_LLM_LOG: logFile ?? null },
  })
  const result = spawnSync(DSH_EXE, ['--expose-internals', DSH_CLI_JS, ...args], {
    cwd: workspace,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  writeFileSync(join(logsDir, `${label}.out`), result.stdout ?? '', 'utf8')
  writeFileSync(join(logsDir, `${label}.err`), result.stderr ?? '', 'utf8')
  return { status: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** First / last JSON line of a headless `--json` run. */
function firstJsonLine(stdout) {
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    try {
      return JSON.parse(line)
    } catch { /* not JSON */ }
  }
  return undefined
}

// ── Session 日志:多帧 zstd(JSONL 后端按批次各写一帧,Node 只解第一帧) ──
function zstdFrameLength(buf, offset) {
  if (buf.length - offset < 8) return undefined
  const magic = buf.readUInt32LE(offset)
  if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) return 8 + buf.readUInt32LE(offset + 4) // skippable frame
  if (magic !== 0xfd2fb528) return undefined
  let pos = offset + 4
  const fhd = buf[pos]
  pos += 1
  const fcsFlag = (fhd >> 6) & 3
  const singleSegment = (fhd & 0x20) !== 0
  const checksum = (fhd & 0x04) !== 0
  const dictIdFlag = fhd & 3
  if (!singleSegment) pos += 1 // window descriptor
  pos += [0, 1, 2, 4][dictIdFlag]
  pos += [singleSegment ? 1 : 0, 2, 4, 8][fcsFlag]
  for (;;) {
    if (buf.length - pos < 3) return undefined
    const header = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)
    const last = (header & 1) === 1
    const blockType = (header >> 1) & 3
    const blockSize = header >> 3
    pos += 3
    pos += blockType === 1 ? 1 : blockSize // RLE block carries one byte
    if (pos > buf.length) return undefined
    if (last) return pos - offset + (checksum ? 4 : 0)
  }
}
function decompressSessionLog(path) {
  const buf = readFileSync(path)
  const frames = []
  let offset = 0
  while (offset < buf.length) {
    const length = zstdFrameLength(buf, offset)
    if (length === undefined || length <= 0) break
    frames.push(buf.subarray(offset, offset + length))
    offset += length
  }
  if (frames.length === 0) throw new Error(`解析不到 zstd 帧:${path}`)
  const text = frames.map((frame) => zlib.zstdDecompressSync(frame).toString('utf8')).join('')
  return {
    frames: frames.length,
    bytes: buf.length,
    rows: text.split('\n').filter((line) => line.trim() !== '').map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`会话日志第 ${index + 1} 行不是 JSON:${String(error)}`)
      }
    }),
  }
}
function walkFiles(dir, predicate, found = []) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(path, predicate, found)
    else if (predicate(path)) found.push(path)
  }
  return found
}
function findSessionLog(sessionId) {
  const matches = walkFiles(join(home, 'sessions'), (path) => path.endsWith('.jsonl.zstd') && path.split(/[\\/]/).includes(sessionId))
  if (matches.length !== 1) throw new Error(`会话 ${sessionId} 的日志应恰好一个,实际 ${matches.length}:${matches.join(', ')}`)
  return matches[0]
}
function memoryRecordFiles() {
  const dir = join(home, 'storages', 'neural_mind', 'memories')
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.startsWith('m_') && name.endsWith('.json')) : []
}

// ── 主流程 ───────────────────────────────────────────────────────────────
let passed = false
let report
try {
  // 1. 建 headless profile
  const init = run('01-init-profile', ['--profile', PROFILE, '--from-default-profile', 'headless', '--dump-config'])
  if (init.status !== 0) throw new Error(`建 profile 失败(exit ${init.status}):${init.stderr.slice(-2000)}`)
  record('profile-init', existsSync(join(home, 'profiles', PROFILE, 'package.json')), join(home, 'profiles', PROFILE))

  // 2. 装 mock-LLM bundle 与插件
  const addMock = run('02-add-mock-bundle', ['plugin', '--profile', PROFILE, 'add', MOCK_BUNDLE_DIR])
  if (addMock.status !== 0) throw new Error(`装 mock bundle 失败:${addMock.stderr.slice(-3000)}`)
  record('install-mock-bundle', addMock.stdout.includes('neural-mind-test-mock-llm'), addMock.stdout.trim().split('\n').slice(-2).join(' | '))
  const addPlugin = run('03-add-plugin', ['plugin', '--profile', PROFILE, 'add', pluginPath])
  if (addPlugin.status !== 0) throw new Error(`装插件失败:${addPlugin.stderr.slice(-3000)}`)
  record('install-plugin', addPlugin.stdout.includes('neural-mind'), addPlugin.stdout.trim().split('\n').slice(-2).join(' | '))

  // 3. profile patch:默认模型指向 mock;普通 E2E 关提炼/SOUL 保持确定性;
  //    --default-smoke 则开启二者,并把批次降到 1(报告里标注非默认批次)。
  const pluginConfig = defaultSmoke
    ? '    extractEnabled: true\n    extractBatchTurns: 1\n    extractIdleMinutes: 1\n    soulEnabled: true\n'
    : '    extractEnabled: false\n    soulEnabled: false\n'
  writeFileSync(join(home, 'profiles', PROFILE, 'cordis.patch.yml'), `# E2E profile layer: local mock LLM route + deterministic plugin config.
- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: mock
    model: mock-1

- id: neural-mind
  name: neural-mind
  config:
${pluginConfig}
- id: session-title-llm
  disabled: true
`, 'utf8')
  record('profile-patch-written', true, join(home, 'profiles', PROFILE, 'cordis.patch.yml'))

  const dump = run('04-dump-config', ['--profile', PROFILE, '--dump-config'])
  if (dump.status !== 0) throw new Error(`dump-config 失败:${dump.stderr.slice(-3000)}`)
  record('compose-mock-row', dump.stdout.includes('- id: mock-llm') && dump.stdout.includes('neural-mind-test-mock-llm'))
  record('compose-agent-default-model', /- id: agent-default-model[\s\S]{0,120}provider: mock/.test(dump.stdout))
  record('compose-memory-config', defaultSmoke
    ? /- id: neural-mind[\s\S]{0,200}extractEnabled: true/.test(dump.stdout)
    : /- id: neural-mind[\s\S]{0,160}extractEnabled: false/.test(dump.stdout))

  // 4. run1:mock 发一个 memory_remember 工具调用 → 插件在轮内同步落盘
  const run1 = run('05-run1', ['--profile', PROFILE, '--json', RUN1_TASK], { logFile: mockLog })
  const run1Session = firstJsonLine(run1.stdout)
  record('run1-exit-0', run1.status === 0, `exit=${run1.status}${run1.stderr.trim() === '' ? '' : ` stderr=${run1.stderr.slice(-400)}`}`)
  record('run1-session-line', run1Session?.type === 'session' && typeof run1Session.sessionId === 'string', run1Session?.sessionId)
  if (run1Session?.sessionId === undefined) throw new Error('run1 没有输出 session id')
  record('run1-turn-completed', run1.stdout.includes('"phase":"turn_end"') && run1.stdout.includes('"kind":"completed"'))

  // 5. run2:插件 pre-step 召回 run1 的记忆并注入
  const run2 = run('06-run2', ['--profile', PROFILE, '--json', RUN2_TASK], { logFile: mockLog })
  const run2Session = firstJsonLine(run2.stdout)
  record('run2-exit-0', run2.status === 0, `exit=${run2.status}${run2.stderr.trim() === '' ? '' : ` stderr=${run2.stderr.slice(-400)}`}`)
  record('run2-session-line', run2Session?.type === 'session' && typeof run2Session.sessionId === 'string', run2Session?.sessionId)
  if (run2Session?.sessionId === undefined) throw new Error('run2 没有输出 session id')

  // 6. 解码两份 Session V4 日志并断言
  const log1 = decompressSessionLog(findSessionLog(run1Session.sessionId))
  const log2 = decompressSessionLog(findSessionLog(run2Session.sessionId))
  console.log(`run1 日志:rows=${log1.rows.length} frames=${log1.frames} bytes=${log1.bytes}`)
  console.log(`run2 日志:rows=${log2.rows.length} frames=${log2.frames} bytes=${log2.bytes}`)
  const headers = log2.rows.filter((row) => row.type === 'session')
  record('session-format-v4', headers.length === 1 && headers[0].version === 4, `version=${headers[0]?.version}`)
  const turnEnds = log2.rows.filter((row) => row.type === 'turn/end').map((row) => row.data?.reason?.kind)
  record('run2-turn-end-completed', turnEnds.includes('completed'), JSON.stringify(turnEnds))
  const toolResults = log1.rows.filter((row) => row.type === 'tool/result')
  record('run1-memory-tool-executed', toolResults.some((row) => row.data?.message?.toolCallId === 'mock-call-memory-remember-1'), `tool/result count=${toolResults.length}`)
  record('memory-record-persisted', memoryRecordFiles().length > 0, memoryRecordFiles().join(', '))

  const injected = log2.rows.filter((row) => row.type === 'user/message' && row.data?.source?.kind === 'plugin:neural-mind')
  const injectedText = injected.map((row) => (Array.isArray(row.data?.content)
    ? row.data.content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n')
    : '')).join('\n')
  record('run2-injected-plugin-message', injected.length > 0, `count=${injected.length}`)
  record('run2-injected-memory-content', injectedText.includes('BLUE-FALCON-42'), JSON.stringify(injectedText.slice(0, 160)))
  record('session-log-wrote', log1.bytes > 0 && log2.bytes > 0, `run1+run2 rows=${log1.rows.length + log2.rows.length}`)

  // 7. mock 侧证据:run2 的模型请求确实带上了注入消息
  const mockRows = readFileSync(mockLog, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
  const groups = []
  for (const row of mockRows) {
    if (row.event === 'adapter-registered') groups.push({ registered: row, requests: [] })
    else if (row.event === 'request' && groups.length > 0) groups[groups.length - 1].requests.push(row)
  }
  record('mock-registered-each-run', groups.length === 2, `runs=${groups.length}`)
  if (defaultSmoke) {
    const soulSeen = mockRows.some((row) => [row.systemPreview, row.systemMessagePreview]
      .some((text) => typeof text === 'string' && text.includes('E2E-SOUL-PERSONA')))
    const extractSeen = mockRows.some((row) => row.reason === 'extract')
    // headless one-shot 可能在后台提炼完成前退出;SOUL 段是装配期事实,可确定性断言。
    record('soul-section-injected', soulSeen, 'SOUL 段进入 system 消息')
    console.log(`ⓘ default-smoke(一次性任务): extract request=${extractSeen}; 后台提炼的长驻验收见 N1/release-matrix`)
    record('default-smoke-batch-override', true, 'extractBatchTurns=1（非默认批次，已标注）')
  }
  const run1Mock = groups[0]?.requests ?? []
  const run2Mock = groups[1]?.requests ?? []
  record('mock-run1-tool-call-then-text', run1Mock.map((row) => row.decision).join(',') === 'tool-call,text', run1Mock.map((row) => `${row.decision}:${row.reason}`).join(','))
  record('mock-run2-request-saw-injection', run2Mock.length === 1 && run2Mock[0].injectedMemorySeen === true, JSON.stringify(run2Mock.map((row) => ({ decision: row.decision, injectedMemorySeen: row.injectedMemorySeen, messageCount: row.messageCount }))))

  // 8. 全程不得出现 SessionFormatError / 关键插件启动失败
  const combined = [run1.stderr, run2.stderr, run1.stdout, run2.stdout].join('\n')
  record('no-session-format-errors', !/SessionFormatError|producer-owned source kind|format v4 message requires/.test(combined))
  const pluginStderrLines = combined.split('\n').filter((line) => line.includes('[memory]'))
  record('plugin-stderr-empty', pluginStderrLines.length === 0, pluginStderrLines.slice(0, 3).join(' | '))

  const failed = assertions.filter((item) => item.ok !== true)
  report = {
    generatedAt: new Date().toISOString(),
    host: identity,
    dshHome: home,
    workspace,
    mockBundle: MOCK_BUNDLE_DIR,
    plugin: pluginPath,
    defaultSmoke,
    runs: {
      run1: { task: RUN1_TASK, sessionId: run1Session.sessionId, exit: run1.status, rows: log1.rows.length, bytes: log1.bytes },
      run2: { task: RUN2_TASK, sessionId: run2Session.sessionId, exit: run2.status, rows: log2.rows.length, bytes: log2.bytes, injectedMessages: injected.length },
    },
    mockCalls: groups.map((group) => group.requests.map((row) => ({ decision: row.decision, reason: row.reason, injectedMemorySeen: row.injectedMemorySeen, messageCount: row.messageCount }))),
    commands,
    assertions,
  }
  writeFileSync(join(home, 'e2e-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  if (reportPath !== undefined) writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`\n${assertions.length - failed.length}/${assertions.length} 项断言通过`)
  if (failed.length > 0) throw new Error(`失败断言:${failed.map((item) => item.name).join(', ')}`)
  passed = true
} catch (error) {
  console.error(`E2E FAILED: ${error?.message ?? error}`)
}

// ── 收尾:成功且未 --keep 时删除临时 home;失败一律保留供排查 ──────────────
const reportFile = join(home, 'e2e-report.json')
if (passed && !keep) {
  rmSync(home, { recursive: true, force: true })
  console.log('E2E PASS(临时 DSH_HOME 已清理;--keep 可保留)')
  process.exit(0)
}
console.log(`E2E ${passed ? 'PASS' : 'FAIL'} — home 保留:${home}`)
if (existsSync(reportFile)) console.log(`报告:${reportFile}${reportPath === undefined ? '' : ` / ${resolve(reportPath)}`}`)
process.exit(passed ? 0 : 2)
