/**
 * SOUL 提议周回顾(§4.4「节奏:信号 → 周回顾」)——**纯函数、无 I/O**。
 *
 * 背景:人格提议从"每次提炼都可能产出"降频为"每周最多一次",且证据必须跨天。
 * 平时后台提炼器只把**用户原话**收进 `soul_signals`(候选证据,不是提议);
 * 只有周回顾那一次(距上次回顾满间隔 **且** 保留期内 ≥2 条信号 **且** 信号跨 ≥2 个 UTC 日)
 * 才允许把信号归纳成一句正式提议。
 *
 * 这一层只做判定与 prompt 文本拼装;写盘、审计、入库都在 lib/extract.js,
 * 所以间隔/保留期/跨天判定可以脱离存储单测(见 test/soulreview.test.mjs)。
 */
import { DAY_MS as UTIL_DAY_MS } from './util.js'

/** 一天的毫秒数(与 lib/util.js 同值;本模块独立导出,便于按本契约单测)。 */
export const DAY_MS = UTIL_DAY_MS

/** 周回顾 prompt 块的字符上限(含固定规则;§4.4)。 */
const REVIEW_BLOCK_MAX_CHARS = 1200
/** 信号最多列 12 条、过去提议最多列 5 条(§4.4;周回顾不是把整池倒进 prompt)。 */
const SIGNAL_MAX_LINES = 12
const HISTORY_MAX_LINES = 5
/** 每条材料单独截断,避免一条长原话吃光整个块预算。 */
const SIGNAL_QUOTE_MAX_CHARS = 80
const HISTORY_CONTENT_MAX_CHARS = 60
const SOUL_EXCERPT_MAX_CHARS = 240
/** 回执历史:最多 3 条、每条原话截 80 字符(工具回话要能一屏读完,§4.4)。 */
const IGNORED_DEFAULT_LIMIT = 3
const IGNORED_CONTENT_MAX_CHARS = 80

const HEADER = '【周回顾】这是每周一次的 SOUL 回顾,不是普通提炼:平时只收集人格信号(用户原话),只有这一轮允许产出正式提议。'

/** 规则写死在文本里(不是靠模型自觉):跨天重复、判断形态、宁缺毋滥。 */
const RULES = [
  '规则(写死):',
  '① 同类信号必须在**跨天**出现 ≥2 次才算重复;同一天说两遍不算。',
  '② 提议必须写成**判断**:冲突时选哪边 + 依据 + 什么时候会害我——不是"遇到 X 就做 Y"的情形规则。',
  '③ 没有新东西就给 null,不要为了产出而产出。',
].join('\n')

/** ISO 时间 → 毫秒;坏值返回 null(不猜)。 */
function safeMs(ts) {
  const ms = Date.parse(typeof ts === 'string' ? ts : '')
  return Number.isNaN(ms) ? null : ms
}

/** ISO 时间 → UTC 日期 `YYYY-MM-DD`;坏值标"日期未知"(不静默丢条目)。 */
function dayOf(ts) {
  const ms = safeMs(ts)
  return ms === null ? '日期未知' : new Date(ms).toISOString().slice(0, 10)
}

