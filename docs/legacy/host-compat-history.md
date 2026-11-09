# 宿主兼容校准史（原 DESIGN §8.1–§8.4）

> 覆盖节号：§8.1、§8.2、§8.3、§8.4

> **遗留文档**：原 `DESIGN.md` §8.1–§8.4 的跨版本校准记录，不反映当前接缝；正文冻结，不再修改。
> 实施状态：**已实施**（各版本核实结论已并入现行 [§8 宿主接缝映射](../design/08-host-seams.md)）。
> 现行入口：[DESIGN.md](../../DESIGN.md) · [§8](../design/08-host-seams.md) · 历史索引 [README](README.md)。

### 8.1 v2.0 跨版本适配事实(0.1.6 → 0.2.0-rc.1,逐条核过)

**① 设置服务换了整套模型**(最大的一处)。`@deepseek-ai/dsh-settings` 面向插件的写入口只剩
`configure()` / `describe()` / `write()` 三个(服务上另有 `invalidate()`、`update()/replace()/mutate()`、
`documentPath` 等内部与传输面方法,插件不该直接用);`installSection` **不存在**;`~/.dsh/settings.yaml`
不再是用户层(Loader 完成全部条目后一次性导入各节 → 文件改名 `settings.yaml.imported`)。

- 表单以 **profile entry id** 标识插件(本插件 = `memory`);`describe()` 的过滤条件是
  `volatileForm(schema) !== undefined` ——**一个 volatile 字段都没有的 entry 不进镜像**,
  设置页连表单都不显示,而且**不报错**(静默)。
- 写入路径:`settings.write()` → `configEditor.edit()` → 落进 **profile 的 `cordis.patch.yml`**
  → `reconcileProfilePatches()` → 正常 Loader 路径。
- 层级(高 → 低):命令行 overlay → home patch(`~/.dsh/cordis.patch.yml`)→ **profile patch(设置页写这层)**
  → 组合包层 → schema 默认值。前两层只参与解析、不作文本写入目标;表单写入若会被它们覆盖,宿主直接拒绝
  (快照 `writable: false`)。「重置」恢复 profile 覆盖层以下的值。

**② volatile 引用协议**(跨 ESM 副本稳定)。

```js
const write = Symbol.for('cosmokit.volatile.write')   // 全局注册表 → 跨副本一致
isVolatile(v) === (typeof v === 'object' && v !== null && write in v)
createVolatile(value) => Object.freeze({ get: () => current, [write]: (v) => { current = v } })
```

- Schemastery 的 `Schema.resolve()` 遇 `meta.volatile` 就 `createVolatile(value)`,所以
  **标了 volatile 的字段解析后不是值,是引用对象**。`snapshot()` 强制其内容只能是 plain
  object / array(不能有函数与环)。
- Loader 的 `Entry._commitVolatile()`(`cordis-plugin-loader`)**只在 volatile 字段变了**时:
  `resolveConfig(fiber.runtime, …)` 解析出 candidate → `updateVolatile(ref, source)` **原地**提交进
  引用 → 在插件自己的 fiber ctx 上 `emit('loader/volatile-update', paths)` → **整插件不重挂载**。
  含普通字段的变更走另一条:整插件重挂载、`apply` 重新执行。
- **一个不显眼的例外**:`_commitVolatile` 里新值**解析失败**(非法取值)时,Loader 只
  `logger.warn("volatile config update failed for %C")` 后 `return true` —— 于是
  `update()` 里"先存进 `fiber._config` 的新 raw"与"引用仍是旧值"并存:**既不重挂载也不发事件**,
  旧配置继续跑,新值等到下次激活才生效。所以"设置页保存了却没动静"在这台宿主上是真实可能的,
  且 warn 打在 loader 的 ctx 上(插件自己的日志/审计里查不到)。本插件无需为此加兜底(改对取值即可),
  但真机排查时要知道有这一条。
- 关键前提(核过 `cordis/lib/index.js:1071` 与 `:1355`):`apply(ctx, config)` 拿到的就是
  `fiber.config` **同一棵树**,`_commitVolatile` 提交的正是插件在读的对象——因此
  `getConfig = () => resolveConfig(config)` 是纯函数,永远读到当前值,不需要缓存也不需要 `setSource`。
