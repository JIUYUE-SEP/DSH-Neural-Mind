---
id: 8
title: "DSH 接缝映射 v2.0(已对照宿主发行版源码逐条核实;v2.0 基线 0.2.0-rc.1,现行认证基线 0.2.1-rc.3 / 0.2.2-rc.1)"
status: 现行
since: 0.1.0
verified: 2026-11-09
code: [lib/index.js]
supersedes: []
superseded_by: null
---

# §8 DSH 接缝映射 v2.0(已对照宿主发行版源码逐条核实;v2.0 基线 0.2.0-rc.1,现行认证基线 0.2.1-rc.3 / 0.2.2-rc.1)


> **版本沿革**:v1 基线 DSH 0.1.5-rc.2(commit `c291e796`,GitHub 仓库源码),v1.9 在 0.1.6-alpha.1
> 上补了四行。**v2.0 = 0.1.6 → 0.2.0-rc.1 跨版本适配**(commit `62962ee4`,Electron 44),
> 证据来源换成**发行版 `app.asar` 内的官方包 `lib/` + `README.zh.md`**(仓库源码路径不再对得上)。
> 这一跨里三处接缝是**换了机制**而不是换了名字:设置服务、配置变更通知、客户端设置传输。
> 全部差异**收口在三处**:`lib/compat.js`(volatile 配置引用 / `loader/volatile-update` / Session V4 来源)、`lib/index.js`(`settings.configure` 登记)、`lib/client/*`(`configForms` 客户端通道);机械对账见 `tools/check-seams.mjs`(12 项)。
> **v1.11(0.2.1-rc.3)新增 §8.2**:Session 格式 V4(消息来源生产者归属、tool/result 提升为 tool 角色消息)
> 是唯一真正破坏性的接缝;全表其余条目本轮逐条复验未变。

