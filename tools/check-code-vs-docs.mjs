#!/usr/bin/env node
/**
 * 代码 ↔ 文档 一致性核对(§9 不做清单、§4.1/§4.4 常量与语义、§5 闸门、§7 降级姿势)。
 *
 * 与 check-config-ledger 的分工:那个对 §10 配置账本(结构化,已挂进 npm test);
 * 这个对**行为性声明**,靠文本证据,所以只做独立命令(`npm run check:conform`),不进 npm test。
 *
 * 为什么单独拿出来:今天的核对里 6 条"不符"全是假警报,而最典型的一类是
 * **代码里"提到禁令"的注释被当成违反**(「禁用 eventAt/snapshotEvents」本身就是合规证据)。
 * 所以这里先把注释剥掉再查,并给每条声明写明它要什么证据。
 *
 * 用法:`node tools/check-code-vs-docs.mjs` — 有不一致即退出码 1。
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Config } from '../lib/config.js'
import { resolveConfig } from '../lib/compat.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(join(root, p), 'utf8')
/** 剥掉块注释与行注释:注释里"提到禁令"是合规证据,不该算违反。 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// 递归收集(D1 拆分后 lib/client/ 也在纪律网内;键是相对 lib/ 的路径,顶层文件名不变)
const files = fs.readdirSync(join(root, 'lib'), { recursive: true }).filter((f) => f.endsWith('.js'))
const code = Object.fromEntries(files.map((f) => [f, stripComments(read('lib/' + f))]))
const raw = Object.fromEntries(files.map((f) => [f, read('lib/' + f)]))
const all = Object.values(code).join('\n')

/**
 * 自检:下面的断言大量按**文件名**取内容(`raw['soul.js']` 之类)。文件被改名/移走时,
 * `code['search.js']` 是 undefined,而 `/intersect/i.test(undefined)` 会把 undefined 转成
 * 字符串 "undefined" 再匹配——**缺失性检查因此必然通过**(实测:把 lib/search.js 移走,
 * 那条照样打印"一致")。所以先钉住"被引用的文件都在",缺一个就直接退出码 2。
 */
const REFERENCED = ['soul.js', 'inject.js', 'search.js', 'sidecar.js', 'api.js', 'util.js', 'config.js', 'extract.js', 'embed.js', 'index.js', 'provenance.js', 'ops.js']
const absent = REFERENCED.filter((f) => raw[f] === undefined)
if (absent.length > 0) {
  process.stderr.write(`检查器自检失败:lib/ 里取不到这些被引用的文件 ${absent.join(', ')}——按文件名做的断言会退化成"必然通过"\n`)
  process.exit(2)
}
// 必须解包 volatile 引用:设置页可编辑字段在 0.2.0 的解析结果里是引用对象而不是值,
// 不解包则 cfg.<字段> 一律读成 "[object Object]",取值类断言全部假红。
const cfg = resolveConfig(Config['~standard'].validate(undefined).value)
const pkg = JSON.parse(read('package.json'))

const rows = []
/**
 * @param strength '强' = 缺失性/取值类(找不到就是没做、取到的就是真值);
 *                 '弱' = 存在性/顺序类(只证明"有那段代码",不证明逻辑正确——正确性归 106 条单测 + e2e)
 */
/**
 * 证据强度自动判定:
 *  - **强**:缺失性检查("代码里不该出现 X",找不到就是没做)与取值类(直接读 schema 的默认值)。
 *  - **弱**:存在性/顺序类——只证明"有那段代码",不证明逻辑正确(正确性归单测与 e2e)。
 */
const strengthOf = (claim) => (/不做|不用|不碰|不写|不引入|不物理删除|已无|默认值/.test(claim) ? '强' : '弱')
/**
 * strength 默认按 claim 关键词自动判,但关键词会判错方向:
 *  - `§4.4 SOUL 序位 410/420` 只能证明"源码里有这两个字面量 + 一行 import"(存在性),
 *    原先因为句里有"序位"被自动标成**强**——自评过高;
 *  - `§4.1 profilePollSeconds 默认 5` 是直接读 schema 取到的真值(取值类),句里写的是
 *    "默认 5"而不是"默认值",被自动标成**弱**——自评过低,读者会以为它不算证据。
 * 所以这里允许逐条显式覆盖,自动判定只兜底。
 */