- `configure({ auto: false }, ctx.fiber)`:声明"本插件自带页面"。**第二参数必须显式传插件自己的
  `ctx.fiber`**(默认值是 settings 服务自己的 fiber,那条策略永远匹配不到 entry);同一 fiber 重复登记**抛**;
  返回值是**注销器**,官方要求登记进插件 effects(策略表按 fiber 强引用,不撤销会留住已销毁的 fiber)。
- `autoGenerate` 只是描述符里的一个标志(官方 README:"目前没有已发布的客户端用它")。**实测印证**:
  0.2.0-rc.1 发行版的 `dsh-web-frontend` 包里 `autoGenerate` **零命中**,`dsh-client-ui-settings` /
  `-general` 也不读它,设置页的分区条目全部来自 slot `settings.section`。所以上一句是**前向兼容**——
  将来若有客户端按 schema 自动生成表单,不会与自带页面撞成两个入口;**当前它不改变任何可见行为**,
  别把"已经关掉了宿主的自动配置页"当成既成事实(措辞纪律见 §13 v1.10 表)。

**③ Schemastery 版本红线**。宿主内置 **3.18.4**;本插件原锁 `^3.18.2`(**3.18.2 没有 `.volatile()`**),
已升到 `^3.18.4`(连带 `@deepseek-ai/cosmokit` 1.8.3 → 1.8.5,后者才导出 `createVolatile`)。
解析走的是**插件自己那份** Schemastery(`resolveConfig()` 用 `runtime.Config['~standard'].validate`,
即我们导出的 `Config`),所以红线在插件侧不在宿主侧。

**④ 标记粒度**(Schemastery `validateVolatileSchema` 两条硬约束):volatile 字段必须落在固定对象路径上、
不能被另一个 volatile 字段包住 → **要么标容器要么标叶子,不能都标**;数组/dict 的**内部**元素路径被强制
blocked → 标数组/dict 这一层本身。本插件因此:数组/dict 标节点(`privateWorkspaces`、`toolOutputOverrides`…),
`semanticSearch` 标**叶子**(容器未标)。设置页可编辑面 = 配置卡 26 项 + SOUL 卡 2 项 = **28 项 volatile**(v1.14/v1.15 后),
两侧闭合由 `check-seams` ⑦ 机械守住(自带页面是唯一编辑面 → 漏标或漏渲染都等于"改不了")。

**⑤ 其余接缝逐条对照**:

| 接缝 | 0.1.6 | 0.2.0-rc.1 | 状态 |
|---|---|---|---|
| `sessionQuery.readSession(id)` 返回 | `{ header, events }` | **`{ session, inheritedEventCount, events }`** | 已兼容两键(`inheritedEventCount` 暂未利用,§11 V2 候选:用它排除继承来的事件,缩小跨域回放面) |
| `llm.stream({ system })` | 有效 | **仍然有效**(DeepSeek 适配器照读 `options.system`,`forAdapter` 不剥) | **不要改** |
| `credentials.resolve(ref)` | 任意字符串 | 名字语法是 branded `CredentialRef` 的 `/^[A-Za-z_][A-Za-z0-9_]*$/`;**`resolve()` 对语法外的名字不抛**——官方 JSDoc 明确"语法外没有可错过的引用,应读作未设置而不是抛错"(抛 `TypeError` 的是构造/校验用的 `credentialRef()`,不是 `resolve`) | 已加同判据自查(`lib/embed.js`):不为省一次注定落空的异步查找而静默停在"凭据缺席",而是明确落到 `process.env` 兜底。**注意**旧措辞"不合语法会抛 TypeError 所以我们挡"是错的,已订正 |
| 客户端 `settingsScope` 服务 | 存在 | **已移除** | 换 `configForms` |
| 客户端 `configForms.get(entryId)` | — | 新:`{ status, value, base, user, revision, writable, mode }` + `set/unset/mutate(ops, expectedRevision)`;`getSnapshot()` 是**稳定引用**(可直接喂 `useSyncExternalStore`) | 写入判据 = `Promise<boolean>` 接受标志 + revision 栅栏双信号;嵌套路径必须走 `mutate`(官方 `set(field,value)` 只收单段) |
| 客户端 `settings.section` slot | 同 | **未变**(由 `dsh-client-ui-settings-general` 声明并渲染) | 本插件 0.6.5 起不再占用(入口改主侧栏,见 §8.3) |
| `ctx.slots` / `ctx.locale` / `window.__ModuleLoader__.load` / `ctx.effect` | — | **未变** | 无需改 |
| `tools.register({name,description,parameters,output:{schema,render},execute})` | — | **未变**(raw JSON Schema 仍走同一子集校验) | 无需改 |
| `webServer.register({kind:'exact',path,handler})` | — | **未变** | 无需改 |
| `storageDomain.open(spec)` / `domain.table()` / `domain.global` | — | **未变** | 无需改 |
| `systemPrompt.section({name,order,text,interpolate})` | — | **未变** | 无需改 |
| `agent/pre-step` / `agent/created` / `agent/disposed` / `session/event` | — | **未变** | 无需改 |
| `agents.list()` / `tokenMeter.measure(session)` / `agentDefaultModel.currentSelection()` | — | **未变** | 无需改 |
| `ctx.inject([...], fn)` / `cordis.patch.yml` 的 `insert:` | — | **未变** | 无需改 |

