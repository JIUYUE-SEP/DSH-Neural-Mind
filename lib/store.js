/**
 * 存储装配:storageDomain 在则落盘(per-record,§8),缺席则纯内存态(§7:重启失忆,
 * 功能照常)。两半对上层暴露同一形状:KvTable 兼容接口 + global 槽 + close。
 */
import { batchDomainSpec, domainSpec, DOMAIN_NAME, LEGACY_DOMAIN_NAME, legacyDomainSpec, usageDomainSpec } from './schema.js'
import { bestEffort } from './util.js'

/** 与 KvTable 同形的内存表(entries/keys 返回快照迭代器)。 */
function memoryTable() {
  const map = new Map()
  return {
    get: (key) => map.get(key),
    put: async (key, value) => {
      map.set(key, value)
    },
    delete: async (key) => map.delete(key),
    update: async (key, fn) => {
      if (!map.has(key)) throw new Error(`missing-key: ${key}`)
      const next = fn(map.get(key))
      map.set(key, next)
      return next
    },
    entries: () => [...map.entries()][Symbol.iterator](),
    keys: () => [...map.keys()][Symbol.iterator](),
    get size() {
      return map.size
    },
  }
}

function memoryStore() {
  let state = { version: 1 }
  return {
    memories: memoryTable(),
    hotbuffer: memoryTable(),
    outbox: memoryTable(),
    audit: memoryTable(),
    soulHistory: memoryTable(),
    /** §4.4 周回顾:人格信号(用户原话)候选池。 */
    soulSignals: memoryTable(),
    batches: memoryTable(),
    batchesPersisted: false,
    /** §14 使用观测:独立域,打开失败时这半边退化为内存态。 */
    usage: { days: memoryTable(), recent: memoryTable() },
    usagePersisted: false,
    global: {
      get: () => state,
      set: async (value) => {
        state = value
      },
    },
    persisted: false,
    close: async () => {},
  }
}

/**
 * 给可能挂住的调用套超时:存储后端异常时 `open()` 可能既不 resolve 也不 reject,
 * 而它在我们启动路径的第一行 —— 卡住就意味着工具/API/SOUL 段全都不注册且毫无提示
 * (实测:open 永不返回时插件完全静默失效,应用照常服务)。
 */
function withTimeout(promise, ms, what, onLateResolve) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = () => {
      if (settled) return false
      settled = true
      clearTimeout(timer)
      return true
    }
    const timer = setTimeout(() => {
      if (!settle()) return
      reject(new Error(`${what} 超时(${ms}ms)`))
    }, ms)
    timer.unref?.()
    Promise.resolve(promise).then(
      (value) => {
        if (!settle()) {
          // 超时后底层才成功:调用方已降级,这里必须把晚到的域关掉,避免句柄/锁泄漏。
          onLateResolve?.(value)
          return
        }
        resolve(value)
      },
      (error) => {
        if (!settle()) return
        reject(error)
      },
    )
  })
}

/**
 * 主域的表集合(与 domainSpec 保持一致):迁移时逐表补缺。
 */
const DOMAIN_TABLES = ['memories', 'hotbuffer', 'outbox', 'audit', 'soul_history', 'soul_signals']

/** 表里是否有至少一条记录(兼容"快照迭代器"与"数组"两种 entries() 返回)。 */
function hasAnyRecord(table) {
  const entries = table.entries()
  if (typeof entries?.next === 'function') return entries.next().done === false
  if (typeof entries?.[Symbol.iterator] === 'function') return entries[Symbol.iterator]().next().done === false
  return false
}

/** 把旧域里目标域还没有的记录按 key 补进去(幂等:已存在的 key 跳过)。 */
async function copyMissingRecords(legacyDomain, targetDomain, tables) {
  let copied = 0
  for (const name of tables) {
    const target = targetDomain.table(name)
    const seen = new Set()
    for (const [key] of target.entries()) seen.add(key)
    for (const [key, value] of legacyDomain.table(name).entries()) {
      if (seen.has(key)) continue
      await target.put(key, value)
      copied += 1
    }
  }
  return copied
}

