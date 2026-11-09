# 交接单:0.2.1-rc.3 兼容修复(Session 格式 V4,第四轮)

> **遗留文档**：本文记录 0.5.0 之前的兼容修复过程，不反映当前状态；正文冻结，不再修改。
> 实施状态：**已实施**（0.5.0 第四轮 Session V4 兼容修复已交付；文中 §6 可核的 9 条接缝主张 2026-11-09 复核全部成立）。
> 现行入口：[STATUS.md](../../STATUS.md) · [NEXT_STEPS.md](../../NEXT_STEPS.md) · [DESIGN.md](../../DESIGN.md) · 历史索引 [README](README.md)。

> 交接时间 2026-10-26。前三轮见 `git log`(浏览器半成品字节、原子替换重试、评审回流)。
> **本轮的性质**:不是加功能,是**真机审计出的一处"一注入就报错、还会卡死会话日志"的接缝断裂**。
> 定位靠五路证据(rc2 发行包逐文件对比 / live `app.asar` 源码抽取 / 直接 import 宿主包的可执行探针 /
> 隔离 profile + 无头浏览器 / **本地 mock LLM 的两轮真实对话自动验收**),修复后**没有**装进用户本机 DSH——
> 但核心链路已由 `tools/e2e-conversation.mjs` 自动覆盖(24/24 断言),用户侧不再需要手工"验收"才能确认修复。

---

## 0. 一句话现状

DSH Desktop 装了 **0.2.1-rc.3**(build `be72761`)。插件写/读会话事件仍用 **V3 表示**:
注入消息来源是 `{ kind:'plugin', plugin:… }`,宿主 **Session 格式 V4** 的编码器直接抛
`SessionFormatError: format v4 message requires a producer-owned source kind`;而
`dsh-session-checkpoint-policy` 在**每次模型请求前** `flush` 会话日志且 fail-closed
⇒ **任何一轮注入过记忆的对话都会报错、请求发不出去,会话日志停在坏前缀,之后每轮都失败直到重启**。
这就是"老版本插件、现在应该不能用、会报错"的真因。

修复已进 **0.5.0**:注入消息写 V4 生产者来源 `{ kind:'plugin:dsh-plugin-memory' }`(读侧兼容两代);
`tool/result` 按 V4 的 tool 角色消息解析;压缩回冲匹配器两代都认;清掉已删除的
`dsh.client.inject` 包;`check:host` 扩到 46 条接缝 + 插件声明校验并会**自动探测本机安装**。
本地基线 **177 项 / 174 通过 / 0 失败 / 3 跳过**;隔离实例启动、`/memory/api`、无头浏览器设置页
全部复验通过。**对话链路也有自动验收了**:`tools/e2e-conversation.mjs` 用本地 mock LLM 在隔离 DSH 上
跑两轮 headless 对话(run1 落一条记忆,run2 触发注入),解压 Session V4 日志断言注入消息被持久化、
turn 正常完成、无 SessionFormatError——**24/24 断言通过**。

---

## 1. 根因与证据(按严重度)

| # | 缺陷 | 后果 | 判据 |
|---|---|---|---|
| P0 | 注入消息用退役的 V3 来源 `{kind:'plugin',plugin:…}`(`lib/inject.js` 的 `appendMessage`;`lib/extract.js` 的提炼请求同形状) | 宿主 V4 编码器拒绝 → 该轮请求不发出、会话日志停更、后续每轮在同一 checkpoint 失败直到重启 | `dsh-session-format-v3-to-v4` 原生接纳源码;`probe-v4-codec.mjs` 直接 import live 宿主:旧形状 THROW,新形状 OK |
| P1 | `lib/turns.js` 只认 V3 的 `{type:'tool-result'}` 包装块 | V4 的 `tool/result` 是 tool 角色消息(顶层 `toolCallId`/`isError`、直接 content)→ **所有工具产出静默丢弃**(热缓冲/提炼/轨迹回放) | 宿主 `dsh-llm` 的 `createToolResultMessage` 与 V4 原生接纳规则;同一探针的 V3/V4 两种形状对照 |
| P2 | 压缩回冲匹配器只认 `.kind === 'plugin' && .plugin === …` | V4 下永不匹配:压缩后字符不回冲、id 不解禁 → 注入预算提前耗尽(静默) | V3→V4 迁移边把未知插件改写为 `plugin:<包名>` 且删掉 `plugin` 字段 |
| P2 | `tokenMeter.measure()` 真实返回无 `ratio/limit` | `pressureRatio()` 恒 undefined,`injectPauseThreshold` 结构性不生效(实际跑文档兜底:纯会话总量上限) | 宿主 `dsh-token-meter/README.zh.md`;本轮**不改**,记为已知限制(§5) |
| P2 | `dsh.client.inject` 里 `@deepseek-ai/dsh-client-ui-slots` 已不存在 | **静默 no-op**(未知包名被浏览器半跳过;`inject` 只是到达提示,排序看 `external`)——不是故障,但未来宿主若开始校验就是坑 | `dsh-client-modules` 的 `arriveGraphRow` / `orderByModuleGraph`;`slots` 服务现由 `dsh-client-ui-renderer` 提供 |