**⑥ 客户端半的组合**:bundle 清单(`package.json` 的 `dsh.client`)要声明依赖的客户端包
(`dsh-client-locale` / `dsh-client-ui-settings` / `dsh-client-ui-renderer`——`slots` 服务在 0.2.1
由 renderer 提供,`dsh-client-ui-slots` 包已删除);`configForms` 由
`dsh-client-ui-settings` 提供。**0.6.5 起页面容器换成主侧栏**:`sidebar.panellist` 由
`dsh-client-ui-sidebar` 声明,`main`(keyed)由 `dsh-client-ui-layout` 声明并按
`activePanelId` 选面板;这两个包是宿主基础组合的一部分,插件不需要 require 它们的模块
(只消费槽位),所以 `dsh.client.inject` 不扩项——扩了反而会在缺包的老组合里把插件卡成未激活。
官方"伴生配置页"用 `ctx.configForms.whileServed([ns], …)` 跟随命名空间是否被服务(如
`dsh-client-ui-settings-shell`/`-web-search`);本插件的页面除配置外还要跑 `/memory/api` 的四张卡,
故**不**套 `whileServed`,而是在 `status !== 'ready'` 时如实显示"不可用"——宿主半一个 volatile
都没标时,用户仍能看到这一页并知道为什么。

**工程纪律**:一切注册皆为 effect 自动回收;自有定时器/outbox pump 挂 `ctx.effect`;配置热替换重建插件(内存态须可重建);Config 用 Schemastery(`Schema.object`,禁 plain object),domain 记录用 zod,两套不混;bundle patch 整行替换不 DeepMerge——默认值全放 schema 里。

### 8.2 v1.11:0.2.1-rc.3 复核与 Session 格式 V4(逐条核过)

> **基线**:DSH Desktop **0.2.1-rc.3**(build `be72761`),Node 24.21.0,PNPM 11.28.5,Schemastery 3.18.5。
> 复核方式 = 从 live `app.asar` 抽取宿主源码逐条核对 + 直接 import 宿主包跑可执行探针 + 隔离 profile 启动 +
> 无头浏览器端到端(**没有**装进用户本机 DSH;见 HANDOFF 第四轮)。rc2→rc3 的包级差异另用 npm 上
> `0.2.0-rc.2` 的发行包逐文件比较过:插件消费的接缝里 `dsh-settings` 零改动,其余差异与本插件无关。

**① Session 格式 V4(0.2.0-rc.1 起就是,不是 rc3 才来的)** ——本轮唯一的**破坏性**接缝:

