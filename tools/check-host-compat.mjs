#!/usr/bin/env node
/**
 * 宿主兼容性核查(DESIGN §8 v2.x 的机械复核;基线 DSH Desktop 0.2.1-rc.3,并兼容 0.2.2-rc.1 / Session 格式 V4)。
 *
 * 用途:DSH 每次更新(rc.x 滚动)后,一条命令回答"插件依赖的接缝还在不在、语义变没变"。
 * 它**不依赖** `.scratch/dsh-ref/` 的抽取物——所有断言都直接打在**实机 asar** 的代码上,
 * 因此不会出现"和上一版相同 ⇒ 大概没事"这种推论式结论(那是本轮最容易自我安慰的地方)。
 *
 * 四段:
 *  ① 宿主身份:桌面壳版本与 build commit、内置 Node/pnpm、宿主侧 Schemastery 版本、Session 格式版本;
 *  ② 逐文件差异(可选):有 `.scratch/dsh-ref/` 时,把插件用到的包与抽取物逐文件比哈希,
 *     把"只有 package.json 版本号变了"和"代码真变了"分开——后者才需要人工看;
 *  ③ 接缝断言:`文件:正则`,对应 DESIGN §8.1/§8.2 与代码里真正消费的 API(含 Session V4 消息表示);
 *  ④ 插件声明校验:`dsh.client.inject` 里的包必须真实存在(0.2.1 删掉 ui-slots 后,旧声明
 *     会成为静默 no-op;将来宿主若开始校验,就会变成安装/加载失败)。
 *
 * 用法:`node tools/check-host-compat.mjs [asar 路径]`
 *   asar 缺省自动探测已安装的桌面壳(DSH_ASAR / DSH_ASAR_ROOTS 可覆盖),也可显式传路径。
 * 退出码:0 = 接缝全在且声明有效;1 = 有接缝缺席或声明失效(会逐条列出);2 = asar 读不到。
 *
 * 注意:本工具只证明"API 还在 + 声明与宿主对得上";**语义**仍靠 `npm test` 与隔离 profile 端到端
 * (HANDOFF 第四轮:Session V4 的 source/tool-result 语义变化就是这种"存在但语义变了"的坑)。
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { resolveAsarPath, readAsar, listAsar, walkAsar } from './lib/host-asar.mjs'

const ASAR = resolveAsarPath(process.argv[2])
const ROOT = 'dsh/node_modules/@deepseek-ai'
const REF_ROOT = process.env.DSH_REF || new URL('../.scratch/dsh-ref/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const REF_DIR = (() => {
  const nested = join(REF_ROOT, 'dsh', 'node_modules', '@deepseek-ai')
  return fs.existsSync(nested) ? nested : REF_ROOT
})()
if (!fs.existsSync(ASAR)) {
  process.stderr.write(`读不到 asar:${ASAR || '(未自动探测到已安装的桌面壳)'}\n` +
    '用参数或 DSH_ASAR 指定路径,例如 F:/deepseek-harness/resources/app.asar;\n' +
    '非标准安装位置可用 DSH_ASAR_ROOTS 追加搜索根(分号分隔)\n')
  process.exit(2)
}

// ── ① 宿主身份 ──────────────────────────────────────────────────────────
console.log('① 宿主身份')
const shellPkg = JSON.parse(readAsar(ASAR, 'package.json') ?? '{}')
console.log(`   桌面壳 ${shellPkg.name ?? '?'} = ${shellPkg.version ?? '?'}  build ${String(shellPkg.dshBuildCommit).slice(0, 12)}`)
const rtPath = ASAR.replace(/app\.asar$/, 'runtime/versions.json')
if (fs.existsSync(rtPath)) {
  const rt = JSON.parse(fs.readFileSync(rtPath, 'utf8'))
  const need = process.env.DSH_NODE || '24'
  console.log(`   内置 Node ${rt.node} / pnpm ${rt.pnpm} —— 插件 engines 要求 ^22.19 || >=24:${String(rt.node).startsWith(need) ? '满足' : '⚠ 核对 engines'}`)
}
const hostSchemastery = JSON.parse(readAsar(ASAR, `${ROOT}/schemastery/package.json`) ?? '{}').version
const ownSchemastery = JSON.parse(fs.readFileSync(new URL('../node_modules/@deepseek-ai/schemastery/package.json', import.meta.url), 'utf8')).version
const ownPinned = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).dependencies?.['@deepseek-ai/schemastery']
console.log(`   Schemastery:宿主内置 ${hostSchemastery} / 插件装的是 ${ownSchemastery}(锁 ${ownPinned})——`
  + `${hostSchemastery === ownSchemastery ? '版本一致' : '不同版本'};`.trim(),
  `\n   (解析走插件自己那份,红线在插件侧:必须支持 .volatile(),见 §8.1-③)`)

// ── ② 逐文件差异(可选,需要抽取物)──────────────────────────────────────
const PKGS = {
  host: ['dsh-settings', 'cordis-plugin-loader', 'cordis', 'cosmokit', 'dsh-session-query', 'dsh-credentials',
    'dsh-credentials-local', 'dsh-llm', 'dsh-llm-deepseek', 'dsh-tools', 'dsh-host-webserver', 'dsh-storage-domain',
    'dsh-storage-json', 'dsh-system-prompt', 'dsh-agent', 'dsh-token-meter', 'dsh-agent-default-model',
    'dsh-config-editor', 'dsh-session', 'dsh-session-format-catalog', 'dsh-session-format-v3-to-v4',
    'dsh-app-boot', 'dsh-plugin-manager'],
  // 0.2.1-rc.3 已删除 dsh-client-ui-slots / dsh-client-store(槽位实现并入 shell 静态种子,
  // `slots` 服务改由 dsh-client-ui-renderer 提供)——旧清单留在历史记录里,别再按包名当接缝。
  client: ['dsh-client-modules', 'dsh-client-locale', 'dsh-client-ui-settings', 'dsh-client-ui-settings-general',
    'dsh-client-ui-renderer', 'dsh-client-ui-layout', 'dsh-cordis-client-runner'],
}
const codeFile = (p) => /\.(js|mjs|cjs|json)$/.test(p) && !/README|LICENSE|package\.json$/.test(p)
let refNote = ''
if (fs.existsSync(REF_DIR)) {
  const changedCode = []
  const removed = []
  const same = []
  for (const pkg of [...PKGS.host, ...PKGS.client]) {
    const refRoot = `${REF_DIR}/${pkg}`
    if (!fs.existsSync(refRoot)) { refNote = `抽取物缺 ${pkg}(重新 extract-dsh)`; continue }
    const refSet = new Set(fs.readdirSync(refRoot, { recursive: true })
      .map((f) => String(f).replace(/\\/g, '/'))
      .filter((f) => codeFile(f) && !f.startsWith('node_modules/')))
    const liveSet = new Set(walkAsar(ASAR, `${ROOT}/${pkg}`)
      .map((f) => f.slice(`${ROOT}/${pkg}/`.length))
      .filter(codeFile))
    for (const f of liveSet) {
      if (!refSet.has(f)) continue
      const a = createHash('sha1').update(readAsar(ASAR, `${ROOT}/${pkg}/${f}`) ?? '').digest('hex')
      const b = createHash('sha1').update(fs.readFileSync(`${refRoot}/${f}`, 'utf8')).digest('hex')
      if (a !== b) changedCode.push(`${pkg}/${f}`)
    }
    for (const f of refSet) if (!liveSet.has(f)) removed.push(`${pkg}/${f}`)
    if (![...changedCode, ...removed].some((x) => x.startsWith(`${pkg}/`))) same.push(pkg)
  }
  console.log(`\n② 与抽取物逐文件比对(代码文件,不含 README/package.json)`)
  console.log(`   完全相同 ${same.length} 个包;内容有变 ${changedCode.length} 个文件;live 里已消失 ${removed.length} 个文件`)
  for (const f of changedCode) console.log(`     ~ ${f}`)
  for (const f of removed) console.log(`     - ${f}(确认无人引用:grep live 入口 ${f.replace(/^.*\//, '').replace(/\.(js|mjs)$/, '')})`)
  if (refNote) console.log(`     ⓘ ${refNote}`)
} else {
  console.log(`\n② 跳过:找不到抽取物 ${REF_DIR}(可用 .scratch/extract-dsh.mjs 重抽;不影响 ③)`)
}

// ── ③ 接缝断言(打在 live asar 代码上)───────────────────────────────────
const FILES = {
  settings: 'dsh-settings/lib/index.js', loader: 'cordis-plugin-loader/lib/index.js',
  cosmokit: 'cosmokit/lib/index.js', cordis: 'cordis/lib/index.js',
  schemastery: 'schemastery/lib/index.mjs', sessionQuery: 'dsh-session-query/lib/index.js',
  credentials: 'dsh-credentials/lib/index.js', llmDeepseek: 'dsh-llm-deepseek/lib/index.js',
  tools: 'dsh-tools/lib/index.js', webserver: 'dsh-host-webserver/lib/index.js',
  storage: 'dsh-storage-domain/lib/index.js', prompt: 'dsh-system-prompt/lib/index.js',
  agent: 'dsh-agent/lib/index.js', tokenMeter: 'dsh-token-meter/lib/index.js',
  adm: 'dsh-agent-default-model/lib/index.js', clientModules: 'dsh-client-modules/lib/index.js',
  uiSettings: 'dsh-client-ui-settings/lib/client.js', uiGeneral: 'dsh-client-ui-settings-general/lib/client.js',
  locale: 'dsh-client-locale/lib/client.js',
  // 主侧栏全局面板:侧栏行(`sidebar.panellist`)+ 右侧主区域(`main`,keyed by panel id)
  uiSidebar: 'dsh-client-ui-sidebar/lib/client.js', uiLayout: 'dsh-client-ui-layout/lib/client.js',
  // 0.2.0-rc.1 起的 Session 格式 V4 + 0.2.1 起的新门禁
  session: 'dsh-session/lib/index.js', sessionV4: 'dsh-session-format-v3-to-v4/lib/index.js',
  sessionCatalog: 'dsh-session-format-catalog/lib/index.js', uiRenderer: 'dsh-client-ui-renderer/lib/client.js',
  appBoot: 'dsh-app-boot/lib/index.js', pluginManager: 'dsh-plugin-manager/lib/index.js',
}
const cache = new Map()
const src = (k) => {
  if (!cache.has(k)) cache.set(k, readAsar(ASAR, `${ROOT}/${FILES[k]}`) ?? '')
  return cache.get(k)
}
/** 每条 = DESIGN §8/§8.1 里被消费的一个具体 API;措辞即"变了就必须重看这里"。 */
const SEAMS = [
  ['设置服务', 'configure(presentation, owner = this.ctx.fiber) —— owner 默认值是服务自己的 fiber', 'settings', /configure\(presentation, owner = this\.ctx\.fiber\)/],
  ['设置服务', '同一 fiber 重复登记会抛(所以我们 catch)', 'settings', /Settings presentation is already configured/],
  ['设置服务', 'describe 按 volatileForm 过滤:一个都没标就不进镜像(静默)', 'settings', /const form = volatileForm\(schema\)/],
  ['设置服务', '表单投影读 entry.fiber.effectiveConfig(0.2.2)/fiber.config(0.2.1) —— 原地提交的目标树', 'settings', /projectForm\(form, plainConfig\(entry\.fiber\.(?:config|effectiveConfig)\)\)/],
  ['设置服务', 'settings.yaml 一次性导入并改名 .imported', 'settings', /const imported = `\$\{path\}\.imported`/],
  ['设置服务', 'get writable() 恒 true:遮蔽是"写入被拒",不是快照只读', 'settings', /get writable\(\)/],
  ['Loader', '_commitVolatile 仍在', 'loader', /_commitVolatile\(\)/],
  ['Loader', '原地提交 updateVolatile(ref, source)', 'loader', /updateVolatile\(ref, source\)/],
  ['Loader', 'emit loader/volatile-update(插件的热重建入口)', 'loader', /"loader\/volatile-update"/],
  ['Loader', 'volatileOnly 判定 equalExceptVolatile', 'loader', /equalExceptVolatile/],
  ['cosmokit', 'volatile 符号取全局注册表(跨 ESM 副本一致)', 'cosmokit', /Symbol\.for\("cosmokit\.volatile\.write"\)/],
  ['cosmokit', 'createVolatile 存在', 'cosmokit', /function createVolatile/],
  ['cosmokit', 'volatileEntries 递归收集', 'cosmokit', /function volatileEntries/],
  ['cordis', 'apply 收到解析后的 config(0.2.2) / this.config(0.2.1)(与原地提交同一棵树)', 'cordis', /callback\(this\.ctx, (?:this\.config|config)\)/],
  ['cordis', 'config 在 apply 前被解析:0.2.2 存 _effectiveConfig,0.2.1 覆盖 this.config', 'cordis', /this\._effectiveConfig = config|this\.config = this\._resolveConfig\(this\._config\)/],
  ['cordis', 'ctx.effect(execute, label) 签名', 'cordis', /effect\(execute, label = "anonymous"\)/],
  ['Schemastery', '.volatile() 标记方法存在', 'schemastery', /volatile\(\)/],
  ['sessionQuery', 'readSession 返回含 inheritedEventCount(新形状)', 'sessionQuery', /inheritedEventCount/],
  ['credentials', '引用名语法 REF_PATTERN', 'credentials', /const REF_PATTERN = \S*\^\[A-Za-z_\]/],
  ['credentials', '语法外"读作未设置"而非抛错', 'credentials', /read as "not set"/],
  ['llm-deepseek', 'options.system 仍被拼进请求(不要改成 system 消息)', 'llmDeepseek', /options\.system/],
  ['tools', 'tools.register 定义含 output', 'tools', /output/],
  ['webServer', 'webServer.register 路由 seam', 'webserver', /register/],
  ['storageDomain', 'storageDomain.open', 'storage', /open\(/],
  ['systemPrompt', 'section() 注册', 'prompt', /section/],
  ['agent', 'agent/created 与 agent/disposed(按 agent 装段的依据)', 'agent', /"agent\/created"|"agent\/disposed"/],
  ['tokenMeter', 'measure(session)', 'tokenMeter', /measure/],
  ['agentDefaultModel', 'currentSelection()', 'adm', /currentSelection/],
  ['client-modules', '按 package.json 的 dsh.client 建 boot graph', 'clientModules', /client/],
  // ↓ 本轮修掉的静默通道:宿主**不编译**浏览器半,直接把它当成品字节读走。
  //   这条断言是"我们为什么必须预构建 lib/client.js"的宿主侧证据;它一变,整条取件姿势就要重看。
  ['client-modules', '浏览器半取件读 readFileSync(clientPath):宿主不做编译(0.2.2 包进 readClientBundle,仍读原始字节)', 'clientModules', /readFileSync\(clientPath\)/],
  ['client-modules', 'exports["./client"] 就是那个成品路径(clientExportOf)', 'clientModules', /clientExportOf/],
  ['ui-settings', '提供 configForms 服务', 'uiSettings', /super\(ctx, "configForms"\)/],
  ['ui-settings', 'ConfigFormController.mutate(ops, expectedRevision)', 'uiSettings', /mutate\(ops, expectedRevision\)/],
  ['ui-settings', 'getSnapshot 是稳定引用(useSyncExternalStore 前提)', 'uiSettings', /createSnapshotStore/],
  ['ui-settings', 'persistence 非 host 时 writable:false', 'uiSettings', /writable: false/],
  ['ui-settings-general', '渲染 settings.section slot', 'uiGeneral', /entries\("settings\.section"\)/],
  ['ui-settings-general', 'settings.section 的 slot 声明位', 'uiGeneral', /"settings\.section": \{/],
  // ↓ 0.6.5:记忆入口从设置弹窗搬到主侧栏。侧栏行与右侧页面是**两个槽位**,
  //   id 必须同源,否则点侧栏行会抛 layout.selectPanel 的未注册错误。
  ['ui-sidebar', 'sidebar.panellist 的 slot 声明位', 'uiSidebar', /"sidebar\.panellist": \{/],
  ['ui-sidebar', '面板行内容按 { size, active } 渲染', 'uiSidebar', /renderSlot\("sidebar\.panellist", \{\s*size:/],
  ['ui-sidebar', '点击面板行调用 layout.selectPanel(id)', 'uiSidebar', /selectPanel\(id\)/],
  ['ui-layout', 'main 是 keyed 槽,按 activePanelId 选面板', 'uiLayout', /renderSlot\("main", \{\}, \{ entryKey:/],
  ['ui-layout', 'selectPanel 校验 main 已注册(否则抛)', 'uiLayout', /main panel .* is not registered/],
  ['locale', 'ctx.locale.register / bind', 'locale', /register\(|\bbind\(/],
  // ↓ 0.2.0-rc.1 起的 Session 格式 V4:消息来源与工具结果表示都换代了。
  //   插件写侧(v4 source kind)与读侧(tool 角色结果)都按这些事实实现;任一条变了必须重看 lib/compat.js + lib/turns.js。
  ['Session V4', '当前写入格式 = 4', 'session', /const SESSION_FORMAT_VERSION = 4/],
  ['Session V4', '消息来源必须是"生产者拥有"的 kind(非空且 ≠ "plugin")', 'sessionV4', /format v4 message requires a producer-owned source kind/],
  ['Session V4', 'V4 tool/result 必须是 tool 角色消息', 'sessionV4', /requires a tool-role message/],
  ['Session V4', 'V3→V4 迁移边把未知插件映射成 plugin:<包名>', 'sessionV4', /function producerKind/],
  ['Session V4', '格式 catalog 的当前版本 = 4', 'sessionCatalog', /currentVersion: 4/],
  // 0.2.1 把 ui-slots 包删了,`slots` 服务改由 ui-renderer 提供(插件 dsh.client.inject 已据此更新)。
  ['ui-renderer', '`slots` 服务由 dsh-client-ui-renderer 提供', 'uiRenderer', /super\(ctx, "slots"\)/],
  // 0.2.1 新增的 DSH 版本兼容门禁(插件未声明 engines.dsh,因此放行;声明方式见 DESIGN §8.2)。
  ['plugin-manager', '版本兼容门禁:engines.dsh / DSH peer 依赖', 'appBoot', /engines\.dsh/],
  ['plugin-manager', '不兼容版本可被显式豁免(用户承担风险)', 'pluginManager', /incompatible-version/],
]
console.log('\n③ 接缝断言(直接打在 live asar 上)')
let bad = 0
for (const [group, what, key, re] of SEAMS) {
  const s = src(key)
  const ok = s.length > 0 && re.test(s)
  if (!ok) { bad++; console.log(`   ✗ [${group}] ${what}${s.length === 0 ? '  (取不到 ' + FILES[key] + ')' : ''}`) }
}
if (bad === 0) console.log(`   ✓ ${SEAMS.length} 条全部命中`)

// ── ④ 插件声明校验(dsh.client.inject 的包必须真实存在)────────────────────
console.log('\n④ 插件声明校验')
const ownPkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
let manifestBad = 0
const inject = ownPkg.dsh?.client?.inject ?? []
for (const pkgName of inject) {
  const bare = pkgName.startsWith('@deepseek-ai/') ? pkgName.slice('@deepseek-ai/'.length) : pkgName
  if (readAsar(ASAR, `${ROOT}/${bare}/package.json`) === null) {
    manifestBad++
    console.log(`   ✗ dsh.client.inject 引用了宿主里不存在的包:${pkgName}`)
  }
}
if (inject.length > 0 && manifestBad === 0) console.log(`   ✓ dsh.client.inject ${inject.length} 个包在 live 宿主里都存在`)
if (ownPkg.dsh?.client?.platform !== 'web') { manifestBad++; console.log('   ✗ dsh.client.platform 必须是 "web"(宿主按此入浏览器半)') }
if (typeof ownPkg.exports?.['./client'] !== 'string') { manifestBad++; console.log('   ✗ exports["./client"] 缺失(宿主 clientExportOf 取不到浏览器半)') }
const patchRel = ownPkg.dsh?.bundle?.patch
if (typeof patchRel !== 'string' || !fs.existsSync(new URL(`../${patchRel.replace(/^\.\//, '')}`, import.meta.url))) {
  manifestBad++
  console.log(`   ✗ dsh.bundle.patch 指向的文件不存在:${patchRel}`)
} else {
  console.log(`   ✓ dsh.bundle.patch → ${patchRel}`)
}
if (manifestBad === 0) console.log('   ✓ 插件清单声明与 live 宿主对得上')

const failed = bad + manifestBad
console.log(`\n结论:${failed === 0 ? '兼容 —— 插件依赖的接缝在 live 宿主上逐条存在,声明也与宿主对得上' : `有 ${failed} 项不通过(${bad} 条接缝 + ${manifestBad} 项声明)—— 按 DESIGN §8.1/§8.2 对应小节复核代码`}`)
console.log('提示:本工具只证明"API 还在 + 声明对得上";"语义没变"要靠 npm test 与隔离 profile 端到端(HANDOFF 第四轮:Session V4 就是存在但语义变了的坑)。')
process.exit(failed === 0 ? 0 : 1)

