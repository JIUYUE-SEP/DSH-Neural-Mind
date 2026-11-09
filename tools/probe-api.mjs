#!/usr/bin/env node
/**
 * /neural-mind/api 真机探测(只读诊断,不改任何数据)。
 *
 * 用途:装好插件、重启宿主之后,用一条命令回答"设置页的数据通道到底通没通"。
 * 这是**端到端**证据,比读代码可靠:宿主侧的 webServer 路由是**只增不减**的按需注册,
 * 插件若在服务就绪前探测过一次就放弃,整条路由会静默缺席,外在表现只是设置页空白。
 *
 * ```sh
 * dsh web --port 3000          # 记下它打印的 token
 * node tools/probe-api.mjs http://127.0.0.1:3000 <token>
 * ```
 *
 * 期望:
 *   `POST /neural-mind/api` → 200 + `{"ok":true,...}`(带 x-neural-mind-client 头)
 *   `GET  /neural-mind/api` → 403(插件自己的同源校验在起作用,这是**对的**)
 *   `POST` 少自定义头 → 403(同上)
 *
 * 说明:token 只用于通过 dsh web 的入口鉴权;`/neural-mind/api` 本身走"同源 + 自定义头"防线。
 */
const base = process.argv[2] ?? 'http://127.0.0.1:3000'
const token = process.argv[3] ?? ''

const call = async (method, path, headers = {}, body) => {
  const url = `${base}${path}${token === '' ? '' : `?token=${encodeURIComponent(token)}`}`
  let res
  try {
    res = await fetch(url, { method, headers, body })
  } catch (error) {
    return { status: 0, note: `连不上:${error?.message ?? error}` }
  }
  const text = await res.text()
  return { status: res.status, contentType: res.headers.get('content-type'), text }
}

const cases = [
  ['POST /neural-mind/api(带自定义头,应 200)', () => call('POST', '/neural-mind/api',
    { 'content-type': 'application/json', 'x-neural-mind-client': '1' }, JSON.stringify({ action: 'stats' }))],
  ['POST /neural-mind/api(缺自定义头,应 403)', () => call('POST', '/neural-mind/api',
    { 'content-type': 'application/json' }, JSON.stringify({ action: 'stats' }))],
  ['GET /neural-mind/api(应 403,不是 404)', () => call('GET', '/neural-mind/api', { 'x-neural-mind-client': '1' })],
]

let verdict = 'ok'
for (const [label, run] of cases) {
  const r = await run()
  const body = r.note ?? r.text.slice(0, 200)
  console.log(`${label}\n  → ${r.status}${r.contentType === undefined ? '' : ` ${r.contentType}`} ${body}`)
  if (label.includes('应 200') && r.status !== 200) verdict = 'fail'
  if (label.includes('应 403') && r.status !== 403) verdict = 'fail'
}

if (verdict === 'ok') {
  console.log('\n结论:/neural-mind/api 路由已注册且防线正确 —— 设置 → 记忆 的数据通道是通的')
} else {
  console.log('\n结论:路由没按预期响应。若 405/404,说明 /neural-mind/api 根本没注册(webServer 探测落空),')
  console.log('      看宿主的 stderr 有没有 `[memory] webServer 缺席`;若 401,检查 token 是否带对。')
  process.exitCode = 1
}
