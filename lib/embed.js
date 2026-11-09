/**
 * 向量路(§5):自建 HTTP 通道(无官方接缝),OpenAI 兼容 /embeddings。
 * 凭据走 credentials 服务,进程环境兜底;模型名即指纹,换模型旧向量作废。
 * 查询路 150ms 内联份额(timeoutMs);重嵌入节流:分批、单并发、串行调度(§5 v1.8)。
 */
import { bestEffort, fireAndForget } from './util.js'

/** 自适应分段:≤chunkPlainMaxChars 整条;超出按 chunkSize/chunkOverlap 滑窗。 */
export function chunkText(text, cfg) {
  if (typeof text !== 'string' || text === '') return []
  if (typeof cfg.chunkPlainMaxChars !== 'number' || !Number.isFinite(cfg.chunkPlainMaxChars) || cfg.chunkPlainMaxChars < 0) {
    throw new Error('chunkPlainMaxChars 必须是非负数')
  }
  if (text.length <= cfg.chunkPlainMaxChars) return [text]
  if (!Number.isInteger(cfg.chunkSize) || cfg.chunkSize <= 0) throw new Error('chunkSize 必须是正整数')
  if (!Number.isInteger(cfg.chunkOverlap) || cfg.chunkOverlap < 0 || cfg.chunkOverlap >= cfg.chunkSize) {
    throw new Error('chunkOverlap 必须是非负整数且小于 chunkSize')
  }
  const chunks = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(text.length, start + cfg.chunkSize)
    chunks.push(text.slice(start, end))
    if (end >= text.length) break
    start = end - cfg.chunkOverlap
  }
  return chunks
}

export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * @param deps { cfg: config.semanticSearch + 分段参数, ctx, logger, audit }
 */