/**
 * 旧域名记录迁入新域(2026-11-09 改名 memory → neural_mind 的一次性迁移)。
 *
 * 读旧域、不删不改——旧目录留着可回滚;新域已有数据也照常补缺(上次半途中断可续)。
 * 批次答卷域(`memory_extract`)不迁移:它只是 7 天内可重放的短命缓存,丢失只意味着
 * 崩溃重放多调一次 LLM,不值得为它引入第二处迁移状态。
 *
 * @returns 拷贝条数(global 继承成功记 1 条);0 = 没有可迁移内容;null = 旧域打不开
 *   (这种情况**不写迁移标记**,下次启动再试,避免一次偶发失败把旧记录永久漏掉)。
 */
async function migrateLegacyDomain(storageDomain, legacySpec, targetDomain, { timeoutMs, logger, onLateResolve }) {
  let legacy
  try {
    legacy = await withTimeout(
      storageDomain.open(legacySpec),
      timeoutMs,
      `storageDomain.open(${legacySpec.name})`,
      onLateResolve,
    )
  } catch (error) {
    logger.info(`memory: 旧域名 ${legacySpec.name} 打开失败,跳过迁移: ${error?.message ?? error}`)
    return null
  }
  try {
    if (!DOMAIN_TABLES.some((name) => hasAnyRecord(legacy.table(name)))) return 0
    let copied = await copyMissingRecords(legacy, targetDomain, DOMAIN_TABLES)
    const legacyGlobal = await legacy.global.get()
    const targetGlobal = await targetDomain.global.get()
    // 只在目标 global 还停在初始值(没有本次运行写过状态)时继承旧 global。
    const untouched = targetGlobal === null || targetGlobal === undefined
      || (targetGlobal.onboardedAt === undefined && targetGlobal.sourceRemapVersion === undefined)
    if (untouched && legacyGlobal !== null && legacyGlobal !== undefined
      && (legacyGlobal.onboardedAt !== undefined || legacyGlobal.sourceRemapVersion !== undefined)) {
      await targetDomain.global.set({ ...targetGlobal, ...legacyGlobal })
      copied += 1
    }
    return copied
  } finally {
    try {
      await legacy.close?.()
    } catch {
      // 旧域关闭失败不影响迁移结果:句柄随进程回收,不阻断启动。
    }
  }
}

/**
 * @param {object} [options] - `{ timeoutMs }`:open 的超时(超时按降级处理)。
 * @returns 统一 Store;storageDomain 存在但 open 失败或超时时响亮降级到内存态并记日志。
 */
