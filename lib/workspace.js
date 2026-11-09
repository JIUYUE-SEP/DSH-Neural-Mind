/**
 * 籍贯解析(§2):workspaceId = git 仓库根 canonical 路径 + 相对子路径(monorepo 二级籍贯);
 * worktree 经 git-common-dir 归并同仓;非 git 目录回退 canonical cwd。
 * 不依赖 workspaceRegistry(§7);git 缺席/超时一律回退。
 */
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath, relative } from 'node:path'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

async function git(args, cwd) {
  const { stdout } = await execFileP('git', ['-C', cwd, ...args], { timeout: 3000 })
  return stdout.trim()
}

/**
 * 路径比较口径(与 search 共用):统一分隔符、去尾斜杠;Windows 大小写不敏感。
 * workspaceId 由 realpath 产生(Windows 上是反斜杠),配置里用户常写正斜杠或尾斜杠。
 */
export function normalizeWorkspacePath(value) {
  let s = String(value ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (process.platform === 'win32') s = s.toLowerCase()
  return s
}

/** privateWorkspaces 的唯一定义点:workspace.js 与 search.js 不得各写一套。 */
export function isPrivateWorkspace(workspaceId, privateWorkspaces = []) {
  const id = normalizeWorkspacePath(workspaceId)
  if (id === '') return false
  return privateWorkspaces.some((entry) => {
    const root = normalizeWorkspacePath(entry)
    return root !== '' && (id === root || id.startsWith(`${root}/`))
  })
}

/**
 * 工作区启用范围(v1.14):`disabledWorkspaces` 的唯一定义点。匹配口径与 privateWorkspaces 一致
 * (workspaceId 或其前缀,分隔符/大小写归一)。
 * 命中 = 记忆插件在该工作区**完全不介入**:不写 L0/outbox(也就不会提炼)、不召回、不注入。
 * 与 privateWorkspaces 的区别:**private 是"能记但不外流",disabled 是"根本不记"**。
 */
export function isWorkspaceDisabled(workspaceId, disabledWorkspaces = []) {
  const id = normalizeWorkspacePath(workspaceId)
  if (id === '') return false
  return disabledWorkspaces.some((entry) => {
    const root = normalizeWorkspacePath(entry)
    return root !== '' && (id === root || id.startsWith(`${root}/`))
  })
}

const SEEN_WORKSPACE_LIMIT = 30
const SEEN_WORKSPACE_REFRESH_MS = 300_000

/**
 * 记录"见过的工作区"(给配置页的工作区选择器用)。
 * **停用列表里的工作区同样要记录**——否则用户停用后它在 UI 里消失,就再也没法启用回来。
 * 存 `store.global.seenWorkspaces`(限长 30);同一工作区 5 分钟内不重复写,避免每轮写盘。
 */
export function createSeenWorkspaceRegistry({ store, logger } = {}) {
  const lastWrite = new Map()
  return async function noteWorkspace(ws) {
    if (ws === undefined || typeof ws.id !== 'string' || ws.id === '' || ws.id === '(unknown)') return
    const now = Date.now()
    if (now - (lastWrite.get(ws.id) ?? 0) < SEEN_WORKSPACE_REFRESH_MS) return
    lastWrite.set(ws.id, now)
    try {
      const state = store?.global?.get?.() ?? {}
      const list = Array.isArray(state.seenWorkspaces) ? state.seenWorkspaces : []
      const next = [{ id: ws.id, label: ws.label ?? ws.id, lastSeenMs: now }, ...list.filter((item) => item?.id !== ws.id)]
        .slice(0, SEEN_WORKSPACE_LIMIT)
      await store.global.set({ ...state, seenWorkspaces: next })
    } catch (error) {
      // 记录失败不影响主流程(纯 UI 辅助数据),但要留一行可诊断日志
      logger?.info?.(`memory: 记录见过的工作区失败(不影响主流程): ${error?.message ?? error}`)
    }
  }
}

/**
 * @param options { privateWorkspaces: string[] }
 * resolve(cwd) → { id, label, gitRoot, subPath, isPrivate }
 *   id    籍贯字面值(唯一键)
 *   label 渲染用短名(仓库名/子路径)
 */
export function createWorkspaceResolver({ privateWorkspaces = [] } = {}) {
  const cache = new Map()

  async function resolveWorkspace(cwd) {
    if (typeof cwd !== 'string' || cwd === '') {
      return { id: '(unknown)', label: '未知位置', gitRoot: undefined, subPath: '', isPrivate: false }
    }
    if (cache.has(cwd)) return cache.get(cwd)
    const pending = compute(cwd)
    cache.set(cwd, pending)
    return pending
  }

  async function compute(cwd) {
    let canonical = cwd
    try {
      canonical = await realpath(cwd)
    } catch {
      // 目录不存在等:用原路径
    }
    let gitRoot
    try {
      const top = await git(['rev-parse', '--show-toplevel'], canonical)
      let root = top
      try {
        const commonDir = await git(['rev-parse', '--git-common-dir'], canonical)
        // worktree:common-dir 指向主仓 .git 目录,归并到主仓根(§2)
        const absCommon = resolvePath(canonical, commonDir)
        if (basename(absCommon) === '.git') root = dirname(absCommon)
      } catch {
        // common-dir 查询失败:用 toplevel
      }
      gitRoot = await realpath(root).catch(() => root)
    } catch {
      gitRoot = undefined // 非 git 目录
    }
    const base = gitRoot ?? canonical
    let subPath = gitRoot !== undefined ? relative(gitRoot, canonical) : ''
    if (subPath.startsWith('..')) subPath = '' // worktree  cwd 不在主仓根下:按仓根算
    const id = subPath === '' ? base : `${base}/${subPath}`
    const label = subPath === '' ? basename(base) || base : `${basename(base)}/${subPath}`
    const isPrivate = isPrivateWorkspace(id, privateWorkspaces)
      || isPrivateWorkspace(base, privateWorkspaces)
    return { id, label, gitRoot, subPath, isPrivate }
  }

  return { resolve: resolveWorkspace }
}
