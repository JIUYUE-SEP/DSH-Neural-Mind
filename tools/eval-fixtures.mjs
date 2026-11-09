/**
 * 评估夹具(共享):带 id 的 ground truth + 真池子载入。
 * 三个工具共用:`fusion-ab.mjs`(候选集 A/B)、`inject-eval.mjs`(真实注入路径)、`gate-sweep.mjs`(绝对相关性闸门扫描)。
 * 只读,不写记忆池。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parseDocument } from 'yaml'
import { Config } from '../lib/config.js'
import { resolveConfig } from '../lib/compat.js'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const POOL = join(DSH_HOME, 'storages/neural_mind')

/** 载入注入池(与插件同口径:active/staged 记忆 + 未消化热缓冲,跳 hidden/archived)。 */
export function loadPool() {
  const read = (dir, keep) => {
    try {
      return fs.readdirSync(join(POOL, dir))
        .filter((f) => f.endsWith('.json'))
        .map((f) => { try { return JSON.parse(fs.readFileSync(join(POOL, dir, f), 'utf8')).record } catch { return null } })
        .filter((r) => r !== null && keep(r))
    } catch {
      return []
    }
  }
  return {
    memories: read('memories', (r) => (r.status === 'active' || r.status === 'staged') && r.hidden !== true),
    hot: read('hotbuffer', (r) => r.digested !== true && r.hidden !== true),
  }
}

/**
 * "当前工作区"取真实工作区里最常见的一个。
 * 注意要**排除导入批次** `memos-import` —— 否则导入记忆会白吃同仓加成(实测踩过)。
 */
export function currentWorkspaceOf(memories) {
  const count = memories
    .filter((r) => r.workspaceId !== 'memos-import')
    .reduce((m, r) => ({ ...m, [r.workspaceId]: (m[r.workspaceId] ?? 0) + 1 }), {})
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]
  return top === undefined ? '' : top[0]
}

/** 正例:查询 → 应命中的记录 id 前缀(用户会这么问,刻意不照抄原文措辞)。 */
export const POS = [
  ['系统提示词是不是每条消息都往历史里塞一份', ['m_83c3cf91']],
  ['怎么让显存用完就还给我', ['m_9ecd85b5']],
  ['我这块卡跑哪个量化版本合适', ['m_06ae1974']],
  ['向量一共占多少存储', ['m_48b4e889']],
  ['我 ComfyUI 存的工作流在哪个目录', ['m_4ead78fa']],
  ['视频发糊怎么调参数', ['m_dd5f687d', 'm_e31258d2']],
  ['画像该写多长、写什么', ['m_3a8929ae']],
  ['我之前说想试哪几个编辑器插件', ['m_75567132']],
  // 次要目标 m_e8b6710c 在终轮卫生(2026-09-18)被归档(过程噪音),只留主目标
  ['归档架那个仓库状态怎么样', ['m_1c12fa50']],
  ['配置文件被我改坏了那次怎么修的', ['m_40675517']],
  ['人格段落插在提示词哪个位置', ['m_a6cce7be']],
  // 原目标 m_0ce07062 在终轮卫生被归档(过程);改钉活着的答案:模板与规范指针
  ['用 anima 出图要先做什么', ['m_0b3f2147', 'm_e49e2921']],
  // 原目标 m_2376b880 在终轮卫生被归档(无结论疑问);改钉活着的答案:侧栏即插件 / 改源码才需源码
  ['想改界面侧栏,需要改 harness 源码吗', ['m_363f0eac', 'm_aab6be7b']],
  ['为什么插件升级后容易坏', ['m_6a2b55af']],
  ['热缓冲里的东西多久被删掉', ['m_af1bf161']],
  ['人格层的设计是怎么定的', ['m_91e2aaf5']],
  ['存储写不了的时候插件会怎样', ['m_89e38b9f']],
  // ['画像为什么只剩文件入口', ['m_be7b2cc9']] —— 池子卫生(2026-09-17)归档了这条:
  //   它的内容已进 DESIGN §4.1/§13 与 README,池子里不再有对应记录。
  //   留着会把它记成"假性 miss"(知识在文档里,不该指望注入),所以从正例里摘掉。
  // ['我本机留了哪些 embedding 模型', ['m_d820c958']] —— 终轮卫生(2026-09-18)归档:
  //   死系统模型清理记录;现状(qwen3 via ollama)只在 README,池子里没有可钉的活记录,摘除。
  ['出一段视频要多久', ['m_e31258d2', 'm_dd5f687d']],
]

