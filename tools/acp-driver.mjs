#!/usr/bin/env node
/**
 * ACP 驱动脚本(手工 e2e 验证用,非插件一部分):
 *   node tools/acp-driver.mjs <profile> <cwd> <prompt> [settleMs]
 * 流程:initialize → session/new → session/prompt → 停留 settleMs(让后台提炼跑完)。
 * NDJSON JSON-RPC over stdio;permission 请求自动放行(测试 profile 专用)。
 * 2026-11-09 从 test/ 移入 tools/:留在 test/ 下会被裸 `node --test` 当测试文件收走(实测 153/12 红)。
 */
import { spawn } from 'node:child_process'

const [profile, cwd, prompt, settleMsArg] = process.argv.slice(2)
const settleMs = Number(settleMsArg ?? 45_000)
if (!profile || !cwd || !prompt) {
  console.error('usage: acp-driver.mjs <profile> <cwd> <prompt> [settleMs]')
  process.exit(2)
}

const child = spawn('dsh', ['--profile', profile], { stdio: ['pipe', 'pipe', 'inherit'] })
let buffer = ''
const pending = new Map()
let nextId = 1

function send(method, params) {
  const id = nextId++
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }))
}

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8')
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (line === '') continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`))
      else p.resolve(msg.result)
    } else if (msg.method === 'session/request_permission') {
      child.stdout.pause()
      child.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { outcome: { outcome: 'selected', optionId: msg.params?.options?.[0]?.optionId ?? 'allow' } },
      }) + '\n')
      child.stdout.resume()
    }
  }
})

child.on('exit', (code) => {
  for (const p of pending.values()) p.reject(new Error(`dsh exited (${code})`))
})

const deadline = Date.now() + 240_000
const init = await send('initialize', { protocolVersion: 1, clientCapabilities: {} })
console.error('[driver] initialize ok:', JSON.stringify(init?.protocolVersion ?? init))
const created = await send('session/new', { cwd, mcpServers: [] })
const sessionId = created.sessionId
console.error('[driver] session:', sessionId)
const t0 = Date.now()
const result = await send('session/prompt', { sessionId, prompt: [{ type: 'text', text: prompt }] })
console.error(`[driver] prompt settled in ${Date.now() - t0}ms:`, JSON.stringify(result))
console.error(`[driver] 进程保持 ${settleMs}ms 等后台提炼…`)
await new Promise((r) => setTimeout(r, Math.min(settleMs, Math.max(0, deadline - Date.now()))))
child.kill()
process.exit(0)
