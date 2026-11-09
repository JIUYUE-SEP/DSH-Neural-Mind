/**
 * DSH 接缝对账(§8 v2.0)。
 *
 * 这份检查器守的是**0.2.0 引入的四条静默失败通道**——它们都不报错,只是"功能不见了":
 *
 *  1. **记忆页看不到配置**:0.2.0 的设置服务按 Schemastery 的 `meta.volatile` 决定
 *     哪些字段可编辑;一个 volatile 字段都没有的 entry 直接不进 `settings.describe()`
 *     的镜像。而客户端「记忆 → 配置」页签卡的字段清单在 `lib/client/config-card.js`
 *     的 `GROUPS` 里——两边一旦漂移,用户只会看到"配置不可用"。
 *  2. **volatile 标记越界**:Schemastery 要求 volatile 字段落在固定对象路径上、且不能被
 *     另一个 volatile 字段包住;标错会让**整个 Config 校验抛错** → 插件起不来。
 *  3. **entry id 漂移**:客户端按 entry id 寻址(`ctx.configForms.get(entryId)`),
 *     宿主半的 `SETTINGS_NS` 与 `cordis.patch.yml` 里 insert 的 id 必须是同一个字符串;
 *     **真正寻址那一行**必须用这个常量,写成内联字面量就绕过了对账(⑤)。
 *  4. **可编辑面留洞**:记忆页是本插件唯一确定的编辑面(宿主的自动生成页当前无客户端消费,
 *     且我们已声明 `auto: false` 不依赖它),所以标了 `live()` 却没进记忆页任何一张卡的字段,
 *     就真的没有编辑入口了——③ 管"页面要的字段宿主认不认",⑦ 管反过来"宿主认改的字段页面给不给改"。
 *  5. **客户端 bundle 没被装载**:`package.json` 的 `dsh.client` 由 `dsh-client-modules`
 *     登记成 boot graph 行。整段删掉 → 「记忆」整页不出现;inject 少列服务提供方 →
 *     apply 拿不到 `configForms`/`locale`。⑧ 守这条(评审实测:删掉整段时旧版三道门禁全绿)。
 *  6. **控件类型与宿主 schema 错配**:`GROUPS` 的 `kind` 拼错(如 `toogle`)会落到 else 分支
 *     渲染成文本框,于是把**字符串写进 boolean/number 字段**;select 候选值写错则选中即被
 *     宿主校验拒绝。⑨ 按宿主 schema 的 `type` 反推应有 kind,并把 options 对回 union 的取值集。
 *
 * 六条都是"改了才红"的机械对账,不依赖文档描述。检查器自身的失效也纳入:② 没过时后续项整块
 * 不跑,输出会打 `⚠ 连带没跑 N 项`,不让"通过 N 项"把被沉默的检查数糊过去。
 */
import { readFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import { GROUPS } from '../lib/client/config-card.js'
import { SOUL_FIELDS } from '../lib/client/soul-card.js'
import { isVolatileRef } from '../lib/compat.js'
import { Config, SETTINGS_NS } from '../lib/index.js'

const failures = []
const notes = []
/** 前置检查没过、连带没跑的项目。必须打出来——否则"通过 N 项"会低估被沉默掉的检查数。 */
const skipped = []
const fail = (message) => failures.push(message)
const ok = (message) => notes.push(message)

// ── ① Schemastery 必须支持 volatile ────────────────────────────────────────
if (typeof Config?.volatile !== 'function' && typeof z.any().volatile !== 'function') {
  fail('Schemastery 无 .volatile():记忆页无法投影任何可编辑字段(需要 @deepseek-ai/schemastery >= 3.18.4)')
} else {
  ok('Schemastery 支持 .volatile()')
}

// ── ② Config 能带着 volatile 标记通过校验 ──────────────────────────────────
let resolved = null
try {
  const result = Config['~standard'].validate({})
  if (result.issues) throw new Error(JSON.stringify(result.issues))
  resolved = result.value
  ok('Config 校验通过(volatile 标记未越界)')
} catch (error) {
  fail(`Config 校验失败:volatile 标记可能越界(volatile 字段不能被另一个 volatile 字段包住,也不能落在数组/dict 内部): ${error?.message ?? error}`)
}

// ── ③ 客户端字段清单 ↔ 宿主 Config 的可编辑面必须逐项对齐 ──────────────────
/**
 * 复刻宿主 `dsh-settings` 的判定:`plainSchema` 用 `new z(schema.toJSON())` 重建,
 * 再沿 `dict` 找带 `meta.volatile` 的最近祖先。这里用同一算法,确保"我们以为可编辑"
 * 与"宿主真的认"是同一个答案。
 */
function hostVolatileForm(schema) {
  if (schema.meta?.volatile) return schema
  if (schema.type === 'object') {
    const dict = Object.fromEntries(Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
      const field = hostVolatileForm(child)
      return field === undefined ? [] : [[key, field]]
    }))
    return Object.keys(dict).length === 0 ? undefined : z.object(dict)
  }
  return undefined
}