| 功能 | 接缝 | 证据 |
|---|---|---|
| 固定用户画像注入 | `ctx.systemPrompt.section()` | docs/subsystems/system-prompt.md:111 |
| **动态召回注入** | **`agent/pre-step` waterfall,await next() 后追加消息进 decision.messages**(必须调 next();永不 reject) | core.md:314,337,1082;packages/core/agent-loop/src/agent.ts:244-254(assembly 先于 pre-step);session.md:657(注入消息进持久日志) |
| 每轮检索门控 | 同上,`step === 1` 判定 | packages/core/agent-loop/src/agent.ts:288,348 |
| **上下文压力计量**(V1.1 已接线) | `ctx.tokenMeter.measure(session)`(§4.2 压力自适应,超 `injectPauseThreshold` 跳过动态注入,常驻除外);占比防御式读取(ratio/pressure/total÷limit,形状不符退回纯会话上限),50ms 让路。**注意:认证宿主 0.2.2-rc.1 的 `measure()` 返回 totalTokens/surfaceTokens 等、无容量字段 → 占比恒 undefined,压力门当前实际不生效**;适配 `contextPressure()` 后才兑现 | token-meter.md:5,92;compaction.md:69,86 |
| 回合结束观察 | `ctx.on('session/event')` 观察 `turn/end`,**按 reason 过滤** | session.md:43,629-651 |
| 压缩事件(V1.1 已接线) | `session/event` 观察 `compaction/*`:被折叠的注入消息字符回冲 + id 解禁(经 sessionQuery 比对 plugin 来源消息);shadowedSeqs 落 search 的 shadow 集,本会话 L0 解禁(§4.2) | compaction.md;session-query.md:461 |
| 原文获取 | `session/event` 流累积 / `ctx.get('sessionQuery')`;**禁** `eventAt/snapshotEvents/ownEvents`(已弃用) | session.md:476-502 |
| LLM 提炼 | `ctx.get('llm').stream()`;路由回退链**实测两环** requestHeader→agentDefaultModel(文档早先写的 `agent.options` 一环不存在);`purpose` 留 unset | llm-streaming.md:295,574-613;session.md:561;core.md:65,431 |
| 落盘 | `ctx.get('storageDomain')` + `storageDomain.open(domainSpec())`——**spec 是手写的字面量,没用官方 `defineDomain`**(为保持依赖最小;形状规则靠 `test/schema.test.mjs` 自己守);**高频写选 per-record layout**;版本纪律经 `version`/`compatibleVersions` | storage.md:47,61-65,95,126 |
| 工具注册 | `ctx.tools.register({ name, parameters, output, execute })`——**原始 JSON Schema 注册,未经 `defineTool`**(入参自行校验,`output.schema` 仍强制校验);无 approval 服务时 ask 变 denial | tools.md:149,504,654 |
| **审计标记** | **写进插件自有 storageDomain 审计表**——不写会话日志(ignorable 陷阱) | session.md:257-264;packages/core/session/src/known-event-types.ts:7-20 |
| compaction 收割(V3) | `compaction/summary` 自带 shadowedSeqs,shadowed 事件仍可读 | compaction.md:16;session-query.md:461 |
| 后台维护(V3) | `agent.runMaintenance()` 空闲维护时机 | core.md:92-101 |
| 设置页(**v2.0 重写**:整套模型换了) | 插件侧入口是 `settings.configure()`,表单读写由 `describe()/write()` 驱动(`installSection` **已移除**;宿主服务另有 `schema/mutate/update/replace/...`,插件不依赖):**entry 的 config 就是设置页编辑的那一段**,按 entry id(`neural-mind`;0.6.6 前为 `memory`)寻址;可编辑面由 Schemastery 的 `meta.volatile` 决定(一个都没标 → 该 entry 根本不进 `describe()` 镜像,静默无表单)。自带页面要 `settings.configure({ auto:false }, ctx.fiber)`(第二参数必须是插件自己的 fiber;返回注销器,官方姿势登记进 effects)。客户端原先登记 **`settings.section`**(0.2.1 仍在,不是 `settings.plugin.item`);**0.6.5 起入口改为 `main` + `sidebar.panellist`,见 §8.3**,设置通道仍是 `ctx.configForms.get(entryId)`(0.1.6 的 `settingsScope` 已移除) | `@deepseek-ai/dsh-settings` README.zh.md + `lib/index.js:370`(`configure`/抛重复登记)、`:418`(`volatileForm(schema) === void 0 → 不入镜像`)、`:436`(`projectForm(form, plainConfig(entry.fiber.effectiveConfig))`);`dsh-client-ui-settings` README.zh.md「配置表单」节 |
| embedding | **无官方接缝,自建 HTTP**;凭据走 packages/credentials | (llm-streaming.md 通读无 embedding API) |
| 官方 recipe | "Memory \| section provider + tool" | cookbook/extension-cookbook.md:126 |
| **人格层注入(按 agent 装段)** | `agent/created` → `agent.ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({ text: () => … }))`;`agent/disposed` 卸段 | packages/context/file-reference-local/src/index.ts:69-95;packages/core/system-prompt/src/index.ts:53-76(`text` 可为 provider 函数);packages/core/scope/src/scoped-events.generated.ts:12 |
| 完整人设抑制插件段 | persona `complete: true` 使该段成为唯一提示词段 | packages/preset/persona/src/index.ts:42-43,63-68;packages/preset/agent-presets/presets/minimal/agent.cordis.yml:9-15 |
| 规矩层(AGENTS.md;不重复造) | `@deepseek-ai/dsh-agent-instructions`:`$DSH_HOME/AGENTS.md` + 项目链,首轮 baseline 消息 | packages/context/agent-instructions/README.md;packages/bundle/base/cordis.patch.yml:268-271 |
| 身份标识(将来用) | `session.header.agentPreset`(创建事实)与最后一条 `agent-preset/selected`(当前值) | packages/core/session/src/types.ts:123-127;packages/preset/agent-presets/tests/mount.spec.ts:579 |

> **路径口径(v1.9 复核;v2.0 换源)**:v1 表的坐标一律相对 **GitHub 仓库根**(基线 commit
> `c291e796` = 0.1.5-rc.2),`docs/*.md` 是 `docs/subsystems/*.md` 的简写;复核时把 `core/…`/`preset/…`
> 补全为 `packages/core/…`(原文漏前缀,按原路径在该 commit 上查不到文件),补全后行号逐条对齐。
> **v2.0 起基线换成发行版**:`@deepseek-ai/*` 包的 `lib/index.js`(minified 单文件)与
> `README.zh.md`(官方包级真源,**复核宿主契约优先读它**);`app.asar` 不是目录,普通
> `fs.readdir` 会 `ENOTDIR`,抽取脚本见 docs/legacy/IMPLEMENTATION.md 的工具段。


## 修订记录

- 2026-11-09：从 DESIGN.md §8 现行映射拆出；跨版本校准史见 docs/legacy/host-compat-history.md
- 2026-11-10：0.6.7 §14 接线——boot 创建使用观测（独立域失败退化为进程内），旁路接 injectionLog / extractor / tools / `/neural-mind/api` 的 `usage`、`pool` 动作；不改任何宿主接缝

- 2026-11-12：**0.7.0 工具改名接线口径**——`lib/index.js` 的注释与接线说明由 `soul_update` 改为 `soul_propose`；宿主接缝（volatile / `loader/volatile-update` / 会话来源）无变化，`check:seams` 12 项仍全绿。
- 2026-11-12：**周回顾接线**——插件入口把 SOUL 运行时传给提炼器（`createExtractor({ …, soul })`），周回顾 prompt 用 `soul.current()` 摘要避免重复提议；宿主接缝无变化，`check:seams` 12 项仍全绿。
