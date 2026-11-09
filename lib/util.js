/**
 * 通用小工具:时间、id、串行队列、JSON 提取、时间窗解析、原子写入。
 * 纯函数,无外部依赖,方便单测。
 */
import { createHash, randomUUID } from 'node:crypto'
import { rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DAY_MS = 86_400_000

export const nowIso = () => new Date().toISOString()

/**
 * 展开用户配置里的"家目录"写法(§4.1 画像等路径类配置)。
 *
 * - 空串原样返回(表示"未配置");
 * - `~/…`、`~\…` 展开到 homedir;
 * - 光写 `~` / `~/` / `~\` 是非法取值:`~` 指家目录本身,永远不是可写文件。
 *   非法时返回 `{ path: raw, invalid: true }`,由调用方留痕(stderr + 审计),不静默。
 */
export function expandUserPath(raw) {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text === '') return { path: '', invalid: false }
  if (text === '~' || text === '~/' || text === '~\\') return { path: text, invalid: true }
  if (text.startsWith('~/') || text.startsWith('~\\')) {
    return { path: join(homedir(), text.slice(2)), invalid: false }
  }
  return { path: text, invalid: false }
}

/** iso 时间距 nowMs 的天数(可为负)。解析失败返回 +Infinity,让坏时间戳自然沉底。 */
export const ageDays = (iso, nowMs = Date.now()) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : (nowMs - t) / DAY_MS
}

export const addDaysIso = (iso, days) => new Date(Date.parse(iso) + days * DAY_MS).toISOString()

/** per-record layout 的 key 须匹配 /^[a-zA-Z0-9_-]+$/;uuid 含连字符,合规。 */
export const newId = (prefix) => `${prefix}_${randomUUID()}`

export const sha1 = (s) => createHash('sha1').update(s).digest('hex')

export function truncateChars(s, n) {
  if (typeof s !== 'string') return ''
  if (s.length <= n) return s
  return `${s.slice(0, n)}…[截断,原 ${s.length} 字符]`
}

/** 从模型输出里抠出第一个完整 JSON 对象(容忍 ```json 围栏与前后废话)。 */
export function safeJsonExtract(text) {
  if (typeof text !== 'string') return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const value = JSON.parse(body.slice(start, end + 1))
    return value !== null && typeof value === 'object' ? value : null
  } catch {
    // 模型没吐出合法 JSON:按"没提取到"返回 null,由调用方决定降级,不在这里抛
    return null
  }
}

/** 插件内每域一条 async 串行队列:防撕裂,不防丢更新(§3.0)。 */
export class SerialQueue {
  #tail = Promise.resolve()
  /** @param fn () => Promise<T>;fn 抛错不会毒化后续任务。 */
  run(fn) {
    const result = this.#tail.then(fn)
    this.#tail = result.then(() => {}, () => {})
    return result
  }
}

/**
 * recall 的 time 参数解析。支持:
 *   "2026-09-01"               当天
 *   "2026-09-01..2026-09-10"   区间(右端含当天末)
 *   "7d" / "24h"               距今天窗
 * 解析失败返回 null(调用方如实告知模型)。
 */
export function parseTimeWindow(spec, nowMs = Date.now()) {
  if (spec === undefined || spec === null || spec === '') return null
  const s = String(spec).trim()
  const day = /^(\d{4}-\d{2}-\d{2})$/
  const range = s.split('..')
  if (range.length === 2 && day.test(range[0]) && day.test(range[1])) {
    return { from: Date.parse(`${range[0]}T00:00:00Z`), to: Date.parse(`${range[1]}T23:59:59.999Z`) }
  }
  if (day.test(s)) {
    return { from: Date.parse(`${s}T00:00:00Z`), to: Date.parse(`${s}T23:59:59.999Z`) }
  }
  const rel = s.match(/^(\d+)\s*([dh])$/i)
  if (rel) {
    const n = Number(rel[1])
    const ms = rel[2].toLowerCase() === 'd' ? n * DAY_MS : n * 3_600_000
    return { from: nowMs - ms, to: nowMs }
  }
  return null
}

/** 空串/空白判定。 */
export const isBlank = (s) => typeof s !== 'string' || s.trim() === ''

/** 把任意值收成字符串数组(滤掉空项)。 */
export function asStringArray(v) {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
}