**时间线校正**:V4 在 **0.2.0-rc.1/rc.2 就已经是当前格式**(npm 发行包 `dsh-session` 里
`SESSION_FORMAT_VERSION = 4`)。所以 P0/P1 是**从来没有被真机对话验证过**的既有错误,
不是 rc.3 才引入的;上一轮真机 14 秒卸载 + 浏览器半修复后的验收从没真的发过一句对话。

---

## 2. 本轮改了什么(0.4.1 → 0.5.0)

| 文件 | 改动 |
|---|---|
| `lib/compat.js` | 新增 V4 会话表示接缝:`OWN_SOURCE_KIND`、`pluginSource()`、`isPluginSource()`(写侧 V4、读侧两代兼容);注释写明为什么必须换 |
| `lib/inject.js` | `appendMessage()` 改用 `pluginSource()`;压缩回冲匹配改用 `isPluginSource()` |
| `lib/turns.js` | 新增 `toolResultOf(event)`(V4 tool 角色 + V3 包装块归一)、`mergeToolCalls()`(先 assistant tool-call、后 tool/result 两批合并时不让占位 `(unknown)` 覆盖真名);`eventsToTurnParts` 用新函数 |
| `lib/tools.js` | trajectory 回放改用 `mergeToolCalls()`(修复失败计数/工具名被覆盖) |
| `lib/extract.js` | 提炼请求消息来源同步为 V4 生产者来源 |
| `package.json` | 版本 0.5.0;`dsh.client.inject`:去掉已删除的 `dsh-client-ui-slots`,改 `…-ui-renderer`;描述基线更新 |
| `test/session-format.test.mjs` | 新增 5 项:V4/V3 来源识别、tool/result 两代解析、缺 callId 防御、V4 回合累积与注入消息排除 |
| `test/pipeline.test.mjs` | 注入断言改为 V4 来源;压缩联动素材改 V4;顺手把两处写死的 `2026-09-20` 过期时间改为相对时间(时间炸弹) |
| `test/tools.test.mjs` | trajectory 用例加入 V4 `tool/result` 并断言失败计数;state 过期时间改相对值 |
| `tools/check-host-compat.mjs` | **自动探测**本机 `app.asar`(不再写死 `T:/dsh`;支持 `DSH_ASAR`/`DSH_ASAR_ROOTS`);接缝 38 → 46(Session V4、ui-renderer 的 slots、版本门禁);新增 ④ 段「插件声明校验」(`dsh.client.inject` 的包必须真实存在、platform/exports/patch 检查);修正 `findNode` 的 TDZ 让启动期探测可用 |
| `tools/lib/host-asar.mjs`(新) | asar 最小读取器 + DSH 桌面壳自动探测 + **依赖闭包按需抽取**(两个门禁脚本共用) |
| `tools/check-session-shapes.mjs`(新) | **形状门禁** `npm run check:shapes`:把插件产出的消息喂给 live 宿主的 `sessionFormatCatalog.encodeCurrentEvent`,并让插件解析器读宿主 V4 fixture;宿主换 Session 格式时会先红 |
| `tools/e2e-conversation.mjs`(新) | **对话 E2E** `npm run test:e2e`:隔离 DSH + 本地 mock LLM,两轮 headless 对话 → 解压 Session V4 日志断言注入消息被持久化/turn 完成/无格式错误(24 项断言) |
| `test/fixtures/mock-llm-bundle/`(新) | 测试专用 cordis bundle:通过 `ctx.llm.registerAdapter` 注册确定性 mock provider(`mock`/`mock-1`),零依赖、不发布 |
| `DESIGN.md` | 升 v1.11,新增 **§8.2**:0.2.1-rc.3 复核 + Session V4 逐条事实、其余变更、未变清单、已知限制 |
| `IMPLEMENTATION.md` | 基线数字更新 |
| `README.md` | 新增「兼容性(0.5.0)」节(支持范围、三个修复点、check:host/check:shapes/test:e2e 用法);测试基线/接缝数更新 |