function isVolatilePath(schema, path) {
  if (schema.meta?.volatile) return true
  const [key, ...rest] = path
  const child = key === undefined ? undefined : schema.dict?.[key]
  return child !== undefined && isVolatilePath(child, rest)
}

const clientPaths = GROUPS.flatMap((group) => group.fields.map((field) => field.key))
if (clientPaths.length === 0) fail('客户端 GROUPS 为空:配置卡没有任何字段')

let plain = null
if (resolved !== null) {
  try {
    plain = new z(Config.toJSON())
  } catch (error) {
    fail(`Config.toJSON() 无法重建为普通 schema(设置服务正是这么做的): ${error?.message ?? error}`)
  }
}

if (plain !== null) {
  const form = hostVolatileForm(plain)
  if (form === undefined) {
    fail('宿主视角下没有任何 volatile 字段:entry 不会进 settings.describe(),记忆页看不到配置表单')
  }
  for (const dotted of clientPaths) {
    const path = dotted.split('.')
    if (!isVolatilePath(plain, path)) {
      fail(`记忆页字段 "${dotted}" 在宿主视角下不可编辑:lib/config.js 里对应的 schema 节点没打 live(...)`)
    }
  }
  if (failures.length === 0) ok(`记忆页 ${clientPaths.length} 个字段全部可编辑(宿主同一判定)`)
} else {
  skipped.push('③ 字段清单↔可编辑面(② 没过,无 plain schema 可比)')
}

// ── ④ 校验出来的树里确实有引用(不然 getConfig 解包是空转) ─────────────────
// 逐个字段查,不抽样:抽样对象会随 GROUPS 顺序漂移(把已生效的那个字段挪到最后就绿),
// 而"标了却没产出引用"恰恰是 schemastery 解析退化时唯一的可见信号。
if (resolved !== null) {
  const notRef = []
  for (const dotted of clientPaths) {
    let node = resolved
    for (const key of dotted.split('.')) node = node?.[key]
    if (!isVolatileRef(node)) notRef.push(dotted)
  }
  if (notRef.length > 0) {
    fail(`${notRef.length} 个字段解析后不是 volatile 引用(标记没生效,原地提交链路空转): ${notRef.join(', ')}`)
  } else {
    ok(`volatile 引用已被 schemastery 真正产出(${clientPaths.length} 项全查,解包链路非空转)`)
  }
} else {
  skipped.push('④ 引用产出核验(② 校验没过,无从解析)')
}

