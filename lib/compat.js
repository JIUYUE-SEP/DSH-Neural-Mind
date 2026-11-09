/**
 * DSH 0.2.0 接缝兼容层(§8 接缝映射 v2.0)。
 *
 * 0.1.6 → 0.2.0 这一跨,插件用到的宿主接缝有三处是**换了机制**而不是换了名字,
 * 这一层把差异收在一个文件里,其余代码只依赖这里的窄接口:
 *
 *  1. **volatile 配置引用**:0.2.0 的设置服务按 Schemastery 的 `.volatile()` 元数据
 *     划分"可编辑字段"。被标记的字段在 `Config` 解析后**不再是值,而是引用对象**
 *     (`{ get() }`,另带一个注册表符号方法用于提交)。协议本身是跨 ESM 副本稳定的
 *     ——符号用 `Symbol.for` 取,所以这里不必依赖 cosmokit 的任何导出。
 *     所有读配置的地方都过 `resolveConfig()` 深解包,拿到的仍是普通对象:插件内部
 *     50 余处 `cfg.x.y` 消费点因此零改动。
 *
 *  2. **配置变更通知**:0.1.6 的 `settings.installSection({onChange})` 已移除;
 *     0.2.0 走 Loader 自己的两条路——volatile-only 变更**原地提交**到引用并在插件
 *     自己的 fiber ctx 上 emit `loader/volatile-update`;含普通字段的变更整插件重挂载
 *     (本插件的 `reboot()` 本来就吃这条路)。
 *
 *  3. **能力探测**:以下探测一律"缺席即降级",旧宿主上插件仍能启动(§7 纪律)。
 */

/** cosmokit 跨副本共享的 volatile 写通道符号(`Symbol.for` = 全局注册表)。 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/**
 * 判定一个配置节点是不是 volatile 引用。
 * 判据与 cosmokit 的 `isVolatile` 一致:普通对象且带注册表符号方法。
 * 这样识别是跨 ESM 副本稳定的,不依赖构造它的那份 cosmokit。
 */
export function isVolatileRef(value) {
  return typeof value === 'object' && value !== null && VOLATILE_WRITE in value
}

/** 读一个 volatile 引用(或普通值)。 */
export function readVolatile(value) {
  return isVolatileRef(value) ? value.get() : value
}

/**
 * 深解包配置树:volatile 引用取当前值,其余结构原样递归。
 * 返回的是**新建的普通对象**(引用快照本身已冻结,不能再被改写),调用方可以安全持有。
 * @param value - `Config` 解析后的配置树(可能含 volatile 引用)。
 * @returns 纯值配置树。
 */
export function resolveConfig(value) {
  if (isVolatileRef(value)) return resolveConfig(value.get())
  if (Array.isArray(value)) return value.map((item) => resolveConfig(item))
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveConfig(item)]))
  }
  return value
}

/**
 * 给 schema 节点打 volatile 标记(记忆页可编辑的前提),旧 Schemastery 上原样返回。
 * `validateVolatileSchema` 的硬约束:volatile 字段必须落在固定对象路径上,且**不能
 * 被另一个 volatile 字段包住**——所以调用方要么标容器、要么标叶子,不能两者都标。
 * @param schema - Schemastery 节点。
 * @returns 打了标记的节点(或原节点)。
 */
export function markVolatile(schema) {
  return typeof schema?.volatile === 'function' ? schema.volatile() : schema
}

/**
 * 该 Schemastery 是否支持 volatile 标记。
 * 不支持时配置仍可用,只是记忆页看不到本插件的配置表单(降级而非故障)。
 */
export function hasVolatileSupport(schema) {
  return typeof schema?.volatile === 'function'
}