/** 真·跨语言:目标记录不含拉丁字母(否则英文查询靠 BM25 就能蹭上,测不到语义)。 */
export const CROSS = [
  ['when does the model get loaded and unloaded', ['m_9ecd85b5']],
  ['how long should the persona profile be', ['m_3a8929ae']],
]

/** 负例:期望"几乎不注入"。 */
export const NEG = ['明天上海天气怎么样', '推荐几部 2024 年的电影', '怎么做红烧肉', '今天股市怎么样']

/** 命中判定:id 前缀匹配(标注用前缀,实际是完整 UUID)。 */
export function firstHit(ids, targets) {
  return ids.findIndex((id) => targets.some((t) => id.startsWith(t)))
}

/**
 * 评估用的 embedding 端点。**必须在评估里显式配好**:`semanticSearch` 默认 baseUrl/modelId 为空,
 * 直接拿默认配置建 embedder 会让向量路静默关闭 —— 实测踩过:两套工具对同一指标给出 0.36 vs 0.64,
 * 根因就是其中一个没配端点、只跑了 BM25。
 */
export const EVAL_EMBED = {
  baseUrl: 'http://127.0.0.1:11434/v1',
  modelId: 'qwen3-embedding:0.6b',
  apiKeyOptional: true,
  timeoutMs: 30_000,
}

/** 合并出评估用配置,并把端点补上。 */
export function evalConfig(base) {
  return { ...base, semanticSearch: { ...base.semanticSearch, ...EVAL_EMBED } }
}

/**
 /**
 * 读**线上当前生效**的配置:schema 默认值 + profile patch 里 `id: neural-mind` 那行的 config。
 *
 * 两个历史坑叠在这里:
 *  ① **必须解包**。0.2.0 起 `validate().value` 里标了 volatile 的字段是**引用对象**而不是值,
 *    不 `resolveConfig()` 就得到 `injectMaxItems + 1 === '[object Object]1'` 这种数——
 *    `gate-sweep.mjs` 的 `K`、`inject-eval.mjs` 的 `limit` 都直接吃它,评估数字会静默失真。
 *  ② **来源换了**。原先读 `~/.dsh/settings.yaml` 的 `memory` 段;0.2.0 取消了这个用户层
 *    (启动时一次性导入 profile 后改名 `settings.yaml.imported`),设置页写的是 profile 的
 *    `cordis.patch.yml`。还按老路径读 = **永远读不到线上覆盖**,仪器与线上重新漂移。
 *
 * profile 名取 `$DSH_PROFILE`(缺省 `desktop`,即 DSH Desktop 用的那个);`$DSH_HOME` 缺省 `~/.dsh`。
 * patch 里没有 memory 行 = 全按 schema 默认值;YAML 解析失败**当场抛**(评估不许跑在错假设上)。
 * 端点仍由 evalConfig 统一覆盖:EVAL_EMBED.timeoutMs=30s 永远赢,线上的 150~600ms 是内联查询预算,
 * 拿来评估会测成延迟而不是排序。
 */
export function loadLiveConfig() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const profile = process.env.DSH_PROFILE || 'desktop'
  const file = join(home, 'profiles', profile, 'cordis.patch.yml')
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return resolveConfig(Config['~standard'].validate(undefined).value)
  }
  const doc = parseDocument(text)
  if (doc.errors.length > 0) throw new Error(`${file} 解析失败: ${doc.errors[0].message}`)
  const rows = doc.toJS()
  const row = Array.isArray(rows) ? rows.find((r) => r && (r.id === 'neural-mind' || r.id === 'memory')) : undefined
  return resolveConfig(Config['~standard'].validate(row?.config ?? {}).value)
}

/** 自检:端点没配好就当场报错,别让"向量路静默关闭"再骗人。 */
export async function assertVectorLane(embedder) {
  if (!(await embedder.available())) {
    throw new Error('评估中止:向量路不可用(baseUrl/modelId/apiKey 未配或服务未起),否则测出来的是纯 BM25')
  }
}
