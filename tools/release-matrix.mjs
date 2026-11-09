#!/usr/bin/env node
/**
 * B3 发布门禁:从真实 npm pack 产物安装到隔离 DSH,并跑对话 E2E。
 * - 不读/不写真实 profile;E2E 自己建临时 DSH_HOME。
 * - 普通 E2E 保持 extract/SOUL 关闭;--default-smoke 额外跑一次开启二者的冒烟。
 * - N1:SDK stdio 长驻 profile,默认批次 6,验证后台提炼真的发生。
 * - 打包文件名与内容清单、client bundle 新鲜度由 prepack/npm pack 保证。
 *
 * 用法:node tools/release-matrix.mjs [--keep] [--skip-default-smoke]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)))
const argv = process.argv.slice(2)
const keep = argv.includes('--keep')
const skipDefaultSmoke = argv.includes('--skip-default-smoke')
const nodeBin = process.execPath
const nodeDir = dirname(nodeBin)
const npmBin = process.env.NPM_BIN ?? (process.platform === 'win32' ? join(nodeDir, 'npm.cmd') : join(nodeDir, 'npm'))
const env = { ...process.env, PATH: `${nodeDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` }
const tmp = mkdtempSync(join(tmpdir(), 'dsh-memory-release-'))

const fail = (message) => {
  console.error(`\nRELEASE-MATRIX FAILED: ${message}`)
  console.error(`临时目录保留供排查: ${tmp}`)
  process.exit(1)
}

if (!existsSync(npmBin)) fail(`找不到 npm: ${npmBin};可用 NPM_BIN 指定`)
console.log(`宿主 Node: ${nodeBin}`)
console.log(`临时目录: ${tmp}`)

console.log('\n▶ npm pack')
const npmCli = join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
const pack = existsSync(npmCli)
  ? spawnSync(nodeBin, [npmCli, 'pack', '--json', '--pack-destination', tmp], { cwd: REPO, env, encoding: 'utf8' })
  : spawnSync(npmBin, ['pack', '--json', '--pack-destination', tmp], {
    cwd: REPO,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
if (pack.status !== 0) fail(`npm pack 失败: ${String(pack.stderr ?? '').slice(-1000)}`)
const start = pack.stdout.indexOf('[')
const end = pack.stdout.lastIndexOf(']')
if (start < 0 || end <= start) fail(`npm pack 没有 JSON 输出: ${String(pack.stdout ?? '').slice(-1000)}`)
const packed = JSON.parse(pack.stdout.slice(start, end + 1))
const entry = packed.find((item) => item !== null && typeof item.filename === 'string')
if (entry === undefined) fail(`npm pack 未返回 tarball 名: ${JSON.stringify(packed).slice(0, 500)}`)
const tarballPath = join(tmp, entry.filename)
const files = new Set((entry.files ?? []).map((file) => file.path))
for (const required of ['package.json', 'lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'README.md']) {
  if (!files.has(required)) fail(`打包产物缺文件: ${required}`)
}
console.log(`✓ 打包产物 ${entry.filename} (${files.size} 个文件)`)

const runE2E = (label, extraArgs) => {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(nodeBin, [join(REPO, 'tools/e2e-conversation.mjs'), '--plugin', tarballPath, ...extraArgs], {
    stdio: 'inherit',
    env,
    cwd: REPO,
  })
  if (result.status !== 0) fail(`${label} 失败（退出码 ${String(result.status)}）`)
}

runE2E('对话 E2E（从 tarball 安装）', [])

// B3 升级:固定上一版 → 候选包。候选用本次 npm pack 产物,不是仓库目录。
const previous = process.env.PREVIOUS_TARBALL
  ?? join(REPO, 'bench-results', 'artifacts', 'dsh-plugin-memory-0.5.0-pre-f0ec867.tgz')
if (!existsSync(previous)) fail(`找不到上一版 tarball: ${previous}(可设 PREVIOUS_TARBALL 覆盖)`)
console.log('\n▶ 升级 smoke（上一版 → 候选包）')
const upgrade = spawnSync(
  nodeBin,
  [join(REPO, 'tools/upgrade-smoke.mjs'), '--previous', previous, '--candidate', tarballPath, '--report', join(tmp, 'upgrade-report.json')],
  { stdio: 'inherit', env, cwd: REPO },
)
if (upgrade.status !== 0) fail(`升级 smoke 失败（退出码 ${String(upgrade.status)}）`)

if (!skipDefaultSmoke) runE2E('默认配置冒烟（extract/SOUL 开启，批次=1）', ['--default-smoke'])

// N1:headless 一次性任务看不到后台提炼,改用 SDK stdio 长驻 profile 做确定性验收。
if (!skipDefaultSmoke) {
  console.log('\n▶ 默认提炼长驻验收（N1：SDK stdio，默认批次=6）')
  const n1 = spawnSync(nodeBin, [join(REPO, 'tools/default-extract-smoke.mjs'), '--plugin', tarballPath, '--report', join(tmp, 'n1-report.json')], {
    stdio: 'inherit',
    env,
    cwd: REPO,
  })
  if (n1.status !== 0) fail(`N1 默认提炼长驻验收失败（退出码 ${String(n1.status)}）`)
}

const report = {
  generatedAt: new Date().toISOString(),
  tarball: entry.filename,
  previous,
  files: [...files].sort(),
  node: process.version,
  platform: process.platform,
  upgrade: true,
  defaultSmoke: !skipDefaultSmoke,
  defaultExtract: !skipDefaultSmoke,
}
writeFileSync(join(tmp, 'release-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`\n${JSON.stringify(report, null, 2)}`)
if (!keep) rmSync(tmp, { recursive: true, force: true })
else console.log(`保留临时目录: ${tmp}`)
console.log('\nRELEASE-MATRIX PASS')
