/**
 * 宿主 asar 的共享读取/抽取基建(给 `check-host-compat` / `check-session-shapes` 等门禁脚本用)。
 *
 * 设计要点:
 *  - **只读 live 安装**:`resolveAsarPath()` 会先看显式参数 / `DSH_ASAR` / `DSH_ASAR_ROOTS`,
 *    再扫描常见安装位置,并用根 `package.json` 的包名确认是 DSH 桌面壳(别的 Electron 应用也有 app.asar)。
 *  - **最小 asar 读取器**:asar 不是目录,普通 fs 读法会 ENOTDIR;这里按 header 表定位 offset/size。
 *  - **按需抽取**:跑"形状门禁"时要把宿主包真正 `import` 进来,而 Node 不能从 asar import。
 *    `ensureHostPackages()` 只抽取给定入口包的**依赖闭包**(deps + peerDeps)到 `%TEMP%`,
 *    按 `node_modules/` 布局落盘,并在同版本命中时复用缓存。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = 'dsh/node_modules'

// ── 最小 asar 读取器 ──────────────────────────────────────────────────────
export function headerOf(asarPath) {
  const fd = fs.openSync(asarPath, 'r')
  try {
    const sizeBuf = Buffer.alloc(8)
    fs.readSync(fd, sizeBuf, 0, 8, 0)
    if (sizeBuf.readUInt32LE(0) !== 4) throw new Error(`${asarPath} 不是 asar(pickle 签名不符)`)
    const headerBuf = Buffer.alloc(sizeBuf.readUInt32LE(4))
    fs.readSync(fd, headerBuf, 0, headerBuf.length, 8)
    const json = headerBuf.subarray(8, 8 + headerBuf.readUInt32LE(4)).toString('utf8')
    return { header: JSON.parse(json), base: 8 + headerBuf.length }
  } finally {
    fs.closeSync(fd)
  }
}

/** Descend one asar header by path segments. */
export function findNode(node, segs) {
  return segs.reduce((cur, s) => (cur?.files ? cur.files[s] : null), node)
}

/** asar 里标记 `unpacked` 的文件在磁盘上的真实位置(app.asar.unpacked/<relPath>)。 */
export function unpackedPathOf(asarPath, relPath) {
  return join(`${asarPath}.unpacked`, ...relPath.split('/').filter(Boolean))
}

/** Read one file out of an asar as utf8. Returns null for a directory / missing entry. */
export function readAsar(asarPath, relPath) {
  const { header, base } = headerOf(asarPath)
  const node = findNode(header, relPath.split('/').filter(Boolean))
  if (!node || node.files) return null
  // 0.2.2-rc.1 起宿主把部分包(如 tslib)标成 unpacked,字节在 app.asar.unpacked/ 下,
  // 不在 asar 偏移表里;不处理会被误判成"包不存在"。
  if (node.unpacked) {
    try {
      return fs.readFileSync(unpackedPathOf(asarPath, relPath), 'utf8')
    } catch {
      return null
    }
  }
  const buf = Buffer.alloc(Number(node.size))
  const fd = fs.openSync(asarPath, 'r')
  try {
    fs.readSync(fd, buf, 0, buf.length, base + Number(node.offset))
  } finally {
    fs.closeSync(fd)
  }
  return buf.toString('utf8')
}

/** List direct children names of one asar directory. */
export function listAsar(asarPath, relDir = '') {
  const { header } = headerOf(asarPath)
  const node = relDir === '' ? header : findNode(header, relDir.split('/').filter(Boolean))
  return node?.files ? Object.keys(node.files).sort() : []
}

/** All file paths (recursively) under one asar directory. */
export function walkAsar(asarPath, relDir, out = []) {
  for (const name of listAsar(asarPath, relDir)) {
    const p = `${relDir}/${name}`
    const { header } = headerOf(asarPath)
    const node = findNode(header, p.split('/'))
    if (node?.files) walkAsar(asarPath, p, out)
    else if (node !== null && node !== undefined) out.push(p)
  }
  return out
}

