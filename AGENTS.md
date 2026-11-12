# AGENTS.md

> 本文件是本仓库 AI agent 指引的**唯一来源**；新增指引只改这里，不要再建 `CLAUDE.md` / Cursor rules。
> 所有数字（测试数 / 门禁结果 / 版本状态）以 [STATUS.md](STATUS.md) 为准，本文件不复述。

## 项目速览

- DSH（DeepSeek Harness）的**心智插件** `neural-mind`：全局记忆池（L0 热缓冲 → 后台提炼 → L2/L3 检索注入）+ SOUL 人格自我设定层 + L1 用户画像，外加主侧栏「记忆」控制台。
- 纯 JS ESM + Cordis 插件；Node `^22.19 || >=24`；运行时依赖只有 `@deepseek-ai/schemastery`、`zod`。
- **唯一生成物**：`lib/client.js`（浏览器半 bundle，由 `npm run build:client` 生成，禁止手改）。
- 发布方式：git tag + GitHub Release（**不发 npm**）。公开仓库历史保持单提交线性，已发布历史禁止重写。
- 文档语言：中文；结论先行、表格、引用 § 编号。

## 命令

```sh
npm test                 # 配置账本 + 接缝 + 设计 P0 + 操作队列 + 全部单测
npm run verify:release   # 全量发布门禁：host / shapes / conform / 设计 P1 / E2E / release-matrix
npm run build:client     # 改 lib/client/** 后必须重建 lib/client.js
node tools/check-design.mjs --history --strict   # 设计同提交纪律（基线 docs/design/.baseline = ROOT）
node tools/check-ops.mjs                         # 操作队列：OP 编号 / 定稿计划 / 完成登记一致
```

只跑单个测试文件：`node --test test/<name>.test.mjs`。门禁失败先修根因，不要绕过。

## 代码地图

| 路径 | 职责 |
|---|---|
| `lib/index.js` | 插件入口：接线、boot、热重建、健康状态 |
| `lib/inject.js` | 注入路径（记忆 + 画像 + SOUL 段） |
| `lib/hotbuffer.js` / `lib/outbox.js` / `lib/extract.js` | 写路径：L0、投递、LLM 提炼 |
| `lib/store.js` / `lib/schema.js` | storageDomain 装配 + 域 spec / 记录 schema（含旧域迁移） |
| `lib/search.js` / `lib/rank.js` | BM25 / 向量 / RRF 检索、排序、衰减与证据 |
| `lib/tools.js` / `lib/ops.js` | 工具（remember / recall / forget / soul_propose）与操作实现 |
| `lib/api.js` | 记忆页 `/neural-mind/api`（同源校验） |
| `lib/usage.js` | 使用观测（§14）：计数 / 明细落盘 / 保留裁剪 / `pool` 只读统计 |
| `lib/compat.js` | DSH 版本 / 形状兼容（含会话来源 kind） |
| `lib/client/**` + `lib/client.js` | 浏览器半（页面 / 卡片 / i18n / CSS）；`lib/client.js` 是生成物 |
| `test/` / `tools/` | `node:test` 测试（fake ctx / storage 在 `helpers.mjs`）/ 门禁（含 `check-ops.mjs` 操作队列）、E2E、评估脚本 |
| `docs/design/` / `docs/ops/` / `docs/legacy/ops/` / `bench-results/` | 设计合同（front-matter `code:` 声明归属）/ 计划草稿 / 定稿计划（OP，冻结）/ 冻结评估数据、发布物与校验和 |

## 约定（改代码前先读）

- **§ 编号永久冻结**：不重排、不复用；新增机制才新增 §。
- **代码与设计同提交**：改了某份 `docs/design/*.md` 里 `code:` 声明的文件，必须同提交改那份文档；确无设计影响时在提交信息独占一行写 `Design: none`。
- **配置项双向对账**：改 `lib/config.js` schema → 同步 `docs/design/10-config-ledger.md`；未接线项在描述里标 `[未实现]`。
- **数字必须实测**：测试数、体积、SHA 只写 `STATUS.md`（README 里有门禁核对的声明），禁止"大概/估计"。
- **行为变更必须有测试**：沿用 `test/helpers.mjs` 的 fake ctx / storage 模式；测试全绿才算完成。
- **存储变更守版本纪律**：破坏性字段/语义变更升 `version` + `compatibleVersions` 并写迁移；旧域名 / 旧来源形状的读侧只加不减（参考 `lib/schema.js`、`lib/store.js`）。
- **不物理删除用户数据**：只做归档 / 屏蔽；改名 / 换域必须带迁移并保留旧目录。
- **提交信息**：`feat(scope): …` / `fix(scope): …` / `docs(scope): …` / `release: …` / `chore: …`。

## 边界

**✅ 总是做**

- 改行为就加/改测试，并让 `npm test` 全绿
- 改客户端源码后重建并提交 `lib/client.js`
- 数字变了同步 `STATUS.md`；里程碑更新 `CHANGELOG.md` / `NEXT_STEPS.md`
- 提交前扫一遍本机路径、用户名、密钥、真实会话正文

**⚠️ 先问用户**

- `git push`、打 tag、建 GitHub Release、改仓库可见性、删库、npm 发布
- 新增依赖
- 破坏性接口变更：工具名、配置键、存储格式、对外路由
- 改名（包名 / entry id / 设置命名空间）

**🚫 绝不做**

- 提交 `.scratch/`、本机路径、个人身份信息、密钥
- 手改 `lib/client.js`（生成物）、改 `docs/legacy/`（冻结历史）
- 删除用户数据；`force-push`、重写已发布历史
- 在 `CLAUDE.md` / Cursor rules 里另起一份指引

## 完成后自检

1. `npm test` 全绿；涉及发布物再跑 `npm run verify:release`
2. 测试数 / 门禁状态与 `STATUS.md` 一致，版本级事实补进 `CHANGELOG.md`
3. 设计文档与代码同提交（`check:design --history --strict`）
4. 生成的 `lib/client.js` 已更新，提交里没有本机信息

## 项目机制坑（代码决定，不是环境问题）

- `lib/store.js` 的 `storageDomain.open` 必须套超时：卡住会让插件整体静默失效。
- 客户端 `NS` 必须等于宿主 `SETTINGS_NS`，也等于 profile entry id；改 id 是三处联动（`check:seams` 对账）。
- bundle 模块 id 必须等于包名（`pretest` 检查），手改 bundle 必被抓。
- 换 `DSH_HOME` 时旧 `storages/memory*` 会在首次启动迁入 `neural_mind`（只读旧域、旧目录保留）。
