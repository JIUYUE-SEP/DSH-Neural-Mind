/**
 * 本地 embedding 服务的生命周期托管(§5 v1.9 补):dsh 起 → 服务起;dsh 关 → 服务关。
 *
 * 三条纪律:
 *  1. **端口已被监听就当外部服务**——不重复拉起,退出时也不杀(别人起的别人管);
 *  2. **收养靠 stdin 管道,不靠轮询 PID**——父进程无论是正常退出、Ctrl-C 还是
 *     `kill -9`,写端都会关闭,看门狗立刻 EOF 并收掉自己拉起的那个子进程;
 *     轮询 `kill -0 <pid>` 会在 PID 复用后误判成"还活着",这里避开这个坑;
 *  3. **失败只记账不打扰**——拉不起来就记一条审计,向量路照旧降级纯 BM25。
 */
import { spawn as nodeSpawn } from 'node:child_process'
import { connect } from 'node:net'

const PROBE_TIMEOUT_MS = 700

/** 端口有没有人在听(TCP 探活,不关心协议:HTTP/Ollama/自建都算)。 */
export function probePort(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false
    const socket = connect({ host, port })
    const finish = (ok) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

/** baseUrl → { host, port };解析不了返回 null(记一条账,不猜)。 */
export function endpointOf(baseUrl) {
  try {
    const url = new URL(String(baseUrl))
    const port = url.port === ''
      ? (url.protocol === 'https:' ? 443 : 80)
      : Number(url.port)
    if (!Number.isFinite(port) || port <= 0) return null
    return { host: url.hostname, port }
  } catch {
    // baseUrl 不是合法 URL:当"没有端点"处理——配置面坏值不许把边车/插件启动带崩
    return null
  }
}

/**
 * 看门狗脚本:拉起用户命令 → 阻塞在 stdin 上 → 父进程一死(EOF)就收尸。
 * 自己收到 TERM/INT/HUP 时也先收尸再退(插件正常卸载那条路)。
 */
export function watchdogScript(command) {
  return [
    'set -u',
    'cleanup() { [ -n "${child:-}" ] && kill "$child" 2>/dev/null; }',
    'trap cleanup TERM INT HUP',
    `${command} < /dev/null &`,
    'child=$!',
    'cat > /dev/null', // 父进程持有写端:它一死这里就 EOF
    'cleanup',
  ].join('\n')
}

/**
 * @param deps { getCfg: 取当前 semanticSearch 配置, logger, report(kind, detail),
 *               spawnImpl?, probe?, schedule? } 后三项为测试注入口
 */
export function createSidecar({ getCfg, logger, report, spawnImpl, probe, schedule }) {
  const spawn = spawnImpl ?? nodeSpawn
  const probeFn = probe ?? probePort
  const later = schedule ?? ((cb, ms) => setTimeout(cb, ms))
  let child = null
  let external = false
  let starting = false

  const note = (kind, detail) => {
    try {
      report?.(kind, detail)
    } catch (error) {
      logger?.info?.(`memory: 边车审计写入失败: ${error?.message ?? error}`)
    }
  }

  /**
   * 拉起来之后在后台确认端口真的开了(仅用于审计,不阻塞启动)。
   * 超过审计窗口只记一条 unready,但**继续静默等到 3× 窗口**——首次启动本来就可能几秒到几十秒,
   * 早退会让预热永远不发生(第一条检索又白降级一次)。真的等不到就放手,向量路照旧降级。
   */
  async function confirmReady(endpoint, waitMs, warmup) {
    const auditDeadline = Date.now() + waitMs
    const giveUpAt = Date.now() + waitMs * 3
    let notedUnready = false
    while (Date.now() < giveUpAt) {
      if (await probeFn(endpoint.host, endpoint.port)) {
        note(
          notedUnready ? 'embed-sidecar-late-ready' : 'embed-sidecar-ready',
          `${endpoint.host}:${endpoint.port} 已就绪${notedUnready ? '(超出审计窗口后)' : ''}`,
        )
        await runWarmup(warmup)
        return
      }
      if (child === null) return // 期间被卸载了,不再记账
      if (!notedUnready && Date.now() >= auditDeadline) {
        notedUnready = true
        note('embed-sidecar-unready', `等待 ${waitMs}ms 后 ${endpoint.host}:${endpoint.port} 仍未监听(继续等待,向量路暂时降级)`)
      }
      await new Promise((resolve) => later(resolve, 500))
    }
  }

  /**
   * 就绪即预热(v1.9 补,`autoStartWarmup`):本地服务普遍懒加载,不预热的话
   * **第一条检索**必然撞查询预算(冷加载几秒 > 内联份额)而白白降级一次。
   * 代价是 dsh 一起就把模型驻留显存——所以默认关,由使用方显式打开。
   */
  async function runWarmup(warmup) {
    if (warmup === undefined) return
    const started = Date.now()
    try {
      const ok = await warmup()
      const ms = Date.now() - started
      note(ok ? 'embed-sidecar-warmed' : 'embed-sidecar-warmup-failed', `${cfg0().modelId || '(未配模型)'} ${ms}ms`)
    } catch (error) {
      note('embed-sidecar-warmup-failed', `${error?.message ?? error}`)
    }
  }

  /** 预热开关与当前模型名(每次读最新配置,热重建后不残留旧值)。 */
  function cfg0() {
    return getCfg?.() ?? {}
  }

  /** 幂等:已有托管子进程或端口已有人听,都不重复拉起。 */
  async function ensure(warmup) {
    const cfg = getCfg?.() ?? {}
    const command = String(cfg.autoStartCommand ?? '').trim()
    if (command === '' || cfg.enabled !== true) return
    if (child !== null || starting) return
    const endpoint = endpointOf(cfg.baseUrl)
    if (endpoint === null) {
      note('embed-sidecar-failed', `baseUrl 无法解析,不启动: ${String(cfg.baseUrl)}`)
      return
    }
    // 预热只在显式开启时做;端口已有人听(外部服务)时也不预热——那不是我们起的
    const warm = cfg.autoStartWarmup === true ? warmup : undefined
    starting = true
    try {
      if (await probeFn(endpoint.host, endpoint.port)) {
        if (!external) {
          external = true
          note('embed-sidecar-external', `${endpoint.host}:${endpoint.port} 已在监听,交给外部管理(不拉起、不回收)`)
        }
        return
      }
      child = spawn('/bin/sh', ['-c', watchdogScript(command)], { stdio: ['pipe', 'ignore', 'ignore'] })
      child.once?.('error', (error) => {
        child = null
        note('embed-sidecar-failed', `启动失败: ${error?.message ?? error}`)
      })
      child.unref?.() // 边车不阻塞 dsh 退出;管道照旧持有,EOF 回收不受影响
      note('embed-sidecar-started', `${command} (pid ${child.pid ?? '?'})`)
      const waitMs = Number(cfg.autoStartWaitMs)
      void confirmReady(endpoint, Number.isFinite(waitMs) && waitMs > 0 ? waitMs : 20_000, warm)
        .catch((error) => logger?.info?.(`memory: 边车就绪探测失败: ${error?.message ?? error}`))
    } catch (error) {
      child = null
      note('embed-sidecar-failed', `启动失败: ${error?.message ?? error}`)
    } finally {
      starting = false
    }
  }

  /** 卸载:收掉本进程拉起的那一个(外部服务不动)。真正的兜底是 stdin EOF。 */
  function dispose() {
    const target = child
    child = null
    if (target === null) return
    try {
      target.kill('SIGTERM')
    } catch (error) {
      logger?.info?.(`memory: 边车回收失败(管道兜底): ${error?.message ?? error}`)
    }
  }

  return {
    ensure,
    dispose,
    /** 是否由本进程托管(测试与审计用)。 */
    owned: () => child !== null,
  }
}
