#!/usr/bin/env node
/**
 * §10 配置账本机械对账:docs/design/10-config-ledger.md(原 DESIGN.md §10)清单 vs lib/config.js 的 Config schema。
 *
 * 为什么要有这个:§10 自称"schema 全量收录",而"所有参数全部经 §10 暴露、不许硬编码"是仓库级承诺。
 * 肉眼扫会漏项(实测漏过 profileText/profileFile、又漏过 semanticSearch 的 6 个实现期新增项),
 * 所以把对账变成一条命令,而不是一次人工检查。
 *
 * 用法:`npm run check:ledger`(有差异 → 退出码 1,可直接进 CI/pre-commit)
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Config } from '../lib/config.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dict = Config.dict ?? Config['~standard']?.jsonSchema?.properties
if (dict === undefined) {
  console.error('check-config-ledger: 读不到 Config schema(Config.dict 缺失),检查 lib/config.js 导出')
  process.exit(2)
}

const schemaTop = Object.keys(dict)
const schemaSub = Object.fromEntries(
  Object.entries(dict)
    .filter(([, v]) => v?.dict !== undefined || v?.['~standard']?.jsonSchema?.properties !== undefined)
    .map(([k, v]) => [k, Object.keys(v.dict ?? v['~standard'].jsonSchema.properties)]),
)

const ledgerPath = join(root, 'docs', 'design', '10-config-ledger.md')
let doc
try {
  doc = fs.readFileSync(ledgerPath, 'utf8')
} catch {
  console.error('check-config-ledger: 读不到 docs/design/10-config-ledger.md(§10 配置账本已从 DESIGN.md 拆出)')
  process.exit(2)
}
// 围栏正则必须容忍 CRLF:Windows 检出(core.autocrlf)下该文件可能是 CRLF,
// 而 `[a-z]*\n` 在 ```yaml\r\n 上匹配不上 → 账本解析为空、"0 项"、
// 一片"schema 有 §10 缺"的假红(实测踩过)。这里统一按 `\r?\n` 收。
const blocks = [...doc.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/g)].map((m) => m[1])

// 解析账本:顶层键 + 缩进块里的子项(以 `name:` / `name?:` 开头,忽略行尾注释)
const docKeys = new Set()
const docSub = {}
let current = null
for (const raw of blocks.join('\n').split('\n')) {
  const line = raw.replace(/\/\/.*$/, '')
  const m = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*[?:]/.exec(line)
  if (m === null) {
    if (/^\s*\}/.test(line)) current = null
    continue
  }
  const indent = m[1].length
  const key = m[2]
  if (indent <= 2) {
    docKeys.add(key)
    current = null
    // 键名允许以数字结尾(bm25、sha256 之类)——早先这条正则只认字母,漏判过 bm25 块
    if (/[A-Za-z0-9_]\s*:\s*\{/.test(line)) {
      current = key
      docSub[key] = []
    }
  } else if (current !== null) {
    docSub[current].push(key)
  }
}

const problems = []

const missTop = schemaTop.filter((k) => !docKeys.has(k))
const extraTop = [...docKeys].filter((k) => !schemaTop.includes(k))
if (missTop.length > 0) problems.push(`§10 缺顶层项(schema 有): ${missTop.join(', ')}`)
if (extraTop.length > 0) problems.push(`§10 多顶层项(schema 没有): ${extraTop.join(', ')}`)
for (const [key, subs] of Object.entries(schemaSub)) {
  const listed = docSub[key]
  if (listed === undefined) {
    problems.push(`${key} 在 §10 里没有展开块(应列 ${subs.length} 项)`)
    continue
  }
  const miss = subs.filter((s) => !listed.includes(s))
  const extra = listed.filter((s) => !subs.includes(s))
  if (miss.length > 0) problems.push(`${key} 缺子项: ${miss.join(', ')}`)
  if (extra.length > 0) problems.push(`${key} 多子项: ${extra.join(', ')}`)
}

// ── 附加对账(v1.9 补):三类"文档自称"也机械查 ─────────────────────────────
// ① 账本(docs/design/10-config-ledger.md)的「常用层 N 项」声明 ↔ 该句里实际列出的键数,且键必须存在于 schema
// ② README 的「常用层(N 项)」声明 ↔ 其下方表格行数
// ③ README 开发段的「再跑 N 项」 ↔ test/*.test.mjs 里 test(...) 的声明数(node --test 同口径)

/** 取自一句声明里所有反引号包起来的键名(排除带括号的补充说明)。 */
function backtickKeys(sentence) {
  return [...sentence.matchAll(/`([A-Za-z][A-Za-z0-9_.]*)`/g)].map((m) => m[1])
    .filter((key) => !key.includes('.'))
}