/** 防 unhandled rejection 的 fire-and-forget。 */
export function fireAndForget(p, logger, what) {
  Promise.resolve(p).catch((error) => logger.info(`${what} 失败(已忽略): ${error?.message ?? error}`))
}

/**
 * 尽力而为的异步动作:失败**故意不上报**(目标记录可能已被并发删除,或存储正在关闭)。
 *
 * 纪律(v1.9 收口):只有"回写一条可能已不存在的记录""清理临时文件""释放已经没用的句柄"
 * 这类**失败也不影响功能**的地方才用它。其它失败要么走 `fireAndForget`(留一行日志),
 * 要么自己 try/catch 并写清理由或写审计。
 *
 * 它存在的意义是让"我在这里故意吞掉失败"**有名字**:能 grep、能在评审时一眼数清,
 * 而不是散落的 `.catch(() => undefined)`——那种写法读代码时分不出是"有意"还是"忘了处理"。
 */
export function bestEffort(p) {
  return Promise.resolve(p).catch(() => undefined)
}

/**
 * 原子写入:先写同目录临时文件,再 `rename` 覆盖目标。失败时清掉临时文件后**把错误抛出去**
 * (调用方负责如实上报,不在这里吞)。
 *
 * ## 为什么 rename 要重试(实测教训)
 *
 * 这是 Windows 上的**真实产品缺陷**,不是测试噪声:目标文件只要被任何进程持有一个
 * 未共享删除的句柄(编辑器打开着 SOUL.md、杀毒/索引服务正在扫、另一个读取调用还没收尾),
 * `rename` 就返回 `EPERM`/`EBUSY`/`EACCES`,而这个占用**通常只持续几毫秒**。
 * 一次即弃的写法会让 `soul_update`(以及记忆页保存画像)随机报"写入失败",
 * 而 SOUL 的并发回归用例在 Windows 上稳定复现过:`commit` 全部 rename 失败,
 * `current()` 保持旧值——外在表现就是"改了没生效"。
 *
 * 重试次数刻意保守(4 次、指数退避 ~290ms 上限):写盘处在用户可感知的路径上,
 * 宁可快速失败让人看见,也不要长时间静默挂住。
 *
 * @param path - 目标文件(必须已存在或可在同目录创建)。
 * @param content - 写入内容。
 * @param options - `mode`(默认 0600)与 `retries`(默认 4)。
 * @returns 实际使用的临时文件路径(仅供诊断;正常路径下已被 rename 掉)。
 */
export async function writeFileAtomic(path, content, options = {}) {
  const { mode = 0o600, retries = 4 } = options
  const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    await writeFile(tmp, content, { encoding: 'utf8', mode })
    await renameWithRetry(tmp, path, retries)
    return tmp
  } catch (error) {
    // 半成品必须当场清掉:rename 失败(目标被占/跨设备/指到目录)时临时文件会留下
    await bestEffort(unlink(tmp))
    throw error
  }
}

/**
 * 带退避重试的 rename:只重试**占用类**错误(Windows 的瞬时锁),其余(ENOENT/EXDEV/…)立即抛。
 * 判据写在 `error.code` 上,不匹配错误消息文本。
 */
async function renameWithRetry(from, to, retries) {
  const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES'])
  let delayMs = 10
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (attempt >= retries || !TRANSIENT.has(error?.code)) throw error
      await new Promise((resolve) => { setTimeout(resolve, delayMs) })
      delayMs *= 2
    }
  }
}

/**
 * 写入后补 embedding(§5):available() 探测 → embedChunks → 回填 chunks 与模型指纹并同步内存语料。
 * 失败口径与原内联写法一致:embed 失败静默(重嵌入兜底),update 走 bestEffort(记录可能已并发删除)。
 * 抽取自 extract/tools 两处逐字重复(D2)——漏改一处会让该路径写入的记忆不带向量、静默只剩 BM25。
 */
export async function embedAfterWrite({ embedder, store, search, logger, skip = false }, record, content, label) {
  if (skip === true || record.hidden === true || record.status === 'archived') return
  if (!(await embedder.available())) return
  fireAndForget(
    embedder.embedChunks(content).then(async (chunks) => {
      if (chunks === undefined) return
      const updated = await bestEffort(store.memories
        .update(record.id, (cur) => ({ ...cur, chunks, embeddingModel: embedder.model })))
      if (updated !== undefined) search.upsertMemory(updated)
    }),
    logger,
    label,
  )
}