---

## 3. 验证(全部隔离,没装进用户本机 DSH)

```powershell
$node = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
node tools/build-client.mjs --check          # 浏览器半产物新鲜
node tools/check-config-ledger.mjs           # §10 配置账本零差异
node tools/check-seams.mjs                   # 12 项接缝
node tools/check-code-vs-docs.mjs            # 28 条声明 0 不符
node tools/check-host-compat.mjs             # 自动探测 live asar:46 条接缝 + 声明校验全过
node tools/check-session-shapes.mjs          # 形状门禁:插件产物 ← live 宿主编解码器(9 项)
node tools/e2e-conversation.mjs              # 对话 E2E:隔离 DSH + 本地 mock LLM 两轮(24/24 断言)
node --test test/*.test.mjs                  # 177 项 / 174 通过 / 0 失败 / 3 跳过
```

隔离实例(DSH_HOME 指到 `%TEMP%`,`dsh plugin --profile memtest add <repo>`):
启动正常、`/memory/api` 三态探测通过、无头 Edge 端到端 16/16(设置页出现「记忆」、五张卡渲染、
5 个 `/memory/api` 全 200、0 console error)。**没有**在用户 `~/.dsh/profiles/desktop` 上做任何安装或改动。

> **2026-10-27 审计补充**:上述“没有安装”是当时状态。本机 `~/.dsh/profiles/desktop` 现已用
> `link:<repo>` 安装本插件,`include:memory` 为 active;真实安装、升级或回滚前
> 仍按上文隔离纪律单独确认。

**对话 E2E 的证据**(`tools/e2e-conversation.mjs`,本地 mock LLM,零账号):
run1 让 mock 发一个 `memory_remember` 工具调用(插件轮内落盘一条记忆);run2 问同一事实——
插件 `agent/pre-step` 召回并注入;解压 run2 的 Session V4 日志后断言:
`session.version=4`、`run2 turn/end completed`、`user/message source.kind = "plugin:dsh-plugin-memory"`
且内容含 `BLUE-FALCON-42`、mock 请求侧 `injectedMemorySeen: true`、无 `SessionFormatError`/`producer-owned`
报错、插件 stderr 无启动失败。**24/24 通过**(本机实测;成功默认清空临时 home,`--keep` 保留)。

**真机验收仍可做一遍(可选,自动化已覆盖核心链路)**:安装到桌面端「插件」页后:
1. 发一句会触发注入的话(先 `memory_remember` 一条词面明显的内容,再问同一关键词)。
2. 该轮正常完成、**会话 JSONL 继续增长**(修复前:该轮报错、日志停更)。
3. 宿主日志/stderr 不再出现 `SessionFormatError … producer-owned source kind`。
4. 设置 → 记忆五张卡都在;改一个 volatile 字段 → 日志 `memory: 配置已更新(…),热重建中`。
5. `memory_recall` 能检索到工具产出相关的记忆(V4 tool/result 解析生效)。

---

## 4. 环境(本轮实测)

| 项 | 值 |
|---|---|
| 仓库/工作区 | `<repo>`(remote `github.com/JIUYUE-SEP/dsh-plugin-memory`) |
| 目标宿主 | **DSH Desktop 0.2.1-rc.3**(build `be72761`,Electron 44;宿主源码在 `<DSH 安装目录>\resources\app.asar`) |
| 宿主侧关键格式 | **Session format V4**(`dsh-session` 的 `SESSION_FORMAT_VERSION = 4`);消息来源生产者归属 |
| Node / pnpm | 用 DSH 自带运行时:`…\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`(24.21.0)/ `…\pnpm\bin\pnpm.cjs`(11.7.0);**PATH 里没有 node,npm test 需用绝对路径** |
| 隔离验收 | `DSH_HOME=%TEMP%\dsh-memtest-home`,profile `memtest`,端口 19400;浏览器 = Edge `--headless=new` + 原生 WebSocket 的 CDP 脚本(`.scratch/tools/e2e-browser.mjs`,不入库);**对话链路** = `tools/e2e-conversation.mjs`(已入库,自动建 `%TEMP%` home,跑完清理) |
| 审计物(不入库) | `.scratch/notes/host-compat-audit.md`(逐接缝证据)、`.scratch/notes/probe-v4-codec.mjs`、`.scratch/notes/browser-e2e.md`、`.scratch/dsh-rc2/`(npm 0.2.0-rc.2 发行包) |

---

## 5. 遗留 / 下一轮候选

