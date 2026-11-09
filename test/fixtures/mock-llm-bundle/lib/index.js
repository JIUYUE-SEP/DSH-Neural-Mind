/**
 * Test-only mock LLM provider for DSH 0.2.1-rc.3 headless E2E.
 *
 * Registers one provider route `mock` with exact model `mock-1` through the
 * public seam `ctx.llm.registerAdapter(providers, adapter)`
 * (packages/llm/llm/src/index.ts; live: dsh-llm/lib/index.js:1842).
 *
 * The runtime calls, per model request:
 *   adapter.providerInfo(provider)                      -> {id, name}            (llm/lib/index.js:1873)
 *   adapter.providerRetryPolicy(provider)               -> retry policy | undefined (:1876)
 *   adapter.prepareCall(provider, model, signal)        -> {model, stream}        (:2224)
 *   prepared.stream(options)                            -> AsyncIterable<StreamChunk> (:2249-2258)
 * `resolveModel()` is read by prepareCall for model metadata validation
 * (:2225-2226, :2115-2163), and listModels() is advisory only.
 *
 * StreamChunk protocol (see dsh-llm-deepseek/lib/index.js translate():1962-2028):
 *   {type:'block-start', index, blockType:'text'|'reasoning'|'tool-call'}
 *   {type:'text-delta', index, text} | {type:'reasoning-delta', index, text}
 *   {type:'tool-call-delta', index, id, name?, argumentsDelta}
 *   {type:'block-end', index, block: ContentBlock}
 *   {type:'usage', usage:{inputTokens,outputTokens,totalTokens}}
 *   {type:'finish', reason:{kind:'stop'|'tool-calls'|'max-tokens'}, replayState?}
 * Exactly one terminal finish; `replayState` is optional (BlockAssembler treats it as optional).
 *
 * Behaviour is deterministic and keyed off the LAST real user message:
 *   - contains "remember"/"记住"  -> one tool call `memory_remember` (confirm:true)
 *     so neural-mind persists a memory synchronously inside the turn;
 *   - the step after a tool result -> plain text (turn completes);
 *   - anything else              -> plain text mentioning BLUE-FALCON-42.
 * Every request/decision is appended as JSONL to $DSH_MOCK_LLM_LOG when set.
 */
import { appendFileSync } from 'node:fs'

export const name = 'mock-llm-spike'

/** Fact written by run 1 and expected to be recalled (injected) by run 2. */
const SECRET = 'BLUE-FALCON-42'
const MEMORY_CONTENT = `The secret code is ${SECRET}.`

const logPath = () => process.env.DSH_MOCK_LLM_LOG

function log(entry) {
  const path = logPath()
  if (path === undefined || path === '') return
  try {
    appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8')
  } catch {
    // A test harness log must never break the run.
  }
}

/** Flatten one durable message into text (content blocks). */
function messageText(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

/** Last user-role message produced by the real user (not a plugin injection). */
function lastUserTask(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'user') continue
    const kind = message?.source?.kind
    if (kind !== 'user') continue
    return messageText(message)
  }
  return ''
}

/** The last message is a tool result: this step must finish with text. */
function followedToolResult(messages) {
  const last = messages[messages.length - 1]
  return last?.role === 'tool'
}

/** Plugin extraction request: producer-owned source + the extraction JSON contract. */
function isExtractionRequest(messages) {
  const last = messages[messages.length - 1]
  return last?.role === 'user'
    && typeof last?.source?.kind === 'string'
    && last.source.kind.startsWith('plugin:neural-mind')
    && /输出 JSON|记忆提炼器/.test(messageText(last))
}

function extractionReply() {
  const fact = process.env.DSH_MOCK_EXTRACT_FACT
  return textReply(JSON.stringify({
    episode: null,
    facts: fact === undefined || fact === ''
      ? []
      : [{
          content: fact,
          kind: 'fact',
          source: 'user',
          entity: 'n1',
          temporal: 'pattern',
          importance: 6,
          confidence: 0.9,
          eventTime: new Date().toISOString(),
        }],
    lessons: [],
    relations: [],
    soulProposal: null,
  }))
}

