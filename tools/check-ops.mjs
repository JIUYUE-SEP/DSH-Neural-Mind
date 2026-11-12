#!/usr/bin/env node
/**
 * 操作门禁（check-ops.mjs，文档体系 v0.3）
 *
 * 校验「定稿计划 / 队列 / 完成登记」三处一致。规则：
 *   1. OP 编号全局唯一（计划文件名 + NEXT_STEPS 队列 + completed 完成登记一起查）
 *   2. 队列里的每个 OP 必须具备定稿计划（docs/legacy/ops/OP-xxxx-*.md）
 *   3. 完成登记里的 OP 不能还留在队列里（完成的同一提交要移除）
 *   4. 「当前操作」数量 ≤ ops.maxCurrent（默认 1；多人并行可调大）
 *   5. 计划文件格式：文件名为 OP-xxxx-*.md；front-matter `op` 与文件名一致；正文含「不代表现状」声明
 *   6. 完成登记：OP 存在、日期是真实日期、同一 OP 不重复登记
 *
 * 不做：计划里 § 引用的校验（历史引用允许过期）、取消记录校验（取消只从队列移除即可）。
 *
 * 用法：
 *   node tools/check-ops.mjs
 *   node tools/check-ops.mjs --config path/to/doc-system.config.json
 *
 * 依赖：Node 18+，不需要 git。
 */
import fs from 'node:fs'
import { join, resolve, basename } from 'node:path'

const DEFAULTS = {
  draftDir: 'docs/ops',
  legacyDir: 'docs/legacy/ops',
  queueFile: 'NEXT_STEPS.md',
  completedFile: 'docs/legacy/completed.md',
  maxCurrent: 1,
}
const KNOWN_KEYS = new Set([...Object.keys(DEFAULTS), '$comment'])

const args = process.argv.slice(2)
const flagValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const configPath = flagValue('--config') ?? join(process.cwd(), 'doc-system.config.json')
const root = process.cwd()

const stripBom = (s) => s.replace(/^\uFEFF/, '')
const readText = (absPath) => stripBom(fs.readFileSync(absPath, 'utf8'))

let config = {}
try {
  config = JSON.parse(readText(resolve(root, configPath)))
} catch (e) {
  console.error(`check-ops: 读不到配置 ${configPath}（${e.code ?? e.message}）`)
  process.exit(2)
}
const cfg = { ...DEFAULTS, ...(config.ops ?? {}) }
for (const key of Object.keys(config.ops ?? {})) {
  if (!KNOWN_KEYS.has(key)) {
    console.warn(`check-ops: 未知配置键 ops.${key}（会被忽略；已知键：${[...KNOWN_KEYS].join(' / ')}）`)
  }
}
// 当前操作上限：默认 1（单人/单 AI 串行）；多人并行可调大
const maxCurrentRaw = Number(cfg.maxCurrent)
const maxCurrent = Number.isInteger(maxCurrentRaw) && maxCurrentRaw >= 1 ? maxCurrentRaw : 1
if (!Number.isInteger(maxCurrentRaw) || maxCurrentRaw < 1) {
  console.warn(`check-ops: ops.maxCurrent=${cfg.maxCurrent} 无效（应为 ≥1 的整数），按默认 1 处理。`)
}
const queuePath = resolve(root, cfg.queueFile)
const completedPath = resolve(root, cfg.completedFile)
const legacyDir = resolve(root, cfg.legacyDir)

const problems = []
const fail = (msg) => problems.push(msg)
const isValidDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m === null) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}
const readOrFail = (absPath, label) => {
  try {
    return readText(absPath)
  } catch {
    fail(`读不到 ${label}（${absPath}）`)
    return null
  }
}

// ── 1. 定稿计划（docs/legacy/ops/OP-xxxx-*.md）────────────────────────────
const plans = new Map() // op 编号 → 计划文件相对路径
let planFiles = []
try {
  planFiles = fs.readdirSync(legacyDir).filter((f) => f.endsWith('.md')).sort()
} catch {
  fail(`读不到定稿计划目录 ${cfg.legacyDir}/（应先创建该目录）`)
}
for (const file of planFiles) {
  const rel = `${cfg.legacyDir.replaceAll('\\', '/')}/${file}`
  const m = /^OP-(\d{4})-(.+)\.md$/.exec(file)
  if (m === null) {
    if (file.startsWith('OP-')) fail(`${rel}: 计划文件名必须是 OP-0001-<slug>.md（4 位编号 + 短横线 + 名字）`)
    continue // README 等说明文件不算计划
  }
  const id = Number(m[1])
  let text = ''
  try {
    text = readText(join(legacyDir, file))
  } catch {
    fail(`${rel}: 读取失败`)
    continue
  }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (fm === null) fail(`${rel}: 缺 front-matter（需要 op / title / date）`)
  else {
    const fields = {}
    for (const line of fm[1].split(/\r?\n/)) {
      const mm = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)
      if (mm !== null) fields[mm[1]] = mm[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    }
    if (fields.op === undefined) fail(`${rel}: front-matter 缺字段 op`)
    else if (Number(fields.op) !== id) fail(`${rel}: front-matter op=${fields.op} 与文件名编号 ${id} 不一致`)
    if (fields.title === undefined || fields.title === '') fail(`${rel}: front-matter 缺字段 title`)
    if (fields.date !== undefined && !isValidDate(fields.date)) fail(`${rel}: date 必须是真实存在的 YYYY-MM-DD（当前 "${fields.date}"）`)
  }
  if (!text.includes('不代表现状')) fail(`${rel}: 缺少「不代表现状」声明（计划模板要求固定写这句）`)
  if (plans.has(id)) fail(`OP-${String(id).padStart(4, '0')} 编号重复：${plans.get(id)} 与 ${rel}`)
  else plans.set(id, rel)
}
const planIds = new Set(plans.keys())