1. **真机对话验收**(§3)——已由 `tools/e2e-conversation.mjs` 自动化(mock LLM + 隔离 DSH),真机手动验收只剩"装上去看一眼"的可选确认。
2. **tokenMeter 压力门**:当前宿主 `measure()` 无 ratio/limit,`injectPauseThreshold` 结构性失效。
   已找到可用来源:`dsh-agent-loop` 会追加 `request/context` 会话事件(带 `contextWindow`),可在
   `session/event` 里折叠后算 `totalTokens / contextWindow`;拿到宿主稳定来源前不臆造。
3. **`dsh.client.inject` 的语义**:0.2.1 起只是模块到达提示,排序看 `external`。本插件只 `require("react")`
   (静态种子),**不要**给 react 加 `external`。
4. **不要加 `engines.dsh`(暂)**:prerelease 的 semver 范围很容易把后续 rc 挡在门外
   (`>=0.2.0-rc.2` 并不包含 `0.2.1-rc.3`)。真要加,先写一个满足当前版本的精确范围并跑
   `dsh plugin add` 实测。
5. `check:conform`(code vs docs)不在 `npm test` 里,改文档后建议单独跑一次。
6. 下一版宿主滚动的标准动作:`npm run check:host`(API 存在性 + 声明)→ `npm run check:shapes`(Session 形状能否被宿主编解码器接受)→ `npm run test:e2e`(真实对话链路)→ `npm test` → 隔离 profile 起一次 → 无头浏览器跑一次。

---

## 6. 踩过的坑(累积,别重踩)

1. **V4 消息来源**不是"换个名字":要求非空且 ≠ 字面量 `plugin`;未知插件按 `plugin:<包名>`。
   旧形状在 `Session.append` 阶段**不报错**,只在持久化编码时炸——单测/假宿主全绿也发现不了。
2. **checkpoint fail-closed**:坏消息会先卡住本轮到不了模型,再卡住后续每一轮;看到"对话一直失败"
   先查会话日志 flush,而不是模型/网络。
3. **V4 tool/result 是 tool 角色消息**:顶层 `toolCallId`/`isError` + 直接 content;别再找包装块。
4. **逐事件合并要防覆盖**:assistant tool-call 与 tool/result 是两条事件,直接 spread 会让占位名盖掉真名。
5. **写死日期的测试是定时炸弹**:`expiresAt` 落在「过期 + 2×TTL 宽限」之外后,记录被归档、注入路径
   拿不到它;一律用相对时间(本轮清掉最后两处)。
6. **`tools/check-host-compat.mjs` 的 asar 自动探测**:启动期探测发生在模块求值中,被调用的工具函数
   必须是 `function` 声明(不能是 `const` 箭头),否则 TDZ 报 `Cannot access 'findNode' before initialization`。
7. **宿主不是"编译"浏览器半,而是把 `exports["./client"]` 当成品字节读走**——改 `lib/client/` 必须
   `npm run build:client`;`pretest` 与 `check-seams` ⑫ 会拦。
8. **app.asar 不能当目录读**;抽取用自写的 header 解析,或 `tools/lib/host-asar.mjs` 的最小读取器/闭包抽取器。
9. **`llm.stream({ system })` 在 0.2.x 仍然有效**;`sessionQuery.readSession` 返回
   `{ session, inheritedEventCount, events }`;别按旧文档改回 `header`。
10. **平台差异要带判据**:Windows 上 `mode` 位不落实、symlink 需开发者模式——跳过要说明"为什么测不到",
    不要写死平台。
11. **会话日志是多帧 zstd**:JSONL 后端按批次各写一帧,Node 的 `zstdDecompressSync` 只解第一帧;
    必须自己走帧(FHD 的 checksum 位要 +4 字节)。`tools/e2e-conversation.mjs` 内置了帧遍历。
12. **asar 里的 CLI 入口对普通 Node 不可见**:E2E 要像 `dsh.cmd` 那样
    `ELECTRON_RUN_AS_NODE=1 "<DeepSeek Harness.exe>" --expose-internals "<app.asar>\dsh\...\cli.js"`,
    不要试图用 `fs.existsSync`/裸 Node spawn 探测 asar 内路径。
13. **`--from-default-profile` 会真的启动**:建 profile 时要配 `--dump-config` 才会建完即退;
    profile patch 对同一 `id` 是**整行 config 替换**(不深合并)。
14. **mock LLM 要回答所有调用**:标题/提炼也会走 `llm.stream`,要么让 mock 都给回答,要么在测试 profile 里
    关掉(`session-title-llm disabled` + `extractEnabled:false`),否则调用序列不确定。
