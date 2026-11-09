#!/usr/bin/env node
/**
 * 客户端半打包器(零依赖):把 `lib/client/*.js` 的 ESM 源码收成一个自包含 bundle,
 * 写到 `lib/client.js`。
 *
 * ## 为什么必须有这一步(实测教训,别删)
 *
 * 宿主 `@deepseek-ai/dsh-client-modules` 的取件姿势是 **`readFileSync(clientPath)`**
 * ——它把 `exports["./client"]` 指向的那个文件**当成成品字节**直接塞进 combo 响应,
 * 从不做编译。所以那个文件必须是"执行即注册"的自包含 bundle(官方包由 tsdown 预构建:
 * `dsh-client-ui-settings-general/lib/client.js` = 53KB 单文件,`module id = 包名`)。
 *
 * 本仓库原先把 ESM 源码放在那个路径上,后果是**静默的**:boot graph 里行还在
 * (宿主扫的是 `dsh.client` 声明 + `exports["./client"]` 存在性),combo 也照常 200,
 * 但响应体里**没有本插件的模块**(实测:声明 7 个 entries,bundle 内只有 6 个 id,
 * `neural-mind` 仅以 sourceMappingURL 里的名字出现)——因为浏览器执行到
 * `import ... from "./client/index.js"` 时,`require` 是 `undefined`,工厂抛错、
 * 模块注册表里什么都没有。外在表现是"设置里没有『记忆』这一页",毫无告警。
 *
 * 官方格式就是下面这段(尾行 `//# sourceMappingURL=` 由宿主自行替换,本脚本不写):
 *
 * ```js
 * window.__ModuleLoader__.load({
 *   id: "<包名>",
 *   factory: (require) => {
 *     var module = { exports: {} }; var exports = module.exports;
 *     Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
 *     ...内联全部模块...
 *     exports.apply = apply; exports.inject = inject;
 *     return module.exports;
 *   },
 * });
 * ```
 *
 * ## 转换规则(严格:遇到不认识的形态直接报错,不静默降级)
 *
 * - 相对导入 `import { a, b as c } from "./x.js"` → 解构自该模块的命名空间对象。
 *   内部模块只 export 函数/常量,**不做 live binding**,需在 import 时就取到值。
 * - 外部导入 `import React from "react"` → `require("react")`(宿主模块表提供)。
 * - `export function/const/let/class` → 就地声明 + 登记进命名空间对象。
 * - `export default X` → `exports.default = X`。
 * - 只支持单行/多行花括号形式与默认导入;`export * from` / 动态 import 一律报错。
 *
 * 用法:`node tools/build-client.mjs [--check]`(`--check` 只校验产物是否最新,不写盘)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ENTRY = join(ROOT, 'lib', 'client', 'index.js')
const OUT_FILE = join(ROOT, 'lib', 'client.js')
const PKG_NAME = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name

/** 内部模块的 key 统一用相对 lib/client 的 POSIX 路径,产物与平台无关。 */
const moduleKey = (abs) => relative(join(ROOT, 'lib', 'client'), abs).split('\\').join('/')

const fail = (message) => {
  process.stderr.write(`build-client: ${message}\n`)
  process.exit(1)
}