| 事实 | 证据(宿主源码) | 插件侧后果与处置 |
|---|---|---|
| `SESSION_FORMAT_VERSION = 4`;新建会话头 `version: 4` | `dsh-session/lib/index.js` | 插件写/读会话事件必须按 V4 |
| 消息来源要求**生产者拥有**的 kind:非空、且 ≠ 字面量 `plugin`;否则编码抛 `SessionFormatError: format v4 message requires a producer-owned source kind` | `dsh-session-format-v3-to-v4/lib/index.js`(native source admission) | 旧注入消息 `{kind:'plugin',plugin:…}` **必抛**。改为 `{kind:'plugin:dsh-plugin-memory'}`(迁移边对未知插件的映射);读侧两代都认 |
| V3→V4 迁移边把未知插件来源改写成 `plugin:<原包名>`,并移除 `plugin` 字段 | 同上 `producerKind` + README「消息来源转换」 | 历史日志迁移后同样是新形状;压缩回冲匹配器两代都要认 |
| `tool/result` 的 V4 表示:**tool 角色消息**,`toolCallId`/`isError` 在消息顶层,`content` 是直接内容块数组;V3 的 `{type:'tool-result'}` 包装块被拒 | `dsh-llm` 的 `createToolResultMessage`;V4 原生接纳规则 | 旧解析器只认包装块 → **所有工具产出静默消失**(热缓冲/提炼/轨迹回放)。`lib/turns.js` 的 `toolResultOf()` 归一,`mergeToolCalls()` 解决「先 assistant tool-call、后 tool/result」两批合并时的工具名覆盖 |
| checkpoint 策略在**每次模型请求前** `flush` 会话日志,编码失败 fail-closed(请求不发出);失败批次留在缓冲并暂停 drain | `dsh-session-checkpoint-policy`、`dsh-session-persistence-jsonl` | 一条坏消息会让该轮报错、后续每轮在同一处失败直到重启。**这是"应该不能用、会报错"的真因** |

**② 其它变更(都不影响本插件,但核对过)**:

- `dsh-client-ui-settings` 的 `ConfigFormController` 去掉了 `persistence`/`mode`:快照现在恒为
  `{ status, value, base, user, revision, writable }`(本插件只用这些),写队列恒走 Host。
- `dsh-client-ui-slots` 包在 0.2.1 删除:`slots` 服务由 `dsh-client-ui-renderer` 提供,`SlotCore`
  实现并入 shell 静态种子;`dsh.client.inject` 只是**模块到达/保留提示**(未知包名被浏览器半静默跳过,
  排序由 `dsh.client.external` 决定),故旧声明是 no-op。已改为 locale + ui-settings + ui-renderer,
  并由 `check-host-compat` ④ 段守住「声明里的包必须存在」。
- `dsh-client-modules` 的 boot graph 增加 `release` 字段;chunk 路由忽略 `client.node.js`——与本插件无关。
- `dsh-host-webserver` 增加 TLS 与"只许具体 IP 字面量"的绑定校验;`register({kind,path,handler})` 未变。
- `dsh-plugin-manager` 新增 **DSH 版本兼容门禁**:声明了 `engines.dsh` 就按它、否则按 `@deepseek-ai/dsh*`
  peer 依赖判;不满足的 entry 被 detach 成 `disabled: true`(模块根本不 import),可用 version exemption 放行。
  本插件两者都不声明 → 直接放行。**注意 prerelease 的 semver 陷阱**:`>=0.2.0-rc.2` 这类范围并不包含
  `0.2.1-rc.3`(带 prerelease 的版本只匹配同一 `major.minor.patch` 且带 prerelease 的比较器),
  所以本轮**不**加 `engines.dsh`——宁可放行,也不要给后续 rc 挖一个"装不上"的坑。

**③ 逐条复验为"未变"的接缝**:`settings.configure/describe/write` + `loader/volatile-update`(dsh-settings
本轮零改动)、`systemPrompt.section`、`agent/pre-step`(payload/决策形状未变;V4 只改消息来源)、
`agent/created`/`agent/disposed`、`session/event` + `turn/end.reason.kind`、`compaction/*.shadowedSeqs`、
`sessionQuery.readSession → {session, inheritedEventCount, events}`、`llm.stream({system})`、`credentials.resolve`、
`tools.register({name,parameters,output:{schema,render},execute})`、`webServer.register`、
`storageDomain.open`/`table`/`global`、`ctx.fiber`/`effect`/`inject`、`dsh.bundle.patch` + `insert:` 补丁格式、
Node engines。机械复核入口从 38 条扩到 **46 条接缝 + ④ 声明校验**,并会**自动探测**本机安装的 `app.asar`。
另加一道**形状门禁** `npm run check:shapes`(`tools/check-session-shapes.mjs`):它不查 API 在不在,而是把插件
**实际产出的会话消息**喂给 live 宿主的 Session 编解码器(`sessionFormatCatalog.encodeCurrentEvent`),
并让插件的解析器读宿主版本的 V4 fixture——宿主换 Session 格式(如 V5)时这条会最先红,不必等真机对话暴露。
第三道是**对话 E2E** `npm run test:e2e`(`tools/e2e-conversation.mjs`):在隔离 `DSH_HOME` 上装一个
测试专用 mock LLM bundle(`test/fixtures/mock-llm-bundle`,经 `ctx.llm.registerAdapter` 注册确定性 provider),
跑两轮 headless 对话(run1 落一条记忆,run2 触发 `agent/pre-step` 注入),解压 Session V4 日志断言
"注入消息被持久化 + turn 完成 + 无 SessionFormatError"。零账号、零网络,成功清临时 home。

