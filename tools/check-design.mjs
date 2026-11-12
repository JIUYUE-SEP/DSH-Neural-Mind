#!/usr/bin/env node
/**
 * 设计文档门禁（v0.3：只校验「现行设计」）
 *
 * 目的：让「现行设计合同」和「代码」之间的漂移变成一条会失败的构建。
 * v0.3 起 DESIGN 只存现状：没有 status / since / supersedes 等状态字段；
 * 计划与历史由 docs/legacy 承载（见 check-ops.mjs）。
 *
 * 日常门禁（默认，适合挂进日常测试）：
 *   docs/design/** 的 front-matter（id / title / verified / code）合法性、§ 编号唯一且递增、
 *   文件前缀 = § 号、code 路径存在且必须是文件、归属唯一、
 *   DESIGN.md 设计树索引（4 列：§ / 主题 / 文件 / 代码入口）↔ 文件双向一致。
 *   § 编号规则由配置 design.sectionIdRule 决定：increasing（默认，递增、允许空号 =
 *   机制已退役）、continuous（不允许空号）、none（不查顺序）；空号不复用。
 *
 * 提交门禁（--history，适合挂进发布/合并门禁，配 --strict 时漂移才失败）：
 *   代码 ↔ 设计「同提交纪律」：某提交改了设计文档 code: 声明的文件，却没在同提交改那份文档 = 漂移。
 *   批量读取：2 次 git log 拿全部提交，开销与提交数基本无关。
 *   - 豁免：提交信息里有独占一行 `Design: none`（可审计的显式跳过）
 *   - 基线：--since <rev> 优先，其次读配置的 baselineFile（写 ROOT = 从仓库根提交起算），最后退化为最近 tag
 *   - 不加 --strict 时漂移只告警；但「检查本身出错」（不是 git 仓库 / 浅克隆 / 基线解析失败）
 *     无论 strict 都失败，避免环境坏了却显示绿色。
 *
 * 用法：
 *   node tools/check-design.mjs
 *   node tools/check-design.mjs --history
 *   node tools/check-design.mjs --history --strict --since v1.0.0
 *   node tools/check-design.mjs --config path/to/doc-system.config.json
 *
 * 依赖：Node 18+、git（日常门禁不需要 git）。配置格式见 doc-system.config.json。
 * 索引表必须是 `| § | 主题 | 文件 | 代码入口 |` 四列；§0 行表示 DESIGN.md 本文。
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, relative, basename } from 'node:path'
import { tmpdir } from 'node:os'

const DEFAULTS = {
  designDir: 'docs/design',
  indexFile: 'DESIGN.md',
  indexHeading: '## 设计树索引',
  baselineFile: 'docs/design/.baseline',
  requireCode: true,
  codeRoots: [],
  sectionIdRule: 'increasing', // increasing（默认，允许空号）| continuous（不允许空号）| none
}
const KNOWN_DESIGN_KEYS = new Set([...Object.keys(DEFAULTS), '$comment', 'requireContinuousSectionIds'])

const args = process.argv.slice(2)
const flagValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const wantHistory = args.includes('--history')
const strict = args.includes('--strict')
const sinceArg = flagValue('--since')
const configPath = flagValue('--config') ?? join(process.cwd(), 'doc-system.config.json')

const root = process.cwd()
const problems = []
const historyProblems = []
const drift = []
const fail = (msg) => problems.push(msg)
const commitFail = (msg) => {
  historyProblems.push(msg)
  console.error(`[提交门禁] ${msg}`)
}

// ── 读文件：统一去 BOM（Windows 编辑器常见）───────────────────────────────
const stripBom = (s) => s.replace(/^\uFEFF/, '')
const readText = (absPath) => stripBom(fs.readFileSync(absPath, 'utf8'))

// ── 路径归一化：统一 POSIX、去掉 ./ 与尾斜杠、Windows 折叠大小写 ───────────
const WIN = process.platform === 'win32'
const toPosix = (p) => String(p).split('\\').join('/')
const cleanRel = (p) => toPosix(String(p).trim()).replace(/^\.\//, '').replace(/\/+$/, '')
function normPath(p) {
  const rel = toPosix(relative(root, resolve(root, String(p).trim())))
  const out = rel === '' ? '.' : rel
  return WIN ? out.toLowerCase() : out
}
const isOutsideRoot = (rel) => rel === '..' || rel.startsWith('../') || /^[A-Za-z]:/.test(rel)
const isInsideDir = (relPath, dirRel) => {
  const d = cleanRel(dirRel)
  return d === '' ? true : relPath === d || relPath.startsWith(d + '/')
}

// ── 读配置 ────────────────────────────────────────────────────────────────
let config = {}
try {
  config = JSON.parse(readText(configPath))
} catch (e) {
  console.error(`check-design: 读不到配置 ${configPath}（${e.code ?? e.message}）`)
  console.error('  在项目根目录放一份 doc-system.config.json，或用 --config 指定。')
  process.exit(2)
}
const cfg = { ...DEFAULTS, ...(config.design ?? {}) }
// 旧配置兼容：requireContinuousSectionIds 已改名 sectionIdRule（v0.3.1）
if (config.design?.sectionIdRule === undefined && config.design?.requireContinuousSectionIds !== undefined) {
  cfg.sectionIdRule = config.design.requireContinuousSectionIds === false ? 'none' : 'increasing'
  console.warn('check-design: 配置键 design.requireContinuousSectionIds 已弃用，请改用 design.sectionIdRule（increasing / continuous / none）；本次已按旧值映射。')
}
if (!['increasing', 'continuous', 'none'].includes(cfg.sectionIdRule)) {
  console.warn(`check-design: 未知 design.sectionIdRule=${cfg.sectionIdRule}（按 increasing 处理；可选 increasing / continuous / none）`)
  cfg.sectionIdRule = 'increasing'
}
const designDirRel = cleanRel(cfg.designDir)
const designDir = resolve(root, designDirRel)
const indexPath = resolve(root, cfg.indexFile)

// 未知配置键提示：改了配置却静默无效，比报错更误导
for (const key of Object.keys(config.design ?? {})) {
  if (!KNOWN_DESIGN_KEYS.has(key)) {
    console.warn(`check-design: 未知配置键 design.${key}（会被忽略；已知键：${[...KNOWN_DESIGN_KEYS].join(' / ')}）`)
  }
}
if (config.design?.statuses !== undefined || config.design?.retiredStatus !== undefined) {
  console.warn('check-design: v0.3 起设计文档不再有 status / 废弃链，配置里的 statuses / retiredStatus 已失效，可删除。')
}

// ── git 输出捕获：跨平台/受限沙箱下用临时文件，避免管道 stdio 被禁 ────────────
function gitCapture(argv) {
  const tmp = join(tmpdir(), `check-design-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.out`)
  let fd
  try {
    fd = fs.openSync(tmp, 'w')
    execFileSync('git', argv, { cwd: root, stdio: ['ignore', fd, 'inherit'] })
    return fs.readFileSync(tmp)
  } finally {
    try {
      if (fd !== undefined) fs.closeSync(fd)
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}
const gitText = (argv) => gitCapture(argv).toString('utf8').trim()

// ── front-matter 解析（标量 / null / 行内数组 / 块列表 / 行尾注释 / BOM）──────
const unquote = (s) => s.replace(/^"([\s\S]*)"$/, '$1').replace(/^'([\s\S]*)'$/, '$1').replace(/\\(["'])/g, '$1')
function stripTrailingComment(line) {
  let quote = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote !== null) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      continue
    }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, '')
  }
  return line
}
function parseScalar(raw) {
  const v = raw.trim()
  if (v === '') return ''
  if (v === 'null' || v === '~') return null
  if (v === '[]') return []
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(unquote)
  }
  return unquote(v)
}
function parseFrontMatter(text) {
  const src = stripBom(text)
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(src)
  if (m === null) return null
  const lines = m[1].split(/\r?\n/)
  const fm = {}
  for (let i = 0; i < lines.length; i++) {
    const line = stripTrailingComment(lines[i])
    if (line.trim() === '') continue
    const mm = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)
    if (mm === null) continue
    const key = mm[1]
    const raw = mm[2].trim()
    if (raw === '') {
      // 兼容 YAML 块列表：
      //   code:
      //     - src/a.js
      const items = []
      let j = i + 1
      while (j < lines.length) {
        const l = stripTrailingComment(lines[j])
        if (l.trim() === '') {
          j++
          continue
        }
        const lm = /^\s*-\s+(.*)$/.exec(l)
        if (lm === null) break
        items.push(parseScalar(lm[1]))
        j++
      }
      if (items.length > 0) {
        fm[key] = items
        i = j - 1
        continue
      }
    }
    fm[key] = parseScalar(raw)
  }
  return fm
}
const isValidCalendarDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m === null) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

// ── 日常门禁-1 设计文档清单（递归，支持子目录）──────────────────────────────────
function listDesignFiles(dirAbs, baseRel) {
  const out = []
  const walk = (abs, relBase) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const relChild = relBase === '' ? ent.name : `${relBase}/${ent.name}`
      if (ent.isDirectory()) {
        if (ent.name.startsWith('.')) continue
        walk(join(abs, ent.name), relChild)
      } else if (ent.name.endsWith('.md') && !ent.name.startsWith('.')) {
        out.push(relChild)
      }
    }
  }
  walk(dirAbs, baseRel)
  return out.sort()
}

let fileRels = []
try {
  fileRels = listDesignFiles(designDir, '')
} catch {
  console.error(`check-design: 读不到设计文档目录 ${designDirRel}/`)
  process.exit(2)
}
if (fileRels.length === 0) {
  console.error(`check-design: ${designDirRel}/ 下没有 .md（按错误处理，避免假绿）`)
  process.exit(2)
}

const docs = new Map() // id → doc
for (const fileRel of fileRels) {
  const rel = `${designDirRel}/${fileRel}`
  let fm = null
  try {
    fm = parseFrontMatter(fs.readFileSync(join(designDir, fileRel), 'utf8'))
  } catch (e) {
    fail(`${rel}: 读取失败 ${e.message}`)
    continue
  }
  if (fm === null) {
    fail(`${rel}: 缺 front-matter（文件必须以 --- 包围的头部开头）`)
    continue
  }
  const required = ['id', 'title', 'verified', ...(cfg.requireCode ? ['code'] : [])]
  const missing = required.filter((k) => fm[k] === undefined)
  if (missing.length > 0) fail(`${rel}: front-matter 缺字段 ${missing.join(' / ')}`)
  const codeRaw = fm.code
  const codeList = Array.isArray(codeRaw)
    ? codeRaw.map((s) => String(s).trim()).filter(Boolean)
    : typeof codeRaw === 'string' && codeRaw.trim() !== ''
      ? [codeRaw.trim()]
      : []
  const doc = {
    file: fileRel,
    path: rel,
    id: Number(fm.id),
    title: typeof fm.title === 'string' ? fm.title.trim() : '',
    verified: fm.verified,
    code: codeList,
  }
  if (!Number.isInteger(doc.id) || doc.id < 1) fail(`${rel}: id 必须是 ≥1 的整数（§0 保留给 DESIGN.md 本文）`)
  if (doc.title === '') fail(`${rel}: title 不能为空`)
  if (typeof doc.verified !== 'string' || !isValidCalendarDate(doc.verified)) fail(`${rel}: verified 必须是真实存在的 YYYY-MM-DD 日期`)
  if (cfg.requireCode && doc.code.length === 0) fail(`${rel}: code 不能为空（至少一个代码文件路径，供提交门禁漂移检查）`)
  const prefix = /^(\d+)-/.exec(basename(doc.file))
  if (prefix === null) fail(`${rel}: 文件名必须以 § 号开头，如 "05-search.md"`)
  else if (Number(prefix[1]) !== doc.id) fail(`${rel}: 文件前缀 ${prefix[1]} ≠ id ${doc.id}`)
  for (const legacyKey of ['status', 'since', 'supersedes', 'superseded_by']) {
    if (fm[legacyKey] !== undefined) {
      fail(`${rel}: v0.3 起不再支持 front-matter 字段 ${legacyKey}（设计只存现状；状态/历史由计划与完成登记承载）`)
    }
  }
  if (docs.has(doc.id)) {
    fail(`§${doc.id} 重复：${docs.get(doc.id).path} 与 ${rel}`)
    continue
  }
  docs.set(doc.id, doc)
}

// ── 日常门禁-2 code 路径：必须存在、必须是文件、不越界，归属唯一 ─────────────────
const owner = new Map() // 归一化代码路径 → 设计文档路径
for (const doc of docs.values()) {
  for (const p of doc.code) {
    const norm = normPath(p)
    if (isOutsideRoot(norm)) {
      fail(`${doc.path}: code 路径越出项目根目录 ${p}`)
      continue
    }
    let st = null
    try {
      st = fs.statSync(resolve(root, p))
    } catch {
      st = null
    }
    if (st === null) {
      fail(`${doc.path}: code 路径不存在 ${p}`)
      continue
    }
    if (!st.isFile()) {
      fail(`${doc.path}: code 只能声明文件，不能是目录 ${p}（请逐文件声明；目录不参与提交门禁）`)
      continue
    }
    if (owner.has(norm)) fail(`code 路径 ${p} 被多份文档声称：${owner.get(norm)} 与 ${doc.path}`)
    else owner.set(norm, doc.path)
  }
}

// ── 日常门禁-3 DESIGN.md 设计树索引（4 列）双向一致 ────────────────────────────
let designText = ''
try {
  designText = readText(indexPath)
} catch {
  fail(`${cfg.indexFile} 读取失败`)
}
const rows = []
const headingAt = designText.indexOf(cfg.indexHeading)
if (headingAt < 0) {
  fail(`${cfg.indexFile} 里找不到「${cfg.indexHeading}」`)
} else {
  const lines = designText.slice(headingAt).split(/\r?\n/)
  const table = []
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('|')) {
      table.push(l)
      continue
    }
    if (table.length > 0) break
  }
  for (const l of table) {
    const cells = l.split('|').slice(1, -1).map((s) => s.trim())
    if (cells.length < 3) continue
    const firstCell = cells[0] ?? ''
    const isSeparator = /^-+$/.test(firstCell) || /^-+$/.test(cells[1] ?? '')
    if (isSeparator) continue
    const ids = [...firstCell.matchAll(/§(\d+)/g)].map((m) => Number(m[1]))
    if (ids.length === 0) {
      const head = firstCell.replace(/[*`\s]/g, '')
      if (head === '§' || head.toLowerCase() === 'section' || cells[1] === '主题') continue // 表头
      fail(`设计树索引行无法解析 § 号：${l}`)
      continue
    }
    const link = /\]\(([^)]+)\)/.exec(cells[2] ?? '')
    rows.push({ ids, file: link === null ? null : link[1], codeCell: (cells[3] ?? '').trim(), raw: l })
  }
  if (rows.length === 0) fail(`设计树索引表为空或无法解析（「${cfg.indexHeading}」下级应是 | 开头的表）`)
}

const seenIds = new Map()
for (const row of rows) {
  for (const id of row.ids) {
    if (seenIds.has(id)) fail(`§${id} 在设计树索引里出现两次`)
    else seenIds.set(id, row)
  }
  // §0 行 = DESIGN.md 本文（没有文档文件）
  if (row.ids.length === 1 && row.ids[0] === 0) continue
  if (row.file === null) {
    fail(`设计树索引 §${row.ids.join('+')} 缺文件链接`)
    continue
  }
  if (!fs.existsSync(resolve(root, row.file))) {
    fail(`设计树索引 §${row.ids.join('+')} 指向不存在的文件：${row.file}`)
    continue
  }
  const fileNorm = normPath(row.file)
  if (!isInsideDir(fileNorm, designDirRel)) {
    fail(`设计树索引 §${row.ids.join('+')} 只能指向现行设计目录（${designDirRel}/），不能指向归档或其它目录：${row.file}`)
    continue
  }
  for (const id of row.ids) {
    if (!docs.has(id)) fail(`设计树索引 §${id} 指向 ${row.file}，但没有 §${id} 设计文档（合并行也不能声明不存在的 §）`)
  }
  const doc = docs.get(row.ids[0])
  if (doc === undefined) continue
  if (fileNorm !== normPath(doc.path)) fail(`设计树索引 §${row.ids[0]} 链接 ${row.file} 与文档实际文件 ${doc.path} 不一致`)
  // 「代码入口」列：必须是 front-matter code 的同一份事实（空 / — 表示不检查）
  if (row.ids.length === 1 && row.codeCell !== '' && !/^[—–-]$/.test(row.codeCell)) {
    const backticked = [...row.codeCell.matchAll(/`([^`]+)`/g)].map((m) => m[1])
    const tokens = (backticked.length > 0 ? backticked : row.codeCell.split(/[、,，\s]+/))
      .map((s) => s.replace(/^`|`$/g, '').trim())
      .filter((s) => s !== '' && !/^[—–-]$/.test(s))
    const norm = new Set(tokens.map(normPath))
    const docCodes = new Set(doc.code.map(normPath))
    const missing = [...norm].filter((x) => !docCodes.has(x))
    const extra = [...docCodes].filter((x) => !norm.has(x))
    if (missing.length > 0 || extra.length > 0) {
      fail(`设计树索引 §${doc.id}「代码入口」与 front-matter code 不一致（索引：${tokens.join(', ') || '空'}；文档：${doc.code.join(', ')}）`)
    }
  }
}
for (const doc of docs.values()) {
  if (!seenIds.has(doc.id)) fail(`${doc.path}: §${doc.id} 未出现在 ${cfg.indexFile} 设计树索引`)
}
// § 编号规则（design.sectionIdRule）：
//   increasing（默认）：严格递增、允许空号。机制退役时删文档 + 删索引行，编号留洞且永不复用；
//                        空号本身就是「这个机制已退役」的记录（原因写在 CHANGELOG / 冻结计划里）。
//   continuous：不允许空号（老行为，适合引用极少、要求编号整齐的项目）。
//   none：不检查顺序（不建议）。
if (cfg.sectionIdRule === 'increasing' || cfg.sectionIdRule === 'continuous') {
  let prev = -1
  for (const row of rows) {
    for (const id of row.ids) {
      if (id <= prev) {
        fail(`设计树索引 § 号必须严格递增：§${prev} 之后出现 §${id}（空号允许，但不能乱序/回退）`)
      }
      prev = id
    }
  }
}
if (cfg.sectionIdRule === 'continuous') {
  const idList = [...seenIds.keys()].sort((a, b) => a - b)
  const maxId = idList.length > 0 ? idList[idList.length - 1] : -1
  for (let i = 0; i <= maxId; i++) {
    if (!seenIds.has(i)) fail(`设计树索引缺 §${i}（sectionIdRule=continuous 不允许空号；机制退役请改用 increasing）`)
  }
}

// ── 日常门禁结果 ─────────────────────────────────────────────────────────────
const unmapped = (cfg.codeRoots ?? [])
  .map((dir) => {
    try {
      return fs.readdirSync(resolve(root, dir), { withFileTypes: true })
        .filter((e) => e.isFile() && !owner.has(normPath(`${dir}/${e.name}`))).length
    } catch {
      return 0
    }
  })
  .reduce((a, b) => a + b, 0)
if (problems.length > 0) {
  console.error(`[日常门禁] 设计文档检查不通过（${problems.length} 项）：`)
  for (const p of problems) console.error(`  - ${p}`)
} else {
  console.log(`[日常门禁] 现行设计 ${docs.size} 份 · 索引 ${rows.length} 行 · 代码归属 ${owner.size} 条：全部通过 ✓`)
  if (cfg.codeRoots.length > 0) console.log(`     代码覆盖：${cfg.codeRoots.join(' / ')} 顶层另有 ${unmapped} 个文件未映射（仅提示，不参与门禁）`)
}

// ── 批量历史读取：2 次 git log 拿「每个提交的消息 + 变更文件」──────────────
// 性能：与提交数基本无关（旧实现每个提交要起 2 个 git 进程，1000 提交会到分钟级）。
function readHistory(since) {
  const range = `${since}..HEAD`
  const chunksOf = (buf) => buf.toString('utf8').split('\x02').slice(1)
  const headOf = (chunk) => {
    const nul = chunk.indexOf('\0')
    const sha = (nul < 0 ? chunk : chunk.slice(0, nul)).trim()
    return { sha, rest: nul < 0 ? '' : chunk.slice(nul + 1) }
  }
  const msgLog = gitCapture(['--no-pager', '-c', 'core.quotePath=false', 'log', '--reverse', '--format=%x02%H%x00%B%x00', range])
  const fileLog = gitCapture([
    '--no-pager',
    '-c',
    'core.quotePath=false',
    'log',
    '--reverse',
    '--no-renames',
    '--name-only',
    '-z',
    '--format=%x02%H%x00',
    range,
  ])
  const msgs = []
  for (const chunk of chunksOf(msgLog)) {
    const { sha, rest } = headOf(chunk)
    if (!/^[0-9a-f]{7,40}$/.test(sha)) continue
    msgs.push({ sha, msg: rest.split('\0')[0].replace(/\r/g, '').replace(/\n+$/, '') })
  }
  const filesById = new Map()
  for (const chunk of chunksOf(fileLog)) {
    const { sha, rest } = headOf(chunk)
    if (!/^[0-9a-f]{7,40}$/.test(sha)) continue
    const files = rest
      .split('\0')
      .map((s) => s.replace(/^\r?\n/, ''))
      .filter((s) => s !== '')
    filesById.set(sha, files)
  }
  if (msgs.length !== filesById.size) {
    throw new Error(`提交信息与变更文件数量不一致（${msgs.length} vs ${filesById.size}）`)
  }
  return msgs.map((c) => ({ sha: c.sha, msg: c.msg, files: filesById.get(c.sha) ?? [] }))
}

// ── 提交门禁 代码 ↔ 设计 同提交纪律 ────────────────────────────────────────────
if (wantHistory) {
  const inRepo = (() => {
    try {
      return gitText(['rev-parse', '--is-inside-work-tree']) === 'true'
    } catch {
      return false
    }
  })()
  if (!inRepo) {
    commitFail('当前目录不是 git 仓库，提交门禁（同提交纪律）无法检查；日常门禁不需要 git')
  } else {
    // 浅克隆检测：否则 ROOT 基线会被解析成 HEAD，出现「0 个提交、漂移 0 ✓」假绿
    try {
      if (gitText(['rev-parse', '--is-shallow-repository']) === 'true') {
        commitFail('当前仓库是浅克隆（shallow），历史不完整，提交门禁结论不可信；CI 请用 actions/checkout 的 fetch-depth: 0，或先 git fetch --unshallow')
      }
    } catch {
      /* 老版本 git 没有该命令：忽略 */
    }
    let since = sinceArg
    if (since === null) {
      try {
        since = readText(resolve(root, cfg.baselineFile))
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s !== '' && !s.startsWith('#'))[0] ?? null
      } catch {
        since = null
      }
    }
    if (since === null) {
      try {
        since = gitText(['describe', '--tags', '--abbrev=0'])
      } catch {
        commitFail(`拿不到 ${cfg.baselineFile} 也拿不到最近 tag；请显式传 --since <rev>`)
      }
    }
    // `.baseline` 写 ROOT：从仓库根提交起算（历史被压缩成单提交时没有祖先 SHA 可写）
    if (since === 'ROOT') {
      try {
        since = gitText(['rev-list', '--max-parents=0', 'HEAD']).split(/\r?\n/).filter(Boolean)[0] ?? null
      } catch {
        commitFail('无法解析基线 ROOT（git rev-list --max-parents=0 HEAD 失败）')
      }
    }
    if (since !== null && since !== '') {
      // 批量读取：2 次 git 调用拿全部提交（信息 + 变更文件），开销与提交数基本无关
      let commits = []
      try {
        gitText(['rev-parse', '--verify', since])
        commits = readHistory(since)
      } catch (e) {
        commitFail(`无法解析基线或读取提交历史 ${since}（${e.message}）`)
      }
      let skipped = 0
      for (const c of commits) {
        if (/^Design:\s*none\s*$/m.test(c.msg)) {
          skipped++
          continue
        }
        if (c.files.length === 0) continue
        const changedNorm = c.files.map((f) => normPath(f))
        const owners = new Set()
        for (const f of changedNorm) {
          const o = owner.get(f)
          if (o !== undefined) owners.add(o)
        }
        if (owners.size === 0) continue
        const touched = new Set(changedNorm)
        const stale = [...owners].filter((d) => !touched.has(normPath(d)))
        if (stale.length > 0) drift.push({ sha: c.sha.slice(0, 7), stale, files: c.files.filter((f) => owner.has(normPath(f))) })
      }
      if (drift.length === 0 && historyProblems.length === 0) {
        console.log(`[提交门禁] 基线 ${since}..HEAD：${commits.length} 个提交，豁免 ${skipped} 个，漂移 0 ✓`)
        if (commits.length === 0) {
          // 基线==HEAD 时检查范围为空：不失败（可能是有意重置），但必须显眼提醒，避免当保护伞用
          let headSha = ''
          let baseSha = ''
          try {
            headSha = gitText(['rev-parse', 'HEAD'])
            baseSha = gitText(['rev-parse', '--verify', since])
          } catch {
            /* ignore */
          }
          if (headSha !== '' && baseSha === headSha) {
            console.log(`     ! 注意：基线 ${since} 就是当前 HEAD，检查范围为空——相当于把起点挪到了最新，此前的漂移不会被发现。`)
            console.log(`       如果不是故意的，请把 ${cfg.baselineFile}（或 --since）改回真正的检查起点。`)
          } else {
            console.log('     （基线之后没有新提交；若这是 CI 的浅克隆造成的，请检查 fetch-depth: 0）')
          }
        }
      } else if (drift.length > 0) {
        console.log(`[提交门禁] 基线 ${since}..HEAD：${commits.length} 个提交，豁免 ${skipped} 个，漂移 ${drift.length} 处：`)
        for (const d of drift) console.log(`  - ${d.sha}: 改了 ${d.files.join(', ')} 但没改 ${d.stale.join(', ')}`)
        if (!strict) console.log('  （未加 --strict：漂移仅告警；发布/合并门禁请用 --strict）')
      } else if (historyProblems.length > 0) {
        console.log(`[提交门禁] 基线 ${since}..HEAD：${commits.length} 个提交，漂移 0，但有 ${historyProblems.length} 项检查错误（见上）`)
      }
    }
  }
}

// 检查错误（不是 git 仓库 / 浅克隆 / 基线解析失败）无论 strict 都失败；漂移只由 --strict 决定
const failed = problems.length > 0 || historyProblems.length > 0 || (strict && drift.length > 0)
process.exit(failed ? 1 : 0)