// ── ⑤ entry id 三处同源:patch 的 insert id / 宿主 SETTINGS_NS / 客户端 NS ──
const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
const insertId = /-\s+insert:\s*\n\s+-\s+id:\s*([^\s#]+)/.exec(patch)?.[1]
if (insertId === undefined) {
  fail('cordis.patch.yml 里找不到 `insert:` 的 entry id')
} else if (insertId !== SETTINGS_NS) {
  fail(`cordis.patch.yml 的 entry id "${insertId}" ≠ SETTINGS_NS "${SETTINGS_NS}":记忆页按 entry id 寻址,对不上就找不到配置`)
} else {
  ok(`entry id 三处同源:${insertId}`)
}

const clientSource = readFileSync(new URL('../lib/client/runtime.js', import.meta.url), 'utf8')
const clientNs = /export const NS = ["']([^"']+)["']/.exec(clientSource)?.[1]
if (clientNs !== SETTINGS_NS) {
  fail(`客户端 NS "${clientNs}" ≠ 宿主 SETTINGS_NS "${SETTINGS_NS}"`)
} else {
  ok('客户端 NS 与宿主 SETTINGS_NS 一致')
  // 真正的寻址发生在调用点:NS 常量对得再齐,写成 `configForms.get("memory2")` 一样找不到表单
  const clientIndex = readFileSync(new URL('../lib/client/index.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  if (!/configForms\.get\(\s*NS\s*\)/.test(clientIndex)) {
    fail('客户端寻址点不是 `ctx.configForms.get(NS)`:entry id 被写成内联字面量了——⑤ 的"同源"管不到真正寻址那一行,改错不报错、只是配置卡永远读不到值')
  } else {
    ok('客户端寻址点用的就是 NS 常量(configForms.get(NS))')
  }
}


// ── ⑥ 客户端半必须声明 configForms(0.1.6 的 settingsScope 已移除) ───────────
/**
 * 判断"代码里"有没有用到某个标识符——**注释里出现不算**(迁移说明本来就要提到旧名字,
 * 否则下一个人无从知道这段为什么长这样)。
 */
function usesIdentifier(source, name) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  return new RegExp(`\\b${name}\\b`).test(code)
}

const clientEntry = readFileSync(new URL('../lib/client/index.js', import.meta.url), 'utf8')
if (!clientEntry.includes('"configForms"')) {
  fail('lib/client/index.js 的 inject 列表缺 configForms(0.2.0 的设置写入通道)')
} else if (usesIdentifier(clientEntry, 'settingsScope')) {
  fail('lib/client/index.js 仍在用 settingsScope:该服务在 0.2.0 已移除')
} else {
  ok('客户端半走 configForms,未残留 settingsScope')
}

// ── ⑦ volatile 全集必须被记忆页完整覆盖(反方向)────────────────────────────
/** 收集宿主视角下所有 volatile 字段的 dotted path(标了 volatile 的节点不再下钻)。 */
function collectVolatilePaths(schema, prefix = []) {
  if (schema.meta?.volatile) return [prefix.join('.')]
  if (schema.type !== 'object') return []
  return Object.entries(schema.dict ?? {}).flatMap(([key, child]) => collectVolatilePaths(child, [...prefix, key]))
}

/**
 * ③ 只守住"记忆页要改的字段宿主认不认"。这一条守反方向:**宿主认改的字段,记忆页有没有地方改**。
 * 本插件的记忆页是这些字段**唯一确定的编辑面**(宿主那侧的自动生成页目前没有任何客户端消费,
 * 且我们已声明 `auto: false` 不指望它),所以漏一个 volatile 字段它就真的没有编辑入口了——
 * 不报错,只是那个字段"改不了"。
 * 可编辑面 = 配置卡 GROUPS + SOUL 卡的两个开关。
 */
if (plain !== null) {
  const hostPaths = collectVolatilePaths(plain)
  const clientAll = new Set([...clientPaths, ...SOUL_FIELDS])
  const orphan = hostPaths.filter((p) => !clientAll.has(p))
  const ghost = [...clientAll].filter((p) => !hostPaths.includes(p))
  if (orphan.length > 0) {
    fail(`lib/config.js 标了 live() 但记忆页无处可改(本页是唯一的编辑面,这些字段改不了): ${orphan.join(', ')}`)
  } else if (ghost.length > 0) {
    fail(`记忆页要改的字段宿主视角下不是 volatile(写进去不会生效): ${ghost.join(', ')}`)
  } else {
    ok(`可编辑面两侧闭合:宿主 volatile ${hostPaths.length} 项 == 记忆页 ${clientAll.size} 项(配置卡 ${clientPaths.length} + SOUL ${SOUL_FIELDS.length})`)
  }
} else {
  skipped.push('⑦ 可编辑面两侧闭合(② 没过,无 plain schema 可收 volatile 全集)')
}

// ── ⑧ 客户端 bundle 清单:dsh.client 决定页面到底会不会被装载 ────────────────
/**
 * 客户端半不是普通 ESM:它由 `dsh-client-modules` 按 `package.json` 的 `dsh.client`
 * 登记成 boot graph 行。整段删掉/写错 → 记忆页**整页不出现**(不报错);
 * inject 里少列提供方 → 我们的 apply 拿不到 `ctx.configForms`,配置卡停在"不可用"。
 * (注:inject 列表里 `dsh-client-ui-slots` 在 0.2.0-rc.1 发行版没有 client 行,是空条目——
 * 留着是为了 slots 语义可追溯,真机确认后再决定去留。)
 */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const clientManifest = pkg.dsh?.client
if (clientManifest === undefined) {
  fail('package.json 缺 `dsh.client` 清单:客户端 bundle 不会被登记,「记忆」整页不出现')
} else if (clientManifest.platform !== 'web') {
  fail(`dsh.client.platform = ${JSON.stringify(clientManifest.platform)},应为 "web"`)
} else {
  const inject = Array.isArray(clientManifest.inject) ? clientManifest.inject : []
  const providers = [
    ['configForms', '@deepseek-ai/dsh-client-ui-settings'],
    ['locale', '@deepseek-ai/dsh-client-locale'],
  ]
  const missing = providers.filter(([svc, name]) => !inject.includes(name)).map(([svc, name]) => `${svc}←${name}`)
  if (missing.length > 0) {
    fail(`dsh.client.inject 缺 ${missing.join(', ')}:客户端 apply 拿不到该服务,页面要么不出现、要么配置卡永远"不可用"`)
  } else {
    ok(`dsh.client 清单齐(platform=web,inject ${inject.length} 项含所依赖服务的提供方)`)
  }
}

// ── ⑨ 编辑器 kind ↔ 宿主 schema 类型 ───────────────────────────────────────
/**
 * GROUPS 的 `kind` 写错(如 `toggle` 拼成 `toogle`)三道检查器都不会红:config-card 落到
 * else 分支渲染成文本框,于是把**字符串写进 boolean/number 字段**——要么被宿主校验拒绝
 * (用户看到莫名其妙的失败),要么写进去后插件读到错类型。
 * 这里按宿主 schema 的 `type` 反推应有 kind,并把 select 的候选值对回 union 的 const 集。
 * 一个宿主类型允许多种编辑器时列成数组(目前只有 array:`lines` 是通用文本域,
 * `workspaces` 是带候选列表的自定义控件);其余类型仍保持单值。
 */
const KIND_BY_TYPE = {
  boolean: 'toggle', number: 'number', string: 'text', array: ['lines', 'workspaces'], dict: 'dict', union: 'select',
}
if (plain !== null) {
  const bad = []
  for (const group of GROUPS) {
    for (const field of group.fields) {
      let node = plain
      for (const key of field.key.split('.')) node = node?.dict?.[key]
      if (node === undefined) { bad.push(`${field.key}(schema 里不存在,拼错?)`); continue }
      const want = KIND_BY_TYPE[node.type]
      if (want === undefined) { bad.push(`${field.key}(宿主类型 ${node.type} 无对应编辑器)`); continue }
      const allowed = Array.isArray(want) ? want : [want]
      if (!allowed.includes(field.kind)) {
        const expected = allowed.map((kind) => `"${kind}"`).join(' 或 ')
        bad.push(`${field.kind === undefined ? field.key : `${field.key}:kind="${field.kind}"`} 应为 ${expected}(宿主类型 ${node.type})`)
        continue
      }
      if (field.kind === 'select') {
        const allow = (node.list ?? []).map((v) => v?.value)
        const offside = (field.options ?? []).filter((o) => !allow.includes(o))
        if (offside.length > 0) bad.push(`${field.key}:select 选项 ${offside.join('/')} 不在 schema 取值 ${allow.join('/')} 里,选中即被宿主校验拒绝`)
      }
    }
  }
  if (bad.length > 0) fail(`记忆页控件类型与宿主 schema 对不上(${bad.length} 处): ${bad.join('; ')}`)
  else ok(`记忆页 ${GROUPS.reduce((n, g) => n + g.fields.length, 0)} 个控件的 kind/options 与宿主 schema 类型一致`)
} else {
  skipped.push('⑨ 控件 kind↔宿主类型(② 没过,无 plain schema 可对)')
}

// ── ⑩ 浏览器半必须是「宿主能直接执行」的产物(本轮修掉的静默通道)────────────
/**
 * 宿主 `@deepseek-ai/dsh-client-modules` 取浏览器半的姿势是 **`readFileSync(clientPath)`**
 * ——它把 `exports["./client"]` 指向的文件当成**成品字节**塞进 combo 响应,从不编译。
 *
 * 所以那个文件必须是自包含 bundle(官方包由 tsdown 预构建:`module id = 包名` +
 * `factory: (require) => …` 全内联)。曾经这个位置放的是 ESM 源码,失败是**静默的**:
 * boot graph 里行还在、combo 也照常 200,但响应体里没有本插件的模块(实测:声明 7 个
 * entries,bundle 内只有 6 个 id,`neural-mind` 仅以 sourceMappingURL 里的名字出现)
 * ——浏览器执行到相对 import 时 `require` 是 `undefined`,**设置里永远不会出现「记忆」这一页**。
 *
 * 这里只做廉价的形态断言(读文件、看头部);行为验证由 `test/client-bundle.test.mjs`
 * 真执行一遍(注册 id / inject / apply / 渲染五张卡)。
 */
const clientExport = pkg.exports?.['./client']
const clientRel = typeof clientExport === 'string'
  ? clientExport
  : (typeof clientExport === 'object' && clientExport !== null ? clientExport.default : undefined)
if (typeof clientRel !== 'string') {
  fail('package.json 的 exports["./client"] 不是字符串:宿主解析不出浏览器半的路径')
} else if (clientManifest !== undefined) {
  const bundlePath = new URL(`../${clientRel.replace(/^\.\//, '')}`, import.meta.url)
  let bundleSource = ''
  try {
    bundleSource = readFileSync(bundlePath, 'utf8')
  } catch (error) {
    fail(`exports["./client"] 指向的 ${clientRel} 读不到(${error?.code ?? error}):宿主读它时会抛 MissingClientBundleError`)
  }
  if (bundleSource !== '') {
    const head = bundleSource.slice(0, 400)
    const problems = []
    if (!/__ModuleLoader__\s*\.\s*load\s*\(/.test(head)) problems.push('开头没有 window.__ModuleLoader__.load(...) 注册调用')
    if (!head.includes(`id: "${pkg.name}"`)) problems.push(`module id 不是包名 ${pkg.name}`)
    if (/^\s*import\s/m.test(bundleSource)) problems.push('仍含 ESM import 语句(产物必须是自包含 bundle,不是源码)')
    if (problems.length > 0) {
      fail(`${clientRel} 不是宿主可直接执行的成品 bundle:${problems.join(';')}——跑 \`npm run build:client\`(宿主只 readFileSync,不编译)`)
    } else {
      ok(`浏览器半是自包含产物(${clientRel},${Buffer.byteLength(bundleSource, 'utf8')} 字节;module id = 包名)`)
    }
  }
}

// ── 输出 ──────────────────────────────────────────────────────────────────
// ② 校验没过时,依赖 plain/resolved 的 ③④⑦⑨ 整块不跑。exit 1 已经拦住了,但"通过 N 项"
// 会低估被沉默掉的检查数,所以两条路径都显式列出连带没跑的项目。
const skipLine = skipped.length > 0 ? `  ⚠ 连带没跑 ${skipped.length} 项:${skipped.join('; ')}\n` : ''
if (failures.length > 0) {
  process.stderr.write(`\nmemory 接缝对账失败(${failures.length} 项):\n`)
  for (const message of failures) process.stderr.write(`  ✗ ${message}\n`)
  process.stderr.write(skipLine + '\n')
  process.exit(1)
}
process.stdout.write(`memory 接缝对账通过(${notes.length} 项):\n`)
for (const message of notes) process.stdout.write(`  ✓ ${message}\n`)
process.stdout.write(skipLine)