const commonClaim = /常用层\s*(\d+)\s*项[^:]*:([^;]*)/.exec(doc)
if (commonClaim === null) {
  problems.push('§10 找不到「常用层 N 项」的声明(文档结构调整后请同步本工具)')
} else {
  const claimed = Number(commonClaim[1])
  const listed = [...new Set(backtickKeys(commonClaim[2]))]
  if (listed.length !== claimed) {
    problems.push(`§10 常用层声明 ${claimed} 项,但同句列出了 ${listed.length} 项: ${listed.join(', ')}`)
  }
  const ghost = listed.filter((key) => !schemaTop.includes(key))
  if (ghost.length > 0) problems.push(`§10 常用层列出的键不在 schema 里(已删或拼错): ${ghost.join(', ')}`)
}

const readme = fs.readFileSync(join(root, 'README.md'), 'utf8')
const readmeClaim = /常用层\((\d+)\s*项/.exec(readme)
if (readmeClaim === null) {
  problems.push('README 找不到「常用层(N 项)」的声明')
} else {
  const claimed = Number(readmeClaim[1])
  const tableStart = readme.indexOf(readmeClaim[0])
  // 起算点 = 表头分隔行 `|---`(此前只有声明句与空行);**不能**用裸 `'\n\n'` 找表尾:
  // Windows 检出下空行是 `\r\n\r\n`,indexOf 找不到 → 返回 -1 → slice(start,-1) 把后文
  // 整篇算进表格,行数虚高(实测:声明 11 项却报 12 行)。表头/分隔行都不以反引号开头,
  // 所以从 `|---` 起算不丢行。
  const separator = readme.indexOf('|---', tableStart)
  const rest = readme.slice(separator < 0 ? tableStart : separator)
  const blank = /\r?\n\r?\n/.exec(rest)
  const table = blank === null ? rest : rest.slice(0, blank.index)
  const rows = (table.match(/^\|\s*`/gm) ?? []).length
  if (rows !== claimed) problems.push(`README 常用层声明 ${claimed} 项,表格却有 ${rows} 行`)
}

const testClaim = /再跑\s*(\d+)\s*项/.exec(readme)
const declared = fs.readdirSync(join(root, 'test'))
  .filter((f) => f.endsWith('.test.mjs'))
  .reduce((sum, f) => sum + (fs.readFileSync(join(root, 'test', f), 'utf8').match(/^test\(/gm) ?? []).length, 0)
if (testClaim === null) {
  problems.push('README 开发段找不到「再跑 N 项」的测试数声明')
} else if (Number(testClaim[1]) !== declared) {
  problems.push(`README 声明测试 ${testClaim[1]} 项,test/ 里实际有 ${declared} 个 test() 声明`)
}

// ── 附加对账(v1.9 收口):「未实现」标注 ↔ 配置键真的有人在消费 ─────────────────
// schema 里有一批"字段先落地、机制后启用"的 V1.1 键。它们本身不算错,但必须一眼看得出来,
// 否则读代码的人会以为拨了开关就有用(实测踩过:ONBOARDING 让用户去调一个没接线的键)。
// 双向纪律:① 标了 [未实现] → lib/ 里必须真的没人消费(接上了就撕掉标注);
//          ② 没人消费 → 必须标 [未实现](不许再出现静默的空开关)。
const stripNonCode = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\\n]|\\.)*'/g, ' ')
  .replace(/"(?:[^"\\\n]|\\.)*"/g, ' ')
  .replace(/`(?:[^`\\]|\\.)*`/g, (m) => (m.match(/\$\{[^}]*\}/g) ?? []).join(' '))

const libCode = fs.readdirSync(join(root, 'lib'))
  .filter((f) => f.endsWith('.js') && f !== 'config.js')
  .map((f) => stripNonCode(fs.readFileSync(join(root, 'lib', f), 'utf8')))
  .join('\n')
/**
 * 消费 = **属性访问形式** `.叶子名` 出现在 lib/ 的非注释、非字面量代码里(光在文案里提一句不算)。
 *
 * 坦白精度上限:嵌套键只能按叶子名查(`semanticSearch.enabled` 查的是 `.enabled`)。
 * 本插件的 config 是整块传进模块再解构消费的(`createEmbedder({ cfg: cfg.semanticSearch })`
 * 之后读 `cfg.enabled`),所以"同文件里要求出现容器名"这种收紧会误报 24 个已接线的键——实测过,
 * 不可行。因此**同名嵌套键之间分辨不了**:`.enabled` 出现一次,`relevanceGate.enabled`、
 * `injectionGuard.enabled`、`semanticSearch.enabled` 三个都会被判"已消费"。
 * 影响面:纪律 ② (零消费却没标) 对**唯一名**可靠(占绝大多数),对撞名的叶子可能漏报;
 * 纪律 ① (标了却已消费) 偏保守(宁可多问一句),不会漏撕标注。
 * 想要真精确得做 AST/数据流分析,那要引依赖,与 §9-2 冲突——记此为准,不当"双向严丝合缝"宣传。
 */
const consumed = (key) => new RegExp(`\\.${key.split('.').pop()}\\b`).test(libCode)
/** `[未实现]` 允许出现在描述的任意位置(`[未实现] 高级:…` 与 `高级:[未实现] …` 都要抓到)。 */
const isMarked = (desc) => desc.includes('[未实现]')

const flatKeys = []
for (const [key, value] of Object.entries(dict)) {
  const sub = value?.dict ?? value?.['~standard']?.jsonSchema?.properties
  // 注意:schemastery 节点上的 `.description` 可能是**方法**(未设描述时),只有 meta 里那个才是文本
  const desc = (v) => {
    const d = v?.meta?.description ?? v?.description
    return typeof d === 'string' ? d : ''
  }
  if (sub === undefined) flatKeys.push([key, desc(value)])
  else for (const [s, sv] of Object.entries(sub)) flatKeys.push([`${key}.${s}`, desc(sv)])
}
const markedKeys = flatKeys.filter(([, d]) => isMarked(d)).map(([k]) => k)
const wiredButMarked = markedKeys.filter((k) => consumed(k))
const silentUnmarked = flatKeys.filter(([k, d]) => !isMarked(d) && !consumed(k)).map(([k]) => k)
if (wiredButMarked.length > 0) {
  problems.push(`标了 [未实现] 但 lib/ 里已有消费(接线后请撕掉标注): ${wiredButMarked.join(', ')}`)
}
if (silentUnmarked.length > 0) {
  problems.push(`lib/ 里零消费的配置键必须标 [未实现](字段已落地、机制未接线): ${silentUnmarked.join(', ')}`)
}

console.log(`顶层:schema ${schemaTop.length} 项 / §10 ${docKeys.size} 项`)
for (const [key, subs] of Object.entries(schemaSub)) {
  console.log(`  ${key}: schema ${subs.length} 项 / §10 ${(docSub[key] ?? []).length} 项`)
}
console.log(`[未实现] 标注: ${markedKeys.length} 项(字段已落地、机制未接线;接线后请撕掉标注)`)
if (problems.length === 0) {
  console.log('§10 全量对账:零差异 ✓')
  process.exit(0)
}
console.error('\n§10 与 schema 不一致:')
for (const p of problems) console.error(`  - ${p}`)
process.exit(1)