**④ 已知限制(本轮不改)**:`tokenMeter.measure(session)` 的真实返回是
`{ logRevision, baseline, surfaceDeltaTokens, totalTokens, surfaceTokens, nodes }`——**没有** `ratio`/`limit`,
所以 `pressureRatio()` 恒为 `undefined`、`injectPauseThreshold` 结构性不生效(实际运行的是文档里的兜底:
纯会话总量上限)。要真接线需从模型路由另取上下文窗口;在拿到宿主稳定来源前不臆造。

### 8.3 v1.12:记忆入口迁到主侧栏(0.2.1-rc.5 复核)

> **变化**:0.6.4 及以前本插件在设置弹窗登记 `settings.section`;0.6.5 起改为**主侧栏全局面板**。
> 宿主把"侧栏行"和"右侧页面"拆成两个槽位,插件必须**成对注册**——只注册一个会出现
> "侧栏有行、点了没反应"(`selectPanel` 抛未注册)或"页面注册了、没有入口"。

| 事实 | 证据(live asar) | 插件侧落点 |
|---|---|---|
| 侧栏行槽位 `sidebar.panellist`(list)按 `id`/`order`/`label` 登记;行内容以 `renderSlot("sidebar.panellist", { size, active }, { only: id })` 渲染,只放图标 | `dsh-client-ui-sidebar/lib/client.js` | `id: "memory"`、`order: 20`(「插件」0、「自动化任务」10)、`label: () => t("tab")`;图标为自带内联 SVG |
| 面板行点击调用 `ctx.layout.selectPanel(id)`;`LayoutController.selectPanel` 在 id 非 null 时要求 main 槽已注册同 key,否则抛 `layout.selectPanel: main panel "…" is not registered` | `dsh-client-ui-sidebar/lib/client.js`;`dsh-client-ui-layout/lib/client.js` | 侧栏 `id` 与 main `key` 同源(都取 `PANEL_ID = NS = "memory"`),不写两个字符串 |
| 右侧主区域槽位 `main`(keyed)由 `renderSlot("main", {}, { entryKey: activePanelId ?? "conversation" })` 选人 | `dsh-client-ui-layout/lib/client.js` | 注册 `{ name: "main", key: "memory", locale: NS, inject: () => ({ form }) }` |
| 两个槽位都是 root scope;`sidebar.panellist` 是列表、`main` 是 keyed;`main` 的 key 域开放(当时只占用 `conversation`) | `Slots.listSubTree`(live 页面) | 两项都挂 root ctx;`key: "memory"` 与 `conversation` 不冲突 |
| 设置弹窗的 `settings.section` 仍然存在(宿主未变),但本插件不再登记 | `dsh-client-ui-settings-general/lib/client.js` | 入口只留主侧栏;`ctx.configForms.get("memory")` 的寻址与写入通道不变 |

**页面形态**:右侧主区域页沿用宿主管理页版式(`height:100%` + 页内滚动,内容居中 960px,
h1 20px/500 + 一行 13px 简介);七个页签(v1.12 初版五页签,v1.15 增至七个)用 `role="tablist"` + `aria-selected` 表达选中,面板用
`role="tabpanel"` + `hidden`——**隐藏面板仍挂载**,切页签不重新拉 `/memory/api`,`aria` 关系也完整。
页签是分段控件(容器 + 选中块),不是孤立的胶囊按钮。侧栏图标与页签样式只用 `currentColor` +
`--dsw-alias-*`,不 require `@deepseek-ai/dsh-client-ui-primitives`(官方纪律:插件自带控件/图标,
只共享主题令牌)。

