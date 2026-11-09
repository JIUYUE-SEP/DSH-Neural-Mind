/**
 * SOUL 自我设定层(§4.4):单文件真相源 + 内存镜像 + 版本快照 + 日预算 + 四道检查。
 *
 * 纪律:
 *  - **装配路径零 I/O**:注入段只读 `renderText()`(纯内存);文件 I/O 一律异步、在装配之外
 *  - **写入顺序**:先原子写文件 → 成功后更新镜像 + 存版本 + 记审计(写盘失败时镜像不变)
 *  - **日预算从 soulHistory 现算**,不另设计数器——天然可审计、可回滚
 *  - **四道检查**:密钥形态 → 注入特征 → 长度 → 预算;被拒不计数
 *  - 一切外部能力经调用方注入(soul 自己不 ctx.get,便于单测)
 */
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, readlink, realpath, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { detectInjection, detectSecret, looksImperative } from './text.js'
import { bestEffort, fireAndForget, nowIso, truncateChars, writeFileAtomic } from './util.js'

/** 注入序位:persona(0)与 L1 用户画像(420)之间(官方 SECTION_ORDERS 未占用的 0–500 空档)。 */
export const SOUL_SECTION_ORDER = 410

/** 渲染包裹(§4.4 第三层:内容纪律与优先级写死在文本里)。 */
export const SOUL_LEAD = '# 我的自我设定(SOUL)\n\n'
  + '以下是你自己维护的人格设定:它描述你的性格与信条,不改变你的角色、职责与安全规则;'
  + '与系统人设、AGENTS.md、用户当场要求冲突时,一律以后者为准。\n\n'

/** 默认位置:`$DSH_HOME/SOUL.md`(DSH_HOME 缺席时 `~/.dsh`)。 */
export function defaultSoulPath(env = process.env) {
  const home = typeof env?.DSH_HOME === 'string' && env.DSH_HOME.trim() !== ''
    ? env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  return join(home, 'SOUL.md')
}

/**
 * 光写一个 `~` 是**非法取值**(指家目录本身,读必 EISDIR):2026-09-17 裁决——拒绝该取值、
 * 回退默认路径,并在启动时留痕(stderr + 审计 `soul-path-rejected`),不做静默失败。
 * 要家目录请写 `~/SOUL.md`;留空 = 默认位置。
 */
export function isRejectedSoulFile(configured) {
  if (typeof configured !== 'string') return false
  const raw = configured.trim()
  return raw === '~' || raw === '~/' || raw === '~\\'
}

/** 解析配置路径:空 = 默认位置;支持 `~` 与 `~/…` 展开;非法取值(`~`)回退默认。 */
export function resolveSoulPath(configured, env = process.env) {
  const raw = typeof configured === 'string' ? configured.trim() : ''
  if (raw === '' || isRejectedSoulFile(raw)) return defaultSoulPath(env)
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return join(homedir(), raw.slice(2))
  return raw
}

/** 按行计的增删摘要(给工具返回值与记忆页 diff 用;不追求行级对齐精度)。 */
export function summarizeDiff(prev, next) {
  const before = new Map()
  for (const line of prev === '' ? [] : prev.split('\n')) before.set(line, (before.get(line) ?? 0) + 1)
  let added = 0
  for (const line of next === '' ? [] : next.split('\n')) {
    const left = before.get(line) ?? 0
    if (left > 0) before.set(line, left - 1)
    else added += 1
  }
  let removed = 0
  for (const [, left] of before) removed += left
  return { added, removed, beforeChars: prev.length, afterChars: next.length }
}

/** UTC 日界(预算口径;写进配置描述)。 */
const dayOf = (iso) => (typeof iso === 'string' ? iso.slice(0, 10) : '')

/**
 * 建 SOUL 运行时。
 * @param {object} deps - 依赖注入面。
 * @param {object} deps.cfg - 插件配置(soul* 与 injectionGuard)。
 * @param {object} deps.store - `openStore` 结果(用 `soulHistory` 表)。
 * @param {object} deps.audit - 审计写入器(`write(kind, detail, sessionId)`)。
 * @param {object} deps.logger - 插件 logger。
 * @param {object} [deps.env] - 环境变量(测试注入;默认 process.env)。
 * @returns SOUL 运行时。
 */
