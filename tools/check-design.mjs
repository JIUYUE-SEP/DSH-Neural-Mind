#!/usr/bin/env node
/**
 * 设计文档门禁(2026-11-09,S7)
 *
 * P0(默认,挂进 npm test):
 *   docs/design/*.md 的 front-matter 合法性与语义、§ 编号唯一、文件前缀=§ 号、
 *   废弃链双向一致、code 路径存在且归属唯一、DESIGN.md 设计树索引 ↔ 文件双向一致。
 *
 * P1(--history,挂进 verify:release 的 --strict):
 *   代码 ↔ 设计「同提交纪律」:某提交改了设计文档 code: 声明的文件,却没在同提交改那份文档 = 漂移。
 *   - 豁免:提交信息里有独占一行 `Design: none`(可审计的显式跳过)
 *   - 基线:默认读 `docs/design/.baseline`(P1 从哪条提交起生效),没有则用最近 tag;可用 --since <rev> 覆盖
 *     (`.baseline` 写 `ROOT` = 从仓库根提交起算;历史被压缩成单提交时没有祖先 SHA 可指,用这个哨兵)
 *   - 不加 --strict 时漂移只告警,不改变退出码
 *
 * 用法:
 *   npm run check:design
 *   npm run check:design -- --history
 *   npm run check:design -- --history --strict --since v0.6.5
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const designDir = join(root, 'docs', 'design')
const indexPath = join(root, 'DESIGN.md')

const STATUSES = new Set(['草稿', '现行', '已修订', '已废弃'])
const args = process.argv.slice(2)
const wantHistory = args.includes('--history')
const strict = args.includes('--strict')
const sinceIdx = args.indexOf('--since')
const sinceArg = sinceIdx >= 0 ? args[sinceIdx + 1] : null

const problems = []
const p1Problems = []
const drift = []
const notes = []
const fail = (msg) => problems.push(msg)
const p1Fail = (msg) => {
  p1Problems.push(msg)
  console.error(`[P1] ${msg}`)
}

/**
 * 沙箱兼容的 git 输出捕获:DSH 的 workspace-write 沙箱禁止"管道 stdio"(spawn EPERM),
 * 但允许把子进程 stdout 重定向到已打开的 fd,所以这里经临时文件取输出。
 * 正常环境与沙箱里都能用;P1 只在发布门禁与手工检查时跑,这点开销可忽略。
 */
function gitCapture(argv) {
  const tmp = join(tmpdir(), `check-design-${process.pid}-${Date.now()}.out`)
  const fd = fs.openSync(tmp, 'w')
  try {
    execFileSync('git', argv, { cwd: root, stdio: ['ignore', fd, 'inherit'] })
  } finally {
    fs.closeSync(fd)
  }
  try {
    return fs.readFileSync(tmp, 'utf8')
  } finally {
    fs.unlinkSync(tmp)
  }
}

