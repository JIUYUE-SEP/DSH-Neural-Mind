/**
 * 文本处理:分词(CJK 2/3-gram + 标识符二级切分)、代码块折叠、查询相关片段裁剪、
 * 注入防御特征、密钥形态检测、sensitive 关键词初筛、工具调用摘要。
 * 全部为纯函数。
 */
import { truncateChars } from './util.js'

// ── 分词(§5.1:索引与查询同构)──────────────────────────────────────────────

const CJK = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff'
const TOKEN_RE = new RegExp(`[A-Za-z_][A-Za-z0-9_]*|[${CJK}]+|[A-Za-z0-9]+`, 'g')
const CJK_RE = new RegExp(`^[${CJK}]+$`)

/** hotBufferMaxEntries → [hot, buffer, max, entries];auth_token → [auth, token]。 */
export function splitIdentifier(ident) {
  const out = []
  for (const seg of ident.split(/[_$]+/)) {
    // 驼峰切分:hotBuffer → hot|Buffer;HTMLParser → HTML|Parser
    for (const part of seg.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
      if (part !== '') out.push(part.toLowerCase())
    }
  }
  return out
}

/** entity 归一(entity 比较的唯一口径:去首尾空白、折叠连续空白、小写;写入方与比较方必须共用,§3.2)。 */
export const normalizeEntity = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').toLowerCase() : '')

/**
 * D1 内容规范化:只做 Unicode NFC、trim、空白折叠。
 * 不删标点/数字/否定词,不做大小写忽略——宁可漏合并,也不误杀。
 */
export const normalizeContent = (v) => (typeof v === 'string' ? v.normalize('NFKC').replace(/\s+/g, ' ').trim() : '')

/**
 * 全文分词。CJK 连续段切 2/3-gram(单字直接保留);标识符按 camel/snake 二级切分;
 * 其余拉丁按词。保留重复(BM25 需要词频)。
 */
export function tokenize(text) {
  if (typeof text !== 'string' || text === '') return []
  const tokens = []
  for (const match of text.matchAll(TOKEN_RE)) {
    const raw = match[0]
    if (CJK_RE.test(raw)) {
      if (raw.length === 1) {
        tokens.push(raw)
      } else {
        for (let i = 0; i < raw.length - 1; i++) tokens.push(raw.slice(i, i + 2))
        for (let i = 0; i < raw.length - 2; i++) tokens.push(raw.slice(i, i + 3))
      }
    } else if (/[A-Z_]/.test(raw) && /[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
      tokens.push(...splitIdentifier(raw))
    } else {
      tokens.push(raw.toLowerCase())
    }
  }
  return tokens
}

// ── 代码块折叠(§3.1:防旧代码被照抄)────────────────────────────────────────

/** 助手回复里的围栏代码块折成"前 3 行 + 行数指引";完整代码经 recall 整条展开取回。 */
export function foldCodeBlocks(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (whole, lang, body) => {
    const lines = body.replace(/\n+$/, '').split('\n')
    if (lines.length <= 3) return whole
    return `\`\`\`${lang}\n${lines.slice(0, 3).join('\n')}\n// …(共 ${lines.length} 行,见原文)\n\`\`\``
  })
}

// ── 查询相关片段裁剪(§4.2:词面重合窗口,无重合留头留尾)─────────────────────

export function makeExcerpt(text, queryTokens, maxChars) {
  if (typeof text !== 'string') return ''
  if (text.length <= maxChars) return text
  // 优先最长的查询词(信息量大),找最早出现位置
  const haystack = text.toLowerCase()
  const needles = [...new Set(queryTokens)]
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length)
  let pos = -1
  for (const needle of needles) {
    const at = haystack.indexOf(needle.toLowerCase())
    if (at >= 0 && (pos < 0 || at < pos)) pos = at
  }
  if (pos >= 0) {
    const half = Math.floor(maxChars / 2)
    const start = Math.max(0, pos - half)
    const end = Math.min(text.length, start + maxChars)
    const head = start > 0 ? '…' : ''
    const tail = end < text.length ? '…' : ''
    return head + text.slice(start, end) + tail
  }
  // 留头留尾
  const headLen = Math.floor(maxChars * 0.6)
  const tailLen = maxChars - headLen - 2
  if (tailLen <= 0) return `${text.slice(0, maxChars)}…`
  return `${text.slice(0, headLen)} …… ${text.slice(text.length - tailLen)}`
}

// ── 注入防御(§3.4 第二层:落盘前过滤)──────────────────────────────────────

/**
 * 检测前的文本归一化(NFKC + 去零宽/双向控制字符 + 折叠空白)。
 * 必要性:红队实测 `忽略<零宽>之前的指令`、全角字母、日/俄文变体都能绕过原始正则;
 * 归一化把"看起来一样但码点不同"的写法收敛到同一形态,再交给词表。
 * 只用于**检测**,不改动落盘内容本身。
 */
