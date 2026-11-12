/**
 * DSH 记忆插件(设计:DESIGN.md 总览 + docs/design/ 机制细则;§11 实施路线已归 docs/legacy/)。
 *
 * 接线纪律(§3.0):turn/end 按 reason 过滤;先 outbox 后热缓冲;幂等键查重;
 * 自有定时器全部可 dispose;热替换丢内存态,热缓冲与 outbox 落盘可恢复。
 * 降级纪律(§7):一切外部能力 ctx.get 探测,缺席不崩。
 * 配置纪律(§8 v2.0):entry 的 config 就是记忆页编辑的那一段;标了 volatile 的字段
 * 由 Loader **原地提交**新值(整插件不重挂载),读配置经 resolveConfig 实时解包;
 * 变更经 loader/volatile-update 触发热重建(dispose + 按新配置从存储重建)。
 * 含普通字段的变更不走这条路:Loader 整插件重挂载,apply 重新执行。
 */
import { createAudit } from './audit.js'
import { hasVolatileFields, onVolatileUpdate, resolveConfig } from './compat.js'
import { Config, validateChunkConfig } from './config.js'
import { createEmbedder, createReembedder } from './embed.js'
import { createExtractor } from './extract.js'
import { createHotBuffer } from './hotbuffer.js'
import { createInjectionLog } from './injectionlog.js'
import { registerInjection, registerProfile, registerSoul } from './inject.js'
import { createOutbox } from './outbox.js'
import { registerApi } from './api.js'
import { createMemoryOps } from './ops.js'
import { batchRoleOf, rolesOfSessionRange } from './provenance.js'
import { reconcileArchiveState, shouldArchive } from './rank.js'
import { createSearch } from './search.js'
import { createSidecar } from './sidecar.js'
import { createSoul, defaultSoulPath, isRejectedSoulFile } from './soul.js'
import { openStore } from './store.js'
import { createUsage } from './usage.js'
import { TurnTracker } from './turns.js'
import { registerTools } from './tools.js'
import { bestEffort, fireAndForget, nowIso, truncateChars } from './util.js'
import { createSeenWorkspaceRegistry, createWorkspaceResolver, isPrivateWorkspace, isWorkspaceDisabled } from './workspace.js'

export { Config }
export const name = 'neural-mind'

/** 记忆页 namespace(浏览器半以此为 join key;等于 profile entry id,见 lib/schema.js 顶部)。 */
export const SETTINGS_NS = 'neural-mind'

const SWEEP_INTERVAL_MS = 30 * 60_000

const ONBOARDING = `memory: 首次运行 —— 全局记忆池已启用(热缓冲 + 后台提炼 + 混合检索)。
  隐私项可选:privateWorkspaces(只进不出);sensitiveNoCross / sensitiveKeywords 默认关闭(个人使用不需要),要按敏感内容隔离时再打开;
  研究或跨语言用法强烈建议配置 semanticSearch(embedding);办公用户建议为表格/搜索类工具配 toolOutputOverrides;
  注意:落盘明文(本机单人使用为前提);分开目录才有隔离。
  详见插件 README。配置入口:主侧栏「记忆」;或 profile 的 cordis.patch.yml 给 id: neural-mind 行写 config。`

/**
 * 配置来源(§8 v2.0 接缝):
 *
 * 0.1.6 的分层是「schema 默认 ← cordis entry ← settings.yaml 用户层」,靠
 * `settings.installSection` 的 `setSource` 拿到合并结果。0.2.0 换成了 Loader 自己的
 * 一套:entry 的 config **就是**记忆页编辑的那份(设置写入经 configEditor 落进 profile
 * 的 cordis.patch.yml,再走正常 Loader 路径回来)。
 *
 * 其中标了 `.volatile()` 的字段在解析后是**引用对象**,Loader 原地提交新值——所以
 * `resolveConfig(config)` 永远读到当前值,不需要 setSource 这条通道,也不需要缓存。
 * 这里因此是一个纯函数:每次调用都反映最新配置。
 *
 * 含**普通**字段的变更不在此列:Loader 会整插件重挂载,`apply` 重新拿到新 config。
 */
