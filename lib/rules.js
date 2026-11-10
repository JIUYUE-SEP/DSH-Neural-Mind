/**
 * §15 项目规则：AGENTS.md 托管块的**纯函数原语**（草稿阶段，未接线）。
 *
 * 设计边界（见 docs/design/15-project-rules.md）：
 * - 本模块只做字符串层面的解析 / 合并 / 校验，**不做任何 I/O**；
 * - 真正的写入协议（显式确认、diff 预览、文件 hash 预检、git 工作树检查、备份、
 *   原子写、审计、回滚）属于接线阶段，留给 store / api 侧实现——避免草稿阶段就碰用户仓库文件；
 * - 托管块之外的内容一字不动；无法确认块结构时一律拒绝写入。
 */

export const RULES_BLOCK_START = '<!-- neural-mind:rules:start -->'
export const RULES_BLOCK_END = '<!-- neural-mind:rules:end -->'
export const RULES_MAX_COUNT = 20
export const RULES_MAX_CHARS = 200

/** 规范化一条规则：去项目符号 / 编号、折叠空白；空或超长返回 null。 */
export function normalizeRule(value) {
  if (typeof value !== 'string') return null
  let text = value.replace(/\r?\n/g, ' ').trim()
  text = text.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()
  text = text.replace(/\s+/g, ' ').trim()
  if (text === '' || text.length > RULES_MAX_CHARS) return null
  return text
}

/** 校验一批规则：规范化 + 去重（大小写折叠）+ 上限检查。 */
export function validateRules(list) {
  if (!Array.isArray(list)) return { ok: false, rules: [], errors: ['rules 必须是数组'] }
  const errors = []
  const rules = []
  const seen = new Set()
  for (const raw of list) {
    const rule = normalizeRule(raw)
    if (rule === null) {
      errors.push(`无效规则（空或超过 ${RULES_MAX_CHARS} 字符）：${String(raw).slice(0, 40)}`)
      continue
    }
    const key = rule.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    rules.push(rule)
  }
  if (rules.length > RULES_MAX_COUNT) errors.push(`规则条数超过上限 ${RULES_MAX_COUNT}`)
  return { ok: errors.length === 0, rules, errors }
}

/** 渲染托管块（含首尾标记），规则少时也保持每行一条。 */
export function renderRulesBlock(rules, { eol = '\n' } = {}) {
  const lines = [RULES_BLOCK_START, ...rules.map((rule) => `- ${rule}`), RULES_BLOCK_END]
  return lines.join(eol) + eol
}

/** 标记必须独占一行：避免误把正文里的字符串当块边界。 */
function isStandaloneMarker(value, index, marker) {
  const before = index === 0 ? '\n' : value[index - 1]
  const afterIndex = index + marker.length
  const after = afterIndex >= value.length ? '\n' : value[afterIndex]
  return (before === '\n' || before === '\r') && (after === '\n' || after === '\r')
}

/**
 * 定位托管块。
 * @returns {{status:'none'}} | {{status:'ok', start:number, end:number, content:string}}
 *   | {{status:'unterminated'|'malformed'|'multiple'}}（后三者都拒绝写入）
 *   start/end 覆盖整个块（含首尾标记与行尾换行），用于整块替换。
 */
export function locateRulesBlock(text) {
  const value = typeof text === 'string' ? text : ''
  const starts = []
  const ends = []
  for (let index = value.indexOf(RULES_BLOCK_START); index >= 0; index = value.indexOf(RULES_BLOCK_START, index + 1)) starts.push(index)
  for (let index = value.indexOf(RULES_BLOCK_END); index >= 0; index = value.indexOf(RULES_BLOCK_END, index + 1)) ends.push(index)
  if (starts.length === 0 && ends.length === 0) return { status: 'none' }
  if (starts.length !== 1 || ends.length !== 1) return { status: 'multiple' }
  const [startMarker, endMarker] = [starts[0], ends[0]]
  if (endMarker < startMarker) return { status: 'unterminated' }
  if (!isStandaloneMarker(value, startMarker, RULES_BLOCK_START) || !isStandaloneMarker(value, endMarker, RULES_BLOCK_END)) {
    return { status: 'malformed' }
  }
  const startLine = value.lastIndexOf('\n', startMarker) + 1
  const afterEnd = endMarker + RULES_BLOCK_END.length
  const endLineBreak = value.indexOf('\n', afterEnd)
  const end = endLineBreak < 0 ? value.length : endLineBreak + 1
  const content = value.slice(startMarker + RULES_BLOCK_START.length, endMarker)
  return { status: 'ok', start: startLine, end, content }
}

/** 从块内容里读回规则（用于 UI 展示已有托管块）。 */
export function parseRulesBlock(content) {
  return String(content ?? '')
    .split(/\r?\n/)
    .map((line) => normalizeRule(line))
    .filter((line) => line !== null)
}

/**
 * 生成"把规则写进 AGENTS.md 文本"的结果（纯函数，不落盘）。
 * - 无块 → 追加到文件末尾（保留原有内容与行尾风格）；
 * - 有块 → 只替换块本身；
 * - rules 为空 → 删除托管块；
 * - 结构异常（多个块 / 标记不成对 / 标记不在行首）→ 拒绝。
 * @returns {{ok:true, action:'inserted'|'replaced'|'removed'|'unchanged', after:string}}
 *   | {{ok:false, reason:string, errors?:string[]}}
 */
export function mergeRulesBlock(text, list) {
  const value = typeof text === 'string' ? text : ''
  const checked = validateRules(list)
  if (!checked.ok) return { ok: false, reason: checked.errors.join('；'), errors: checked.errors }
  const eol = value.includes('\r\n') ? '\r\n' : '\n'
  const located = locateRulesBlock(value)
  if (located.status === 'multiple') return { ok: false, reason: '文件里有多个托管块标记，拒绝写入' }
  if (located.status === 'unterminated') return { ok: false, reason: '托管块标记不成对（缺少 start 或 end），拒绝写入' }
  if (located.status === 'malformed') return { ok: false, reason: '托管块标记不在独立行，拒绝写入' }
  if (located.status === 'none') {
    if (checked.rules.length === 0) return { ok: true, action: 'unchanged', after: value }
    const separator = value === '' ? '' : value.endsWith('\n') ? eol : eol + eol
    return { ok: true, action: 'inserted', after: value + separator + renderRulesBlock(checked.rules, { eol }) }
  }
  if (checked.rules.length === 0) {
    const after = value.slice(0, located.start) + value.slice(located.end)
    return after === value ? { ok: true, action: 'unchanged', after } : { ok: true, action: 'removed', after }
  }
  const after = value.slice(0, located.start) + renderRulesBlock(checked.rules, { eol }) + value.slice(located.end)
  return after === value ? { ok: true, action: 'unchanged', after } : { ok: true, action: 'replaced', after }
}