export function normalizeForDetection(text) {
  if (typeof text !== 'string' || text === '') return ''
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .replace(/[\t\u00A0\u3000]+/g, ' ')
}

export const INJECTION_PATTERNS = [
  { id: 'ignore-instructions', re: /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?)/i },
  { id: 'disregard-all', re: /\bdisregard\s+(all|any|the\s+above|everything)/i },
  { id: 'new-instructions', re: /\b(new|updated|override)\s+(system\s+)?instructions?\s*[:：]/i },
  { id: 'system-prompt-ref', re: /\b(system|admin|root)\s+(prompt|override|command)\b/i },
  { id: 'jailbreak', re: /\b(jailbreak|DAN\s+mode)\b|开发者模式/i },
  { id: 'zh-ignore', re: /忽略(以上|之前|前面|所有|全部|先前).{0,10}(指令|指示|要求|规则|提示词?)/ },
  { id: 'zh-must-obey', re: /你(现在)?(必须|务必|一定要|只能)(执行|运行|遵守|听从|照做)/ },
  { id: 'zh-new-role', re: /(从现在开始|从现在起|接下来).{0,12}(你是|扮演|充当|变成)/ },
  { id: 'zh-system-directive', re: /系统(提示|指令|命令|消息)\s*[:：]/ },
  { id: 'shell-abuse', re: /(执行|运行|execute|run)\s*`?(rm\s+-rf|sudo\s|curl\s+\S+\s*\|\s*(sh|bash))/i },
  // ── 以下为 v1.9 审查补强:只针对"放宽/绕过自身约束"的语义,不拦"收紧"表述 ──
  // (用户明确定调:提到沙箱/权限这个词不拦;"默认批准/不必询问/绕过审批"这类才拦)
  { id: 'relax-permission-zh', re: /(默认|自动|直接)\s*(已)?\s*(批准|放行|允许|通过)|不必(再)?\s*(询问|确认|请示|征求)|无需\s*(询问|确认|请示)|不要(再)?\s*(询问|确认|告知|告诉|提醒)\s*(用户|我)/ },
  { id: 'relax-permission-en', re: /\b(pre-?approved|auto-?approve[d]?|no need to (ask|confirm|notify)|don'?t (ask|tell|notify|warn) the user|bypass (the )?(sandbox|approval|permission|restriction|policy))/i },
  { id: 'relax-permission-ja', re: /(ユーザーに)?(確認|通知|報告)(しなくて|せずに|しないで)|承認済みと(みなして|して)/ },
  { id: 'relax-permission-ru', re: /не\s+(спрашивай|сообщай|уведомляй)\s+пользовател/i },
  { id: 'self-rule-override', re: /(系统(提示|指令|规则)|安全规则|安全策略)[^。\n]{0,24}(冲突|矛盾|抵触)[^。\n]{0,24}(以我|按我的|我的(信条|设定)|优先|为准)|(以我|按我的|我的(信条|设定|规则))[^。\n]{0,20}(覆盖|凌驾|优先于|高于|取代|越过)[^。\n]{0,20}(系统|安全|沙箱|审批|规则|提示|指令)|\b(override|take precedence over|ignore)\b[^。\n]{0,16}\b(system prompt|safety (rules|policy))\b/i },
]

/**
 * 收紧表述豁免(§4.4 定稿口径:只拦"放宽自身约束"的语义)。
 *
 * 为什么要它:正则只会看"bypass/默认批准"这种词面,看不出方向——
 * 「I will never bypass the sandbox approval」「不允许默认批准任何操作」都是**收紧**,
 * 却被当成放宽拦了下来。判据取"同一小句里、匹配点之前出现否定词"(不/禁止/never/refuse…);
 * 跨小句不算(「不要乱删文件。默认批准只读命令」里的否定不该豁免后一句)。
 * 只在 relax-permission-* 上生效;**不放宽** jailbreak/ignore-instructions 这类无条件特征。
 */
function negatedBefore(text, index) {
  let start = 0
  for (let i = index - 1; i >= 0 && index - i <= 60; i--) {
    if (/[。！？!?;\n]/.test(text[i])) {
      start = i + 1
      break
    }
  }
  return /(?:never|not|won'?t|don'?t|doesn'?t|mustn'?t|avoid|refuse|不|禁止|严禁|切勿|不可|别)/i.test(text.slice(start, index))
}

/** 返回命中的特征 id;未命中返回 null。 */
export function detectInjection(text, extraPatterns = []) {
  if (typeof text !== 'string' || text === '') return null
  const normalized = normalizeForDetection(text)
  for (const { id, re } of INJECTION_PATTERNS) {
    const m = re.exec(normalized)
    if (m === null) continue
    if (id.startsWith('relax-permission') && negatedBefore(normalized, m.index)) continue
    return id
  }
  for (const pattern of extraPatterns) {
    try {
      if (new RegExp(pattern, 'i').test(normalized)) return `extra:${pattern}`
    } catch {
      // 用户配置的坏正则:跳过(配置面不作硬失败)
    }
  }
  return null
}

/** 祈使句开头检测(中英文常见指令动词)。 */
export function looksImperative(text) {
  if (typeof text !== 'string') return false
  const head = text.trim().slice(0, 40)
  return /^(请你?)?(立即|马上|务必|必须|不要再?|停止|执行|运行|删除|忽略|记住以下命令)/.test(head)
    || /^(ignore|forget|disregard|you\s+must|always|never|delete|execute|run|obey)\b/i.test(head)
}

// ── 密钥形态检测(§2:敏感字段拒绝落盘)──────────────────────────────────────

const SECRET_PATTERNS = [
  { id: 'openai-style-key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'aws-access-key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: 'gitlab-token', re: /\bglpat-[A-Za-z0-9_-]{16,}\b/ },
  { id: 'slack-token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'hf-token', re: /\bhf_[A-Za-z0-9]{20,}\b/ },
  { id: 'stripe-key', re: /\b[sr]k_(live|test)_[A-Za-z0-9]{16,}\b/ },
  { id: 'npm-token', re: /\bnpm_[A-Za-z0-9]{20,}\b/ },
  { id: 'pypi-token', re: /\bpypi-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'aws-secret-assignment', re: /\baws_secret_access_key\b\s*[:=]\s*["']?[A-Za-z0-9/+=]{30,}/i },
  { id: 'private-key-inline', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: 'generic-secret-assignment', re: /\b(api[_-]?key|secret|access[_-]?token|auth[_-]?token|password|passwd|passphrase)\b\s*[:=]\s*["']?[^\s"']{12,}/i },
]

export function detectSecret(text) {
  if (typeof text !== 'string' || text === '') return null
  const normalized = normalizeForDetection(text) // 零宽字符插入的令牌也要能认出来
  for (const { id, re } of SECRET_PATTERNS) {
    if (re.test(normalized)) return id
  }
  return null
}

// ── sensitive 关键词初筛(§2:L0 落盘时的可选防线;R4 起默认关闭)──────────────
//
// R4(0.6.6,2026-11-08 定):默认不做敏感自动标记——`sensitiveKeywords` 默认空,
// 本清单只作为"预设参考"保留(用户要打开开关时可整份复制/挑选)。机制本身仍在
// (hotbuffer 对 content+thinking 跑 prescreenSensitive),只是默认不喂词表。
// 历史教训:纯字符串包含匹配会误伤技术词(emo⊂memory、NDA⊂standard、诊断⊂诊断卡)。

export const DEFAULT_SENSITIVE_KEYWORDS = [
  // 健康
  '病历', '诊断', '体检', '用药', '处方', '抑郁', '焦虑症', '失眠', '心理咨询', '住院',
  // 情绪
  '压力大', '崩溃', '情绪低落', 'emo',
  // 亲密关系
  '男朋友', '女朋友', '老公', '老婆', '恋爱', '分手', '结婚', '离婚', '相亲', '暗恋',
  // 薪酬
  '工资', '薪资', '年薪', '月薪', '奖金', '年终奖', '期权', '公积金', 'salary', 'compensation',
  // 人事
  '裁员', '离职', '跳槽', '晋升', '绩效考核', '背调', 'layoff',
  // 合同与未公开经营数据
  '合同条款', '营收', '净利润', '毛利率', '估值', '融资轮', '未公开', '保密协议', 'NDA',
]

export function prescreenSensitive(text, keywords) {
  if (typeof text !== 'string' || text === '') return false
  const lower = text.toLowerCase()
  for (const keyword of keywords) {
    if (keyword === '') continue
    if (lower.includes(keyword.toLowerCase())) return true
  }
  return false
}

// ── 工具调用摘要(§3.1:摘要制 + 失败例外 + head 分流)────────────────────────

/** tool/result 事件的 ToolResultBlock → 纯文本。 */
export function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b) => b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}

/**
 * 规则生成的调用摘要。mode: 'summary' 只留元信息;'head' 附前 500 字符。
 * 失败调用例外:输出截断存 failedChars 字符(§3.1)。
 */
export function summarizeToolCall(name, argsPreview, ok, outputText, mode, failedChars) {
  const args = truncateChars(argsPreview ?? '', 120)
  if (!ok) {
    return `✗ ${name}(${args}) → 失败:\n${truncateChars(outputText, failedChars)}`
  }
  if (mode === 'head') {
    return `✓ ${name}(${args}) → 成功,输出节选:\n${truncateChars(outputText, 500)}`
  }
  return `✓ ${name}(${args}) → 成功(输出 ${(outputText ?? '').length} 字符)`
}