// ── 2. NEXT_STEPS：当前操作 / 排队操作 ────────────────────────────────────
function parseSection(text, headingRe, label) {
  const m = headingRe.exec(text)
  if (m === null) {
    fail(`${cfg.queueFile}: 找不到「${label}」小节（格式见模板）`)
    return []
  }
  const rest = text.slice(m.index + m[0].length).split(/\r?\n/)
  const table = []
  let started = false
  for (const line of rest) {
    if (line.startsWith('|')) {
      table.push(line)
      started = true
      continue
    }
    if (started) break
  }
  const ids = []
  for (const line of table) {
    const cells = line.split('|').slice(1, -1).map((s) => s.trim())
    if (cells.length < 2) continue
    if (/^-+$/.test(cells[0] ?? '') || (cells[0] ?? '') === 'OP') continue // 分隔行 / 表头
    const id = /OP-(\d{4})/.exec(line)
    if (id !== null) ids.push(Number(id[1]))
  }
  return ids
}

let currentIds = []
let queuedIds = []
const queueText = readOrFail(queuePath, cfg.queueFile)
if (queueText !== null) {
  currentIds = parseSection(queueText, /^##\s*1\.\s*当前操作/m, '1. 当前操作')
  queuedIds = parseSection(queueText, /^##\s*2\.\s*排队操作/m, '2. 排队操作')

  if (currentIds.length > maxCurrent) {
    fail(
      `${cfg.queueFile}: 「当前操作」最多 ${maxCurrent} 个（配置 ops.maxCurrent=${maxCurrent}；当前 ${currentIds.length} 个：${currentIds.map((n) => `OP-${String(n).padStart(4, '0')}`).join(', ')}）`,
    )
  }
  const seen = new Set()
  for (const id of [...currentIds, ...queuedIds]) {
    if (seen.has(id)) fail(`${cfg.queueFile}: OP-${String(id).padStart(4, '0')} 在队列里出现多次`)
    seen.add(id)
    if (!planIds.has(id)) fail(`${cfg.queueFile}: OP-${String(id).padStart(4, '0')} 在队列里，但 ${cfg.legacyDir}/ 下没有对应计划文件`)
  }
}
const queueIds = new Set([...currentIds, ...queuedIds])

// ── 3. completed：完成登记 ───────────────────────────────────────────────
const completedIds = new Set()
const completedText = readOrFail(completedPath, cfg.completedFile)
if (completedText !== null) {
  const lines = completedText.split(/\r?\n/)
  let inTable = false
  for (const line of lines) {
    if (line.startsWith('|')) {
      if (!inTable) inTable = true
      const cells = line.split('|').slice(1, -1).map((s) => s.trim())
      if (cells.length < 2) continue
      if (/^-+$/.test(cells[0] ?? '') || (cells[0] ?? '') === 'OP') continue
      const m = /^OP-(\d{4})$/.exec(cells[0] ?? '')
      if (m === null) continue
      const id = Number(m[1])
      if (completedIds.has(id)) fail(`${cfg.completedFile}: OP-${String(id).padStart(4, '0')} 重复登记`)
      completedIds.add(id)
      if (!isValidDate(cells[1] ?? '')) fail(`${cfg.completedFile}: OP-${String(id).padStart(4, '0')} 的完成日期不是真实 YYYY-MM-DD（当前 "${cells[1] ?? ''}"）`)
      if (!planIds.has(id)) fail(`${cfg.completedFile}: OP-${String(id).padStart(4, '0')} 已登记完成，但 ${cfg.legacyDir}/ 下没有对应计划文件`)
      if (queueIds.has(id)) fail(`${cfg.completedFile}: OP-${String(id).padStart(4, '0')} 已登记完成，却还留在 ${cfg.queueFile} 队列里（完成时同一提交要移除）`)
    } else if (inTable && line.trim() !== '') {
      inTable = false
    }
  }
}

// ── 结果 ─────────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error(`[ops] 操作门禁不通过（${problems.length} 项）：`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(
  `[ops] 定稿计划 ${plans.size} 份 · 当前操作 ${currentIds.length}/${maxCurrent} · 排队 ${queuedIds.length} · 完成登记 ${completedIds.size}：全部通过 ✓`,
)