// ── 会话消息表示(0.2.0-rc.1+ 的 Session 格式 V4)────────────────────────────
//
// 0.2.0-rc.1 起宿主写 **Session 格式 V4**(`dsh-session` 的 `SESSION_FORMAT_VERSION = 4`),
// 消息来源要求"生产者拥有"的 kind:非空字符串、且**不等于字面量 `plugin`**。V3 的
// `{ kind: 'plugin', plugin: <包名> }` 包装在编码/解码时被拒(`SessionFormatError`),
// 而宿主自己的 V3→V4 迁移边把未知插件映射成 `plugin:<包名>`——所以写侧照抄这个约定。
//
// 只改**写**:新注入消息一律 V4 形状。读侧(压缩联动扫描历史日志)同时认两代形状,
// 这样迁移前写入的历史日志、旧宿主残留与单元测试素材都不用改写。

/** 本插件包名(改名后;改名前的 `dsh-plugin-memory` 只作为兼容旧日志的读侧别名保留)。 */
export const PLUGIN_NAME = 'neural-mind'

/** 改名前的包名:历史会话日志/旧测试素材里真实出现过,读侧继续认,新写入不再产生。 */
export const LEGACY_PLUGIN_NAMES = ['dsh-plugin-memory']

/** 本插件注入消息的生产者来源 kind(V4 形状;`plugin:` + 包名)。 */
export const OWN_SOURCE_KIND = `plugin:${PLUGIN_NAME}`

/** V4 下本插件注入消息的来源对象(新写入一律用它)。 */
export function pluginSource() {
  return { kind: OWN_SOURCE_KIND }
}

/**
 * 判据:这条消息来源是不是本插件注入的?
 * 认 V4 的 `{ kind: 'plugin:neural-mind' }`,也兼容改名前的
 * `{ kind: 'plugin:dsh-plugin-memory' }` 与 V3 的
 * `{ kind: 'plugin', plugin: 'dsh-plugin-memory' }`(历史日志 / 旧测试素材)。
 * @param source - 消息的 source 字段。
 */
export function isPluginSource(source) {
  if (source === null || typeof source !== 'object') return false
  if (source.kind === OWN_SOURCE_KIND) return true
  if (source.kind === 'plugin') {
    return source.plugin === PLUGIN_NAME || LEGACY_PLUGIN_NAMES.includes(source.plugin)
  }
  return typeof source.kind === 'string' && LEGACY_PLUGIN_NAMES.some((name) => source.kind === `plugin:${name}`)
}

/** 配置里是否有任何 volatile 字段——决定本 entry 会不会进设置服务的 describe 镜像。 */
export function hasVolatileFields(value) {
  if (isVolatileRef(value)) return true
  if (Array.isArray(value)) return value.some((item) => hasVolatileFields(item))
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).some((item) => hasVolatileFields(item))
  }
  return false
}

/**
 * 绑一条 volatile 变更监听。
 *
 * 语义(对照 `cordis-plugin-loader` 的 `_commitVolatile`):监听器**只在值真的变了**
 * 时被调用,且新值已经提交进引用——所以回调里直接重新 `resolveConfig` 就能读到新值,
 * 不需要从事件参数里取。事件参数是变更路径数组,仅用于留痕。
 *
 * 监听器自身抛错会被 Loader 吞掉并警告(值已提交),所以这里再包一层 best-effort,
 * 让"重配置失败"不会变成宿主日志里的噪声。
 *
 * @param ctx - 插件 ctx。
 * @param onChanged - `(paths: string[][]) => void`。
 * @returns 注销器。
 */
export function onVolatileUpdate(ctx, onChanged) {
  if (typeof ctx?.on !== 'function') return () => {}
  try {
    return ctx.on('loader/volatile-update', (paths) => {
      try {
        onChanged(Array.isArray(paths) ? paths : [])
      } catch (error) {
        try {
          process.stderr.write(`[memory] volatile 重配置失败(值已提交,下一轮生效): ${error?.message ?? error}\n`)
        } catch {} // stderr 写不进去(管道已关/宿主重定向)时无处可报,再抛只会污染宿主日志
      }
    })
  } catch {
    // 老宿主无 loader/volatile-update:原地提交仍在,只是热重建延到下次重挂载——降级而非故障
    return () => {}
  }
}