export function createEmbedder({ cfg, chunkCfg, ctx, logger, audit }) {
  let lastFailure = ''
  /** 已观测到的向量维度:首次成功响应后确定,用于"端点换模型但 modelId 没改"的防呆。 */
  let dimension = null

  async function resolveKey() {
    if (cfg.apiKeyEnv === '') return undefined
    // §8 v2.0:apiKeyEnv 是 credentials 的**引用名**,语法是 `/^[A-Za-z_][A-Za-z0-9_]*$/`
    // (与宿主 `isCredentialRefName` 同判据)。宿主 `resolve()` 对语法外的名字**不抛**——
    // 官方口径是"读作未设置";这里先自查是为了不做一次注定落空的异步查找,并让"填错了"
    // 明确落到进程环境兜底,而不是静默停在"凭据缺席 → 向量路降级"。
    // 不缓存:用户可能先点一次“测试连接”看到缺密钥,再去 credentials 文件里补;
    // 缓存 undefined 会让补上的 key 一直不生效,必须重启插件。宿主 credentials
    // 是内存快照解析,逐次读取的成本可以忽略。
    const name = cfg.apiKeyEnv
    const credentials = ctx.get('credentials')
    if (credentials !== undefined && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      try {
        const hit = await credentials.resolve(name)
        if (hit !== undefined && typeof hit.value === 'string' && hit.value !== '') return hit.value
      } catch (error) {
        logger.info(`memory: 凭据解析失败(${name}): ${error?.message ?? error}`)
      }
    }
    return process.env[name]
  }

  /** 端点是否配全(与凭据无关的那部分)。 */
  function configured() {
    return cfg.enabled && cfg.baseUrl !== '' && cfg.modelId !== ''
  }

  // ── 降级计数(§5"降级率供校准"):按原因聚合后写一条审计,不逐次刷屏 ──────────
  // 阈值 10 次 或 距上次落账 5 分钟;首次降级立即落一条(否则"到底有没有走向量路"无从判断)。
  const degraded = new Map()
  let sinceFlush = 0
  let lastFlushMs = 0
  function note(reason) {
    degraded.set(reason, (degraded.get(reason) ?? 0) + 1)
    sinceFlush += 1
    const now = Date.now()
    if (sinceFlush >= 10 || now - lastFlushMs >= 300_000) flush(now)
  }
  function flush(now) {
    if (degraded.size === 0 || audit === undefined) return
    const detail = `model=${cfg.modelId === '' ? '(未配)' : cfg.modelId} ${[...degraded]
      .map(([reason, count]) => `${reason}=${count}`).join(' ')}`
    degraded.clear()
    sinceFlush = 0
    lastFlushMs = now
    fireAndForget(audit.write('embed-degraded', detail), logger, 'memory: 降级审计')
  }

  async function available() {
    if (!configured()) return false
    const key = await resolveKey()
    if (key !== undefined) return true
    if (cfg.apiKeyOptional === true) return true
    // 配好了端点却没凭据:向量路静默关闭。这条最容易踩,记进降级账(否则表现是"配了没用")
    lastFailure = `缺少 embedding 凭据(apiKeyEnv=${cfg.apiKeyEnv === '' ? '(空)' : cfg.apiKeyEnv})`
    note('no-key')
    return false
  }

  /** POST {baseUrl}/embeddings;失败返回 null(降级纯 BM25,不打扰聊天)。 */
  async function callEmbeddings(texts, timeoutMs) {
    lastFailure = ''
    const key = await resolveKey()
    if (key === undefined && cfg.apiKeyOptional !== true) {
      lastFailure = `缺少 embedding 凭据(apiKeyEnv=${cfg.apiKeyEnv === '' ? '(空)' : cfg.apiKeyEnv})`
      note('no-key')
      return null
    }
    const url = `${cfg.baseUrl.replace(/\/+$/, '')}/embeddings`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...key === undefined ? {} : { authorization: `Bearer ${key}` },
        },
        body: JSON.stringify({ model: cfg.modelId, input: texts }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) {
        lastFailure = `embedding HTTP ${res.status}`
        logger.info(`memory: embedding HTTP ${res.status}(已降级纯 BM25)`)
        note(`http-${res.status}`)
        return null
      }
      const body = await res.json()
      const data = body?.data
      if (!Array.isArray(data) || data.length !== texts.length) {
        lastFailure = 'embedding 响应 data 形状不符'
        note('shape')
        return null
      }
      const vectors = data.map((d) => (Array.isArray(d?.embedding) ? d.embedding : null))
      // 维度防呆(§5):空向量、同批内不等长都算形状不符;**跨响应维度变化**意味着端点换了模型
      // 但 modelId 没改——此时绝不能把两种维度的向量混用:cosine() 对不等长会静默返回 0,
      // 外在表现只是"向量路突然聋了",没有任何告警。这里当场降级纯 BM25 并记账。
      const first = vectors[0]
      if (first === null || first === undefined || first.length === 0) {
        lastFailure = 'embedding 响应 data 形状不符'
        note('shape')
        return null
      }
      if (!vectors.every((v) => Array.isArray(v) && v.length === first.length)) {
        lastFailure = 'embedding 响应内维度不一致'
        note('shape')
        return null
      }
      if (dimension === null) {
        dimension = first.length
      } else if (dimension !== first.length) {
        lastFailure = `embedding 维度变化(${dimension} → ${first.length}):端点换了模型但 modelId 仍是 ${cfg.modelId};请同步 modelId,旧向量会按指纹重嵌入`
        logger.info(`memory: ${lastFailure}(本次降级纯 BM25)`)
        note('dim-mismatch')
        return null
      }
      return vectors
    } catch (error) {
      // 超时/网络失败:静默降级(只记账,不打扰聊天)
      const name = error?.name
      const reason = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network'
      lastFailure = `embedding ${reason === 'timeout' ? '超时' : '网络错误'}: ${error?.message ?? error}`
      note(reason)
      return null
    }
  }

  return {
    /** 指纹:换模型后旧向量作废(§1)。 */
    model: cfg.modelId,
    available,
    /** 已观测到的向量维度(首次成功响应后确定;null = 尚未观测)。 */
    dimension: () => dimension,
    /** 最近一次失败的可读原因(记忆页健康检查用;成功调用会清空)。 */
    lastFailure: () => lastFailure,
    /**
     * 检索侧发现"库中向量维度与当前端点不符"时用它记账:复用同一降级账(按原因计数 + 节流落审计),
     * 不另造一套审计噪声源。
     */
    noteDegraded: (reason) => note(reason),
    /** 查询路:内联预算内(默认 150ms);超时/失败 → null,调用方降级纯 BM25。 */
    async embedQuery(text) {
      const vectors = await callEmbeddings([text], cfg.timeoutMs)
      return vectors?.[0] ?? null
    },
    /** 写入路:批量一次调用(token 总量与不分段相同);失败静默。 */
    async embedChunks(text) {
      const pieces = chunkText(text, chunkCfg)
      if (pieces.length === 0) return undefined
      const vectors = await callEmbeddings(pieces, 30_000)
      if (vectors === null || vectors.some((v) => v === null)) return undefined
      return pieces.map((piece, i) => ({ text: piece, embedding: vectors[i] }))
    },
    /**
     * 预热:发一次极小的真实调用,把模型拉进显存(本地服务多为懒加载)。
     * 预算独立且宽松——冷加载几秒到几十秒,不能按查询路那 150ms 算;
     * 失败照常进降级账,不抛错。
     */
    async warm(timeoutMs = 60_000) {
      if (!(await available())) return false
      const vectors = await callEmbeddings(['warmup'], timeoutMs)
      return vectors !== null && vectors[0] !== null
    },
    /**
     * 记忆页“测试连接”:发一条极短文本,返回模型/维度/延迟或可读错误。
     * 不改任何记忆;失败也不会让聊天降级(只是本次探针失败)。
     */
    async probe(timeoutMs = 10_000) {
      if (!configured()) {
        return { ok: false, error: '向量路未配置:需要同时填 enabled/baseUrl/modelId' }
      }
      if (!(await available())) {
        return { ok: false, error: lastFailure || '向量路不可用' }
      }
      const started = Date.now()
      const vectors = await callEmbeddings(['memory embedding connectivity test'], timeoutMs)
      const latencyMs = Date.now() - started
      if (vectors === null || !Array.isArray(vectors[0]) || vectors[0].length === 0) {
        return { ok: false, error: lastFailure || 'embedding 调用失败', latencyMs }
      }
      return {
        ok: true,
        model: cfg.modelId,
        dimensions: vectors[0].length,
        latencyMs,
      }
    },
  }
}