export async function apply(ctx, config) {
  const logger = ctx.logger('memory')

  /** 读当前配置(volatile 引用已解包成纯值)。 */
  const getConfig = () => resolveConfig(config)

  // scope 已按产品决策固定 global;旧 profile 里的字段不丢弃、不报错,只提醒迁移。
  const legacyScope = resolveConfig(config)?.scope
  if (legacyScope !== undefined) {
    process.stderr.write(`[memory] scope 已停用(旧值 ${String(legacyScope)}),检索固定 global;可从 profile 配置中删除该字段\n`)
  }

  // 回合累积与事件监听跨热重建存活:重建期间的合格回合进 pendingPkgs,
  // 新运行时就绪后统一消化,一个都不丢。
  const turns = new TurnTracker()
  const pendingPkgs = []
  let handleTurnFn = null
  let warmWorkspaceFn = null
  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/start') warmWorkspaceFn?.(session.header?.cwd)
    let pkg = null
    try {
      pkg = turns.onEvent(session, event)
    } catch (error) {
      logger.info(`memory: 回合累积失败(已跳过): ${error?.message ?? error}`)
    }
    if (pkg === null) return
    if (handleTurnFn !== null) fireAndForget(handleTurnFn(pkg), logger, 'memory: 回合写入')
    else pendingPkgs.push(pkg)
  })

  let alive = true
  let cleanup = async () => {}
  let rebooting = false
  let rebootAgain = false
  /** 存储晚到恢复只挂一次(避免反复重建) */
  let storageRecoveryArmed = false
  /** 最近一次成功 boot 的 audit(仅供"启动失败"落一条可诊断记录;失败后清空)。 */
  let auditRef = null
  /**
   * 启动健康(§13 可观测性):回合管道到底有没有接上。
   * 之前"页面开着但回合永远不记录"是**静默**的——boot 在 registerApi 之后、
   * `handleTurnFn = handleTurn` 之前抛错,就没留下任何用户可见线索。
   * 现在:状态进 /neural-mind/api 的 stats,记忆页诊断卡能报警;失败也落一条审计(存储可用时)。
   */
  const health = { state: 'booting', error: '', at: '', warnings: [] }

  // 本地 embedding 边车(§5 v1.9):随 dsh 进程生灭,跨热重建存活——
  // 记忆页改一次配置会热重建,边车不能跟着重启(否则每次保存都重拉一遍模型)。
  let currentAudit = null
  // 预热必须走"当前这一代"的 embedder:插件先按 cordis 基座配置 boot 一次
  // (那时 baseUrl/modelId 还是空的),设置层附着后才热重建出真正可用的 embedder。
  // 边车是进程级的、不随热重建重启,若抓住第一代的闭包去预热,就会出现
  // "available() 立刻 false → 0ms 预热失败"这种哑火(实测踩过)。
  let currentWarm = async () => false
  const sidecar = createSidecar({
    getCfg: () => getConfig()?.semanticSearch,
    logger,
    report: (kind, detail) => fireAndForget(currentAudit?.write(kind, detail), logger, `memory: ${kind}`),
  })

  async function boot(cfg) {
    validateChunkConfig(cfg)
    const rankCfg = { ...cfg.decay, ...cfg.scoring }
    const store = await openStore(ctx, logger, { timeoutMs: cfg.storageOpenTimeoutMs })
    if (!alive) {
      await store.close()
      return async () => {}
    }

    const workspace = createWorkspaceResolver({ privateWorkspaces: cfg.privateWorkspaces })
    // 工作区选择器的数据源:记录"见过的工作区"(停用的也记,否则 UI 里消失后无法再启用)
    const noteSeenWorkspace = createSeenWorkspaceRegistry({ store, logger })
    warmWorkspaceFn = (cwd) => fireAndForget(workspace.resolve(cwd), logger, 'memory: 籍贯预解析')
    // 降级账(§5:降级率供校准)落审计 → 先建 audit 再建 embedder
    const audit = createAudit({ store, logger })
    auditRef = audit
    currentAudit = audit
    // §14 使用观测(0.6.7):独立短命域。读回已有遥测 + 起清理定时器;
    // 域不可用或 usageLog=false 时整体退化为"未落盘"(等价 0.6.6 行为),不抛错。
    const usage = createUsage({ store, cfg, audit, logger, health })
    await usage.start()
    const embedder = createEmbedder({ cfg: cfg.semanticSearch, chunkCfg: cfg, ctx, logger, audit })
    // 维度防呆的自愈钩子:检索发现库里向量维度与当前端点不符 → 触发一次重嵌入。
    // 先声明后赋值:search 建在 reembedder 之前(它只需要一个"该跑了"的信号,不依赖实例)。
    let reembedder = null
    const search = createSearch({ cfg, rankCfg, embedder, logger, turns, onVectorMismatch: () => reembedder?.kick() })

    // 边车:端口没人听才拉起(幂等;已有外部服务则记一条 external 后不插手);
    // 开了 autoStartWarmup 时,就绪后顺手预热——用真实 embedder,预算宽松(冷加载几十秒)
    currentWarm = () => embedder.warm()
    void sidecar.ensure(() => currentWarm())
      .catch((error) => logger.info(`memory: 边车启动失败(向量路照常降级): ${error?.message ?? error}`))

    // SOUL 自我设定(§4.4):真相源是文件,启动时读一次进内存镜像;
    // 之后由 pre-step 轮询(外部手改)、soul_propose 工具与记忆页刷新
    // 配置卫生:soulFile 只写一个 `~` 指家目录本身(读必失败)——拒绝取值、回退默认,并留痕。
    // 留 stderr 一行是因为默认日志级别下 logger.info 不可达(§13 的启动级失败纪律)。
    if (isRejectedSoulFile(cfg.soulFile)) {
      process.stderr.write('[memory] soulFile 配成 "~"(那是家目录,不是文件):已改按默认路径处理;要家目录请写 "~/SOUL.md"\n')
      await bestEffort(audit.write('soul-path-rejected', `soulFile=${JSON.stringify(cfg.soulFile)} 指向目录,已回退 ${defaultSoulPath(process.env)}`))
    }
    const soul = createSoul({ cfg, store, audit, logger })
    await soul.refresh('boot')
    let extractorRef = null
    const hotbuffer = createHotBuffer({
      store, search, cfg, embedder, audit, logger,
      onFuse: (sessionId) => extractorRef?.forceSession(sessionId),
      // R16:删"未消化"L0 副本前确认原文仍能从会话日志读回(读不回则保留并告警——
      // 用户关掉提炼后,L0 可能是唯一一份;DESIGN §3.1/§9.9)。服务缺席同样按读不回处理。
      restoreCheck: async (entry) => {
        const sessionQuery = ctx.get('sessionQuery')
        if (sessionQuery === undefined) return false
        try {
          const snapshot = await sessionQuery.readSession(entry.sessionId)
          const events = snapshot?.events ?? []
          return Number.isFinite(entry.startSeq) && Number.isFinite(entry.endSeq)
            && events.some((e) => e.seq >= entry.startSeq && e.seq <= entry.endSeq)
        } catch {
          return false // 读盘失败 = 读不回:保留副本,等下次清扫复查
        }
      },
    })
    const outbox = createOutbox({ store, cfg, audit, logger })

    // 启动即重建内存语料(热替换丢内存态,落盘可恢复,§3.0)
    search.rebuild(
      [...store.memories.entries()].map(([, v]) => v),
      [...store.hotbuffer.entries()].map(([, v]) => v),
    )

    const extractor = createExtractor({
      ctx, store, cfg, rankCfg, search, hotbuffer, outbox, turns, audit, embedder, logger, usage,
    })
    extractorRef = extractor
    await extractor.pruneBatchPayloads()

    const handleTurn = async (pkg) => {
      const ws = await workspace.resolve(pkg.cwd)
      fireAndForget(noteSeenWorkspace(ws), logger, 'memory: 记录见过的工作区')
      // 工作区停用(v1.14):完全不介入——不登记 outbox、不写热缓冲(也就不会产生提炼)
      if (isWorkspaceDisabled(ws.id, cfg.disabledWorkspaces)) return
      if (cfg.extractEnabled) {
        // 顺序纪律:先写 outbox(登记引用),再写热缓冲(§3.0)
        const registered = await outbox.register(pkg, ws)
        if (!registered) return // 幂等键命中,防重复提炼
        await hotbuffer.writeTurn(pkg, ws)
        extractor.notifyTurn(pkg)
      } else {
        await hotbuffer.writeTurn(pkg, ws)
      }
    }

    // L1 用户画像(§4.1):启动读一次进内存镜像;之后由 agent/pre-step 轮询补上外部手改
    const profile = await registerProfile({ ctx, cfg, logger, audit })
    // 注入日志(v1.15):进程内环形缓冲,给记忆页「总览/召回」解释"这一轮注入了什么/为什么没注入"。
    // 不落盘、不记正文;热重建时重新开一份(它只描述本次运行)。
    const injectionLog = createInjectionLog({ max: 60, onRecord: (row) => usage.recordInjection(row) })

    // R1a(0.6.6):记忆写操作(停用/恢复/改标记/彻底隐藏)与来源展开——控制台与工具共用一套实现
    const ops = createMemoryOps({ ctx, cfg, rankCfg, store, search, hotbuffer, audit, turns, workspace, logger })

    const disposers = [
      registerInjection({ ctx, cfg, rankCfg, search, store, workspace, audit, logger, soul, profile, injectionLog }),
      registerTools({ ctx, cfg, rankCfg, search, store, hotbuffer, workspace, audit, embedder, logger, soul, turns, usage, ops }),
      registerApi({ ctx, cfg, rankCfg, store, search, audit, logger, soul, profile, embedder, injectionLog, usage, health, extractor, ops }),
      registerSoul({ ctx, soul, logger, audit }),
      profile.dispose,
      () => fireAndForget(usage.dispose(), logger, 'memory: 使用观测落盘'),
    ]

    // ── 回合管道先激活,再跑可降级的启动后置步骤(§13 可观测性纪律)──────────
    // handleTurn 所需的依赖(workspace/outbox/hotbuffer/extractor)在它定义前就齐了。
    // 以前"活动管道"排在 outbox 对账/清扫/重嵌入/首启引导之后:那条链路任一抛错,
    // boot 整体失败 → 页面和 /neural-mind/api 还在(已在上面注册),回合却永远不记录,
    // 且只有一行 stderr。现在的顺序把"能不能记"和"能不能清扫"解耦:
    // 管道先接上,后置步骤失败只进 health/审计,记忆写入照常。
    //
    // 首启引导**必须排在激活之前**:它也是一次 global 读改写(见下),而 noteSeenWorkspace
    // 同样是读改写;管道一旦激活,回合写入与引导写就可能并发,后写覆盖先写会把
    // `onboardedAt` 挤掉(表现为隐私引导重复提示)。激活前写 → 单一写者,无竞态。
    if (store.global.get()?.onboardedAt === undefined) {
      logger.info(ONBOARDING)
      await bestEffort(store.global.set({ ...(store.global.get() ?? {}), version: 1, onboardedAt: nowIso() }))
    }

    handleTurnFn = handleTurn
    for (const pkg of pendingPkgs.splice(0)) fireAndForget(handleTurn(pkg), logger, 'memory: 回合写入')
    health.state = 'ready'
    health.error = ''
    health.at = nowIso()
    health.warnings = []

    let sweepTimer = null
    try {
      // storageDomain **缺席**时挂一次性恢复:服务一出现就重建一次。
      // 注意只在"缺席"时挂——若服务存在但 open 失败/超时,present-but-broken 会让恢复路径反复触发,
      // 变成每轮重建的活锁(实测:工具注册后被立刻拆掉,无限循环);那种情况已由 stderr + 降级交代。
      if (store.persisted !== true && ctx.get('storageDomain') === undefined && !storageRecoveryArmed) {
        storageRecoveryArmed = true
        const fiber = ctx.inject(['storageDomain'], () => {
          fireAndForget(reboot(), logger, 'memory: 存储晚到重建')
        })
        disposers.push(() => { bestEffort(Promise.resolve(fiber?.dispose?.())) })
      }

      // 启动对账(§3.0)+ 积压消化 + 周期清扫
      await outbox.reconcile(hotbuffer)
      // R16b(0.6.6,用户 2026-11-09 裁决"选 C"):重新打开提炼后,把"关掉期间写下、没有
      // outbox 引用"的未消化 L0 补登记,补做一次提炼(不丢那段对话;代价是补提炼的模型调用)。
      // 停用工作区仍完全不介入;积压上限由 R16 的 hotBufferUndigestedTtlHours 兜底。
      if (cfg.extractEnabled) {
        await outbox.registerOrphans(hotbuffer, {
          skip: (entry) => isWorkspaceDisabled(entry.workspaceId, cfg.disabledWorkspaces),
          wsFor: async (entry) => {
            const resolved = await workspace.resolve(entry.workspaceId)
            return {
              id: entry.workspaceId ?? resolved.id,
              label: entry.workspaceLabel ?? resolved.label,
              gitRoot: resolved.gitRoot,
            }
          },
        })
      }
      extractor.flushAll()
      // R13b(0.6.6):旧记录来源回填——一次性。工具/模型写进来的 source 不可信,旧数据里
      // 一律是"用户说的",不能听模型自报:有 sessionId + sourceRange 的按原文角色重算;
      // 没有可复核 provenance 的标 source='unknown'(来源查不清,不猜)。
      // 用 global.sourceRemapVersion 防每次启动重扫;sessionQuery 缺席时不动旧数据,下次再试。
      await backfillLegacySources()
      await sweepAll()

      /**
       * R13b ⑤:旧记录来源回填。只处理 user/assistant 这一轴(code/tool/quote 是内容分类,
       * 描述"从哪类材料看到的",不动);界面确认过的(confirmedByUser)不动。
       * 读不回会话日志 = 不猜 → 'unknown'。
       */
      async function backfillLegacySources() {
        if (store.global.get?.()?.sourceRemapVersion === 1) return
        const sessionQuery = ctx.get('sessionQuery')
        if (sessionQuery === undefined) return // 会话管道还没就绪:保留旧数据,下次启动回填
        const sessions = new Map() // sessionId → events | null
        const readEvents = async (sessionId) => {
          if (sessions.has(sessionId)) return sessions.get(sessionId)
          let events = null
          try {
            events = (await sessionQuery.readSession(sessionId))?.events ?? null
          } catch {
            events = null // 读盘失败 = 读不回,按"查不清"处理
          }
          sessions.set(sessionId, events)
          return events
        }
        let remapped = 0
        let unknown = 0
        for (const [id, m] of [...store.memories.entries()]) {
          if (m.source !== 'user' && m.source !== 'assistant') continue
          if (m.confirmedByUser === true) continue
          let next
          if (typeof m.sessionId !== 'string' || m.sessionId === '' || m.sourceRange === undefined) {
            next = 'unknown'
          } else {
            const events = await readEvents(m.sessionId)
            if (events === null) {
              next = 'unknown'
            } else {
              const role = batchRoleOf(rolesOfSessionRange(events, m.sourceRange.startSeq, m.sourceRange.endSeq))
              next = role === 'user' ? 'user' : 'assistant'
            }
          }
          if (next === m.source) continue
          const updated = await bestEffort(store.memories.update(id, (cur) => ({ ...cur, source: next })))
          if (updated === undefined) continue
          search.upsertMemory(updated)
          if (next === 'unknown') unknown += 1
          else remapped += 1
        }
        await bestEffort(store.global.set({ ...(store.global.get() ?? {}), sourceRemapVersion: 1 }))
        if (remapped + unknown > 0) {
          await audit.write('source-backfilled', `旧记录来源回填:按原文角色重算 ${remapped} 条、标"来源查不清" ${unknown} 条(不猜用户来源)`)
          logger.info(`memory: 旧记录来源回填完成(重算 ${remapped} 条,查不清 ${unknown} 条)`)
        }
      }
      async function sweepMemories() {
        const nowMs = Date.now()
        for (const [id, m] of [...store.memories.entries()]) {
          if (m.status === 'archived') continue
          // §6 读时对账:清零先于归档判定(E 升回 > 阈值的条目不该再被旧 negativeSince 归档)
          const clearPatch = reconcileArchiveState(m, nowMs, rankCfg)
          const live = clearPatch === null ? m : { ...m, ...clearPatch }
          const reason = shouldArchive(live, nowMs, rankCfg)
          if (reason === null) {
            if (clearPatch !== null) {
              const cleared = await bestEffort(store.memories.update(id, (cur) => ({ ...cur, ...clearPatch })))
              if (cleared !== undefined) search.upsertMemory(cleared)
            }
            continue
          }
          const updated = await bestEffort(store.memories.update(id, (cur) => ({ ...cur, status: 'archived' })))
          if (updated !== undefined) search.upsertMemory(updated)
          await audit.write('auto-archive', `${id}(${reason}): ${truncateChars(m.content, 120)}`, m.sessionId)
        }
      }
      async function sweepAll() {
        await hotbuffer.sweep()
        await sweepMemories()
        await audit.prune()
      }
      // 周期清扫:Node 定时器 + 显式 disposer(读未 inject 的 ctx 属性会抛,不依赖 ctx.interval mixin)
      sweepTimer = setInterval(() => fireAndForget(sweepAll(), logger, 'memory: 周期清扫'), SWEEP_INTERVAL_MS)
      sweepTimer.unref?.()

      // 换模型重嵌入(节流,§5):完成前向量路对指纹不符条目天然降级;维度不符条目也在这里自愈
      reembedder = createReembedder({
        store, embedder, cfg: cfg.semanticSearch, logger, search,
        isPrivate: (workspaceId) => isPrivateWorkspace(workspaceId, cfg.privateWorkspaces),
        audit,
        schedule: (cb, ms) => setTimeout(cb, ms),
      })
      fireAndForget(embedder.available().then((ok) => { if (ok) reembedder.kick() }), logger, 'memory: 重嵌入调度')
    } catch (error) {
      const message = error?.message ?? String(error)
      health.warnings.push(`启动后置步骤失败(回合管道已启用): ${message}`)
      logger.info(`memory: 启动后置步骤失败(回合管道照常,降级运行): ${message}`)
      process.stderr.write(`[memory] 启动后置步骤失败(回合管道已启用,记忆照常写入;清扫/重嵌入可能缺席): ${message}\n`)
      await bestEffort(audit.write('boot-degraded', message))
    }

    return async () => {
      handleTurnFn = null
      warmWorkspaceFn = null
      if (sweepTimer !== null) clearInterval(sweepTimer)
      // 逐个 await 且互不牵连:registerSoul 的注销器是 async(要等段卸干净),
      // 而任何一个注销器抛错都不该让后面的注销与 store.close() 被跳过
      // (跳过 close → 旧 domain 未释放 → 下次 open 撞 already-open → 静默降级纯内存)
      for (const dispose of [...disposers].reverse()) {
        try {
          await dispose()
        } catch (error) {
          logger.info(`memory: 注销器失败(继续卸载): ${error?.message ?? error}`)
        }
      }
      extractor.dispose()
      await store.close()
      if (auditRef === audit) auditRef = null
    }
  }

  /** 串行热重建;重建期间的新请求合并为最后一次。 */
  async function reboot() {
    if (rebooting) {
      rebootAgain = true
      return
    }
    rebooting = true
    health.state = 'booting'
    try {
      do {
        rebootAgain = false
        try {
          await cleanup()
        } catch (error) {
          // cleanup 里跑的是第三方 disposer 与 store.close():任何异常都不能逃逸成 unhandledRejection
          // (Node 默认 --unhandled-rejections=throw → 整个进程崩)
          logger.info(`memory: 热重建清理失败(继续引导新运行时): ${error?.message ?? error}`)
          process.stderr.write(`[memory] 热重建清理失败(继续): ${error?.message ?? error}\n`)
        }
        if (!alive) return
        try {
          cleanup = await boot(getConfig())
        } catch (error) {
          // 启动失败 = 插件停用但对话照常;logger 默认部署不可达,stderr 留一行
          const message = error?.message ?? String(error)
          health.state = 'failed'
          health.error = message
          health.at = nowIso()
          logger.info(`memory: 启动失败(对话照常,记忆停用): ${message}`)
          process.stderr.write(`[memory] 启动失败,记忆插件未生效: ${message}\n`)
          // 能落盘就落一条:否则用户只能在 stderr 里找(桌面版通常看不到)
          const failedAudit = auditRef
          auditRef = null
          if (failedAudit !== null) await bestEffort(failedAudit.write('boot-failed', message))
          cleanup = async () => {}
        }
      } while (rebootAgain)
    } finally {
      rebooting = false
    }
  }

  // 启动:配置直接来自 entry(volatile 引用由 getConfig 实时解包,§8 v2.0)。
  // **必须 await 第一次 boot**:工具与注入的注册都在 boot 内落地;apply 若提前返回,
  // 宿主可能在注册完成前就解析首轮工具集(DSH 0.2.2-rc.1 实测:冷启动首轮
  // memory_remember 报 unknown tool、注入为 0)。boot 失败由 reboot 内部吞掉并记
  // health/stderr,不会阻断宿主(与"对话照常"的既有纪律一致)。
  await reboot()

  // ── 设置接缝(§8 v2.0)────────────────────────────────────────────────────
  //
  // 0.2.0 的 `settings` 服务**不再**让插件登记自己的 namespace:entry 的 config 就是
  // 那一段,记忆页按 entry id(本插件是 `memory`)寻址。插件这边只剩两件事:
  //
  //  ① `configure({ auto: false }, ctx.fiber)`:声明"这个插件自带页面"。
  //     这是**前向兼容,不是救火**:0.2.0-rc.1 的发行版前端并不按 schema 自动生成配置页
  //     (官方 `dsh-settings/README.zh.md` 自陈"目前没有已发布的客户端用它",实测发行包
  //     `dsh-web-frontend` 里 `autoGenerate` 零命中,记忆页分区全部来自 slot `settings.section`)。
  //     登记它的意义是:将来若有客户端按 `autoGenerate` 生成表单,不会和本页撞成两个入口。
  //     策略挂在**插件自己的 fiber** 上,所以要显式传 `ctx.fiber`(不传会记到 settings 服务
  //     自己的 fiber 上,那条策略永远匹配不到任何 entry)。重复登记会抛,故 catch 后只留痕。
  //     `configure()` 返回注销器,官方姿势是登记进插件自己的 effects(策略表按 fiber 强引用,
  //     不撤销就会在每次重挂载后留住一个已销毁的 fiber)。
  //
  //  ② `loader/volatile-update` → 读新值 → 热重建。Loader 在"只有 volatile 字段变了"时
  //     原地提交引用并 emit 这个事件(整插件不重挂载);含普通字段的变更走另一条路
  //     ——整插件重挂载、`apply` 重新执行——两者最终都落到 `reboot()` 同一入口。
  //     一个不显眼的例外:`_commitVolatile` 里新值**解析失败**时(非法取值),Loader 只
  //     `logger.warn` 并保持旧引用、**既不重挂载也不发事件**(raw 已存下,下次激活才生效)。
  //     所以"记忆页保存了却没动静"是这条路径的真实可能,不是本插件的 bug;审计与日志里查不到
  //     它(宿主 warn 在插件 ctx 之外),真机排查时按 stderr 的宿主 warn 找。
  //
  // settings 服务缺席时两条都不挂:配置仍走 profile 的 cordis.patch.yml,改动照样生效。
  ctx.inject(['settings'], (settingsCtx) => settingsCtx.effect(() => {
    try {
      return settingsCtx.settings.configure({ auto: false }, ctx.fiber)
    } catch (error) {
      logger.info(`memory: 自动配置页策略登记失败(自带页面不受影响): ${error?.message ?? error}`)
    }
  }, 'memory: settings presentation'))
  ctx.effect(() => onVolatileUpdate(ctx, (paths) => {
    fireAndForget(
      (async () => {
        const words = paths.map((p) => (Array.isArray(p) ? p.join('.') : String(p))).join(', ')
        logger.info(`memory: 配置已更新(${words || 'volatile'}),热重建中`)
        await reboot()
      })(),
      logger,
      'memory: volatile 重配置',
    )
  }), 'memory: volatile config watch')

  // 可观测性(§13 工程结论):"记忆页看不到配置"是本插件最容易静默失败的一环——
  // 多半是 Config 里一个 volatile 字段都没标,或 Schemastery 太旧没有 `.volatile()`。
  // 不阻塞启动,但必须留一行 stderr,否则用户只会看到"设置里没有记忆的配置项"。
  if (!hasVolatileFields(config)) {
    process.stderr.write(
      '[memory] 未检测到 volatile 配置字段:记忆页不会显示本插件的配置表单'
      + '(旧版 Schemastery 无 .volatile();或 Config 未标记)。其余功能照常。\n',
    )
  }

  ctx.effect(() => async () => {
    alive = false
    handleTurnFn = null
    // 先收边车再拆存储:顺序无关紧要,但放在最前面能让"dsh 关 → 服务关"尽早发生
    // (真正的兜底是边车的 stdin EOF:即便这里没跑到,kill -9 也不会留孤儿)
    sidecar.dispose()
    try {
      await cleanup()
    } catch (error) {
      // 插件卸载路径同样不许把异常抛回宿主(实测:store.close() 抛错会直接让宿主 dispose 失败)
      logger.info(`memory: 卸载清理失败: ${error?.message ?? error}`)
      process.stderr.write(`[memory] 卸载清理失败: ${error?.message ?? error}\n`)
    }
  }, 'memory: lifecycle')
}