// ── front-matter 解析(够用即可:标量 / null / 行内数组)────────────────────
function unquote(s) {
  return s.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
}
function parseScalar(raw) {
  const v = raw.trim()
  if (v === '') return ''
  if (v === 'null' || v === '~') return null
  if (v === '[]') return []
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map(unquote)
  }
  return unquote(v)
}
function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  if (m === null) return null
  const fm = {}
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)
    if (mm === null) continue
    fm[mm[1]] = parseScalar(mm[2])
  }
  return fm
}
const toNumList = (v) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n)) : [])
const toNumOrNull = (v) => {
  if (v === null || v === undefined || v === 'null' || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}

// ── P0-1 设计文档清单 ────────────────────────────────────────────────────
let files = []
try {
  files = fs.readdirSync(designDir).filter((f) => f.endsWith('.md')).sort()
} catch {
  console.error('check-design: 读不到 docs/design/(设计文档目录不存在)')
  process.exit(2)
}
if (files.length === 0) {
  console.error('check-design: docs/design/ 下没有 .md(解析为空,按错误处理,避免假绿)')
  process.exit(2)
}

const docs = new Map() // id → doc
const docFiles = new Set()
for (const file of files) {
  const path = `docs/design/${file}`
  let fm = null
  try {
    fm = parseFrontMatter(fs.readFileSync(join(designDir, file), 'utf8'))
  } catch (e) {
    fail(`${path}: 读取失败 ${e.message}`)
    continue
  }
  if (fm === null) {
    fail(`${path}: 缺 front-matter(文件必须以 --- 包围的头部开头)`)
    continue
  }
  const missing = ['id', 'title', 'status', 'since', 'verified', 'code'].filter((k) => fm[k] === undefined)
  if (missing.length > 0) fail(`${path}: front-matter 缺字段 ${missing.join(' / ')}`)
  const doc = {
    file,
    path,
    id: Number(fm.id),
    title: typeof fm.title === 'string' ? fm.title.trim() : '',
    status: fm.status,
    since: fm.since,
    verified: fm.verified,
    code: Array.isArray(fm.code) ? fm.code.map(String) : [],
    supersedes: toNumList(fm.supersedes),
    supersededBy: toNumOrNull(fm.superseded_by),
  }
  if (!Number.isInteger(doc.id) || doc.id < 0) fail(`${path}: id 必须是整数`)
  if (doc.title === '') fail(`${path}: title 不能为空`)
  if (!STATUSES.has(doc.status)) fail(`${path}: status="${doc.status}" 不在 ${[...STATUSES].join(' / ')}`)
  if (typeof doc.since !== 'string' || !/^\d+\.\d+\.\d+/.test(doc.since)) fail(`${path}: since 不是版本号形式`)
  if (typeof doc.verified !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.verified)) fail(`${path}: verified 必须是 YYYY-MM-DD`)
  if (doc.code.length === 0) fail(`${path}: code 不能为空(至少一个代码路径,供 P1 漂移检查)`)
  if (doc.supersedes.length === 0 && fm.supersedes !== undefined && !Array.isArray(fm.supersedes)) {
    fail(`${path}: supersedes 必须是数组`)
  }
  if (fm.superseded_by !== undefined && fm.superseded_by !== null && doc.supersededBy === null) {
    fail(`${path}: superseded_by 必须是文档 id 或 null`)
  }
  const prefix = /^(\d{2})-/.exec(file)
  if (prefix === null) fail(`${path}: 文件名必须以两位 § 号开头,如 "05-search.md"`)
  else if (Number(prefix[1]) !== doc.id) fail(`${path}: 文件前缀 ${prefix[1]} ≠ id ${doc.id}`)
  if (docs.has(doc.id)) {
    fail(`§${doc.id} 重复:${docs.get(doc.id).path} 与 ${path}`)
    continue
  }
  if (docFiles.has(file)) fail(`${path}: 重复登记`)
  docFiles.add(file)
  docs.set(doc.id, doc)
}

// ── P0-2 语义与废弃链 ────────────────────────────────────────────────────
for (const doc of docs.values()) {
  const retired = doc.status === '已废弃'
  if (retired && doc.supersededBy === null) fail(`${doc.path}: status=已废弃 但 superseded_by 为空`)
  if (!retired && doc.supersededBy !== null) fail(`${doc.path}: status=${doc.status} 却填了 superseded_by=${doc.supersededBy}`)
  if (doc.supersededBy !== null) {
    const target = docs.get(doc.supersededBy)
    if (target === undefined) fail(`${doc.path}: superseded_by 指向不存在的 §${doc.supersededBy}`)
    else if (!target.supersedes.includes(doc.id)) fail(`${target.path}: supersedes 未包含 §${doc.id}(废弃链必须双向)`)
  }
  for (const s of doc.supersedes) {
    const old = docs.get(s)
    if (old === undefined) fail(`${doc.path}: supersedes 指向不存在的 §${s}`)
    else if (old.supersededBy !== doc.id) fail(`${old.path}: superseded_by 未指向 §${doc.id}(废弃链必须双向)`)
  }
}

