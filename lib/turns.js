/**
 * 回合累积(§3.0/§3.1):从 session/event 流自行累积本会话原文(live 会话);
 * turn/end 按 reason 过滤:收 `completed` 与 `max-tokens`(后者标 `truncated`),其余废轮不进。
 * 禁用 eventAt/snapshotEvents/ownEvents(§3.0);冷会话原文由调用方走 ctx.sessionQuery。
 */
import { blocksToText } from './text.js'

const MAX_CACHED_TURNS_PER_SESSION = 30
const MAX_SESSIONS = 50

/**
 * 收哪些 turn/end。
 * `max-tokens` = 至少一个 step 撞到输出上限(DSH 语义:**即使插件随后把这一轮续完了**也会这么盖)——
 * 2026-09-17 裁决:收下并标 `truncated`,由热缓冲正文标记 + 提炼 prompt 提示消化"结尾可能是半句"的风险;
 * `blocked`/`aborted`/`error` 仍是废轮,`interrupted` 是崩溃补写(loop 不实时发出)。
 */
const ACCEPTED_END_KINDS = new Set(['completed', 'max-tokens'])

function newTurnBuffer(turn, startSeq) {
  return {
    turn,
    startSeq,
    userTexts: [],
    assistantTexts: [],
    thinkingTexts: [],
    /** @type Map<string, { name, args, output, isError }> */
    toolCalls: new Map(),
  }
}

/**
 * tool/result → `{ callId, output, isError }`;不认识的形状返回 null(不造半条记录)。
 *
 * 两代表示都要认(DSH 0.2.0-rc.1 起写 Session 格式 V4):
 *  - **V4(当前)**:`data.message` 是 tool 角色消息,`toolCallId` / `isError` 在消息**顶层**,
 *    `content` 直接是内容块数组;V3 的 `tool-result` 包装块在 V4 是被拒绝的退役语法。
 *  - **V3(历史日志/旧素材)**:user 角色消息,`content[0]` 是
 *    `{ type:'tool-result', toolCallId, content, isError }` 包装块。
 *
 * 旧实现只认 V3 包装块:在 0.2.x 真机上**所有工具产出被静默丢弃**(热缓冲/提炼/轨迹回放
 * 里都看不到工具输出),而且不报错——本函数把两代归一,修复即在此。
 *
 * @param event - `session/event` 的 tool/result 事件。
 * @returns `{ callId: string, output: string, isError: boolean }` 或 null。
 */
export function toolResultOf(event) {
  const message = event?.data?.message
  if (message === null || typeof message !== 'object') return null
  const blocks = Array.isArray(message.content) ? message.content : []
  const wrapper = blocks.find((block) => block?.type === 'tool-result')
  const callId = typeof message.toolCallId === 'string' && message.toolCallId !== ''
    ? message.toolCallId
    : (typeof wrapper?.toolCallId === 'string' && wrapper.toolCallId !== '' ? wrapper.toolCallId : undefined)
  if (callId === undefined) return null
  // V4:content 就是内容块数组;V3:内容在包装块里,包装块自身不参与渲染(避免把标记当正文)。
  const content = wrapper === undefined ? blocks : (Array.isArray(wrapper.content) ? wrapper.content : [])
  return {
    callId,
    output: blocksToText(content),
    isError: message.isError === true || wrapper?.isError === true || event?.data?.error !== undefined,
  }
}

/**
 * 把新解析出的工具调用并进已有表:已有 name/args 优先,新条目只补 output/isError。
 *
 * 为什么需要它:live 累积与 trajectory 回放都是**逐事件**喂 `eventsToTurnParts`,assistant 的
 * tool-call 与 tool/result 在两个批次里——直接展开覆盖会让 tool/result 的占位 `(unknown)`
 * 盖掉真实工具名(测试实测)。
 * @param into - 目标 Map(callId → { name, args, output?, isError? })。
 * @param calls - 本次解析出的 Map。
 */
export function mergeToolCalls(into, calls) {
  for (const [callId, call] of calls) {
    const previous = into.get(callId)
    into.set(callId, {
      name: previous?.name ?? call?.name ?? '(unknown)',
      args: previous?.args ?? call?.args ?? '',
      ...(previous?.output !== undefined || call?.output !== undefined ? { output: previous?.output ?? call?.output } : {}),
      ...(previous?.isError !== undefined || call?.isError !== undefined ? { isError: previous?.isError ?? call?.isError } : {}),
    })
  }
}

