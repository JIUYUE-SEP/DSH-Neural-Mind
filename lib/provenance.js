/**
 * 来源判定(R13b,0.6.6):"这条是谁说的"不能听模型自报(confirm / stagedBy / raw.source
 * 都是模型可填的参数),只能听**会话原文的角色**(DSH 本体给的,模型改不了)。
 *
 * 三个可信信号(docs/legacy/REVIEW.md R13 / §10 第 16 条):
 *  ① 整理写入:按 sourceRange 回到会话事件流,看这段原文的角色 → 见 `batchRoleOf` /
 *     `resolveExtractedSource`。只有"整段原文全是用户说的"才记 user,混合/助手/工具一律
 *     assistant(宁可低估,不误标用户)。
 *  ② memory_remember:模型可带一段"用户原话引用"(userQuote),工具拿它与本会话真实用户
 *     消息做规范化比对;对得上才记 user,否则 assistant(见 `userQuoteMatches`)。
 *  ③ 用户在界面点确认:工具之外的可信信号,记 `confirmedByUser`,措辞"你确认过"。
 *
 * 旧记录:有 sessionId + sourceRange 的按 ① 重算;没有的标 `source:'unknown'`(来源查不清),
 * 不猜。本模块全部是纯函数,便于单测;读会话/写库在调用方。
 */
import { normalizeContent } from './text.js'
import { eventsToTurnParts, toolCallsOf } from './turns.js'

/** 单个回合的说话角色:`user` 只有用户正文 / `assistant` 只有助手或工具 / `mixed` 两者都有。 */
export function turnRoleOfParts(pkg) {
  const hasUser = Array.isArray(pkg?.userTexts) && pkg.userTexts.length > 0
  const hasAssistant = (Array.isArray(pkg?.assistantTexts) && pkg.assistantTexts.some((t) => typeof t === 'string' && t.trim() !== ''))
    || toolCallsOf(pkg).length > 0
  if (hasUser && !hasAssistant) return 'user'
  if (!hasUser && hasAssistant) return 'assistant'
  if (hasUser && hasAssistant) return 'mixed'
  return 'empty'
}

/**
 * 退化路径(只拿得到渲染后的原文,拿不到回合包)按渲染标题判断角色:
 * 渲染器用 `[用户]` / `[助手]` / `[工具 …]` 开头,这里只读标题行,避免正文里同形字样干扰。
 * 判不准一律按 `mixed`(调用方会保守记 assistant)。
 */
export function turnRoleOfText(text) {
  if (typeof text !== 'string') return 'empty'
  const lines = text.split(/\r?\n/)
  let hasUser = false
  let hasAssistant = false
  for (const line of lines) {
    if (line === '[用户]') hasUser = true
    else if (line === '[助手]' || line.startsWith('[工具 ')) hasAssistant = true
  }
  if (hasUser && !hasAssistant) return 'user'
  if (!hasUser && hasAssistant) return 'assistant'
  if (hasUser && hasAssistant) return 'mixed'
  return 'empty'
}

/**
 * 整批(提炼输入)的说话角色:**只有所有回合都判成 user 才算 user**,其余(混合 / 助手 /
 * 退化判不清)一律 assistant —— 保守方向与 docs/legacy/REVIEW.md R13 一致。
 */
export function batchRoleOf(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 'assistant'
  return roles.every((role) => role === 'user') ? 'user' : 'assistant'
}

/**
 * 整理产物的最终 source。模型的原始声明只用于保留**内容分类**(code/tool/quote 描述的是
 * "从哪类材料看到的",不是"谁说的");user/assistant 这一轴一律由原文角色决定。
 * 非法/缺失的原始声明按 assistant 处理(旧实现默认 user,是这次要修的偏差)。
 */
export function resolveExtractedSource(claimed, batchRole) {
  if (claimed === 'code' || claimed === 'tool' || claimed === 'quote') return claimed
  return batchRole === 'user' ? 'user' : 'assistant'
}

/** userQuote 规范化后的最小有效长度:太短(如"嗯""好")不构成可验证的原话。 */
export const USER_QUOTE_MIN_CHARS = 4

/**
 * userQuote 是否真的出现在本会话的用户消息里(规范化:NFKC + 空白折叠后做子串比对)。
 * @param quote 模型给的原话引用
 * @param userTexts 本会话用户消息正文(由调用方从会话日志取出)
 */
export function userQuoteMatches(quote, userTexts) {
  if (typeof quote !== 'string') return false
  const needle = normalizeContent(quote)
  if (needle.length < USER_QUOTE_MIN_CHARS) return false
  if (!Array.isArray(userTexts)) return false
  return userTexts.some((text) => typeof text === 'string' && normalizeContent(text).includes(needle))
}

/**
 * 会话事件切片([startSeq, endSeq])→ 每回合角色数组,供旧记录回填(R13b ⑤)用。
 * 按 turn/start → turn/end 切段;切片从回合中间开始时,第一段到下一个 turn/end 为止,
 * 判不准的角色自然落到 mixed/empty(最终保守记 assistant)。
 */
export function rolesOfSessionRange(events, startSeq, endSeq) {
  if (!Array.isArray(events) || !Number.isFinite(startSeq) || !Number.isFinite(endSeq)) return []
  const slice = events.filter((e) => Number.isFinite(e?.seq) && e.seq >= startSeq && e.seq <= endSeq)
  const roles = []
  let current = []
  for (const event of slice) {
    if (event?.type === 'turn/start') {
      if (current.length > 0) roles.push(turnRoleOfParts(eventsToTurnParts(current)))
      current = []
      continue
    }
    if (event?.type === 'turn/end') {
      if (current.length > 0) roles.push(turnRoleOfParts(eventsToTurnParts(current)))
      current = []
      continue
    }
    current.push(event)
  }
  if (current.length > 0) roles.push(turnRoleOfParts(eventsToTurnParts(current)))
  return roles
}

/** 来源的人类可读档位(工具回显 / 客户端标签共用同一口径):user / assistant / unknown / confirmed。 */
export function sourceTier(record) {
  if (record?.confirmedByUser === true) return 'confirmed'
  const source = record?.source
  if (source === 'user') return 'user'
  if (source === 'unknown') return 'unknown'
  return typeof source === 'string' && source !== '' ? source : 'assistant'
}