/** 压成一行并截断:prompt 里的每条材料必须占一行,免得原话里的换行把结构撞散。 */
function clip(value, maxChars) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`
}

/**
 * 最近一次周回顾的时间(扫 `audit` 里 `kind === 'soul-review-run'` 的记录,取最大 ts)。
 * 没有则返回 ''。ISO 字符串同格式可直接字面比较(nowIso 恒为 `toISOString()`)。
 */
export function lastReviewTs(store) {
  let latest = ''
  for (const [, entry] of store?.audit?.entries?.() ?? []) {
    if (entry?.kind !== 'soul-review-run') continue
    const ts = typeof entry.ts === 'string' ? entry.ts : ''
    if (ts > latest) latest = ts
  }
  return latest
}

/**
 * 被忽略过的 SOUL 提议(§4.4「回执」):给 `soul_propose` 的入场券判定用。
 *
 * 判定口径:
 *  - 记录侧:`entity === 'soul'`、`hidden !== true`、`status === 'archived'`;
 *  - 忽略判定:`soulDecision === 'ignored'`;**老记录没有该字段**时按审计兜底——
 *    存在 `kind === 'soul-proposal-ignored'` 且 detail 以该记录 id 开头的审计;
 *  - `soulDecision === 'adopted'` 的归档记录永远不算被忽略(新字段优先于审计)。
 *
 * 新 → 旧排序,取最新 `limit` 条;`note` 取 `soulNote`(用户忽略时填的理由),
 * `content` 截断到 80 字符——工具要能把历史连同理由一起回给模型。
 *
 * @param {object} store - 需要 `memories` 与 `audit` 两张表
 * @param {{ limit?: number }} [options]
 * @returns {{ id: string, ts: string, content: string, note?: string }[]}
 */
export function ignoredHistory(store, { limit = IGNORED_DEFAULT_LIMIT } = {}) {
  // 审计兜底集合:只认 detail 以 id 开头(写入侧格式 `${id}: …`),避免正文里恰好提到别的 id。
  const auditedIgnored = new Set()
  for (const [, entry] of store?.audit?.entries?.() ?? []) {
    if (entry?.kind !== 'soul-proposal-ignored') continue
    const detail = typeof entry.detail === 'string' ? entry.detail.trim() : ''
    if (detail === '') continue
    const id = detail.split(/[\s:：(（]/u)[0]
    if (id !== '') auditedIgnored.add(id)
  }

  const rows = []
  for (const [id, record] of store?.memories?.entries?.() ?? []) {
    if (record === null || typeof record !== 'object') continue
    if (record.entity !== 'soul' || record.hidden === true || record.status !== 'archived') continue
    const ignored = record.soulDecision === 'ignored'
      || (record.soulDecision === undefined && auditedIgnored.has(id))
    if (!ignored) continue
    rows.push({
      id,
      ts: typeof record.createdAt === 'string' ? record.createdAt : (typeof record.eventTime === 'string' ? record.eventTime : ''),
      content: clip(record.content, IGNORED_CONTENT_MAX_CHARS),
      note: typeof record.soulNote === 'string' ? record.soulNote : undefined,
    })
  }
  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
  const max = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : IGNORED_DEFAULT_LIMIT
  return rows.slice(0, max)
}

/**
 * 周回顾到期判定:没有上次记录 → 立即到期;距上次不足 intervalDays → 未到期。
 * `intervalDays` 非正/非数按"每次都可回顾"处理(配置防线,不静默变成永不触发)。
 */
export function isReviewDue({ lastRunTs, nowMs, intervalDays }) {
  if (typeof lastRunTs !== 'string' || lastRunTs.trim() === '') return true
  const last = safeMs(lastRunTs)
  if (last === null) return true
  const now = Number.isFinite(nowMs) ? nowMs : Date.now()
  const days = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 0
  return now - last >= days * DAY_MS
}

/**
 * 取保留期内的人格信号,按 ts 升序返回(旧 → 新)。
 * `retentionDays` 为 0/负数时**不按时间裁剪**(与 usageRetentionDays「0=不清理」同口径)。
 */
export function collectSignals(store, { nowMs = Date.now(), retentionDays = 30 } = {}) {
  const cutoff = Number.isFinite(retentionDays) && retentionDays > 0 ? nowMs - retentionDays * DAY_MS : null
  const rows = []
  for (const [, row] of store?.soulSignals?.entries?.() ?? []) {
    if (row === null || typeof row !== 'object') continue
    if (cutoff !== null) {
      const ms = safeMs(row.ts)
      if (ms === null || ms < cutoff) continue
    }
    rows.push(row)
  }
  return rows.sort((a, b) => {
    const left = typeof a.ts === 'string' ? a.ts : ''
    const right = typeof b.ts === 'string' ? b.ts : ''
    return left < right ? -1 : left > right ? 1 : 0
  })
}

/** 信号覆盖的天数(按 UTC 日期去重计数;跨天证据是"重复"判据的硬前提)。 */
export function signalSpanDays(signals) {
  const days = new Set()
  for (const signal of signals ?? []) {
    const ms = safeMs(signal?.ts)
    if (ms === null) continue
    days.add(new Date(ms).toISOString().slice(0, 10))
  }
  return days.size
}

/**
 * 周回顾 prompt 块(≤1200 字符):说明这是周回顾 + 本周信号 + 过去提议的结局 + 写死的三条规则。
 *
 * 预算不够时按"先缩当前 SOUL 摘要(辅助材料)→ 再丢最旧的提议 → 最后才丢最老的信号"的顺序腾地方:
 * 信号是这一轮要归纳的**证据**,不能被辅助材料挤掉——至少保留最近 2 条(周回顾的前提就是 ≥2 条),
 * 而规则与头尾说明永远保留。
 *
 * @param {object} input
 * @param {object[]} input.signals - `{ ts, quote, ... }`,旧 → 新。
 * @param {object[]} input.history - `{ ts, status, content }`,新 → 旧。
 * @param {string} input.soulText - 当前 SOUL(只取摘要,防重复提议)。
 * @returns {string} 中文 prompt 文本,长度 ≤ 1200。
 */
export function buildReviewBlock({ signals = [], history = [], soulText = '' } = {}) {
  const signalLines = (Array.isArray(signals) ? signals : [])
    .slice(-SIGNAL_MAX_LINES)
    .map((signal) => `- ${dayOf(signal?.ts)}: ${clip(signal?.quote, SIGNAL_QUOTE_MAX_CHARS)}`)
  const historyLines = (Array.isArray(history) ? history : [])
    .slice(0, HISTORY_MAX_LINES)
    .map((row) => `- ${dayOf(row?.ts)} [${clip(row?.status, 20)}] ${clip(row?.content, HISTORY_CONTENT_MAX_CHARS)}`)
  let soulExcerpt = clip(soulText, SOUL_EXCERPT_MAX_CHARS)

  const render = () => [
    HEADER,
    '',
    RULES,
    '',
    '本周人格信号(用户原话,旧 → 新):',
    ...(signalLines.length > 0 ? signalLines : ['(无)']),
    '',
    '过去的提议及结局(新 → 旧):',
    ...(historyLines.length > 0 ? historyLines : ['(无)']),
    '',
    `当前 SOUL(摘要,避免重复提议):${soulExcerpt === '' ? '(空)' : soulExcerpt}`,
  ].join('\n')

  let text = render()
  // ① 先缩当前 SOUL 摘要(防重复是辅助目标,材料不够时让位)
  //    必须有"没变化就停"的栅栏:clip(x, 0) 返回的是 "…"(长度 1)而不是空串,
  //    只靠 soulExcerpt.length > 0 判定会在"摘要已缩到底、材料仍然超长"时死循环。
  while (text.length > REVIEW_BLOCK_MAX_CHARS && soulExcerpt.length > 0) {
    const next = clip(soulExcerpt, Math.max(0, soulExcerpt.length - 80))
    if (next === soulExcerpt) break
    soulExcerpt = next
    text = render()
  }
  // ② 再丢最旧的提议(pop:history 是新 → 旧)
  while (text.length > REVIEW_BLOCK_MAX_CHARS && historyLines.length > 0) {
    historyLines.pop()
    text = render()
  }
  // ③ 最后才丢最老的信号(shift);保留最近 2 条——没有证据的"周回顾"不该发生
  while (text.length > REVIEW_BLOCK_MAX_CHARS && signalLines.length > 2) {
    signalLines.shift()
    text = render()
  }
  // 兜底:固定部分自身就该在预算内;真超了也不返回超长文本(规则留在前半段)
  return text.length <= REVIEW_BLOCK_MAX_CHARS ? text : `${text.slice(0, REVIEW_BLOCK_MAX_CHARS - 1)}…`
}