const check = (claim, evidence, ok, detail = '', strength = null) => rows.push({ claim, evidence, ok, detail, strength: strength ?? strengthOf(claim) })

// ── §9 不做清单(剥注释后查"代码里真的没做")──────────────────────────────
check('§9-4 不碰 system-prompt/assemble waterfall', 'lib/ 里无该事件名', !/system-prompt\/assemble/.test(all))
check('§9-5 不用 ctx.systemPrompt.context()', 'lib/ 里无该调用', !/systemPrompt\.context\(/.test(all))
check('§9-6 不写会话日志', 'lib/ 里无 session.append', !/session\.append\(/.test(all))
check('§9-7 不碰弃用 API', 'eventAt/snapshotEvents/ownEvents 不在可执行代码里', !/\b(eventAt|snapshotEvents|ownEvents)\b/.test(all))
/**
 * 原来看的是 `Object.keys(pkg.dependencies)` 一个映射——把新依赖塞进 **devDependencies**
 * 就不受管(装进 profile 时不会装它,但仓库里从此多了一个安装/审计面,且写测试时容易顺手
 * 变成运行时依赖)。这里两个映射一起核,允许清单显式列明。
 */
const ALLOWED_DEPS = { dependencies: ['@deepseek-ai/schemastery', 'zod'], devDependencies: ['yaml'] }
for (const [field, allow] of Object.entries(ALLOWED_DEPS)) {
  const got = Object.keys(pkg[field] ?? {}).sort()
  check(`§9-2 不引入重依赖(${field})`, `${field} = ${got.join(', ')}`,
    got.join(',') === [...allow].sort().join(','), got.join(','))
}
check('§9-9 记忆不物理删除', 'lib/ 里无 memories.delete', !/memories\.delete\(/.test(all))
check('§9-23 不做路级交集', 'lib/search.js 可执行代码里无交集逻辑', !/intersect/i.test(code['search.js']))

// ── §4.4 SOUL:常量与写盘语义 ─────────────────────────────────────────────
check('§4.4 段名 memory:soul', "soul.js/inject.js 导出常量", /'memory:soul'/.test(raw['soul.js']) || /'memory:soul'/.test(raw['inject.js']))
check('§4.4 SOUL 序位 410 / 画像 420', 'soul.js 定义 410;inject.js 定义 420 且 import 410',
  /SOUL_SECTION_ORDER = 410/.test(raw['soul.js']) && /PROFILE_SECTION_ORDER = 420/.test(raw['inject.js']) && /import \{ SOUL_SECTION_ORDER \}/.test(raw['inject.js']), '', '弱')
check('§4.4 落盘 0600', 'soul.js 经 writeFileAtomic 写入(其实现带 mode 0o600)',
  /await writeFileAtomic\(target, fileText\)/.test(raw['soul.js']) && /mode = 0o600/.test(raw['util.js']))
check('§4.4 先写盘后更新镜像', 'writeFileAtomic 在 mirror.text = 之前',
  raw['soul.js'].indexOf('await writeFileAtomic') < raw['soul.js'].indexOf('mirror.text ='))
check('§4.4 手改探测用内容比对(非 mtime)', '变更检测是 `disk === prevRaw`(逐字);唯一的 mtime 用途是清理 .tmp- 孤儿的年龄判断',
  /if \(disk === prevRaw\) /.test(raw['soul.js'])
  && raw['soul.js'].split('\n').filter((l) => /mtimeMs/.test(l)).every((l) => /ORPHAN_MIN_AGE_MS|tooOld/.test(l)))
check('§4.4 日预算按 agent 当日现算', 'soul.js 有 dailyUsed + author === agent', /author === 'agent'/.test(raw['soul.js']))

// ── §5 闸门与边车 ────────────────────────────────────────────────────────
check('§5 闸门只作用于注入', "必须命中完整表达式 `gate.enabled === true && purpose === 'inject'`",
  /gate\.enabled === true && purpose === 'inject'/.test(code['search.js']))
check('§5 闸门:混合路按两路原始分准入', 'search.js 有 vectorRan 判定', /gateWanted && vectorRan/.test(code['search.js']))
check('§5 闸门:纯 BM25 用 bm25OnlyMin 单路准入(v1.13)', 'search.js 有 else-if 纯 BM25 分支 + 池子大小护栏',
  /else if \(gateWanted\)/.test(code['search.js'])
  && /gate\.bm25OnlyMin/.test(code['search.js'])
  && /bm25OnlyMinPoolSize/.test(code['search.js']))
check('§5 向量维度防呆:端点维度变化记账 + 检索跳过旧维向量(v1.13)',
  'embed.js 记 dim-mismatch 并暴露 noteDegraded;search.js 按 queryDim 跳过不符向量',
  /note\('dim-mismatch'\)/.test(code['embed.js'])
  && /noteDegraded/.test(code['embed.js'])
  && /queryDim/.test(code['search.js'])
  && /dimMismatch \+= 1/.test(code['search.js']))
check('§10 闸门七参数默认值(v1.19 校准 bm25OnlyMin=10)', JSON.stringify(cfg.relevanceGate),
  JSON.stringify(cfg.relevanceGate) === JSON.stringify({
    enabled: true, consensusCos: 0.35, consensusBm25: 2, soloCos: 0.55, soloBm25: 10,
    bm25OnlyMin: 10, bm25OnlyMinPoolSize: 30,
  }))
check('§3.2 长回合整理输入默认值(v1.21 R8a)', 'extractToolOutputMaxChars=8000 / hotBufferTurnMaxChars=32768 / extractMaxInputChars=65536',
  cfg.extractToolOutputMaxChars === 8000 && cfg.hotBufferTurnMaxChars === 32768 && cfg.extractMaxInputChars === 65536,
  `${cfg.extractToolOutputMaxChars}/${cfg.hotBufferTurnMaxChars}/${cfg.extractMaxInputChars}`)
check('§3.1 关掉提炼后的 L0 上限默认值(v1.23 R16)', 'hotBufferUndigestedTtlHours=168(0=关闭) / extractEnabled=true / 死信 TTL=48h',
  cfg.hotBufferUndigestedTtlHours === 168 && cfg.extractEnabled === true && cfg.hotBufferTtlHours === 48,
  `${cfg.hotBufferUndigestedTtlHours}/${cfg.extractEnabled}/${cfg.hotBufferTtlHours}`)
check('§4.2 来源三段判定(v1.24 R13b)', 'schema 有 unknown 来源 + confirmedByUser 可选字段;provenance 有角色/原话判定;tools 有 userQuote;index 有旧记录回填',
  /'unknown'/.test(raw['schema.js'])
  && /confirmedByUser/.test(raw['schema.js'])
  && /userQuoteMatches/.test(raw['provenance.js'])
  && /verifyUserQuote/.test(raw['tools.js'])
  && /sourceRemapVersion/.test(raw['index.js']), '', '强')
check('§10 工作区范围与召回总开关默认值(v1.14)',
  `autoRecall=${cfg.autoRecall} disabledWorkspaces=${JSON.stringify(cfg.disabledWorkspaces)}`,
  cfg.autoRecall === true && Array.isArray(cfg.disabledWorkspaces) && cfg.disabledWorkspaces.length === 0, '', '强')
check('§4.2 openingDigest 默认关(v1.13)', String(cfg.openingDigest), cfg.openingDigest === false, '', '强')
check('§5 边车端口已听则不插手', 'sidecar.js 有 embed-sidecar-external', /embed-sidecar-external/.test(raw['sidecar.js']))
check('§5 边车靠 stdin EOF 收尸', 'watchdog 脚本用 cat 阻塞在 stdin', /cat > \/dev\/null/.test(raw['sidecar.js']))

// ── §4.1 画像单入口 + 轮询 ───────────────────────────────────────────────
check('§4.1 schema 里已无 profileText', 'Config 不暴露该键', !Object.keys(cfg).includes('profileText'))
check('§4.1 profilePollSeconds 默认 5', String(cfg.profilePollSeconds), cfg.profilePollSeconds === 5, '', '强')
check('§4.1 画像段只读内存镜像(装配期零 I/O)', 'inject.js 里 text 是 provider 读 mirror', /text: \(\) => \(mirror\.text/.test(raw['inject.js']))
check('§4.1 写盘走原子替换(tmp + rename)', 'api.js 经 writeFileAtomic;util.js 里 tmp + rename',
  /await writeFileAtomic\(path, content\)/.test(raw['api.js']) && /await renameWithRetry\(tmp, path, retries\)/.test(raw['util.js']))

// ── §7 降级姿势 ─────────────────────────────────────────────────────────
check('§7 必需服务走 ctx.inject', "webServer/tools/systemPrompt/settings 都用 inject 接入",
  ["'webServer'", "'tools'", "'systemPrompt'", "'settings'"].every((n) => all.includes(`inject([${n}]`) || all.includes(`inject([${n},`)))
check('§7 可选服务走 ctx.get', 'credentials/llm/storageDomain 都走 get',
  ['credentials', 'llm', 'storageDomain'].every((n) => new RegExp(`get\\('${n}'\\)`).test(all)))

// ── 静默吞纪律(v1.9 收口)───────────────────────────────────────────────────
// 立这条的起因:32 处 `.catch(() => undefined)` 散在各文件,读代码时分不出"有意吞掉"还是
// "忘了处理"。现在收敛成 util.js 的 bestEffort(有名字、有纪律注释),并用两条机械检查守住。
const swallowFiles = files.filter((f) => f !== 'util.js' && !f.startsWith('client'))
const anonSwallow = swallowFiles.filter((f) => /\.catch\(\(\) => (undefined|\{\})\)/.test(code[f]))
check('静默吞一律走 bestEffort(主机侧无匿名 .catch(() => undefined/{}) )',
  'util.js 是 bestEffort 的实现处(豁免);其它文件出现匿名吞 = 纪律破口',
  anonSwallow.length === 0, anonSwallow.join(', '))

const bareNoReason = []
for (const f of files) {
  const lines = raw[f].split('\n')
  lines.forEach((line, i) => {
    if (!/\bcatch\s*\{/.test(stripComments(line))) return
    if (!lines.slice(i, i + 3).join('\n').includes('//')) bareNoReason.push(`${f}:${i + 1}`)
  })
}
check('裸 catch 就近写清理由(行内或随后两行内有注释)',
  '静默降级必须说明为什么;要留痕的走 fireAndForget(日志)或 audit(审计)',
  bareNoReason.length === 0, bareNoReason.join(', '))

// ── v1.15 记忆控制台(页面重设计)────────────────────────────────────────────
// 注入日志是记忆页"最近注入/为什么没注入"的数据源,纪律是只记元数据:
// 一旦把注入正文或用户查询写进去,页面就从诊断变成会话内容的旁路出口。
// 注:readdirSync({recursive:true}) 在 Windows 上用反斜杠,按文件名取要兼容两种分隔符。
const fileByBase = (base) => Object.entries(code).find(([key]) => key === base || key.endsWith('\\' + base) || key.endsWith('/' + base))?.[1] ?? ''
const injectionLogCode = fileByBase('injectionlog.js')
check('§13 v1.15 注入日志不记注入正文/用户查询原文', 'injectionlog.js 只落白名单元数据(无 content/query 字段)',
  injectionLogCode !== '' && !/\bcontent\s*:/.test(injectionLogCode) && !/\bquery\s*:/.test(injectionLogCode), '', '强')
const shellCode = fileByBase('shell.js')
const tabIds = [...shellCode.matchAll(/\bid: "(overview|memories|recall|config|profile|soul|audit)"/g)].map((m) => m[1])
check('§13 v1.15 记忆页 7 页签 + 懒挂载', 'shell.js 的 TABS 恰为 7 项,面板由 visited 集合门控',
  new Set(tabIds).size === 7 && /visited\.has\(tab\.id\)/.test(shellCode), `tabs=${tabIds.join(',')}`)

// ── R15a 整理过程可见(v1.25)─────────────────────────────────────────────
// 只验"接线确实存在":stats 带 lastExtract/drops、失败写 extract-failed、总览健康检查真的读它。
// 行为正确性(失败原因/限频/丢弃计数)由 test/extract-visibility.test.mjs 守。
check('§3.2 整理过程可见(v1.25 R15a)', 'extract.js 有 lastExtract/drops/extract-failed;api.js stats 透出;总览健康检查读 lastExtract',
  /lastExtract/.test(code['extract.js'])
  && /extract-failed/.test(code['extract.js'])
  && /drops/.test(code['extract.js'])
  && /lastExtract/.test(fileByBase('api.js'))
  && /lastExtract/.test(fileByBase('overview-card.js'))
  && /ovCheckExtractFailed/.test(fileByBase('overview-card.js')), '', '弱')

// ── R1a 记忆管理操作与来源追溯(v1.26)────────────────────────────────────
// 控制台与工具共用 lib/ops.js(同一套状态/级联/审计),详情页真有按钮,"展开来源轮次"真接了接口。
check('§4.3 记忆管理操作与来源追溯(v1.26 R1a)', 'ops.js 有 archive/restore/setSensitive/hardForget/expandOriginal;api.js 有 action 与来源字段;browse-card 有按钮;tools 复用 ops',
  ['archive', 'restore', 'setSensitive', 'hardForget', 'expandOriginal']
    .every((name) => new RegExp(`function ${name}\\(`).test(raw['ops.js'] ?? fileByBase('ops.js')))
  && /case 'archive'/.test(fileByBase('api.js'))
  && /case 'expandSource'/.test(fileByBase('api.js'))
  && /sessionId/.test(fileByBase('api.js'))
  && /data-action": "memory-archive"/.test(fileByBase('browse-card.js'))
  && /data-action": "memory-expand"/.test(fileByBase('browse-card.js'))
  && /ops\.hardForget\(/.test(fileByBase('tools.js')), '', '弱')

// ── README 事实 ─────────────────────────────────────────────────────────
/**
 * 原文这条叫"README 评估工具清单 == tools/ 实际",但它只验了 6 个指定文件名在 tools/ 下存在
 * ——`readme` 那个变量读了 README 却**全文没用过**,所以 README 里少写/多写工具永远不红。
 * 现在做成真的双向对号:tools/ 下每个 .mjs 都要在 README 出现,README 里提到的 tools/*.mjs
 * 也要真存在(拼错的引用同样是文档缺陷)。
 */
const toolsDir = fs.readdirSync(join(root, 'tools'))
const actualTools = toolsDir.filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, ''))
const readme = read('README.md')
const mentioned = [...new Set([...readme.matchAll(/tools\/([a-z0-9-]+)\.mjs/g)].map((m) => m[1]))]
const undocumented = actualTools.filter((t) => !mentioned.includes(t))
const phantom = mentioned.filter((t) => !actualTools.includes(t))
check('README 评估工具清单 == tools/ 实际(双向)',
  `tools/ 实际 ${actualTools.length} 个,README 提到 ${mentioned.length} 个`,
  undocumented.length === 0 && phantom.length === 0,
  [undocumented.length ? `README 漏写: ${undocumented.join(', ')}` : '', phantom.length ? `README 引用了不存在的: ${phantom.join(', ')}` : ''].filter(Boolean).join(' / '))

const bad = rows.filter((r) => !r.ok)
// 自检:这个脚本自己也被一次坏编辑在文件尾留下过死代码(22cc1f5),而语法仍合法、照常输出"零不一致"。
// 所以先验证 rows 形状再下结论——门禁自己也要能被检查。
if (rows.length === 0 || !rows.every((r) => r.strength === '强' || r.strength === '弱')) {
  console.error('检查器自检失败:rows 形状异常(应为非空,且每条都带强/弱标注)')
  process.exit(2)
}
for (const r of rows) console.log(`${r.ok ? '一致' : '**不符**'} [${r.strength}] ${r.claim}   ← ${r.evidence}${r.detail ? '  [' + r.detail + ']' : ''}`)
const strong = rows.filter((r) => r.strength === '强').length
console.log(`\n证据强度:强 ${strong} 条(缺失性/取值类) · 弱 ${rows.length - strong} 条(存在性/顺序类,只证明"有那段代码";行为正确性由 ${fs.readdirSync(join(root, 'test')).filter((f) => f.endsWith('.test.mjs')).length} 个测试文件与 e2e 背书)`)
console.log(`\n共 ${rows.length} 条行为性声明,不一致 ${bad.length} 条`)
process.exit(bad.length === 0 ? 0 : 1)