// ── P0-3 code 路径存在 + 归属唯一 ────────────────────────────────────────
const owner = new Map() // 代码路径 → 设计文档相对路径
for (const doc of docs.values()) {
  for (const p of doc.code) {
    if (!fs.existsSync(join(root, p))) {
      fail(`${doc.path}: code 路径不存在 ${p}`)
      continue
    }
    if (owner.has(p)) fail(`code 路径 ${p} 被多份文档声称:${owner.get(p)} 与 ${doc.path}`)
    else owner.set(p, doc.path)
  }
}

// ── P0-4 DESIGN.md 设计树索引 双向一致 ───────────────────────────────────
const rows = []
let designText = ''
try {
  designText = fs.readFileSync(indexPath, 'utf8')
} catch {
  fail('DESIGN.md 读取失败')
}
const headingAt = designText.indexOf('## 设计树索引')
if (headingAt < 0) {
  fail('DESIGN.md 里找不到「## 设计树索引」')
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
    if (cells.length < 4) continue
    if (cells[1] === '主题' || /^-+$/.test(cells[0])) continue
    const ids = [...cells[0].matchAll(/§(\d+)/g)].map((m) => Number(m[1]))
    if (ids.length === 0) {
      fail(`设计树索引行无法解析 § 号:${l}`)
      continue
    }
    const link = /\]\(([^)]+)\)/.exec(cells[3] ?? '')
    rows.push({ ids, status: cells[2], file: link === null ? null : link[1] })
  }
  if (rows.length === 0) fail('设计树索引表为空或无法解析(标题下级应以 | 开头的表)')
}

const seenIds = new Map()
for (const row of rows) {
  for (const id of row.ids) {
    if (seenIds.has(id)) fail(`§${id} 在设计树索引里出现两次`)
    else seenIds.set(id, row)
  }
  if (row.status === '本文') continue
  if (row.file === null) {
    fail(`设计树索引 §${row.ids.join('+')} 缺文件链接`)
    continue
  }
  if (!fs.existsSync(join(root, row.file))) {
    fail(`设计树索引 §${row.ids.join('+')} 指向不存在的文件:${row.file}`)
    continue
  }
  if (!row.file.startsWith('docs/design/')) continue // 归档行指向 legacy,状态以横幅为准
  const doc = docs.get(row.ids[0])
  if (doc === undefined) {
    fail(`设计树索引 §${row.ids[0]} 指向 ${row.file},但该文件未登记为设计文档`)
    continue
  }
  if (basename(row.file) !== doc.file) fail(`设计树索引 §${row.ids[0]} 链接 ${row.file} 与文档实际文件 ${doc.path} 不一致`)
  if (row.status !== doc.status) fail(`设计树索引 §${row.ids[0]} 状态「${row.status}」≠ 文档 front-matter「${doc.status}」`)
}
for (const doc of docs.values()) {
  if (!seenIds.has(doc.id)) fail(`${doc.path}: §${doc.id} 未出现在 DESIGN.md 设计树索引`)
}
// 索引里的 § 号必须连续(0..N),防止拆/并文档时漏号
const idList = [...seenIds.keys()].sort((a, b) => a - b)
const maxId = idList.length > 0 ? idList[idList.length - 1] : -1
for (let i = 0; i <= maxId; i++) {
  if (!seenIds.has(i)) fail(`设计树索引缺 §${i}(编号必须连续;§6+§7 合并行需显式写出两个号)`)
}