/** 判定一个 app.asar 是不是 DSH 桌面壳(其它 Electron 应用也各有 app.asar,别认错)。 */
export function isDshAsar(candidate) {
  try {
    const shell = JSON.parse(readAsar(candidate, 'package.json') ?? '{}')
    if (shell.name === '@deepseek-ai/dsh-desktop') return true
    const runtime = JSON.parse(readAsar(candidate, 'dsh/package.json') ?? '{}')
    return runtime.name === '@deepseek-ai/dsh-desktop-runtime'
  } catch {
    return false
  }
}

/** 桌面壳身份(版本 + build),用于缓存键与输出。 */
export function hostIdentity(asarPath) {
  const shell = JSON.parse(readAsar(asarPath, 'package.json') ?? '{}')
  return {
    name: shell.name ?? '?',
    version: shell.version ?? '?',
    build: typeof shell.dshBuildCommit === 'string' ? shell.dshBuildCommit.slice(0, 12) : '?',
  }
}

/** 在常见安装位置里找桌面壳的 app.asar(便携安装可能在任何盘符根下的第一层目录,如 `<盘符>\deepseek-harness`)。 */
export function findInstalledAsar() {
  const roots = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs') : '',
    process.env.PROGRAMFILES ?? '',
    process.env['PROGRAMFILES(X86)'] ?? '',
    ...(process.env.DSH_ASAR_ROOTS ?? '').split(';').filter((root) => root !== ''),
  ].filter((root) => root !== '' && fs.existsSync(root))
  const tryDir = (dir) => {
    for (const candidate of [join(dir, 'resources', 'app.asar'), join(dir, 'app.asar')]) {
      if (fs.existsSync(candidate) && isDshAsar(candidate)) return candidate
    }
    return undefined
  }
  const children = (dir) => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name))
    } catch {
      return []
    }
  }
  for (const root of roots) {
    for (const child of children(root)) {
      const direct = tryDir(child)
      if (direct !== undefined) return direct
      for (const grandchild of children(child)) {
        const nested = tryDir(grandchild)
        if (nested !== undefined) return nested
      }
    }
  }
  // 便携安装:任何固定盘符根下的第一层目录(扫描成本 = 每盘根目录一次 readdir)
  for (const letter of ['C', 'D', 'E', 'F', 'G']) {
    for (const child of children(`${letter}:\\`)) {
      const hit = tryDir(child)
      if (hit !== undefined) return hit
    }
  }
  return ''
}

/** 解析 asar 路径:显式参数 > 环境变量 > 自动探测;读不到时返回 ''。 */
export function resolveAsarPath(explicit) {
  const candidates = [explicit, process.env.DSH_ASAR, findInstalledAsar()].filter((value) => typeof value === 'string' && value !== '')
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return ''
}

// ── 按依赖闭包抽取宿主包(供 import)──────────────────────────────────────
/** 一个 bare 包名在 asar 里的相对目录(`@deepseek-ai/` 优先,其次普通 node_modules 依赖)。 */
function packageRelPath(asarPath, bareName) {
  const scoped = `${ROOT}/@deepseek-ai/${bareName}`
  if (readAsar(asarPath, `${scoped}/package.json`) !== null) return scoped
  const plain = `${ROOT}/${bareName}`
  if (readAsar(asarPath, `${plain}/package.json`) !== null) return plain
  return ''
}

/**
 * 抽取一组宿主包及其 `dependencies` + `peerDependencies` 闭包到 `outDir`,
 * 保持 `node_modules/` 布局,使 Node 能直接 `import('file://…/lib/index.js')`。
 *
 * 命中缓存(同一 `outDir` 且 version/build/入口集匹配)时直接复用,不重复抽取。
 * @param asarPath - 桌面壳 app.asar。
 * @param entryPackages - 入口包名(bare,如 `dsh-session-format-catalog`;`@deepseek-ai/` 前缀可省略)。
 * @param outDir - 抽取根目录(其下生成 `node_modules/`)。
 * @returns `{ root: outDir, files, bytes, cached }`。
 */