/**
 * 换模型重嵌入(§5 v1.8 节流):后台分批、单并发、串行延迟调度;
 * 完成前向量路对指纹不符的记录天然降级(检索侧按 fingerprint 跳过)。
 */
export function createReembedder({ store, embedder, cfg, logger, schedule, search, isPrivate = () => false, audit }) {
  let running = false

  async function run() {
    if (running) return
    if (!(await embedder.available())) return
    if (!Number.isInteger(cfg.reembedBatchSize) || cfg.reembedBatchSize <= 0) {
      throw new Error('reembedBatchSize 必须是正整数')
    }
    running = true
    try {
      // 维度防呆:modelId 没变但库里向量维度与当前端点不符时,也视为待重嵌入——否则
      // 这些向量永远算不出分(cosine 对不等长静默返回 0),且只有日志里一行告警。
      const knownDim = typeof embedder.dimension === 'function' ? embedder.dimension() : null
      const dimMismatch = (record) => {
        if (knownDim === null) return false
        if (!Array.isArray(record.chunks) || record.chunks.length === 0) return false
        return record.chunks.some((chunk) => !Array.isArray(chunk?.embedding) || chunk.embedding.length !== knownDim)
      }
      const stale = (record) => record.embeddingModel !== embedder.model || dimMismatch(record)
      const pending = []
      for (const [id, record] of store.memories.entries()) {
        if (record.hidden === true || record.status === 'archived' || isPrivate(record.workspaceId)) continue
        if (stale(record)) pending.push({ table: store.memories, ref: 'mem', id, text: record.content })
      }
      for (const [id, entry] of store.hotbuffer.entries()) {
        if (entry.hidden === true || isPrivate(entry.workspaceId)) continue
        if (stale(entry)) pending.push({ table: store.hotbuffer, ref: 'hot', id, text: entry.content })
      }
      let skipped = 0
      for (let i = 0; i < pending.length; i += cfg.reembedBatchSize) {
        const batch = pending.slice(i, i + cfg.reembedBatchSize)
        for (const item of batch) {
          // TOCTOU:快照之后记录可能被 hidden/归档/private 化;发送前重新读。
          const current = item.ref === 'mem' ? store.memories.get(item.id) : store.hotbuffer.get(item.id)
          if (current === undefined
            || current.hidden === true
            || (item.ref === 'mem' && current.status === 'archived')
            || (item.ref === 'hot' && current.digested === true)
            || isPrivate(current.workspaceId)) {
            skipped += 1
            continue
          }
          const chunks = await embedder.embedChunks(current.content)
          if (chunks === undefined) continue
          const updated = await bestEffort(item.table
            .update(item.id, (cur) => ({ ...cur, chunks, embeddingModel: embedder.model })))
          if (updated === undefined) continue
          // store 成功后才同步 corpus;hot 的 upsertHot 会自行处理 digested/hidden。
          if (item.ref === 'mem') search.upsertMemory(updated)
          else search.upsertHot(updated)
        }
        if (i + cfg.reembedBatchSize < pending.length) await new Promise((resolve) => schedule(resolve, 1000))
      }
      if (skipped > 0) {
        await audit?.write('reembed-skipped', `重嵌入跳过 ${skipped} 条(快照后被 hidden/归档/private/digested)`)
        logger.info(`memory: 重嵌入跳过 ${skipped} 条(状态在运行中改变)`)
      }
      if (pending.length > 0) logger.info(`memory: 重嵌入完成,共 ${pending.length} 条`)
    } finally {
      running = false
    }
  }

  return {
    /** 空闲时调用;已在跑则跳过。 */
    kick() {
      fireAndForget(run(), logger, 'memory: 重嵌入')
    },
  }
}