/**
 * 回合包的 toolCalls 归一为数组。两种形状都真实存在:
 *  - `TurnTracker.onEvent` 产出的回合包 = 数组(便于落盘/序列化);
 *  - `eventsToTurnParts`(冷会话重建、工具层展开原文)= Map(内部按 callId 归并)。
 * 消费方必须经这里:对 Map 直接 `for...of` 拿到的是 `[callId, call]` 数组,字段一律
 * undefined——展开原文里的工具产出会被静默丢掉(2026-11-09 R8a 发现并修)。
 */
export function toolCallsOf(pkg) {
  const calls = pkg?.toolCalls
  if (calls instanceof Map) return [...calls.values()]
  return Array.isArray(calls) ? calls : []
}

/** 事件切片 → 回合部件(冷会话重建与 live 累积共用同一词汇)。 */
export function eventsToTurnParts(events) {
  const parts = {
    userTexts: [],
    assistantTexts: [],
    thinkingTexts: [],
    toolCalls: new Map(),
    /** 该回合是否以 max-tokens 收尾(撞过输出上限;§3.0 裁决后收下并标注)。 */
    truncated: false,
  }
  for (const event of events) {
    if (event.type === 'user/message') {
      const message = event.data
      if (message?.source?.kind !== 'user') continue // 注入消息/工具结果不回流入池
      const text = blocksToText(message.content)
      if (text.trim() !== '') parts.userTexts.push(text)
    } else if (event.type === 'assistant/message') {
      collectAssistant(event.data?.message, parts)
    } else if (event.type === 'tool/result') {
      const result = toolResultOf(event)
      if (result === null) continue
      // 与 assistant 的 tool-call 合并时保留已知道的 name/args:工具结果只补 output/isError,
      // 别让占位 '(unknown)' 把真实工具名覆盖掉(live 累积与 trajectory 回放共用本函数)。
      const previous = parts.toolCalls.get(result.callId)
      parts.toolCalls.set(result.callId, {
        name: previous?.name ?? '(unknown)',
        args: previous?.args ?? '',
        output: result.output,
        isError: result.isError,
      })
    } else if (event.type === 'turn/end') {
      // 冷会话/切片重建也要认得"撞过输出上限"(与 live 累积同一口径)
      if (event.data?.reason?.kind === 'max-tokens') parts.truncated = true
    }
  }
  return parts
}

function collectAssistant(message, parts) {
  if (message === null || typeof message !== 'object' || !Array.isArray(message.content)) return
  for (const block of message.content) {
    if (block?.type === 'text' && block.text.trim() !== '') parts.assistantTexts.push(block.text)
    else if (block?.type === 'reasoning' && block.text.trim() !== '') parts.thinkingTexts.push(block.text)
    else if (block?.type === 'tool-call') {
      parts.toolCalls.set(block.id, {
        name: block.name ?? '(unknown)',
        args: typeof block.arguments === 'string' ? block.arguments : '',
      })
    }
  }
}

export class TurnTracker {
  constructor() {
    /** @type Map<string, { current: object | null, cache: Map<number, object>, route: object | undefined }> */
    this.sessions = new Map()
  }