export function extractHostPackages(asarPath, entryPackages, outDir) {
  const identity = hostIdentity(asarPath)
  const marker = join(outDir, '.dsh-extract.json')
  const wanted = [...new Set(entryPackages.map((name) => name.replace(/^@deepseek-ai\//, '')))].sort()
  try {
    const cached = JSON.parse(fs.readFileSync(marker, 'utf8'))
    if (cached.version === identity.version && cached.build === identity.build && JSON.stringify(cached.entries) === JSON.stringify(wanted)) {
      return { root: outDir, files: cached.files, bytes: cached.bytes, cached: true }
    }
  } catch { /* 无缓存或损坏:重抽 */ }

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const stats = { files: 0, bytes: 0 }
  const done = new Set()
  const queue = [...wanted]
  while (queue.length > 0) {
    const bare = queue.shift()
    if (done.has(bare)) continue
    done.add(bare)
    const pkgRel = packageRelPath(asarPath, bare)
    if (pkgRel === '') throw new Error(`asar 里找不到包 ${bare}(既不在 @deepseek-ai/ 也不在 node_modules 根)`)
    const pkg = JSON.parse(readAsar(asarPath, `${pkgRel}/package.json`))
    const destBase = pkgRel.slice(ROOT.length + 1) // 形如 @deepseek-ai/x 或 x
    const target = join(outDir, 'node_modules', ...destBase.split('/'))
    // 单次 header 解析 + 单个 fd:整包目录落盘(保持 package.json / exports 结构不变)
    const { header, base } = headerOf(asarPath)
    const fd = fs.openSync(asarPath, 'r')
    try {
      const sourceNode = findNode(header, pkgRel.split('/'))
      if (!sourceNode?.files) continue
      const walk = (node, dest, rel) => {
        fs.mkdirSync(dest, { recursive: true })
        for (const [name, child] of Object.entries(node.files ?? {})) {
          const childDest = join(dest, name)
          const childRel = rel === '' ? name : `${rel}/${name}`
          if (child.files) { walk(child, childDest, childRel); continue }
          // 0.2.2-rc.1 起部分包(tslib 等)整包 unpacked:字节在 app.asar.unpacked/ 下。
          if (child.unpacked) {
            const src = unpackedPathOf(asarPath, `${pkgRel}/${childRel}`)
            const buf = fs.readFileSync(src)
            fs.writeFileSync(childDest, buf)
            stats.files += 1
            stats.bytes += buf.length
            continue
          }
          const size = Number(child.size)
          const buf = Buffer.alloc(size)
          fs.readSync(fd, buf, 0, size, base + Number(child.offset))
          fs.writeFileSync(childDest, buf)
          stats.files += 1
          stats.bytes += size
        }
      }
      walk(sourceNode, target, '')
    } finally {
      fs.closeSync(fd)
    }
    // 依赖闭包(deps + peerDeps;optional 不追,与宿主运行时一致)
    for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]) {
      if (dep.startsWith('node:')) continue
      queue.push(dep.replace(/^@deepseek-ai\//, ''))
    }
  }
  fs.writeFileSync(marker, JSON.stringify({ version: identity.version, build: identity.build, entries: wanted, files: stats.files, bytes: stats.bytes }, null, 2))
  return { root: outDir, files: stats.files, bytes: stats.bytes, cached: false }
}

/** 默认抽取缓存根(%TEMP%/dsh-host-packages/<tag>-<version>-<build>)。 */
export function defaultExtractDir(asarPath, tag = 'shapes') {
  const identity = hostIdentity(asarPath)
  return join(tmpdir(), 'dsh-host-packages', `${tag}-${identity.version}-${identity.build}`)
}