export async function openStore(ctx, logger, { timeoutMs = 5000 } = {}) {
  const storageDomain = ctx.get('storageDomain')
  if (storageDomain === undefined) {
    logger.info('memory: storageDomain 缺席,以纯内存态运行(重启失忆,功能照常)')
    // 启动级降级必须留 stderr 一行(§13 工程结论:默认日志级别下 info/warn 不可达)
    process.stderr.write('[memory] storageDomain 服务缺席:以纯内存态运行,本次进程不落盘(重启失忆)\n')
    return memoryStore()
  }
  try {
    const closeLate = (lateDomain) => {
      // 晚到清理失败不影响主流程;bestEffort 留名,避免匿名 catch 破坏纪律。
      bestEffort(Promise.resolve().then(() => lateDomain?.close?.()))
    }
    const domain = await withTimeout(
      storageDomain.open(domainSpec()),
      timeoutMs,
      'storageDomain.open',
      closeLate,
    )
    // 独立短命域:只存 A10 批次答卷。失败不拖垮主存储——退化为进程内 payload,
    // 崩溃重放回到“重新调 LLM”的旧路径,但记忆读写照常。
    let batchDomain
    try {
      batchDomain = await withTimeout(
        storageDomain.open(batchDomainSpec()),
        timeoutMs,
        'storageDomain.open(neural_mind_extract)',
        closeLate,
      )
    } catch (error) {
      logger.info(`memory: neural_mind_extract 域打开失败,批次 payload 退化为进程内: ${error?.message ?? error}`)
      process.stderr.write(`[memory] neural_mind_extract 域打开失败,批次 payload 仅进程内(崩溃重放可能重复): ${error?.message ?? error}\n`)
    }
    // §14 使用观测域(0.6.7):失败不拖垮主存储——观测退化为进程内(等价 0.6.6 行为)。
    let usageDomain
    try {
      usageDomain = await withTimeout(
        storageDomain.open(usageDomainSpec()),
        timeoutMs,
        'storageDomain.open(neural_mind_usage)',
        closeLate,
      )
    } catch (error) {
      logger.info(`memory: neural_mind_usage 域打开失败,使用观测退化为进程内: ${error?.message ?? error}`)
      process.stderr.write(`[memory] neural_mind_usage 域打开失败,使用观测仅进程内(重启归零): ${error?.message ?? error}\n`)
    }
    // 域名迁移(2026-11-09 改名 memory → neural_mind):旧目录里的记录在新域补一份。
    // 只做一次(标记写进 global.migratedDomains);失败不阻断启动,旧域永远保留可回滚。
    try {
      const current = (await domain.global.get()) ?? { version: 1 }
      const migratedDomains = Array.isArray(current.migratedDomains) ? current.migratedDomains : []
      if (!migratedDomains.includes(LEGACY_DOMAIN_NAME)) {
        const copied = await migrateLegacyDomain(storageDomain, legacyDomainSpec(), domain, {
          timeoutMs,
          logger,
          onLateResolve: closeLate,
        })
        if (copied !== null) {
          // 迁移可能已经继承了旧 global,这里重新读一次再补标记(否则会把继承值覆盖掉)。
          const latest = (await domain.global.get()) ?? current
          await domain.global.set({ ...latest, migratedDomains: [...migratedDomains, LEGACY_DOMAIN_NAME] })
          if (copied > 0) {
            logger.info(`memory: 旧域名 ${LEGACY_DOMAIN_NAME} 的 ${copied} 条记录已迁入 ${DOMAIN_NAME};旧域保留未删`)
            process.stderr.write(`[memory] 旧域名 ${LEGACY_DOMAIN_NAME} 的 ${copied} 条记录已迁入 ${DOMAIN_NAME}(旧域保留未删)\n`)
          }
        } else {
          process.stderr.write(`[memory] 旧域名 ${LEGACY_DOMAIN_NAME} 暂时打不开,本次跳过迁移;旧域未删,下次启动重试\n`)
        }
      }
    } catch (error) {
      logger.info(`memory: 旧域名迁移失败(继续用新域): ${error?.message ?? error}`)
      process.stderr.write(`[memory] 旧域名迁移失败(继续用新域): ${error?.message ?? error}\n`)
    }
    return {
      memories: domain.table('memories'),
      hotbuffer: domain.table('hotbuffer'),
      outbox: domain.table('outbox'),
      audit: domain.table('audit'),
      soulHistory: domain.table('soul_history'), // 域内表名用下划线(存储层命名规则),JS 键保持驼峰
      soulSignals: domain.table('soul_signals'),
      batches: batchDomain?.table('batches') ?? memoryTable(),
      batchesPersisted: batchDomain !== undefined,
      usage: {
        days: usageDomain?.table('days') ?? memoryTable(),
        recent: usageDomain?.table('recent') ?? memoryTable(),
      },
      usagePersisted: usageDomain !== undefined,
      global: domain.global,
      persisted: true,
      close: async () => {
        try {
          await batchDomain?.close?.()
        } catch {
          // 批次域关闭失败不影响主域;句柄随进程回收。
        }
        try {
          await usageDomain?.close?.()
        } finally {
          await domain.close()
        }
      },
    }
  } catch (error) {
    logger.info(`memory: storageDomain 打开失败,降级纯内存态: ${error?.message ?? error}`)
    process.stderr.write(`[memory] storageDomain 打开失败,降级纯内存态(本次进程不落盘): ${error?.message ?? error}\n`)
    return memoryStore()
  }
}