**浏览页(0.6.5 同日重设计)**:改成"管理台"而不是"卡片堆":工具栏(全宽搜索 + 刷新)→ 带计数的
状态筛选(全部/活跃/暂存/已归档)→ 可扫读列表(每条两行正文 + 一行元数据:徽章/时间/类型/来源/实体)
→ 点行进入**独立详情**(完整正文 + 状态徽章 + 工作区/时间语义/重要度/创建·事件时间/有效期/暂存来源/ID
的字段网格;检索结果额外显示相关度;被取代条目显示取代者)。暂存条目的确认/拒绝在列表行尾与详情头部
都可操作,动作成功后回到列表并刷新。空态区分"池空 / 搜索无匹配 / 该状态无记忆"。列表行是 `role="button"` +
`tabIndex=0`,Enter/Space 可开;行内按钮 `stopPropagation`,键盘事件用 `target === currentTarget` 只认行本身。
其余四张卡复用,排版抬到 15px 标题/12px 辅助字、卡片圆角 12、画像编辑器在页内加高(46vh)。

**新增门禁**:`check:host` 增加 5 条(上表前四行 + `selectPanel` 校验),46 → **51**;
`test/client-shell.test.mjs` 断言"两项成对注册、id 同源、order 在自动化任务之后、默认浏览页签、
切页签只换可见面板、设置入口已删";`test/client-bundle.test.mjs` 断言产物里两项注册的形状
与五张卡仍在渲染树里。

#### v1.15:记忆控制台(页面重设计)

在 v1.12 的"五张卡页签"基础上把整页升级为控制台;仍走 `main` + `sidebar.panellist`
两个槽位,**宿主接缝零变化**(配置仍走 `ctx.configForms.get("memory")`)。

| 版块 | 内容 |
|---|---|
| 外壳 `shell.js` | **7 个页签**:总览 / 记忆 / 召回 / 配置 / 画像 / SOUL / 审计;默认总览;页签**首次切到才挂载**、之后保持挂载(切回不重拉数据);页头状态条(存储 / 向量路 / 自动召回 / 工作区范围)由一次 `overview` 请求驱动;页头「刷新」自增 `refreshKey` 下发给各面板 |
| 共享层 | `components.js`(Card / Stat / Chip / Badge / Banner / Empty / Skeleton / Bar / Section / SearchBox / Icon)+ `runtime.js` 的 `useApi` / 时间与计数格式化 / `copyText`;样式按 `css/base.js` + `css/shell.js` + 每面板 `css/<panel>.js` 拆分,词典按 `i18n/base.js` + 每面板片段拆分,由 `css.js` / `locale.js` 聚合 |
| 总览 | 健康检查清单(存储/向量/提炼(**含上次整理结果与丢弃计数**)/自动召回/工作区/画像/SOUL)、KPI(长期记忆、热缓冲、提炼队列、向量覆盖、本次运行注入、工作区)、最近注入(含跳过原因)、记忆构成 Bar、最近审计 |
| 记忆 | 搜索防抖 + 状态/类型/工作区筛选(带 facets 计数)+ 排序(最新/最早/重要度)+ 列表/详情(证据时间线、复制、暂存确认与拒绝、加载更多)+ **管理操作(v1.26 R1a):停用/恢复、标为敏感/取消、彻底隐藏(二次确认)、展开来源轮次** |
| 召回 | 召回试验台:按**注入路径**跑一次 `search.diagnose`,展示两路原始分、闸门判据、命中明细(bm25Raw / cos / parts / chunk)与注入预览;**只读**,不写记忆、不改状态 |
| 配置 | 分组折叠 + 关键词搜索 + 「需要关注」诊断 + 数字校验 + 逐项重置 + 工作区选择器升级(搜索/全选/条数/手动兜底);26 个字段与写入通道不变 |
| 画像 / SOUL | 信息层级与视觉重排,**行为与 API 调用序列不变** |
| 审计 | 类型下拉 + 关键词搜索 + 刷新 + 条数 |

**宿主 API 扩展**(只增不改):`overview`(一次给齐首屏聚合)、`injections`(注入日志最近 N 条)、
`detail`(单条详情,不返回向量本体;**v1.26 R1a 起带 `sessionId` / `sourceRange` / `sourceExpandable`,并支持 `hb_…` 只读详情**)、
`recallPreview`(注入路径诊断 + 预览);`list` 增加 `kind` / `workspaceId` / `sort` 与 `facets`;
`stats` 增加 `lastExtract` 与 `drops`(v1.25 R15a:最近一次整理的结果与本次运行的丢弃计数,`overview.stats` 同源);
**v1.26 R1a 新增写操作 action**:`archive` / `restore` / `sensitive` / `hide` / `expandSource`(与工具共用 `lib/ops.js` 的状态/级联/审计口径)。**注入日志** `lib/injectionlog.js`:进程内环形缓冲
(60 条),记录 `mode` / `reason` / 条数 / 字符 / 会话短 id / 工作区 / `hitIds`;
**不记注入正文、不记用户查询原文**(诊断用元数据,正文按需经 `detail` 读)。
`skip` 原因码:`workspace-disabled` / `auto-recall-off` / `no-query` / `pressure` /
`inline-timeout` / `search-unavailable` / `no-hits` / `subagent` / `inject-error`。