/** 把一个模块源码拆成「导入 / 导出 / 正文」。 */
function parseModule(abs) {
  // 行尾统一成 LF 再切分:工作区的源文件可能是 CRLF(老 checkout / Windows 编辑器),
  // 直接按 "\n" 切会留下行尾的 "\r",而这些 "\r" 会一路带进产物 —— 结果是产物变成
  // 混合行尾,`--check` 与"刚构建过"的状态对不上(实测踩过:871 个 CRLF / 506 个 LF)。
  const raw = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
  const lines = raw.split('\n')
  const imports = []
  const internal = [] // 相对导入:{ from, bindings: [{imported, local}] }
  const external = [] // 外部导入:{ source, bindings }
  const exportNames = [] // 具名导出
  let defaultExport = null
  const body = []

  const parseBindings = (inner) => inner.split(',').map((part) => part.trim()).filter((part) => part !== '')
    .map((part) => {
      const as = /^(\S+)\s+as\s+(\S+)$/.exec(part)
      return as === null ? { imported: part, local: part } : { imported: as[1], local: as[2] }
    })

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    // ── import ────────────────────────────────────────────────────────────
    if (/^import\s/.test(trimmed)) {
      let spec = trimmed
      // 多行花括号形式:吃到 `} from "..."` 为止
      if (!/from\s+["'][^"']+["']\s*;?\s*$/.test(spec)) {
        let closed = false
        while (i + 1 < lines.length) {
          i += 1
          spec += ' ' + lines[i].trim()
          if (/from\s+["'][^"']+["']\s*;?\s*$/.test(spec)) { closed = true; break }
        }
        if (!closed) fail(`${moduleKey(abs)}: 无法解析的 import(第 ${i + 1} 行附近): ${trimmed}`)
      }
      const named = /^import\s*\{([\s\S]*)\}\s*from\s*["']([^"']+)["']\s*;?$/.exec(spec)
      const dflt = /^import\s+([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["']\s*;?$/.exec(spec)
      if (named !== null) {
        const bindings = parseBindings(named[1])
        if (bindings.length === 0) fail(`${moduleKey(abs)}: 空导入列表`)
        push(named[2], bindings)
      } else if (dflt !== null) {
        push(dflt[2], [{ imported: 'default', local: dflt[1] }])
      } else {
        fail(`${moduleKey(abs)}: 不支持的 import 形态: ${spec}`)
      }
      continue
    }
    if (/^import\b/.test(trimmed) || /\bimport\s*\(/.test(trimmed)) {
      fail(`${moduleKey(abs)}: 不支持的 import(裸 import / 动态 import): ${trimmed}`)
    }

    // ── export ────────────────────────────────────────────────────────────
    if (/^export\s/.test(trimmed)) {
      const dfltExport = /^export\s+default\s+([A-Za-z_$][\w$]*)\s*;?$/.exec(trimmed)
      if (dfltExport !== null) {
        defaultExport = dfltExport[1]
        continue
      }
      const decl = /^export\s+(?:async\s+)?(function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/.exec(trimmed)
      if (decl !== null) {
        exportNames.push(decl[2])
        body.push(line.replace(/^(\s*)export\s+/, '$1'))
        continue
      }
      const list = /^export\s*\{([^}]*)\}\s*;?$/.exec(trimmed)
      if (list !== null) {
        for (const binding of parseBindings(list[1])) exportNames.push(binding.local)
        continue
      }
      fail(`${moduleKey(abs)}: 不支持的 export 形态: ${trimmed}`)
    }

    body.push(line)
  }

  function push(source, bindings) {
    imports.push(source)
    if (source.startsWith('.')) internal.push({ from: source, bindings })
    else external.push({ source, bindings })
  }

  return { abs, imports, internal, external, exportNames, defaultExport, body: body.join('\n') }
}

/** 递归收集模块并按依赖优先排序(拓扑)。 */
function collect(entryAbs) {
  const modules = new Map()
  const visiting = new Set()
  const visit = (abs) => {
    const key = moduleKey(abs)
    if (modules.has(key)) return
    if (visiting.has(key)) fail(`检测到循环依赖: ${key}`)
    visiting.add(key)
    let parsed
    try {
      parsed = parseModule(abs)
    } catch (error) {
      fail(`读取 ${key} 失败: ${error?.message ?? error}`)
    }
    for (const dep of parsed.internal) {
      const depAbs = resolvePath(dirname(abs), dep.from)
      visit(depAbs)
    }
    visiting.delete(key)
    modules.set(key, parsed)
  }
  visit(entryAbs)
  return modules
}

/** 生成一个模块的包装体。 */
function emitModule(mod) {
  const key = moduleKey(mod.abs)
  const lines = []
  /** 需要 getter 绑定的导入:{ local, holder, imported } */
  const bindings = []

  lines.push(`\tvar ${nsVar(key)} = (function () {`)
  lines.push('\t\tvar exps = {};')
  lines.push(...collectBindings(mod, bindings))
  for (const binding of bindings) {
    lines.push(`\t\tvar ${binding.local} = ${binding.holder}[${JSON.stringify(binding.imported)}];`)
  }

  const body = mod.body.replace(/\s*$/, '')
  lines.push(body)
  if (mod.defaultExport !== null) lines.push(`\t\texps.default = ${mod.defaultExport};`)
  for (const name of mod.exportNames) lines.push(`\t\texps[${JSON.stringify(name)}] = ${name};`)
  lines.push('\t\treturn exps;')
  lines.push('\t})();')
  return lines.join('\n')
}

/**
 * 收集一个模块的导入绑定,并生成取件语句。
 *
 * 绑定是**模块作用域内的普通变量**(`var x = 来源["x"]`),不是 accessor——所以跨模块
 * 的 live binding 必须由**被导入方的稳定对象**承担:`lib/client/runtime.js` 因此把
 * React 的 createElement 与 hooks 收进 `export const react = {…}`,消费方 `import { react }`
 * 拿到的是常量引用,`react.h` 在渲染期读到的永远是最新值。
 *
 * 反面教材(实测踩过两次):① 直接 `import { h }` + 打包器做快照 → `h is not a function`;
 * ② 用 `Object.defineProperty(this, …)` 冒充变量绑定 → `react is not defined`
 * (`this` 不是作用域,属性不等于变量)。两条都由 `test/client-bundle.test.mjs` 当场抓住。
 */
function collectBindings(mod, bindings) {
  const lines = []
  let counter = 0
  for (const dep of mod.external) {
    const holder = `ext_${counter++}`
    lines.push(`\t\tvar ${holder} = require(${JSON.stringify(dep.source)});`)
    for (const binding of dep.bindings) bindings.push({ ...binding, holder })
  }
  for (const dep of mod.internal) {
    const depAbs = resolvePath(dirname(mod.abs), dep.from)
    const holder = nsVar(moduleKey(depAbs))
    for (const binding of dep.bindings) bindings.push({ ...binding, holder })
  }
  return lines
}

const nsVar = (key) => `mod_${key.replace(/[^A-Za-z0-9]/g, '_')}`

function generate() {
  const modules = collect(SOURCE_ENTRY)
  const parts = []
  parts.push('window.__ModuleLoader__.load({')
  parts.push(`\tid: ${JSON.stringify(PKG_NAME)},`)
  parts.push('\tfactory: (require) => {')
  parts.push('\t\tvar module = { exports: {} };')
  parts.push('\t\tvar exports = module.exports;')
  parts.push('\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });')
  for (const [key, mod] of modules) {
    parts.push(`\t\t//#region lib/client/${key}`)
    parts.push(emitModule(mod))
    parts.push('\t\t//#endregion')
  }
  const entry = modules.get(moduleKey(SOURCE_ENTRY))
  if (entry === undefined) fail('入口模块未收集到')
  if (!entry.exportNames.includes('definition')) {
    fail('入口必须命名导出 `definition`(带 id / factory 的模块定义)')
  }
  if (!entry.exportNames.includes('apply')) {
    fail('入口必须命名导出 `apply`(宿主调用的装配函数)')
  }
  const entryNs = nsVar(moduleKey(SOURCE_ENTRY))
  // 宿主读的是 `module.exports`:`id` 取 definition.id(loader 按包名查工厂)、
  // `factory`/`apply`/`inject` 从入口的命名导出组装。definition.factory 只做运行时
  // 初始化(require("react") + 样式),它的返回值**有意丢弃**——否则会污染 definition。
  parts.push(`\t\tvar __definition = ${entryNs}.default;`)
  parts.push('\t\tif (__definition === undefined || typeof __definition.factory !== "function") {')
  parts.push('\t\t\tthrow new Error("neural-mind: 入口 definition.factory 缺失(重新跑 npm run build:client)")')
  parts.push('\t\t}')
  parts.push('\t\t__definition.factory(require);')
  parts.push('\t\tvar __entry = {};')
  parts.push('\t\tfor (const __name of ["apply", "inject", "definition"]) {')
  parts.push(`\t\t\tif (${entryNs}[__name] !== undefined) __entry[__name] = ${entryNs}[__name];`)
  parts.push('\t\t}')
  parts.push('\t\t__entry.id = __definition.id;')
  parts.push('\t\treturn __entry;')
  parts.push('\t},')
  parts.push('});')
  return parts.join('\n') + '\n'
}

const args = process.argv.slice(2)
const check = args.includes('--check')
const generated = generate()

/**
 * 比较时把行尾归一化:产物是构建生成的文本文件,仓库 `.gitattributes` 定的是 `eol=lf`,
 * 但**工作区里可能是 CRLF**(老 checkout、Windows 编辑器都可能造成),而 `--check` 是
 * `npm test` 的 pretest 门禁——逐字节比会让人看到"重建了还是不一致"的死循环。
 * 内容是否最新与行尾无关,所以这里归一化后再比;`--check` 只看内容一致性。
 */
const normalizeEol = (text) => text.replace(/\r\n/g, '\n')

if (check) {
  let existing = ''
  try {
    existing = readFileSync(OUT_FILE, 'utf8')
  } catch {
    fail('lib/client.js 不存在——先跑 `npm run build:client`(宿主读的就是这个文件,缺了设置页不会出现)')
  }
  if (normalizeEol(existing) !== generated) {
    fail('lib/client.js 与 lib/client/ 源码不一致——跑 `npm run build:client` 重新生成')
  }
  const eolNote = existing.includes('\r\n') ? '(工作区是 CRLF,已按行尾无关比较)' : ''
  // 报**字节数**:源码注释是中文,一个字符占 3 字节;拿 `string.length` 当字节数报会与
  // `stat` 对不上(实测踩过:67628 字节的文件被报成 61341 字符)
  process.stdout.write(`客户端 bundle 是最新的(${Buffer.byteLength(generated, 'utf8')} 字节 / ${generated.length} 字符,${generated.split('\n').length - 1} 行)${eolNote}\n`)
} else {
  writeFileSync(OUT_FILE, generated, 'utf8')
  const count = [...generated.matchAll(/\/\/#region lib\/client\//g)].length
  process.stdout.write(`已生成 ${relative(ROOT, OUT_FILE)}(内联 ${count} 个模块,${Buffer.byteLength(generated, 'utf8')} 字节)\n`)
}