// ── P0 结果 ─────────────────────────────────────────────────────────────
const unmapped = fs.readdirSync(join(root, 'lib')).filter((f) => f.endsWith('.js') && !owner.has(`lib/${f}`)).length
if (problems.length > 0) {
  console.error(`[P0] 设计文档检查不通过(${problems.length} 项):`)
  for (const p of problems) console.error(`  - ${p}`)
} else {
  console.log(`[P0] 设计文档 ${docs.size} 份 · 索引 ${rows.length} 行 · 代码归属 ${owner.size} 条:全部通过 ✓`)
  console.log(`     代码覆盖:lib/ 顶层的 ${owner.size} 个文件有 owner;另有 ${unmapped} 个未映射(不参与 P1)`)
}

// ── P1 代码 ↔ 设计 同提交纪律 ────────────────────────────────────────────
if (wantHistory) {
  const git = (a) => gitCapture(a).trim()
  let since = sinceArg
  if (since === null) {
    try {
      since = fs.readFileSync(join(designDir, '.baseline'), 'utf8')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s !== '' && !s.startsWith('#'))[0] ?? null
    } catch {
      since = null
    }
  }
  if (since === null) {
    try {
      since = git(['describe', '--tags', '--abbrev=0'])
    } catch {
      p1Fail('拿不到 docs/design/.baseline 也拿不到最近 tag;请显式传 --since <rev>')
    }
  }
  // `.baseline` 写 `ROOT`:从仓库根提交起算。历史被压缩成单提交后没有祖先 SHA 可写,
  // 而根提交自身又无法在文件里引用自己的 SHA——哨兵解析成根提交,当前 HEAD 即根时
  // 区间为空(0 漂移),之后每个提交照常按同提交纪律检查。
  if (since === 'ROOT') {
    try {
      since = git(['rev-list', '--max-parents=0', 'HEAD']).split(/\r?\n/).filter(Boolean)[0] ?? null
    } catch {
      p1Fail('无法解析基线 ROOT(git rev-list --max-parents=0 HEAD 失败)')
    }
  }
  if (since !== null && since !== '') {
    let commits = []
    try {
      git(['rev-parse', '--verify', since])
      commits = git(['rev-list', '--reverse', `${since}..HEAD`]).split(/\r?\n/).filter(Boolean)
    } catch {
      p1Fail(`无法解析基线 ${since}(git rev-parse/rev-list 失败)`)
    }
    let skipped = 0
    for (const sha of commits) {
      const msg = gitCapture(['show', '-s', '--format=%B', sha])
      if (/^Design:\s*none\s*$/m.test(msg)) {
        skipped++
        continue
      }
      const changed = gitCapture(['show', '--name-only', '--no-renames', '--format=', sha])
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      const owners = new Set()
      for (const f of changed) {
        const o = owner.get(f)
        if (o !== undefined) owners.add(o)
      }
      if (owners.size === 0) continue
      const touched = new Set(changed)
      const stale = [...owners].filter((d) => !touched.has(d))
      if (stale.length > 0) {
        drift.push({ sha: sha.slice(0, 7), stale, files: changed.filter((f) => owner.has(f)) })
      }
    }
    if (drift.length === 0) {
      console.log(`[P1] 基线 ${since}..HEAD:${commits.length} 个提交,豁免 ${skipped} 个,漂移 0 ✓`)
    } else {
      console.log(`[P1] 基线 ${since}..HEAD:${commits.length} 个提交,豁免 ${skipped} 个,漂移 ${drift.length} 处:`)
      for (const d of drift) {
        console.log(`  - ${d.sha}:改了 ${d.files.join(', ')} 但没改 ${d.stale.join(', ')}`)
      }
      if (!strict) console.log('  (未加 --strict:仅告警;verify:release 会以严格模式失败)')
    }
  }
}

for (const n of notes) console.log(`[注] ${n}`)

const failed = problems.length > 0 || (strict && (drift.length > 0 || p1Problems.length > 0))
if (p1Problems.length > 0 && !strict) console.log(`[P1] ${p1Problems.length} 项检查错误(未加 --strict:仅告警)`)
process.exit(failed ? 1 : 0)