  #state(sessionId) {
    let state = this.sessions.get(sessionId)
    if (state === undefined) {
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = this.sessions.keys().next().value
        this.sessions.delete(oldest)
      }
      state = { current: null, cache: new Map(), route: undefined }
      this.sessions.set(sessionId, state)
    }
    return state
  }

  /**
   * 喂一条事件。合格的 turn/end 返回回合包,否则返回 null。
   * @returns null | { sessionId, turn, startSeq, endSeq, cwd, userTexts, assistantTexts,
   *   thinkingTexts, toolCalls, occurredAt }
   */
  onEvent(session, event) {
    const sessionId = String(session.id)
    const state = this.#state(sessionId)
    // 提炼路由:请求头里的 config 是最近一次实际路由(§3.2 回退链第一环)
    const headerConfig = session.requestHeader?.()?.config
    if (headerConfig?.provider !== undefined && headerConfig?.model !== undefined) {
      state.route = { provider: headerConfig.provider, model: headerConfig.model }
    }

    if (event.type === 'turn/start') {
      state.current = newTurnBuffer(event.data.turn, event.seq)
      return null
    }
    if (event.type === 'turn/end') {
      const current = state.current
      state.current = null
      // §3.0 裁决(2026-09-17):completed 与 max-tokens 都收;后者标 truncated(结尾可能是半句)。
      // 其余(blocked/aborted/error,以及 interrupted——崩溃补写、loop 不实时发出)一律废轮。
      const kind = event.data?.reason?.kind
      if (current === null || !ACCEPTED_END_KINDS.has(kind)) return null
      const pkg = {
        sessionId,
        turn: current.turn,
        startSeq: current.startSeq,
        endSeq: event.seq,
        cwd: session.header?.cwd,
        userTexts: current.userTexts,
        assistantTexts: current.assistantTexts,
        thinkingTexts: current.thinkingTexts,
        toolCalls: [...current.toolCalls.entries()].map(([callId, call]) => ({ callId, ...call })),
        occurredAt: new Date(event.time).toISOString(),
        truncated: kind === 'max-tokens',
      }
      state.cache.set(current.turn, pkg)
      while (state.cache.size > MAX_CACHED_TURNS_PER_SESSION) {
        state.cache.delete(state.cache.keys().next().value)
      }
      return pkg
    }

    // 回合中事件:没有 turn/start(插件半途载入)则隐式开缓冲。
    // 注意:user/message 的载荷就是消息本体,不带 turn;assistant/message 与 tool/result 带。
    if (event.type === 'user/message' || event.type === 'assistant/message' || event.type === 'tool/result') {
      const eventTurn = typeof event.data?.turn === 'number' ? event.data.turn : undefined
      if (state.current === null) state.current = newTurnBuffer(eventTurn ?? 0, event.seq)
      // 自带 turn 且与当前缓冲不符 → 跨 turn 碎片(多半错过了 turn/start),忽略
      if (eventTurn !== undefined && state.current.turn !== eventTurn) return null
      const parts = eventsToTurnParts([event])
      state.current.userTexts.push(...parts.userTexts)
      state.current.assistantTexts.push(...parts.assistantTexts)
      state.current.thinkingTexts.push(...parts.thinkingTexts)
      mergeToolCalls(state.current.toolCalls, parts.toolCalls)
    }
    return null
  }

  /** 提炼用:内存缓存中的回合包(仅近期;冷会话走 sessionQuery)。 */
  cachedTurn(sessionId, turn) {
    return this.sessions.get(sessionId)?.cache.get(turn)
  }

  /** 近 n 个缓存回合的用户/助手文本(entity 加权"近 N 轮提及"用,§5.4);无缓存返回 []。 */
  recentTexts(sessionId, n) {
    const cache = this.sessions.get(sessionId)?.cache
    if (cache === undefined || n <= 0) return []
    return [...cache.values()].slice(-n)
      .flatMap((pkg) => [...pkg.userTexts, ...pkg.assistantTexts])
  }

  routeOf(sessionId) {
    return this.sessions.get(sessionId)?.route
  }

  dropSession(sessionId) {
    this.sessions.delete(sessionId)
  }

  /** hard forget 后丢弃单个回合缓存,避免提炼从内存副本复活。 */
  dropTurn(sessionId, turn) {
    const cache = this.sessions.get(sessionId)?.cache
    if (cache !== undefined && typeof turn === 'number') cache.delete(turn)
  }

  /** 丢弃与来源 seq 区间重叠的回合缓存。 */
  dropTurns(sessionId, startSeq, endSeq) {
    const cache = this.sessions.get(sessionId)?.cache
    if (cache === undefined) return
    for (const [turn, pkg] of cache) {
      if (pkg.startSeq <= endSeq && pkg.endSeq >= startSeq) cache.delete(turn)
    }
  }

  /** 丢弃正文包含指定内容的回合缓存(无 sourceRange 的 hard forget 兜底)。 */
  dropTurnsByContent(sessionId, content) {
    const needle = typeof content === 'string' ? content.trim() : ''
    if (needle === '') return
    const cache = this.sessions.get(sessionId)?.cache
    if (cache === undefined) return
    for (const [turn, pkg] of cache) {
      const text = [...pkg.userTexts, ...pkg.assistantTexts, ...pkg.thinkingTexts,
        ...pkg.toolCalls.map((call) => call.output ?? '')].join('\n')
      if (text.includes(needle)) cache.delete(turn)
    }
  }
}
