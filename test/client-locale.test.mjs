/**
 * 词典完整性(v1.15):源码里所有字面量 `t("key")` / `tt("key")` 必须在 zh 和 en 都存在;
 * 共享 base 与各面板片段之间不允许无声覆盖(同名 key),否则一种语言会「看起来有、其实是旧文案」。
 *
 * 动态拼的 key(如 `f_` + 配置键、`labelKey + "_desc"`)不在此检查:那些由面板自己保证。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zh, en } from '../lib/client/locale.js'
import { zh as zhBase, en as enBase } from '../lib/client/i18n/base.js'
import { zh as zhOverview } from '../lib/client/i18n/overview.js'
import { zh as zhMemories } from '../lib/client/i18n/memories.js'
import { zh as zhRecall } from '../lib/client/i18n/recall.js'
import { zh as zhConfig } from '../lib/client/i18n/config.js'
import { zh as zhPersona } from '../lib/client/i18n/persona.js'

const CLIENT_DIR = fileURLToPath(new URL('../lib/client', import.meta.url))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.js') && !full.endsWith('legacy.js')) out.push(full)
  }
  return out
}

/** 源码里字面量调用 `t("key")` / `tt("key")` 的 key(先剥掉注释,免得示例代码被误扫)。 */
function usedKeys(source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  const keys = new Set()
  for (const match of code.matchAll(/\b(?:t|tt)\(\s*["']([A-Za-z][A-Za-z0-9_]*)["']/g)) keys.add(match[1])
  return keys
}

test('词典:源码里用到的每个 key 在 zh 和 en 里都有', () => {
  const files = walk(CLIENT_DIR)
  assert.ok(files.length > 10, '至少扫到外壳与各面板源码')
  const missingZh = new Map()
  const missingEn = new Map()
  for (const file of files) {
    const keys = usedKeys(readFileSync(file, 'utf8'))
    for (const key of keys) {
      if (!(key in zh)) {
        if (!missingZh.has(key)) missingZh.set(key, [])
        missingZh.get(key).push(file.replace(CLIENT_DIR, 'lib/client'))
      }
      if (!(key in en)) {
        if (!missingEn.has(key)) missingEn.set(key, [])
        missingEn.get(key).push(file.replace(CLIENT_DIR, 'lib/client'))
      }
    }
  }
  const format = (missing) => [...missing.entries()].map(([key, where]) => `${key}(${where.join(',')})`).join('; ')
  assert.equal(missingZh.size, 0, `zh 缺 key: ${format(missingZh)}`)
  assert.equal(missingEn.size, 0, `en 缺 key: ${format(missingEn)}`)
})

test('词典:base 与各面板片段之间没有重复 key(避免无声覆盖)', () => {
  const fragments = [
    ['base', zhBase, enBase],
    ['overview', zhOverview, {}],
    ['memories', zhMemories, {}],
    ['recall', zhRecall, {}],
    ['config', zhConfig, {}],
    ['persona', zhPersona, {}],
  ]
  const seen = new Map()
  const duplicates = []
  for (const [name, dict] of fragments) {
    for (const key of Object.keys(dict)) {
      if (seen.has(key)) duplicates.push(`${key}(${seen.get(key)} vs ${name})`)
      else seen.set(key, name)
    }
  }
  assert.deepEqual(duplicates, [], '片段之间重复的 key')
})

test('词典:七个页签的标签与页面标题都在两种语言里', () => {
  for (const key of ['tab', 'pageIntro', 'navOverview', 'navMemories', 'navRecall', 'navConfig', 'navProfile', 'navSoul', 'navAudit']) {
    assert.equal(typeof zh[key], 'string', `zh 缺 ${key}`)
    assert.equal(typeof en[key], 'string', `en 缺 ${key}`)
  }
  // 中英文 key 集合必须一致(新增词只写一种语言时当场红)
  const zhKeys = new Set(Object.keys(zh))
  const enKeys = new Set(Object.keys(en))
  const onlyZh = [...zhKeys].filter((key) => !enKeys.has(key))
  const onlyEn = [...enKeys].filter((key) => !zhKeys.has(key))
  assert.deepEqual(onlyZh, [], '只在 zh 里的 key')
  assert.deepEqual(onlyEn, [], '只在 en 里的 key')
})