**门禁**:接缝检查仍 12 项(volatile 28 闭合、bundle 自包含、`NS` 同源);`check:conform`
新增 v1.15 声明(注入日志隐私、7 页签与懒挂载);客户端测试拆成 `test/client-shell.test.mjs`、
`test/client-locale.test.mjs` 与每面板一个 `test/client-<panel>.test.mjs`(旧 `test/client.test.mjs`
退役,既有覆盖面按面板移植);`client-locale` 机械检查源码里每个字面量 `t("key")` / `tt("key")`
在 zh 与 en 都存在、且 base 与面板片段之间无重复 key(防无声覆盖)。

### 8.4 v1.13:0.2.2-rc.1 复核(宿主内部改名,接缝语义未变)

> **背景**:本机 DSH Desktop 升到 **0.2.2-rc.1**(build `c59d10af`),插件仍以 0.2.1-rc.3 为认证基线。
> 2026-11-09 用 `node tools/check-host-compat.mjs` / `check-session-shapes.mjs` 对 live asar 逐条复跑:
> **check:host 51/51、check:shapes 9/9**。以下 4 处是宿主内部改名/重构,语义未变,断言已改为兼容两版写法。

| 事实(0.2.2-rc.1) | 0.2.1-rc.3 的写法 | 插件侧影响 |
|---|---|---|
| 设置表单投影读 `entry.fiber.effectiveConfig`(新增 getter) | `entry.fiber.config` | 无:插件不直接读 fiber 字段,只经 `configForms` |
| `apply` 收到 `resolveConfig(this.config)` 的解析结果,解析结果存 `_effectiveConfig` | `this.config = this._resolveConfig(this._config)`,apply 收到 `this.config` | 无:插件 `apply(ctx, config)` 拿到的仍是解析后 config;volatile 热重建路径不变 |
| 浏览器半取件包进 `readClientBundle(..., () => readFileSync(clientPath))` | `bundle: readFileSync(clientPath)` | 无:宿主仍读预构建 `lib/client.js` 原始字节,不编译 |
| asar 里部分包(如 `tslib`)标 `unpacked:true`,字节在 `app.asar.unpacked/` | 全部在 asar 偏移表内 | 工具侧:`tools/lib/host-asar.mjs` 支持 unpacked 读取/抽取(否则形状门禁会误判"包不存在") |

**门禁**:`check:host` 的 4 条断言改为兼容两种宿主写法(0.2.1 / 0.2.2),仍是 51 条;`check:shapes`
的依赖闭包抽取支持 `unpacked` 条目,仍 9 项。**端到端**:`npm run verify:release` 在 0.2.2-rc.1 上
跑通(测试 307/304/0/3、E2E 24/24、升级 smoke、release-matrix、N1 全 PASS),认证基线更新为
**DSH Desktop 0.2.1-rc.3 / 0.2.2-rc.1**(两版静态核查与端到端都过)。

**顺带修掉的插件侧时序问题(0.2.2 暴露)**:插件 `apply` 原来"发起 boot 后立即返回",工具与注入
都在异步 boot 里注册;0.2.2-rc.1 启动更快,首轮 pre-step 在注册落地前就解析了工具集——实测
`memory_remember` 返回 `UNKNOWN_TOOL`、第二轮注入为 0(E2E 20/24)。修法:`apply` 改为 async 并
`await` 第一次 boot 再返回(boot 失败仍由 `reboot()` 内部吞掉并记 health/stderr,不阻断宿主)。
修复后 E2E **24/24**。这是"宿主变快"暴露的插件侧竞态,不是宿主改名;旧版 0.5.0 tarball 仍有此问题
(不能改旧包),升级 smoke 在旧版写不进时按旧版存储格式种一条后继续验证"升级保留 + 新版读取"。

---