export function createSoul({ cfg, store, audit, logger, env = process.env }) {
  const path = resolveSoulPath(cfg.soulFile, env)
  /**
   * 注入段读取的唯一对象;**可变 holder**——热重建后老会话仍读新文本(§4.4 核心实现点)。
   * `mirror.text` 保存**文件原文**(含尾部换行):变更检测按原文逐字比对,
   * 这样"自己刚写完"不会被下一次轮询误判成外部修改;对外语义用 `current()`(归一化)。
   * 刻意不存 mtime:mtime 精度与"同一秒内改两次"都会骗人,内容比对才是真相(文件 ≤ soulMaxChars,代价可忽略)。
   */
  const mirror = { text: '', loaded: false }
  let lastPollMs = 0
  let housekeepingDone = false
  /**
   * 提交版本号:每次成功写盘 +1。
   * 用途是**读盘期间的栅栏**——refresh 读盘是异步的,若期间发生过本进程的 commit,
   * 那份陈旧的读盘结果绝不能覆盖镜像(否则刚保存的内容会从注入里消失,还会记出一条假 external 版本)。
   */
  let commitRev = 0
  /** 提交串行链:日预算是"读计数→写盘",并发提交必须排队,否则同轮多次调用可突破配额。 */
  let commitChain = Promise.resolve()

  const normalize = (text) => (typeof text === 'string' ? text.trim() : '')

  const ORPHAN_MIN_AGE_MS = 10 * 60_000

  /**
   * 真实读写路径:**跟随符号链接**(常见用法 `~/.dsh/SOUL.md → ~/dotfiles/SOUL.md`)。
   * 早先版本只拒读链接,结果是"链接无效 + 保存时把链接替换成普通文件"——比不做更糟,
   * 且收益≈0(本机单人模型下用户本来就能直接编辑 SOUL.md)。故两侧统一解引用。
   */
  async function targetPath() {
    let info
    try {
      info = await lstat(path)
    } catch {
      return path // 不存在:按原路径创建
    }
    if (!info.isSymbolicLink()) return path
    try {
      return await realpath(path)
    } catch {
      // 悬挂链接:按链接指向创建目标,别把链接本身覆盖掉
      try {
        const link = await readlink(path)
        return isAbsolute(link) ? link : resolve(dirname(path), link)
      } catch {
        // 连 readlink 都失败(权限/竞态):退回原路径,不比现状更差
        return path
      }
    }
  }

  async function readDisk() {
    const target = await targetPath()
    try {
      return await readFile(target, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return '' // 文件不存在 = 无 SOUL 层,不是错误
      throw error
    }
  }

  /** 进程存活探测(孤儿清理用):ESRCH = 进程不在。 */
  function pidAlive(pid) {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      return error?.code === 'EPERM' // 存在但无权限 → 视为存活
    }
  }

  /**
   * 清理"先写临时文件再改名"留下的孤儿(进程在两步之间被杀时才会出现)。
   * **只清够旧的**:同目录可能有另一个进程正在写自己的临时文件,按前缀无差别删除会误删它,
   * 导致对方 rename ENOENT、写入失败;也会误删用户手工留下的 `.tmp-*` 备份。
   */
  async function cleanupOrphans(nowMs = Date.now()) {
    // 前缀必须按**真实目标**算:临时文件名是 `${target}.tmp-…`,而 target 是 realpath
    // (写盘跟随符号链接)。用配置里那个链接名的 basename 当前缀,dotfiles 布局下永远对不上,
    // 孤儿就永远清不掉(2026-09-17 一致性复核补)。
    const target0 = await targetPath()
    const dir = dirname(target0)
    const prefix = `${basename(target0)}.tmp-`
    let entries
    try {
      entries = await readdir(dir)
    } catch {
      return // 目录还不存在 = 从没写过,无残留
    }
    for (const entry of entries) {
      if (!entry.startsWith(prefix)) continue
      const full = join(dir, entry)
      try {
        const info = await lstat(full)
        if (!info.isFile()) continue
        // 文件名带 pid:进程还活着 → 对方正在写,绝不碰;进程已死 → 立即清理;
        // 解析不出 pid(旧版本残留/别的机器)才退回"超时才清"
        const pid = /[.]tmp-(\d+)-/.exec(entry)?.[1]
        const ownerGone = pid !== undefined ? !pidAlive(Number(pid)) : false
        const tooOld = nowMs - info.mtimeMs >= ORPHAN_MIN_AGE_MS
        if (!ownerGone && !tooOld) continue
        await unlink(full)
        await audit.write('soul-orphan-cleaned', `清理写入残留: ${entry}${ownerGone ? '(属主进程已退出)' : '(超时)'}`)
      } catch {
        // 清理失败不影响功能,下次启动再试
      }
    }
  }

  /**
   * 注入用文本(装配路径唯一入口,纯内存)。
   * 关闭开关 / 空文件 → 返回空串(**渲染层**按 length>0 过滤掉,不是注册表丢弃;
   * 注意作用域内的空段会遮蔽同名全局段,故别在全局层注册同名段)。
   */
  function renderText() {
    if (cfg.soulEnabled === false) return ''
    const body0 = normalize(mirror.text)
    if (body0 === '') return ''
    const body = body0.length <= cfg.soulMaxChars
      ? body0
      : `${body0.slice(0, cfg.soulMaxChars)}\n\n…(已截断:超过 soulMaxChars=${cfg.soulMaxChars})`
    return `${SOUL_LEAD}${body}`
  }

  /** 当前内容(归一化;给 API / 记忆页 / 工具返回值用)。 */
  function current() {
    return normalize(mirror.text)
  }

  function rows() {
    return [...store.soulHistory.entries()].map(([, row]) => row)
  }

  /** 历史(新→旧)。 */
  function history(limit = 50) {
    const list = rows()
    list.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    return list.slice(0, Math.max(0, limit))
  }

  /** 今日成功自改次数(按 soulHistory 现算;被拒不写表,故天然不计数)。 */
  function dailyUsed() {
    const today = dayOf(nowIso())
    let used = 0
    for (const row of rows()) if (row.author === 'agent' && dayOf(row.ts) === today) used += 1
    return used
  }

  /**
   * 裁剪版本快照。
   * **当日条目不动**:日预算由本表现算,若把今天的 `author=agent` 行裁掉,配额会凭空重置
   * (M2 实测:灌 40 次变更后 dailyUsed 由 5 → 0)。裁剪只对更早的日子生效。
   * 条数下界 10:设成 1 会把回滚锚点全裁掉,与"历史不删"的承诺相悖。
   */
  async function trimHistory() {
    const max = Math.max(10, Number(cfg.soulHistoryMaxEntries) || 50)
    const today = dayOf(nowIso())
    const list = rows()
    if (list.length <= max) return
    list.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
    const excess = list.length - max
    let removed = 0
    for (const row of list) {
      if (removed >= excess) break
      if (dayOf(row.ts) === today) continue // 当日行是预算依据,不裁
      await store.soulHistory.delete(row.id)
      removed += 1
    }
  }

  /** 快照理由的净化:限长 + 密钥/注入特征过滤(理由会进版本、审计与记忆页回显)。 */
  const REASON_MAX_CHARS = 200
  function sanitizeReason(reason) {
    if (typeof reason !== 'string') return { reason: undefined }
    const trimmed = reason.trim()
    if (trimmed === '') return { reason: undefined }
    const secret = detectSecret(trimmed)
    const injection = cfg.injectionGuard?.enabled === false ? null : detectInjection(trimmed, cfg.injectionGuard?.extraPatterns ?? [])
    if (secret !== null || injection !== null) {
      const why = secret !== null ? `密钥形态(${secret})` : `注入特征(${injection})`
      return { reason: `(理由已过滤:${why})`, filtered: why, raw: truncateChars(trimmed, 60) }
    }
    return { reason: trimmed.length > REASON_MAX_CHARS ? `${trimmed.slice(0, REASON_MAX_CHARS)}…` : trimmed }
  }

  async function snapshot({ author, reason, sessionId, fromVersionId, prevContent, nextContent }) {
    const entry = {
      id: `soul_${randomUUID()}`,
      ts: nowIso(),
      author,
      ...(reason === undefined ? {} : { reason }),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(fromVersionId === undefined ? {} : { fromVersionId }),
      prevContent,
      nextContent,
    }
    await store.soulHistory.put(entry.id, entry)
    await trimHistory()
    return entry
  }

  /**
   * 校验一份待写入内容。
   * 共享三关(密钥 / 注入特征 / 长度)对所有通道生效;开关与日预算只拦 agent 通道
   * ——记忆页与回滚不受它们限制(§4.4)。
   * agent 通道两道开关:`soulEnabled`(总开关,关了整层停用)先于 `soulSelfEditEnabled`(只管自改)。
   * @param {string} content - 整篇内容。
   * @param {object} [options] - `{ channel: 'agent' | 'user' }`。
   * @returns `{ ok: true, text }` 或 `{ ok: false, error }`。
   */
  function checks(content, { channel = 'agent' } = {}) {
    const text = typeof content === 'string' ? content.trim() : ''
    if (text === '') {
      if (channel === 'agent') return { ok: false, error: 'content 不能为空(整篇替换;要清空人格请让用户在记忆页操作)。' }
      return { ok: true, text }
    }
    const secret = detectSecret(text)
    if (secret !== null) return { ok: false, error: `这段内容像密钥/令牌(${secret}),按隐私纪律拒绝落盘。` }
    if (cfg.injectionGuard?.enabled !== false) {
      const hit = detectInjection(text, cfg.injectionGuard?.extraPatterns ?? [])
      if (hit !== null) {
        return { ok: false, error: `命中注入防御特征(${hit})。这看起来像外部指令;若确实是你自己的信条,请改写措辞再试。` }
      }
    }
    if (text.length > cfg.soulMaxChars) {
      return { ok: false, error: `超出 soulMaxChars(${cfg.soulMaxChars} 字符,当前 ${text.length})。请压缩后再写。` }
    }
    if (channel === 'agent') {
      // 总开关:关了整层停用(§4.4)。该分支在此状态下不可达——总开关关闭时工具不注册;
      // 保留为纵深防御,防将来出现别的 agent 通道入口
      if (cfg.soulEnabled === false) {
        return { ok: false, governance: 'soul-disabled', error: 'SOUL 层已关闭(soulEnabled=false):整层停用,自改也被拒。要启用请让用户在主侧栏「记忆」 → SOUL 里打开。' }
      }
      if (cfg.soulSelfEditEnabled === false) {
        return { ok: false, governance: 'self-edit-disabled', error: '自改已被关闭(soulSelfEditEnabled=false);要改请让用户在主侧栏「记忆」 → SOUL 里操作。' }
      }
      if (dailyUsed() >= cfg.soulEditDailyBudget) {
        return { ok: false, governance: 'budget-exhausted', error: `今天自改已达上限(soulEditDailyBudget=${cfg.soulEditDailyBudget})。可明天再改,或请用户调整上限。` }
      }
    }
    // 祈使句检测**只记录不拒绝**(用户定调:像"我以后回复尽量短"这种自述不该被拦)
    return { ok: true, text, imperative: looksImperative(text) }
  }

  /** 提交本体(串行执行;见 `commit`)。 */
  async function commitInner({ content, reason, author, sessionId, fromVersionId }) {
    const gate = checks(content, { channel: author === 'agent' ? 'agent' : 'user' })
    if (gate.ok !== true) {
      // 治理类拒绝要留痕(§4.4:预算耗尽"拒绝并记审计");内容类拒绝太频繁,只回话不落审计
      if (gate.governance !== undefined) {
        fireAndForget(audit.write(`soul-rejected`, `${gate.governance}:${truncateChars(String(content), 60)}`, sessionId), logger, 'memory: soul 拒绝审计')
      }
      return { ok: false, error: gate.error }
    }
    const text = gate.text
    const clean = sanitizeReason(reason)
    const prev = normalize(mirror.text)
    const fileText = text === '' ? '' : `${text}\n`
    const target = await targetPath() // 跟随符号链接:别把用户的链接替换成普通文件
    try {
      await mkdir(dirname(target), { recursive: true })
      // 0600:与记忆存储同一隐私姿态(落盘明文,威胁模型是本机单人使用)
      // 原子替换 + 占用类错误重试:Windows 上目标被任何句柄占住时 rename 会 EPERM,
      // 一次即弃会让 soul_update 随机失败(见 util.js 的 writeFileAtomic 说明)
      await writeFileAtomic(target, fileText)
    } catch (error) {
      logger.info(`memory: SOUL 写入失败(${path}): ${error?.message ?? error}`)
      await audit.write('soul-write-failed', `${path}: ${error?.message ?? error}`, sessionId)
      return { ok: false, error: `写入 ${path} 失败:${error?.message ?? error}(内容未生效)` }
    }
    mirror.text = fileText // 与磁盘逐字一致:自己写的不会被误判成外部修改
    mirror.loaded = true
    commitRev += 1 // 读盘栅栏:见 refresh
    if (gate.imperative === true) {
      await audit.write('soul-imperative-flagged', `内容含祈使句(仅记录,不拒绝): ${truncateChars(text, 80)}`, sessionId)
    }
    const entry = await snapshot({ author, reason: clean.reason, sessionId, fromVersionId, prevContent: prev, nextContent: text })
    if (clean.filtered !== undefined) {
      await audit.write('soul-reason-filtered', `理由命中 ${clean.filtered}: ${clean.raw ?? ''}`, sessionId)
    }
    await audit.write('soul-update', `${author} ${prev.length}→${text.length} 字符${clean.reason === undefined ? '' : ` — ${clean.reason}`}`, sessionId)
    return { ok: true, id: entry.id, ts: entry.ts, chars: text.length, diff: summarizeDiff(prev, text) }
  }

  /**
   * 写一份新内容:检查 → 原子写文件 → 更新镜像 → 存版本 → 记审计。
   * **串行化**:日预算是"读计数 → 写盘"两步,并发提交会一起读到旧计数而全部通过
   * (实测 budget=2 时 6 次并发全部成功);这里用一条 promise 链把提交排队,
   * 让 `checks()` 里的预算判定发生在临界区内。
   * 写盘失败时镜像不变(不出现"改了但没落盘"的假象)。
   * @param {object} input - `{ content, reason?, author, sessionId?, fromVersionId? }`。
   * @returns `{ ok, ... }`。
   */
  function commit(input) {
    const run = commitChain.then(() => commitInner(input), () => commitInner(input))
    commitChain = run.then(() => undefined, () => undefined)
    return run
  }

  /**
   * 读盘刷新镜像;首次加载不记版本,之后每次内容变化记一版 `external`。
   * @param {string} trigger - 触发来源(boot / agent / poll / settings / manual),进审计。
   * @returns `{ changed, external }`。
   */
  async function refresh(trigger = 'manual') {
    const rev = commitRev // 读盘前的提交版本(栅栏)
    let disk
    try {
      disk = await readDisk()
    } catch (error) {
      logger.info(`memory: SOUL 文件读不到(${path}): ${error?.message ?? error}`)
      await audit.write('soul-read-failed', `${path}: ${error?.message ?? error}`)
      return { changed: false, external: false }
    }
    if (rev !== commitRev) {
      // 读盘期间本进程写过盘:这份读盘结果已经过期,丢掉它
      // ——否则会把刚保存的内容从镜像里"回退"掉,还会记出一条假 external 版本(实测 10/10 复现)
      return { changed: false, external: false, discarded: true }
    }
    if (normalize(disk).length > cfg.soulMaxChars) {
      // 兑现 §10 的承诺:注入会截断,但截断这件事本身要留痕(装配路径不能写审计,故在刷新时记)
      fireAndForget(
        audit.write('soul-oversize', `SOUL 内容 ${normalize(disk).length} 字符 > soulMaxChars=${cfg.soulMaxChars},注入将截断`),
        logger,
        'memory: SOUL 超长审计',
      )
    }
    if (trigger === 'boot' && !housekeepingDone) {
      housekeepingDone = true
      await cleanupOrphans() // 只在启动时扫一次目录,不进轮询与装配路径
    }
    const first = mirror.loaded !== true
    const prevRaw = mirror.text
    mirror.text = disk
    mirror.loaded = true
    if (first) return { changed: normalize(disk) !== '', external: false }
    if (disk === prevRaw) return { changed: false, external: false }
    const prevText = normalize(prevRaw)
    const nextText = normalize(disk)
    await snapshot({ author: 'external', reason: `外部修改(${trigger})`, prevContent: prevText, nextContent: nextText })
    await audit.write('soul-external', `SOUL 外部变更(${trigger}): ${prevText.length}→${nextText.length} 字符`)
    return { changed: true, external: true }
  }

  /**
   * 按最小间隔探测外部手改(pre-step 调用;间隔 `soulPollSeconds`)。
   * @param {number} [nowMs] - 当前毫秒(测试注入)。
   * @returns `{ changed, external }`。
   */
  async function pollIfDue(nowMs = Date.now()) {
    const gapMs = Math.max(0, Number(cfg.soulPollSeconds) || 0) * 1000
    if (nowMs - lastPollMs < gapMs) return { changed: false, external: false }
    lastPollMs = nowMs
    return refresh('poll')
  }

  /**
   * 回滚:把某一版之前的旧内容写回,**产生新版本**,不删历史(§4.4)。
   * @param {string} id - 版本条目 id。
   * @param {string} [sessionId] - 操作来源会话。
   */
  async function rollback(id, sessionId) {
    const entry = store.soulHistory.get(id)
    if (entry === undefined) return { ok: false, error: `没有找到版本 ${id}。` }
    return commit({
      content: entry.prevContent,
      reason: `回滚到 ${id} 之前的版本`,
      author: 'user',
      sessionId,
      fromVersionId: id,
    })
  }

  return {
    path,
    mirror,
    renderText,
    current,
    checks,
    commit,
    refresh,
    pollIfDue,
    history,
    dailyUsed,
    rollback,
  }
}