function hasInjectedMemory(messages) {
  return messages.some((message) => {
    const kind = message?.source?.kind
    return typeof kind === 'string' && kind.startsWith('plugin:neural-mind')
  })
}

function textReply(text) {
  return {
    kind: 'text',
    text,
  }
}

function rememberReply() {
  return {
    kind: 'tool-call',
    toolCallId: 'mock-call-memory-remember-1',
    toolName: 'memory_remember',
    argumentsJson: JSON.stringify({ content: MEMORY_CONTENT, confirm: true, kind: 'fact', temporal: 'pattern' }),
  }
}

/** Deterministic decision for one request; never throws. */
function decide(options) {
  const messages = Array.isArray(options?.messages) ? options.messages : []
  const task = lastUserTask(messages)
  const injected = hasInjectedMemory(messages)
  if (isExtractionRequest(messages)) return { reply: extractionReply(), task, injected, reason: 'extract' }
  if (followedToolResult(messages)) return { reply: textReply('Remembered.'), task, injected, reason: 'after-tool-result' }
  if (/remember|记住|記住/i.test(task)) return { reply: rememberReply(), task, injected, reason: 'remember-task' }
  return { reply: textReply(`The secret code is ${SECRET}.`), task, injected, reason: 'answer-task' }
}

function chunksFor(reply) {
  if (reply.kind === 'tool-call') {
    const block = { type: 'tool-call', id: reply.toolCallId, name: reply.toolName, arguments: reply.argumentsJson }
    return [
      { type: 'block-start', index: 0, blockType: 'tool-call' },
      { type: 'tool-call-delta', index: 0, id: reply.toolCallId, name: reply.toolName, argumentsDelta: reply.argumentsJson },
      { type: 'block-end', index: 0, block },
      { type: 'usage', usage: { inputTokens: 32, outputTokens: 16, totalTokens: 48 } },
      { type: 'finish', reason: { kind: 'tool-calls' } },
    ]
  }
  const block = { type: 'text', text: reply.text }
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text: reply.text },
    { type: 'block-end', index: 0, block },
    { type: 'usage', usage: { inputTokens: 32, outputTokens: Math.max(1, Math.ceil(reply.text.length / 4)), totalTokens: 40 } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

/** Plain-object adapter: the runtime duck-types (no `instanceof LlmAdapter` gate). */
const mockAdapter = {
  providerInfo(provider) {
    return { id: provider, name: 'Mock LLM (test-only)' }
  },
  providerRetryPolicy() {
    return undefined
  },
  listModels() {
    return Promise.resolve([])
  },
  resolveModel(provider, model) {
    return Promise.resolve({
      provider,
      id: model,
      name: `Mock ${model}`,
      description: 'deterministic local test adapter',
      inputModalities: ['text'],
      context: { contextWindow: 200000 },
      defaultMaxTokens: 4096,
    })
  },
  async prepareCall(provider, model) {
    const resolved = await this.resolveModel(provider, model)
    return {
      model: resolved,
      stream: (options) => this.stream(options, provider, model),
    }
  },
  async *stream(options, provider, model) {
    const { reply, task, injected, reason } = decide(options)
    log({
      event: 'request',
      provider,
      model,
      taskPreview: task.slice(0, 200),
      systemPreview: typeof options?.system === 'string'
        ? options.system.slice(0, 4000)
        : (options?.system === undefined ? '' : JSON.stringify(options.system).slice(0, 4000)),
      systemMessagePreview: (() => {
        const systemMessage = Array.isArray(options?.messages)
          ? options.messages.find((message) => message?.role === 'system')
          : undefined
        return messageText(systemMessage).slice(0, 4000)
      })(),
      roles: Array.isArray(options?.messages) ? options.messages.map((message) => message?.role) : [],
      injectedMemorySeen: injected,
      messageCount: Array.isArray(options?.messages) ? options.messages.length : 0,
      decision: reply.kind,
      reason,
    })
    for (const chunk of chunksFor(reply)) yield chunk
  },
}

export function apply(ctx) {
  ctx.inject(['llm'], (scope) => {
    scope.effect(
      () => scope.llm.registerAdapter(['mock'], mockAdapter),
      'mock-llm: register adapter',
    )
    log({ event: 'adapter-registered', provider: 'mock', model: 'mock-1' })
  })
}
