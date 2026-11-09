# 审核溯源（原 DESIGN §13）

> 覆盖节号：§13

> **遗留文档**：原 `DESIGN.md` §13 的版本级审核记录，不反映当前状态；正文冻结，不再修改。
> 实施状态：**已实施**（历史审核已执行并记录；其中 v1.26 为本次事实修正所留）。
> 现行入口：[DESIGN.md](../../DESIGN.md) · [STATUS.md](../../STATUS.md) · 历史索引 [README](README.md)。


v1.2(独立双审核:官方源码核查 + 红队)关键修复:

| 发现 | 修复 |
|---|---|
| assembly 先于 pre-step,context() 同步签名 + 快照累积 | 动态注入改走 pre-step decision 消息批次(§4.2) |
| 注入防御整体缺失 | 三层防御 + 通道分级(§3.4) |
| 证据公式用标量计数器算不出 | 事件明细账 + negativeSince,统一"连续 14 天"(§1,§5.3,§6) |
| L1 无写入路径、lesson 无归宿 | L1 MVP 手编/V2 晋升;lesson 落 L2(§1,§3.2) |
| forget 14 天才生效 | 直接归档(§4.3) |
| inject 与降级矛盾 | 可选服务全改 ctx.get(§7) |
| log-only 事件锁死会话 | 审计改写自有存储(§8) |
| turn/end 不过滤废轮 / flush 窗口 / 并发丢更新 / 幂等缺失 | §3.0 接线纪律 |
| minScore 单双路冲突 / staged 双重降权 / 30 天误杀 user-explicit / importance=high 无定义 | §5、§3.3、配额(§3.4) |
| 配置清单缺口 | §10 全量补齐 |
| embedding 无官方接缝 / workspaceId 来源 / 弃用 API / subagent scope | §5、§7、§3.0、§8 |

v1.3/v1.4(对话评审细化):热缓冲全文存储与内容分流、查询相关片段裁剪、recall 片段返回、向量自适应分段、工具输出摘要制、思考块仅回忆、内存复用分工——见 §3.1,§4.2,§4.3,§5,§10。

v1.5(编码专项 + 二阶副作用):文件锚/核验/state TTL、来源措辞、注入治理三件套(总量/压力/压缩去重)、常驻 lesson、supersededBy、二级籍贯、冷启动收紧、代码块折叠、标识符分词、episode 落 L2、trajectory 回放、子代理默认不注入、核验两档防误杀、预算分配、TTL 续期——见对应节。

v1.6(四场景适配)+ v1.6.1(四场景验收):开场动态、sensitive 内容级不跨域(含 L0 初筛)、forget hard 级联、配额最小名额、confidence 限定代码域、quote 来源、矛盾分流(验收补第三支)、数值 TTL 分档 + validUntil、无锚生命周期补齐、核验两级 + lastVerifiedAt、二进制 mtime、本会话排除、同仓亲和修正、recall 整条展开、常驻用户级补位、confirm 转正、工具分流 + 提炼输入上限——见对应节。

v1.7(全新考官五向 + 一致性终审):

| 发现 | 修复 |
|---|---|
| 排序公式缺 superseded/validUntil 降权因子,且 §3.3/§5.4 自称"唯一降权" | 公式补 ×supersededFactor ×validUntilFactor ×stagedFactor;"唯一降权"改"staged 专属降权";系数入 §10(§5,§5.4,§10) |
| staged 通道无来源字段,双通道差异化无法实施 | 数据模型加 `stagedBy`;§3.3 两路落盘写明(§1,§3.3) |
| negativeSince 触发点两处不一(E 转负 vs E≤−2),中断条件未写 | 统一:E≤−2 记录(保持原时间),E>−2 清零(§1,§6) |
| 300ms 口径冲突(检索保底 200ms vs embed 超时 300ms) | inlineBudgetMs=300 总预算,embed 份额 ≤150ms(timeoutMs 默认改 150)(§4.2,§5,§10) |
| §5.6"全暴露"纪律被自家违反(8KB/16KB/×0.3/权重/开场窗口/派生式等未入 §10) | §10 全量补齐:chunkPlainMaxChars、recallFullMaxChars、supersededFactor、validUntilFactor、evidenceWeights、inlineBudgetMs、openingDigestDays、verifyIntervalDays、entityWindowTurns、evidenceMaxEntries、extractMaxFacts、sensitiveKeywords、同仓派生式写明 |
| §9.9"不物理删除" vs §3.1 L0 删除;hidden 漏列 trajectory | §9.9 补例外与 trajectory(§9) |
| 本会话解禁后渲染写死"另一个会话里" | 措辞按条目 sessionId 动态选择(§4.2) |
| "高证据新记忆""死信"未定义 | 高证据=证据系数≥1.2;死信=outbox 重试耗尽;LLM 缺席期热缓冲不过期(§3.1,§4.2) |
| §5.2 基准含 challenge 与 rationale 不齐 | 基准改"最近 reinforce 或创建"(§5.2) |
| validUntil × TTL 无交互,远期未来事件先被数值 TTL 杀死 | expiresAt = max(正常TTL, validUntil+7 天);"含数值"含日期(§1,§6) |
| importance≥8 的重大生活事件 30 天沉默即归档 | importance≥8 且 E≥0 的 state 免 TTL(仍可被取代/质疑)(§6) |
| 数值到期直接归档 vs validUntil 温和降权,处置倒挂;月度数字死于被需要之前 | 到期先宽限降权(×0.3+"已过期(截至)"渲染),宽限 2×TTL,召回续命(§6,§10) |
| validUntil 只建模"事件",行动项逾期被埋葬 | todo 标记:行动项逾期不降权,渲染"原定 X,未见完成确认"(§1,§4.2,§6) |
| hidden/archived 可见性枚举未覆盖 openingDigest/常驻通道 | 全域表述:一切注入通道不可见;archived 仅 recall 可见(渲染"已归档")(§1,§4.2,§4.3) |
| 核验闭环对 pattern/活跃 state 失效(内容级永不触发,永久"待核实") | 内容级双条件触发:临期 或 超 verifyIntervalDays(§4.2) |
| 锚文件缺失处置未写 | 单次渲染"锚文件已不存在";连续 3 轮缺失才记一次 challenge(§4.2) |
| worktree 归并抹平分支维度 | filePaths 锚附带 anchorRoot,核验以锚根为准,跨 worktree 只提示不记质疑(§1,§4.2) |
| 压缩后注入字符不回冲,长会话后期变相断供 | 被折叠消息对应字符从会话已用量回冲(§4.2) |
| 提炼无错误签名要求,"上次那个错"消化后不可搜 | 编码域规则:排错产出必保留"错误签名+最终结论"对(§3.2) |
| 争议分支罚错人(新事实背 challenge)+ 争议对自续期 | 非对称 challenge(值更新只罚旧方);争议对成对注入不计召回续期(§3.2,§6) |
| 调试假设链被误判争议;entity 字符串未规范化 | 假设演进细则(同 source 时间相邻优先判自我修正,人物豁免);entity 归一/直判(§3.2) |
| "被文献说服"无通道 | 被说服通道:用户当轮明确采纳 → 旧观点 supersededBy,渲染"你后来更新了看法"(§3.2,§4.2) |
| 密读批次:留头留尾截断静默丢弃中间回合且误标已消化 | 按回合整粒舍弃;只有入输入的回合标已消化;截断记审计(§3.2) |
| 配额"强制降级"语义未定义(可能误改 temporal) | 写死:只降 importance 数值;pattern 超配额保留分类取消豁免(§3.4) |
| remember 产物 kind/temporal 未规定,显式约定可能 30 天即死 | schema 加可选 temporal/kind,按 §3.2 指引填写;confirm 转正继承豁免(§3.3) |
| recall 展开失败记 challenge 误伤(管道缺席惩罚记忆) | 展开失败记审计不记 challenge;§9.9 坦白会话日志保留期依赖(§4.3,§9) |
| 常驻 lesson 选择规则、entity='user' 规范值未定义 | 选择=证据系数×importance 降序同分取近;用户实体字面值 'user'(§4.2,§1) |
| openingDigest 被冷启动收紧误伤;零命中门降级期脆弱 | 本地 ≥3 条即启用,与收紧解耦;"无有效命中"替代"零命中"(§4.2) |
| 二进制锚"有更新"标记永不熄灭 | 召回续期时以当前 mtime 再基线(§4.2) |
| 办公文件锚指引空白;sensitive 类目缺办公类;entity 窗口过窄 | 提炼指引补办公产物带锚;类目补薪酬/人事/合同/经营数据;entityBoost 窗口近 3 轮(§3.2,§2,§5.4) |
| recall 整条展开挂代码块(周报等非代码长文取不回);archived 可见性未定义 | 展开不限代码块;archived recall 可见渲染"已归档"(§4.3) |
| importance 不进排序公式未说明 | §1 写明刻意如此(防自评刷分主导排序)(§1,§5) |
| "提醒我"无结构兑现未坦白 | §9 第 13 条(§9) |
| trajectory 是否计召回未写死 | trajectory 回放日志不计条目召回(§4.3,§6) |


v1.8(精简优化修订,响应外部评审五点):

| 发现 | 修复 |
|---|---|
| MVP 机制全量首发,实现与调试风险集中、机制间交互多 | §11 分期:MVP 最小闭环 + V1.1 加固版;数据模型与配置 schema 仍 MVP 全量落地(版本纪律不攒迁移债),分期只分行为机制(§11) |
| 关系判断候选集未规定:全库进 prompt 不可扩展,LLM 看不到旧记忆还会重复落盘 | 候选集写死:每条新事实检索取 top relationCandidateTopK(默认 8)进提炼 prompt(§3.2,§10) |
| 排序 8 因子连乘且 RRF 分值域扁(相邻名次差 <2%),系数主导缺说明与回归纪律 | §5.6 写明"系数主导是刻意的";§5.5 算例集即排序回归测试,新增/调整系数必补算例(§5.6) |
| BM25 绝对及格线随语料规模漂移 | 相对及格线选项 minScoreTopRatio(默认关,与绝对线取较严者)(§5.1,§10) |
| 配置约 50 项用户面过重 | 暴露分层:常用层 8 项(→ v1.8.1 补录为 10 项 → v1.9 增为 12 项 → v1.9 收口删 `profileText` 后为 **11 项** → v1.14 增两项后为 **12 项**)+ 其余标"高级";schema 全量收录不动(§10) |
| 换模型重嵌入无节流,可打爆速率限制/抢内联预算 | 后台分批(reembedBatchSize 默认 64)、单并发、后台跑,完成前降级纯 BM25(§5,§10) |
| 证据 logistic 单事件增益偏大(一次显式印证 → ≈1.46;v1.9 复核修正,原写 ≈1.54 有误) | 留 slope 调节阀(evidenceLogisticSlope 默认 1.0),V2 实测先调 slope 再动权重(§5.3,§10) |

v1.8.1(实现回流修订;MVP 交付,机制设计不变):

| 发现 | 修复/回流 |
|---|---|
| MVP 已交付并过真实环境端到端验证(0.1.5-rc.2:headless/ACP/web 三 profile) | §11 补"实现状态"行;V1.1 划掉 toolOutputOverrides;V2 设置页条目拆分为"剩余"(纠正/改标/平反/翻案/dead-letter 重放/高级层分组)与"已交付"(配置表单/浏览搜索/暂存确认/审计) |
| 设置页(原列 V2)与工具分流(原列 V1.1)超前完成 | 回流至 §11;设置页形态:独立设置页(配置 + 浏览 + 暂存 + 审计),installSection(cordis entry 作 base、settings.yaml 用户层叠加)+ onChange 热重建(改即生效);宿主数据路由 /memory/api(自证同源:自定义头 + Origin/Host 校验) |
| 实现性差异七处(机制必需,最小化;v1.9 复核:原文写"五处"但表内实列七项) | ① semanticSearch 增补 `baseUrl`/`apiKeyEnv`(§5 自建 HTTP 通道必需端点与凭据引用;`providerId` 未采用)② `decay.timeDecayBands` 末档以 3650 天 ≈ ∞(YAML 无 Infinity 字面量)③ recall"按 id 整条展开"落在 query 参数(m_/hb_ 形态识别)④ 新增 settings namespace `memory` 与 `/memory/api` 路由(§8 接缝表之外的实现面)⑤ `semanticSearch` 本地服务三件套(v1.9):`apiKeyOptional`(无鉴权端点免密钥)、`autoStartCommand`/`autoStartWaitMs`/`autoStartWarmup`(服务随 dsh 进程生灭 + 就绪即预热)与 `embed-degraded`/`embed-sidecar-*` 审计(兑现"降级率供校准",见 §5);⑥ 删除 `profileText`,L1 画像收口为文件单入口 + `profilePollSeconds` 轮询(§4.1;两个入口写同一份画像必然重复)⑦ 新增 `relevanceGate` 绝对相关性闸门与三个实验工具(`tools/` 下 fusion-ab.mjs / inject-eval.mjs / gate-sweep.mjs + 共享 fixtures;§5) |
| 工程结论(实现期验证所得) | 可选服务的"晚挂载"竞争:纯 `ctx.get` 一次性探测会永久错过,应用 `ctx.inject` 条件子插件接入(主插件不阻塞,§7 降级语义不变);vendored cordis logger 默认级别下 warn/debug 不可达,启动级失败须留 stderr 一行;一次性 headless 模式(`dsh --profile p "<task>"`)回合结束即 `io.exit`,turn 边界后台写入与后台提炼可能整轮来不及完成——接受为 §3.0 flush 窗口的取舍面,README 已坦白 |
| 测试基线(v1.8.1 时点) | v1.8.1 交付时为 66 项单测;**2026-09-17 复核更新为 119 项**(14 个测试文件:`text` 分词/片段裁剪/注入检测双向 / `search` BM25·硬过滤·本会话排除·闸门·检索失败契约 / `rank` 证据与生命周期·§5.5 算例回归·negativeSince 对账 / `embed` 密钥策略与降级账 / `sidecar`+`sidecar-wiring` 边车与预热代数 / `soul`+`soul-wiring` SOUL 四道检查·按 agent 装段·文件卫生 / `profile` 画像单入口与轮询 / `tools` hard 屏蔽与 L0 遗忘审计 / `pipeline` 假 ctx 管线·thinking 初筛·超大回合 / `settings` 热重建与 API 路由 / `client` 客户端契约 / `schema` 域名与表名规则)+ `test/settings-e2e.mjs`(真 cordis + 真 settings-file 双挂载顺序;2026-11-09 已删除——所测 `settings.update()/get()` 在 0.2.0 已不存在)+ `tools/acp-driver.mjs`(真 ACP 长驻驱动;2026-11-09 从 `test/` 移入 `tools/`,避免被裸 `node --test` 收走;当前 35 文件/358 项,见 v1.26 行) |

措辞修订(2026-09-17;纯术语,不含机制与数据模型变更):

- **"人设层" → "用户画像层"**:L1 原称 "L1 Profile(人设层)",中文易被读成"给 AI 立人设",且与 DSH agent preset 的 persona(决定 AI 性格/工具面的那套)撞词。统一为**用户画像**——描述对象是用户及其项目约定,落地形态是系统提示词里的固定段 `# 用户画像`。文中其余"长期画像"一并统一(§1、§3.2、§4.1、§8;README 与代码注释/设置页标签同步)。
- **不变的东西**(当时的口径;后于 v1.9 收口删除 `profileText`,见 §4.1):标识符(`profileText`/`profileFile`/`memory:profile`)、配置项名、注入序位、只读手编语义均保持原样——纯措辞,不升版、不迁移。

配置总账补全(2026-09-17;补文档,不动设计):

- **§10 补录 L1 用户画像两项**:`profileText`(默认 `''`)与 `profileFile`(默认 `''`)自首版即在 Config schema 中,但原 §10 清单未收录,§13 的实现性差异表亦未列——与"所有参数全部经 §10 配置暴露,不许硬编码"(§5.6/§10)的自我承诺相抵,属唯一漏项。本次补录为一个独立分组「L1 用户画像」(与设置页第五组对齐);**常用层由 8 项修正为 10 项**,README 常用层表同步补齐两行。(v1.9 收口后 `profileText` 删除 → 常用层 **11 项**,见 §4.1 与 §13-⑥。)
- **一并写明两处实现事实**:`profileFile` 设置页不渲染(仅配置文件可改,文件内容于插件启动/热重建时读一次);设置页当前只呈现 §10 分组中的 5 组(隐私与作用域 / 向量检索 / 写入与提炼 / 注入 / L1 用户画像),其余组待 V2 卡片化。**→ 已被后续版本覆盖(v1.9 复核注)**:`profileFile` 已于 v1.9 第 0 步进设置页,分组数已随 SOUL 组变为 **6 组**;此处保留原文只为留痕,当前事实见 §10 尾注与 §13 v1.9 实现回流表。
- **不变的东西**:字段名、默认值、schema 结构、注入序位与全部机制均未改动——本次是补账,不是改设计。

v1.9(SOUL 自我设定层新增 + L1 归位;2026-09-17):

| 变更 | 内容 |
|---|---|
| 新增 §4.4 SOUL 自我设定层 | `$DSH_HOME/SOUL.md` 单文件为真相源;`agent/created` 按 agent 装段(order 410,provider 只读内存镜像,不做装配期同步读盘);`soul_update` 自改工具(密钥形态 / 注入特征 / 长度 / 日预算四道检查,被拒不计数);`soul_history` 版本快照 + 一键回滚(回滚产生新版本,不删历史);设置页 SOUL 卡(预览/编辑/历史/diff/回滚/暂停自改);外部手改探测(内容逐字比对);`complete: true` 人设下自动缺席 |
| §1 新增四层分工表 | 规矩 `AGENTS.md`(DSH 原生)/ 角色 preset persona(DSH 原生)/ 人格 SOUL(本插件)/ 事实 记忆(本插件)——人格不进检索、不受遗忘机制处置 |
| §4.1 L1 归位 | L1 只承载"关于用户的陈述性事实",指令归 `$DSH_HOME/AGENTS.md` 与项目链(避免同句注入两遍与"两个权威");注入改画像口气 |
| §10 配置 +1 组 | 常用层 10 → 12 项(`soulEnabled` / `soulSelfEditEnabled`),SOUL 组含 5 个高级项;设置页分组 5 → 6(**收口删 `profileText` 后常用层为 11 项**,见 §4.1 与 §13-⑥) |
| §9 不做 +5 条 | 14 不自改能力面;15 SOUL 不分档;16 不配 LLM 裁判;17 提炼流水线不直写 SOUL;18 不抢 AGENTS.md 职责 |
| §7/§8 接缝与降级 | 新增 systemPrompt/SOUL 文件/tools 三行降级;新增四行接缝(按 agent 装段、complete 抑制、AGENTS.md 原生层、身份标识) |
| 数据模型 | storageDomain 新增表 `soul_history`(表名规则 `^[a-z][a-z0-9_]*$`);**domain 版本保持 `1`**(源码核实:per-record 按记录判版本、写入盖当前版本;加表不动字段,格式戳无变化理由,升版会给降级上锁) |
| 交付状态 | **五步全部完成(2026-09-17)**,实现步骤与验收证据见 [IMPLEMENTATION.md](IMPLEMENTATION.md);版本 `0.1.0 → 0.2.0`。真机验证:注入(标记出现在模型回复)、`agent/created` 装段、`soul_update` 自改、设置页四条 API 路径、总开关与置灰 |

v1.9 实现回流(第 0–3 步,2026-09-17;机制设计不变):

| 发现 | 修复/回流 |
|---|---|
| **表名 `soulHistory`(驼峰)被存储层拒绝**——域内表名须匹配 `^[a-z][a-z0-9_]*$`(`@deepseek-ai/dsh-storage` 的 `UNIT_NAME_RE`),`storageDomain.open()` 抛错后插件**静默降级纯内存态**;单测(假 storageDomain)看不见,**真机 e2e 才暴露** | 表名改 `soul_history`(JS 侧 store 键仍 `soulHistory`);§4.4/§11/§13 同步;新增 `test/schema.test.mjs`:域名与全部表名必须匹配该规则(无依赖断言,同类错误挡在单测阶段) |
| 存储降级只经 `logger.info`,默认级别不可达 → "更新后记忆全部不落盘"这种事故无人知晓 | `openStore` 的两条降级路径(storageDomain 缺席 / open 失败)各补一行 stderr——沿用 §13"启动级失败须留 stderr 一行"的纪律 |
| 镜像存归一化文本、写盘补尾部换行 → **自己刚写完的内容会被下一次轮询误判成外部修改**,生成假版本 | 定死语义:`mirror.text` 存**文件原文**(逐字比对),对外一律走 `current()`;补回归测试。纪律:写入方与比较方必须用同一归一化口径 |
| `~/.dsh/storages` **跨 profile 共享**:e2e/临时 profile 会往真实记忆池写记录 | 写进 §13 与 IMPLEMENTATION 的 e2e 方法:临时 profile 必须重定向 `storage-json` 的 `root` |
| `profileFile` 缺设置页入口(v1.8.1 记) | 第 0 步补齐(「L1 用户画像」组第二个字段) |
| **`soulEnabled` 语义:文档写"总开关(注入 + 自改)",代码却只停注入**——`soul_update` 仍可写,形成"它还在偷偷改、你看不到"的半开状态 | 按文档改代码(A 方案):`checks` 的 agent 通道先看 `soulEnabled`,`false` 时整层停用;设置页「允许自改」在总开关关闭时置灰且点击无效;补两处单测 + 一处客户端契约测试。用户通道(设置页/回滚)一律不受开关限制 |
| 设置页 SOUL 覆盖层:原型设计为"盖住面板导航栏",真实现改为整屏模态 | 宿主设置面板是 CSS Modules 哈希类名,DOM 祖先定位不可靠;整屏模态(`min(1040px,100%)`)更宽且无脆弱依赖,窄屏自动单列(IMPLEMENTATION 第 4 步有记录) |

一致性复核(2026-09-17;§1–§13 逐条对回 `lib/`,README 与 IMPLEMENTATION 不在本轮范围):

| 发现 | 处置 |
|---|---|
| **§10/§9 有机械对账,§3–§8 只有 27 条文本证据**——于是"文档超前于实现"与"代码没兑现文档合同"两类漂移都不报警 | 本轮把 §1–§13 的**行为性声明**逐条对回代码(三路独立复核 + 逐条回查证据),结果与处置见下四行 |
| **文档过期(实现事实与措辞不符,约 40 处)** | 就地修正,不升版(纯事实对齐):§3.0 幂等键是两把(outbox 三元组 + `batchKey`)/turn/end 丢弃集合含 `max-tokens`/周期清扫已落地;§3.1 sensitive 初筛含 `thinking`、死信定义含超大回合、条数保险丝口径;§3.2 路由回退只有两环、importance 无 rubric、关系候选集查询是"本批原文";§5 重嵌入无空闲门控、边车多一个 `embed-sidecar-late-ready`;§6 到期渲染只对数值 state、归档清零要在同一处判;§8 `defineDomain`/`defineTool` 未采用、槽位名是 `settings.section`、源码路径补 `packages/` 前缀;§1 补录入实现字段(`createdAt`/`workspaceLabel`/`batchKey`/`noExemption`/`suspect`)与 `soul_history.fromVersionId` |
| **文档超前(V1.1 字段已落地、机制未接线,却写成现状)** | 就地标分期 + 在 §4.2 顶部加"实现状态"块一次说清(核验两级/常驻 lesson/开场动态/压力自适应/压缩联动与回冲/shadow 解禁/被说服与争议渲染/300ms 三档降级/段即片段精修/`trajectory`);§4.3 的 `mode` 当前只有 `default`;§7 表把 tokenMeter 标 `[未实现]`;§11 V1.1 划掉两项已交付(段即片段裁剪、recall 整条展开) |
| **代码未兑现文档合同(8 处,已改代码 + 补 7 个回归测试)** | ① `negativeSince` 的"E 升回 > 阈值即清零"原先只挂在 challenge 之后 → 被印证过的条目仍会满 14 天归档;现在惰性注入/周期清扫/印证写入三处都先对账(§6)。② `search()` 不接错,`null` 契约缺失 → "记忆检索暂时不可用"是死代码、真实失败被静默吞成"没想起事";现在抛错收敛成 `null`(§4.2/§7)。③ L0 初筛只筛 `content`,`thinking` 里的敏感内容绕过跨域硬过滤;现在一起筛(§2/§3.1)。④ 注入特征把「never bypass…」「不允许默认批准…」这类**收紧**表述误拦,且「以我的信条覆盖系统规则」漏检;现在加"同小句否定豁免"并补语序(§4.4)。⑤ `memory_forget` 打到 `hb_…` 时,软遗忘也记成 `forget-hard` 并打码;现在审计如实区分,打码只在 hard(§4.3)。⑥ SOUL 写盘失败会留下临时文件、且孤儿清扫前缀按链接名算(符号链接布局下永远清不掉);现在失败即清 + 前缀按 realpath(§4.4)。⑦ 单回合超 `extractMaxInputChars` 时只把 outbox 置 `skipped`,其 L0 副本既不消化也不过期 → 永久占检索池;现在按死信交给 TTL(§3.1)。⑧ 首启引导把 `sensitiveKeywords` 说成常用层(实为高级)、客户端画像文案还写着"与画像文本拼接"(v1.9 已删 `profileText`);文本已改 |
| **数值订正** | §5.3 "单次显式印证 → 系数 ≈1.54" 算错(实为 ≈1.46,`2/(1+e^−1)`;连单测断言消息都写着旧数);§13 v1.8.1 表写"实现性差异五处"但表内列了七项;§13 测试基线 66 → 119;§10 "顶层 58 项" → 59;§12 常用层末尾 12 → 11(收口删 `profileText`);§13 补一行"设置页 5 组/`profileFile` 不渲染"已被后续版本覆盖 |
| **留给用户裁决的三项 → 2026-09-17 已裁决并落地** | ① `max-tokens` 回合**收 + 标注**(不再整轮丢):回合包带 `truncated` → 正文尾附"可能被截断"标记 → 提炼 prompt 声明该回合结尾不作数;② `soulFile: '~'` 是**非法取值**:启动时拒绝、回退默认路径并留 stderr + 审计 `soul-path-rejected`(`~/SOUL.md` 才是家目录写法);③ 段即片段的精修**保持现状**(命中段同样裁到 `excerptChars`),随 V1.1 一起做。①②各配回归测试(pipeline 两处 + soul 一处) |
| **二次复核:用户裁决六处(同日落地,细节见 docs/legacy/IMPLEMENTATION.md 同名条目)** | ① staged 归档守卫错位:negative-since 判定挪到 staged 提前返回之后,§3.3 豁免承诺兑现(补回归锁两边)。② SOUL 预览卡「编辑」越界置灰:删 `disabled`,用户通道不受限兑现(§4.4;补客户端契约)。③ `evidenceWeights.user` 接线:remember confirm 与设置页暂存确认记用户权重 1.0 印证,"用户显式"档从不可达变可达(§3.3/§5.3 已写明落点)。④ 同仓亲和 ×0.9 删除:籍贯只分两档,§2/§5.4/§5.6/§10/§11 清理,§9 第 24 条登记防回潮。⑤⑥ 过期描述(`reembedBatchSize`"空闲时跑")与死代码(`renderHit` 死注释 + 死判空)清理。测试 119 → 121 |
| **v1.1 实现回流(2026-09-18,九步全部交付;机制设计不变)** | ① domain **v1 → v2**:`evidenceEvent` 加可选 `targetId`(争议对对端)——首个按 §1 版本纪律的字段级升版,compatibleVersions [1],1183 条既有记录校验 0 失败(§1/§4.4 口径同步)。② 矛盾处置全支落地:`dispute` 互记互指、`supersededBy` 四触发(带锚/同主体/被说服/假设演进)、争议对成对注入不计续期(§3.2/§6)。③ 注入机制全接线:核验两级(内容级"明确对不上"取保守判据——拉丁/数字值 token 全缺席)、常驻 lesson + openingDigest(消化完成判定走 hits 通道,digest 的 state 单独续期)、tokenMeter 防御式占比(ratio/pressure/total÷limit,形状不符退回纯会话上限)、压缩回冲经 plugin 来源消息比对、L0 shadow 解禁(eligible 起止 seq 判定)、三档降级覆盖渲染循环(不注入半成品)。④ entity 加权两通道(cwd 子路径重合 / 近 N 轮提及经 turns.recentTexts)、冷启动收紧(异地及格线 ×2、系数 ×0.625、达标自恢复)。⑤ trajectory 回放与段即片段精修(命中段整段直出)。⑥ SOUL 提议通道:`entity: 'soul'` 复用暂存区,采纳走用户通道追加进 SOUL(§9-17 兑现,不新增字段)。⑦ 工程:`[未实现]` 账本**清零**(10 项全撕,对账门禁继续);`normalizeEntity` 上移 text.js 共享(写入方与比较方同一归一化口径);`embedAfterWrite` 抽取(D2);`client.js` 按卡片拆分(D1),conform 检查器改递归收集;makeConfig 放宽 inlineBudgetMs 防并行 flaky;**自坑自纠**:`entityWindowTurns` 在 scoring 子对象却读成顶层 cfg(测试当场抓住)。⑧ 实测口径(V1.1 后重扫,2026-09-18,池子 420 条,`inject-eval`+`gate-sweep`,正例 20/负例 4):闸门关 R@5 0.75/负例 5.0,闸门开 R@5 **0.75(持平)**/负例 **0.25~0.3**,两仪器交叉一致——闸门收益是降噪不是提升召回,参数现状(0.35/2 · 0.55/10)仍在平台上。测试 121 → **142**(domain 升版 1 + 各步机制 21)。 |

**复核方法留痕**:三路独立复核各自只读(`§3/§6`、`§4.1–4.3`、`§4.4/§7/§8`),我逐条回查代码后才动手;结论以"能复现的证据"为准(每条给出 `文件:行号` + 逐字引文),纯存在性检查不算证据。修订后 `npm test`(配置账本 + 119 项单测)与 `npm run check:conform`(27 条行为性声明)全绿;三项裁决落地后又补 3 条回归测试。

v1.10(跨版本适配修订,2026-09-29;机制与数据模型零改动):

| 变更 | 内容 |
|---|---|
| §8 接缝映射升 **v2.0**,基线换成发行版 DSH **0.2.0-rc.1** | 新增 **§8.1** 逐条事实(设置服务三方法模型 / volatile 引用协议与 `_commitVolatile` 原地提交 / Schemastery 3.18.4 红线 / 标记粒度两条硬约束 / `readSession` 返回形状 / `credentials` 引用语法 / 客户端 `configForms` / 未变清单)。差异全部收在 `lib/compat.js` 一个文件里,插件内部 50 余处 `cfg.x.y` 消费点零改动 |
| 设置页接缝换机制 | `settings.installSection` + `settings.yaml` 用户层 + `onChange` → **entry config 即设置页那一段 + `.volatile()` 标记可编辑面 + `loader/volatile-update` 热重建**;`settings.configure({ auto:false }, ctx.fiber)` 关掉宿主自动配置页(返回值登记进 effects,卸载即撤销);客户端 `settingsScope` → `ctx.configForms.get('memory')` |
| 新增静默失败通道与门禁 | 关掉自动页之后,**标了 volatile 却没进设置页的字段就真的没有编辑入口**(不报错)。`tools/check-seams.mjs` 第 ⑦ 项双向对账守住:宿主 volatile 全集 == 配置卡 26 项 + SOUL 卡 2 项 = **28**(负例实测:少标 → "写进去不会生效";多标 → "设置页无处可改") |
| 依赖红线 | `@deepseek-ai/schemastery` `^3.18.2` → **`^3.18.4`**(3.18.2 无 `.volatile()`);连带 `cosmokit` 1.8.3 → 1.8.5(才导出 `createVolatile`)。解析用插件自己那份 Schemastery,红线在插件侧 |
| 验证边界(诚实声明) | 回归 149 → **152 项**(144 通过 / 7 失败 / 1 跳过);`check-seams` 11 项、`check-config-ledger` §10 零差异、`check-code-vs-docs` 28 条 0 不符。**尚未在 0.2.0-rc.x 真机里启动过**(本机实为 **rc.2**,§8.1 结论抽自 rc.1;承重两包 `dsh-settings`/`cordis-plugin-loader` 已实测 rc.1↔rc.2 **逐字节相同**),§8.1 全部结论属"发行版源码逐行核查 + 假宿主复刻 `_commitVolatile` 的回归,真机端到端是下一步(见 §8.1 与 IMPLEMENTATION.md 2026-09-29 段的待验清单) |

真机首测缺陷修复(2026-09-30):**浏览器半不是"源码",宿主把它当成品字节读走**

| 项 | 内容 |
|---|---|
| 症状 | 用户在 DSH Desktop(0.2.0-rc.2)真机装上后 **14 秒卸载**:设置里**从来没有出现「记忆」这一页**,零告警。宿主半是好的(审计有 `soul-inject-ready`、`/memory/api` POST 200) |
| 根因 | 宿主 `@deepseek-ai/dsh-client-modules` 的取件是 **`readFileSync(clientPath)`**(live 证据:`bundle: readFileSync(clientPath)` / `clientExportOf`),`exports["./client"]` 指向的文件被**当成成品字节**塞进 combo 响应,**从不编译**。官方包由 tsdown 预构建(53KB 单文件,`module id = 包名`)。本仓库原先把 664 字节 ESM 源码放在该路径 → 浏览器执行相对 import 时 `require` 是 `undefined` → 模块注册表里没有本插件 |
| 判据 | 用临时诊断插件调宿主 `ctx.clientModules.graph()` + `fetchBundle()` 取回 combo 响应体数 `id:`:**声明 7 个 entries,bundle 内只有 6 个模块 id**,`dsh-plugin-memory` 仅出现在 sourceMappingURL 里。修复后同一探测:**15 个模块含 `dsh-plugin-memory` ×2**,含 `settings.section` 与五张卡标题键,390 061 → 451 837 字节 |
| 修法 | 新增零依赖打包器 `tools/build-client.mjs`(ESM → 官方格式自包含 bundle,`--check` 供 pretest);`lib/client.js` 由源码变**构建产物**,源码入口改 `lib/client/index.js`(`apply`/`inject` 具名导出);`runtime.js` 的 `export let h` 等改为**稳定对象** `export const react = {…}`(避开自建打包器复刻跨模块 live binding,该坑实测踩过两次) |
| 门禁 | `check-seams` 11 → **12 项**:第 ⑫ 项断言产物形态(`__ModuleLoader__.load` / `id` = 包名 / 无裸 ESM import),**反向验证过**(换成源码形态 → 退出码 1 且指名);`test/client-bundle.test.mjs` 真执行产物并渲染五张卡;`check-host-compat` 36 → **38 条**(新增两条宿主侧接缝,把"为什么必须预构建"钉在 live asar 上) |

| 顺带修的两处真实缺陷 | 内容 |
|---|---|
| 原子替换一次即弃 | `SOUL.md`/画像的 `tmp + rename` 在目标被任何句柄占住时抛 `EPERM` → 写入随机失败("改了没生效")。新增 `lib/util.js` 的 `writeFileAtomic`(占用类错误退避重试 ≤4 次、失败清临时文件并抛出),`soul.js`/`api.js` 改走它 |
| 用例红得错位归因 | 「竞争回归」红在 rename 被占用,断言却只看 `current()` → "提交失败"被读成"栅栏失效"。现先断言 `commit.ok`(失败走 `t.diagnostic` 报出),并新增**不依赖交错顺序**的栅栏精确回归;三处平台断言改为**带判据**(POSIX `mode` 位按平台、`symlink` 按**探测能力**) |

四路评审(2026-09-29 下午,v1.10.1;四个独立上下文只读子代理评 `9e15700..HEAD`,主代理逐条回读复现后才动手)

| 发现(复现方式) | 处置 |
|---|---|
| **产品缺陷:`lib/inject.js` 的锚逃逸判据硬编码 `'/'`**(`abs.startsWith(rootAbs + '/')`)。Windows 上 `path.resolve` 产出反斜杠,**锚内的合法文件也被判成逃逸** → 存在性/内容级注入前核验在本机整条静默不跑;外在表现只是"这条记忆没标记待核实",零告警 | 改用分隔符无关的 `relative()` 判定(逃逸 ⇒ `..` 开头或绝对路径/跨盘符;锚内 ⇒ 普通相对路径;根本身 ⇒ 空串)。**`pipeline.test.mjs` 从 25 过/3 红变 28/0**—。并把 `resolveAnchor` 从闭包里提成模块级导出、**补了一张判定表**(锚内/点文件名 `.cache`、`..data` 不误杀;`..`、上层穿越、根外绝对路径一律拒)——**反向验证:把旧判据装回去,4 条立刻红(含这张表本身)**。这条是 §9-5 红队加固 R5 的安全边界,原先**零直接覆盖**,才能在整整一个平台上静默失效无人报警—
   修后仍有一次**时绿时红**:该用例把 `eventTime` 设在写文件的同一毫秒内,而 `stat().mtimeMs` 带小数、`toISOString()` 截到整数毫秒,
   比较结果由亚毫秒余数决定;已把两个锚的 mtime 用 `utimesSync` 显式钉死(未变 = 基准前 60 秒,漂移 = 基准后 3600 秒),8 连跑全绿。 —— 这 3 项此前被归类成"Windows mtime 平台差异"。**方法论:「平台差异」是需要证据的分类,不是默认解释**;长期红的用例要先问"它在该失败的那一侧还测得到吗" |
| **仪器缺陷:`tools/eval-fixtures.mjs` 的 `loadLiveConfig()` 没解包 volatile 引用**,且仍读 0.2.0 已取消的 `~/.dsh/settings.yaml` —— 双重失效:线上覆盖永远读不到(仪器与线上重新漂移),而读到的 `injectMaxItems` 是引用对象(`gate-sweep` 的 `K`、`inject-eval` 的 `limit` 直接吃它,`[object Object]1`) | 改读 `$DSH_HOME/profiles/$DSH_PROFILE/cordis.patch.yml` 里 `id: memory` 那行的 `config`,并过 `resolveConfig()`;实测现在拿到的是真值(`injectMaxItems = 5`)。**这提醒:引用协议迁移要连"评估仪器"一起迁,它们不走生产代码路径** |
| **测试盲区:假 ctx 没有 `fiber`** → 本轮修的 `settings.configure({ auto:false }, ctx.fiber)` 里那个参数在测试中恒为 `undefined`;而宿主签名是 `owner = this.ctx.fiber`,**显式传 undefined 与不传完全等价** —— 把这个参数删掉、策略记到 settings 服务自己的 fiber 上,测试照样全绿。同类:`ctx.on` 的假件返回空注销器,"卸载摘监听"从未被验证 | 假 ctx 补 `fiber` 替身 + `on` 返回真摘除器;`settings.test.mjs` 断言 `state.owner === fake.ctx.fiber` 且 `owner !== undefined`(堵住"两个 undefined 相等"的假绿) |
| **门禁四条"全绿而真机失效"(评审实测,主代理独立复现三条)**:①`configForms.get(NS)` 改成内联字符串 → 全绿(⑤ 只比常量字面量,管不到真正寻址那一行);②`package.json` 的 `dsh.client` 整段删除 → 全绿(没有任何门禁读它,后果是设置页整页不出现);③`GROUPS` 的 `kind` 拼错(`toogle`)→ 全绿(控件落到文本框分支,把字符串写进 boolean 字段);④`check-code-vs-docs` 的按文件名取内容:`/intersect/.test(undefined)` 把 undefined 转成字符串 `"undefined"` → **缺失性检查必然通过**(把 `lib/search.js` 移走仍打印"一致") | `check-seams` 8 项 → **11 项**(新增"寻址点必须用 NS 常量"、⑧ `dsh.client` 清单齐、⑨ 控件 kind/options ↔ 宿主 schema 类型;④ 从抽查首字段改为 25 项全查);**负例逐条实测会红**(N1–N7)。`check-code-vs-docs` 加"被引用文件必须都在"自检(缺则退出码 2)、② 短路时打 `⚠ 连带没跑 N 项`;**README 工具清单做成真双向对号**(原那条名字叫"=="却全文没读过 README——`readme` 是个死变量) |
| **文档把"前向兼容"写成"已生效"**:①`configure({auto:false})` 被描述成"关掉了宿主的自动配置页",实测发行版 `dsh-web-frontend` 里 `autoGenerate` **零命中**、`dsh-client-ui-settings*` 也不读它,官方 README 自陈"目前没有已发布的客户端用它" → 那个重复页今天不存在;②`credentials.resolve` 被写成"不合语法抛 TypeError",实测抛点只在 `credentialRef()` 工厂,`resolve()` 只查表(官方注释明说"语法外应读作未设置而非抛错");③"`writable: false` 表示被 home patch 遮蔽"错——宿主 `get writable()` 恒 `true`,遮蔽是**写入时被拒**,`writable:false` 只表示该页面没有 Host 持久化;④"只有三个方法"不严谨(另有 `invalidate/update/replace/mutate/documentPath`);⑤"含普通字段变更必整插件重挂载"漏了例外:`_commitVolatile` 解析失败时只 warn、既不发事件也不重挂载 | 逐处订正(§8.1-①②⑤、README 安装/层级/可写段、`lib/index.js` 与 `lib/embed.js` 注释、IMPLEMENTATION)。**真机核验清单里"writable:false 显示只读"这一条要按新语义改看"保存后报错"** |
| **基线数字与版本自错**:①文档写"上一轮基线 149/138/10/0"——四个数相加是 148,且该提交实测是 149/138/**11**/0(`sidecar-wiring` 当时恒红、尚未改 SKIP),正确叙述是 +1 test / +1 pass / **−1 fail** / +1 skip;②`check-seams` 写 8 项、conform 写 27 条、回归写 150 项均已过时(现 11 / 28 / 151);③ground truth 写"25 条正例"实测 `POS=18 + CROSS=2`;"约 50 项高级"实测 73 个非 volatile 叶子;④**本机宿主实为 0.2.0-rc.2**(commit `04f392c9`),文档一直写 rc.1(`62962ee4`)——已实测承重两包 rc.1↔rc.2 **逐字节相同**、`schemastery` 均 3.18.4、loader 均 1.0.5,故 §8.1 结论对 rc.2 成立,但坐标必须写清 | 数字全部按实测重写(§13 v1.10 行、§8 表头、README 开发段、IMPLEMENTATION、HANDOFF);§8 表头加"哪些行的证据仍是 0.1.x 仓库路径"的范围限定;`62962ee4` 这类无法在仓库内复核的 commit 号保留但标注出处为宿主 `package.json` |
| **`dsh plugin --profile desktop add` 在桌面上根本跑不通**(评审实测 `dsh/lib/bin.js:36` 的 `rejectElectronProfile`:profile "desktop" 由 Electron 应用独占;`dsh` 也不在 PATH,只有 `<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd`) | README 安装段重写:桌面端走应用内侧边栏「插件」页(`dsh-plugin-manager` + `dsh-client-ui-plugin-manager`),命令行只适用于自建的 web/headless profile。**上一份交接单与本轮首版清单里的安装步骤是错的** |
| **评审报了三处我复核后驳回**(留痕以防重提):①"假件的行尾注释正则没剥注释"——真身在 `split('\n')` 后逐行 replace,单行串上 `/\/\/.*$/` 有效,实测剥得干净;②"`[未实现]` 必须 `startsWith`"——原口径就是"打头",改成 `includes` 只是更宽容,顺手改了但不算缺陷;③"⑦ 号双侧同时缩会全绿"——我的复现构造把语法改坏了(多留一个括号)导致三条红是崩溃所致;**该结论已由代码结构确认成立**(⑦ 只做集合相等,无绝对下限),但不是以评审描述的方式成立 | 驳回理由入此表;**"没有绝对下限"这一条真待办**:该钉的是「§10 常用层列出的键必须在设置页可见」,但它会当场红在 `openingDigest`(常用层唯一未标 volatile 的项)——**留待用户裁决,见 HANDOFF §5.2** |
| 遗留未修(记录,不在本轮范围):`settings-e2e.mjs` 测的 `settings.update()/get()` 在 0.2.0 已不存在(建议删或重写为 `configEditor.write`);`acp-driver.mjs` 建议移出 `test/`(裸 `node --test` 会把两者收走 → 实测 153/12 红);假 `configForms` 的 `getSnapshot` 每次返回新对象(真身是稳定引用)、且 `status` 只覆盖 `'ready'`,`'loading'/'unavailable'` 两支零覆盖;`sidecar-wiring` 的 SKIP 判据写死平台,导致"预热取当代 embedder"在 Windows 零覆盖;`?ts=${Date.now()}` 缓存穿透键应改自增;`soul.test.mjs` 的「竞争回归」红在 EPERM rename(应在断言里显式检查 `commit.ok`,否则真因被错位归因) | 见 HANDOFF §5.3;**2026-11-09 已处理前两项**:`settings-e2e.mjs` 已删除、`acp-driver.mjs` 已移入 `tools/` |

v1.13(注入质量默认值收口,2026-11-07;用户实测反馈"注入过多 + 错误注入";机制与数据模型零改动):

| 项 | 内容 |
|---|---|
| **默认开闸门** | `relevanceGate.enabled` false → **true**。旧默认下注入前不做任何绝对相关性准入:冻结集 5 条负例全部注满(均 4.8 条),"今天上海天气怎么样"也注入 5 条;开启后负例 1/5(唯一残留"私有项目数据库连接串"是词面同题、纯词法无解),正例平均注入 4.6 → 1.4 条,R@1 0.75 → 0.875、R@5 1.00 → 0.875。冻结集用确定性假向量,**真池子 2026-09-17 实测**:R@5 持平 0.75、负例均注入 5.0 → 0.25~0.3(§5 已更新) |
| **纯 BM25 也能准入** | 旧行为"纯 BM25 时整条闸门不生效",默认配置(未配 embedding)的用户享受不到任何降噪。新增 `bm25OnlyMin`(默认 2,原始分单路门槛)+ `bm25OnlyMinPoolSize`(默认 30,小池子不启用——绝对分随语料漂移,§5.6 同一条纪律);recall 仍不受影响 |
| **主动记挂默认关** | `openingDigest` true → **false**。开闸门后"零有效命中"变常见,旧默认会把近 7 天 state/episode 塞给任意无关闲聊——正是"错误注入"的第二个来源;要主动记挂再打开 |
| **回归与门禁** | `eval-frozen` 断言负例注入 ≤1、无关查询零注入、正例平均注入 ≤3;新增"无关查询不注入 / 相关查询照常注入"端到端用例 + 纯 BM25 门槛与池子护栏两例;`check-code-vs-docs` 增三条声明(闸门七参数、openingDigest、向量维度防呆)。测试基线 223 项 / 220 通过 / 0 失败 / 3 跳过 |
| **评估集 v2** | 新增 `frozen-v2`(215 条记忆 + 20 条 L0,37 正例 / 13 负例,含 4 条困难负例与 3 条隐私负例),保留 `frozen-v1` 作历史对照。评估向量为**确定性 1024 维**词袋(对齐 bge-m3 / qwen3-embedding 等真实模型维度;插件本身不限定维度,真实端点返回多少维就存多少)。**固定评估基准时间**(v2 = 2026-11-07,v1 = 2026-10-26):时间衰减不再随真实运行日期漂移(旧口径的隐藏隐患);同时把"查询所属当前工作区"写进 ground truth(真实场景是"在项目 X 里问 X",否则 ×0.8 异地系数会把目标压到第 2 名——这是 §5.4 设计不是缺陷)。**v2 基线**:R@1/R@5/MRR **1.0 / 1.0 / 1.0**、正例均注入 5 条(单轮上限)、闲聊负例 **0 注入**、困难负例 2/4、关系候选召回 0.375(top-8;含 2 条 update 对,旧记录已标 superseded 被 ×0.3 降权,属后验状态偏差) |
| **向量维度防呆** | 用户反馈"端点换模型但没改 `modelId` 时维度不一致会静默算不出分"。三处收口:① 嵌入响应当场校验维度——同批不等长按 `shape` 降级;跨响应维度变化记 **`dim-mismatch`** 并降级纯 BM25(不混用两种维度);② 检索侧发现库中向量维度 ≠ 当前查询向量维度 → **跳过该段并记账**(此前 `cosine()` 对不等长静默返回 0,表现只是"向量路聋了"零告警),日志/触发节流 5 分钟;③ 后台重嵌入把"维度不符"也纳入 stale 判定 → 自愈(不必改 `modelId` 也无需手动重建池子)。零 schema 变更、零配置新增 |
| **边界** | 只改默认值与纯 BM25 的准入分支:记忆模型、检索/排序公式、混合路阈值(0.35/2、0.55/10)、L0/L2 语义、隐私硬过滤零改动 |

v1.14(工作区启用范围 + 召回总开关,2026-11-07;用户需求):

| 项 | 内容 |
|---|---|
| **工作区启停** | 新增 `disabledWorkspaces: string[]`(默认 `[]` = 全部启用;workspaceId 或其前缀匹配)。命中 = 该工作区**完全不介入**:turn/end 不写 L0/outbox(→ 不提炼)、pre-step 不注入、三个记忆工具明确拒绝("已停用")。配置页提供**工作区选择器**(checkbox 列表 + 手动路径兜底);数据源是 `global.seenWorkspaces`(写入侧 5 分钟最多记一次,**停用的工作区也记录**——否则 UI 里消失后无法再启用)。**这是运行开关,不是检索域隔离**:检索仍固定 global,private/sensitive 边界不变;停用不清理既有数据。 |
| **召回总开关** | 新增 `autoRecall: boolean`(默认 true)。false = 不自动注入(仍正常写记忆、仍提炼);手动 `memory_recall` 工具不受影响(用户主动问);画像/SOUL 是常驻 systemPrompt 段,不属"召回",不受影响。 |
| **接缝与账本** | 配置页新增工作区选择器与 `autoRecall` 开关;可编辑面 26 → **28**(配置卡 26 + SOUL 2);`check:conform` 31 → **32** 条(新增工作区/召回默认值声明);`/memory/api` 新增 `workspaces` action。测试基线 229 项 / 226 通过 / 0 失败 / 3 跳过(以最终全量跑为准)。 |

v1.15(记忆控制台重设计,2026-11-07;用户需求:重新设计配置页面、保证易用性、可以不只做配置):

| 项 | 内容 |
|---|---|
| **页面结构** | 五卡页签 → **7 页签控制台**(总览 / 记忆 / 召回 / 配置 / 画像 / SOUL / 审计),默认总览;页签首次切到才挂载、之后保持挂载(切回不重拉);页头状态条(存储 / 向量路 / 自动召回 / 工作区范围)+「刷新」;宿主接缝零变化(仍是 `main` + `sidebar.panellist` 两个槽位、`ctx.configForms.get("memory")` 写配置) |
| **总览** | 健康检查清单(存储/向量/提炼/自动召回/工作区/画像/SOUL)+ KPI(长期记忆/热缓冲/提炼队列/向量覆盖/本次运行注入/工作区)+ 最近注入(含跳过原因)+ 记忆构成 Bar + 最近审计;数据来自一次 `overview` 请求 |
| **召回试验台** | 按**注入路径**跑 `search.diagnose`:闸门参数、两路原始分(bm25Raw/cos)、parts 明细、命中 chunk、注入预览与字符预算;**只读**(不写记忆、不改状态);区分"检索不可用"与"没有命中" |
| **配置页** | 分组折叠(带「已改 n 项」)+ 关键词搜索 + 「需要关注」诊断卡 + 数字校验 + 逐项「已覆盖/重置」+ 工作区选择器升级(搜索/全选/半选/条数/手动兜底);26 个字段与 configForms 写入通道不变 |
| **记忆管理台** | 搜索 250ms 防抖 + 状态/类型/工作区筛选(facets 计数)+ 排序(最新/最早/重要度)+ 独立详情(证据时间线、复制 ID/正文、暂存确认/拒绝)+ 加载更多 + 三态空态 + 键盘可达 |
| **画像 / SOUL / 审计** | 视觉与信息层级重排;画像/SOUL 的行为与 API 调用序列不变(回滚确认/编辑覆盖层/diff/提议流程原样);审计增加类型与关键词筛选 |
| **宿主 API(只增不改)** | 新增 `overview` / `injections` / `detail` / `recallPreview`;`list` 增加 `kind` / `workspaceId` / `sort` 与 `facets`。注入日志 `lib/injectionlog.js`:进程内环形缓冲 60 条,记 `mode`/`reason`/条数/字符/会话短 id/工作区/`hitIds`,**不记注入正文、不记用户查询原文**;skip 原因码 9 种(`workspace-disabled` / `auto-recall-off` / `no-query` / `pressure` / `inline-timeout` / `search-unavailable` / `no-hits` / `subagent` / `inject-error`) |
| **门禁与测试** | `check:seams` 12 项不变(volatile 28 闭合、bundle 自包含、NS 同源);`check:conform` 32 → **34 条**(新增 v1.15 注入日志隐私、7 页签+懒挂载);客户端测试从单文件拆分为 `client-shell` / `client-locale` / 各面板 `client-<panel>`;新增 `test/api-console.test.mjs` 覆盖新 action 与注入日志。测试基线 **304 项 / 301 通过 / 0 失败 / 3 跳过**(2026-11-07 全量跑) |
| **已知边界(如实)** | ① 注入日志只在进程内(重启清空),描述"本次运行"而非历史;② 召回试验台在未选工作区时按"无本地工作区"口径(冷启动收紧对异地生效),选一个工作区才与真实注入完全同参;③ 试验台的注入预览是简化渲染(excerpt 截断 + 包裹头字符数),不含核验标记/状态前缀,用于估预算而非逐字复刻 |

v1.16(工作区选择器三源合并 + 回合管道降级自愈,2026-11-07;事故:配置页「停用的工作区」显示 0 个,用户"那么多工作区一个都没显示"):

| 项 | 内容 |
|---|---|
| **根因 1(设计缺口)** | 选择器原本只列 `global.seenWorkspaces`(插件处理过**合格 turn/end** 后才写)+ 记忆池里的 `workspaceId`。它从不读 DSH 自己的工作区注册表 ⇒ **全新安装、或回合管道任一段失效时,用户已有的工作区全部不可见**,而页面只写"还没有已知工作区",无法区分"真没有"与"没记录上" |
| **根因 2(schema bug)** | `globalState` 只声明 `{version, onboardedAt}`。storageDomain 每次 open 都用 zod 校验 global 记录,**未声明的键会被 strip**:`seenWorkspaces` 写进盘了,但下一次 open(热重建 / 重启 / 保存一次 volatile 配置)后内存态就没了 → 选择器归零,且下一次写入只保留刚记的一条。修复:声明为可选数组(`{id,label?,lastSeenMs?}`),老 profile 向后兼容 |
| **根因 3(静默僵尸)** | boot 的"活动回合管道"赋值(`handleTurnFn = handleTurn`)排在 outbox 对账 / 清扫 / 重嵌入调度 / 首启引导**之后**。上述任一步抛错 → boot 整体失败,但 `/memory/api` 与工具已注册:页面能开、接口能答,回合却永远不记录,且只有一行 stderr(桌面版通常看不到)。修复:① 先把管道接上(激活 + 消化 pendingPkgs),再跑可降级后置步骤,失败只记 `health.warnings` + `boot-degraded` 审计;② boot 彻底失败时落 `boot-failed` 审计并把 `{state,error,at}` 放进 `/memory/api` 的 `stats.health`;③ 配置页「需要关注」新增「记忆回合管道未启动:{error}」 |
| **选择器数据源(v1.16)** | 三源合并,以**路径**为行 id(`disabledWorkspaces` 的写入口径):① DSH 工作区注册表(`ctx.get('workspaceRegistry')`,0.2.x;提供标题与顺序,零回合也可见);② `global.seenWorkspaces`(含停用的);③ 记忆池 `workspaceId` 兜底。monorepo 子路径记忆并入仓库根行计数(与 `isWorkspaceDisabled` 前缀口径一致);注册表服务缺席/抛错时静默退回旧口径,不影响其它字段 |
| **门禁与测试** | `check:seams` 12 项不变;`check:conform` 34 条不变(本次无新增行为性声明,仅修实现);测试基线 **307 项 / 304 通过 / 0 失败 / 3 跳过**;新增 global schema 保留 `seenWorkspaces` 一例、工作区选择器注册表合并 / 注册表异常降级两例 |
| **已知边界(如实)** | ① 注册表行 `label` 用 DSH 工作区标题,行 `id` 是路径——两者不同源,用户手动改写路径前缀后该行可能同时出现"注册表行 + 手动行";② 历史事故 20:12–21:02 的**具体 boot 失败原因**未取证(stderr 未落盘),本次是结构修复:让同类失败不再静默、且不再阻断回合记录;③ 若宿主 `workspaceRegistry` 服务名在未来版本变化,选择器自动退回 seen/池口径(不会报错,但会少显示) |

v1.17(冷启动注册竞态修复 + 0.2.2-rc.1 端到端认证,2026-11-09;0.6.5):

| 项 | 内容 |
|---|---|
| **问题** | DSH 0.2.2-rc.1 启动更快;`apply` 原先"发起 boot 后立即返回",首轮 pre-step 在工具/注入注册落地前就解析工具集——实测 `memory_remember` 返回 `UNKNOWN_TOOL`、第二轮注入 0 |
| **修复** | `apply` 改为 async 并 `await` 第一次 boot 再返回(boot 失败仍由 `reboot()` 内部吞掉并记 health/stderr,不阻断宿主);E2E 在 0.2.2-rc.1 上 20/24 → **24/24** |
| **认证** | `check:host` 51/51、`check:shapes` 9/9(4 条接缝断言兼容 0.2.1/0.2.2 两种内部写法;`tools/lib/host-asar.mjs` 支持 `app.asar.unpacked`);`release-matrix` PASS;测试基线 307 项 / 304 通过 / 0 失败 / 3 跳过 |
| **已知边界** | 0.5.0 旧包仍有同样的冷启动竞态(不能改旧包);升级 smoke 在旧版写不进时按旧版存储格式种一条后继续验证"升级保留 + 新版读取" |

v1.18(敏感自动标记默认关闭,2026-11-09;0.6.6 R4;决策 2026-11-08,见 docs/legacy/REVIEW.md R4):

| 项 | 内容 |
|---|---|
| **决策** | 个人单人使用场景下**不做敏感自动标记**:`sensitiveKeywords` 默认 `[]`、`sensitiveNoCross` 默认 `false`;整理提示词不再要求模型标 `sensitive`(字段保留兼容,旧数据/旧模型输出照常解析)。字段、开关、手动标记全部保留——想隔离时自己打开并填词表 / 手动标记 |
| **证据** | `prescreenSensitive` 是 `lower.includes(keyword)`("包含就算")。本机 5/5 条 L0 被误标:emo⊂memory(5/5)、NDA⊂standard/descendant(4/5)、诊断⊂诊断卡(3/5);`sensitiveNoCross` 默认开着 ⇒ 技术记忆失去跨工作区带入资格。逐条核对见 docs/legacy/REVIEW.md R4 |
| **为什么不修误报** | 英文加词边界只能解决 emo/NDA 这类,中文一词多义(诊断/崩溃)纯规则修不干净;只要自动标记还在就永远有误判,而"不跨域"对单人本机没有价值。默认关直接消除这一类问题;以后要启用再按人工标注样本验收(REVIEW §10 第 17 条) |
| **影响面** | 不升存储格式;旧记录已带的 `sensitive` 标记保留事实、默认不生效;`privateWorkspaces` / `disabledWorkspaces` / `hidden` 三条边界不变;跨域硬过滤代码保留(打开开关即恢复) |
| **门禁与测试** | 新增 `test/config-defaults.test.mjs`(默认值 3 项);`pipeline` 增加"默认配置技术文本不被误标"1 项、prompt 契约加"不再要求 sensitive"2 条断言;`search` 增加"默认不拦跨域 / 打开仍拦"1 项;原 thinking 初筛与 openingDigest 敏感用例改为显式开启(锁机制,不依赖默认值)。测试基线 **312 项 / 309 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过;客户端 i18n 两条帮助文案同步并重建 bundle |
| **已知边界(如实)** | ① 默认配置下没有自动隐私隔离——依赖 `privateWorkspaces` 与用户自己打开敏感开关;② 旧 L0 上已有的 `sensitive` 标记不会自动清除(只是默认不生效);③ 手动改标 UI 在 R1a 交付,之前只能 forget |

v1.19(纯 BM25 默认相关性门槛校准,2026-11-09;0.6.6 R18):

| 项 | 内容 |
|---|---|
| **决策** | `relevanceGate.bm25OnlyMin` 默认 **2 → 10**。理由:绝大多数用户不配 embedding,实际走纯 BM25;旧默认下 frozen-v2 负例注入 6/13(均 2.15 条)、R@1 0.973,而混合路是 2/13、R@1 1.0——默认体验明显落后,且只差一个默认值(docs/legacy/REVIEW.md R18) |
| **证据(frozen-v2 双路径,R18 工具改造后实测)** | 纯 BM25 路径:负例注入 **6/13 → 2/13**(均 2.15 → 0.77 条),R@1 **0.973 → 1.000**,R@5 1.0 不变,MRR 0.98 → 1.0;混合路不受影响(2/13、R@1 1.0、R@5 1.0)。两条路径的关系候选召回均为 0.375 |
| **评估工具** | `tools/eval-frozen.mjs` 增加 `--lane bm25\|hybrid\|both`(默认 both):`bm25` 把 embedder 的 `available()` 设为 false,等价于"没配 embedding / 向量路降级"的真实形态;报告顶层 `metrics` 取 hybrid 兼容旧读者,完整两组在 `lanes`;`bench-results/frozen-v2.json` 同时存两组指标 |
| **保留的保护** | `bm25OnlyMinPoolSize=30` 小池子护栏不变(新用户头几十条不会被错误拦);`recall` 路径仍不设闸门;绝对分随语料规模漂移的纪律不变(§5.6),换池子后要重扫 `gate-sweep` / `inject-eval` |
| **回归调整** | `pipeline` 的"默认准入"端到端用例把相关查询从"依赖管理用什么来着?"改成带稀有词 `pnpm` 的问法——R18 后只有中文高频词重叠的问法会被 10 的门槛挡住,这是有意的取舍(冻结集正例不受损) |
| **门禁与测试** | 新增 `config-defaults` 的 gate 默认值断言 1 项;`eval-frozen` 增加双路径断言(bm25 负例 ≤2、闲聊 0、R@1 ≥0.973、单 lane 与 both 一致、非法 lane 报错)。测试基线 **313 项 / 310 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过 |
| **已知边界(如实)** | ① 10 是 frozen-v2 + 默认档的校准值,不是"任何池子都最优";② 中文查询只有高频词重叠时(如"依赖管理用什么来着")会被挡——换来的是负例注入降到 2/13;③ 相对线(`top1×ratio`)仍是长期方向(REVIEW §10 第 17/23 条),本次先做绝对线 + 双路径评估 |

v1.20(工具接口小修 + 画像截断保护,2026-11-09;0.6.6 R13a):

| 项 | 内容 |
|---|---|
| **画像截断保护** | 外部画像文件 > 20,000 字符时 `profileSnapshot` 只返回前 20,000 并标 `truncated`;`profileSave` 先读现有文件,源文件超长直接**拒绝保存**(记忆页保存按钮同步禁用)。此前用户一保存就把截断版写回,尾部永久丢失——这是真实数据丢失,不是体验问题 |
| **recall 截断可见** | 新增 `limit`(1–20,默认 10),内部多取 1 条判断"还有更多";截断时末尾标注"共显示前 N 条,还有更多;可用 time / session / 更具体的 query 收窄,或调大 limit"。旧实现按 `injectMaxItems*2` 静默截断,模型不知道还有更多,也不会去收窄 |
| **forget 关联回显上限** | 同 entity 相关记忆最多回显 10 条 + 总数 + "另有 N 条未列出";记忆库越大,一次 forget 的输出不再无限增长 |
| **自动带入行带编号** | `mem` 行渲染为 `[m_…] [工作区 · 时间] …`;编号计入 `injectMaxChars`(渲染返回值同时用于预算判定,超限整条丢)。L0 热缓冲行不加(模型没有可执行的后续动作)。这让模型能对刚看到的事实直接 `memory_forget({id})` / 纠错 |
| **门禁与测试** | 新增 `tools` 两例(recall limit/截断、forget 回显上限)、`pipeline` 一例(注入行编号 + 总额度)、`settings` 画像超长拒写断言、`client-persona` 截断时保存禁用断言。测试基线 **316 项 / 313 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过;客户端 bundle 重建 |
| **已知边界(如实)** | ① 画像超长时只能手动精简 / 直接编辑文件,页面不提供"强制覆盖"开关(安全优先);② 编号占用单轮注入额度,长内容条目可能因此更早被丢弃(R13a 只给长期记忆行加);③ 工具描述瘦身、`kind` 收敛等其余 R13 小项(REVIEW 第 5/7/8 条)不在 0.6.6 本次范围 |

v1.21(长回合不再整粒丢弃,2026-11-09;0.6.6 R8a):

| 项 | 内容 |
|---|---|
| **问题与证据** | 本机 5 条 L0 里有 3 条因为单个回合 `renderOriginal` 拼出来的原文超过 `extractMaxInputChars=65536` 字符,被标 `deadLettered`(操作记录 `extract-oversized-turn` 3 条)、48h 后真正删除(docs/legacy/REVIEW.md R8a)。写代码时"读大文件、看长构建日志"最容易撞上,而这类长会话恰恰最值钱 |
| **截断只作用于整理路径** | `renderOriginal(pkg, cfg, opts)` 新增可选 `opts.toolOutputMaxChars`:只有 `lib/extract.js` 的 `turnText()` 传 `cfg.extractToolOutputMaxChars`;工具层 `memory_recall` 按 id 展开原文不传(仍只受 `recallFullMaxChars` 约束)。成功输出留头部(`truncateChars` 带"截断,原 N 字符"标记),失败输出用 `makeExcerpt` 留头留尾——报错签名常在日志尾部 |
| **单回合上限复用现成旋钮** | 截短工具输出后,整回合再按 `hotBufferTurnMaxChars`(默认 32768,恒小于批量上限 65536)截断并记 `extract-turn-truncated`;不新增第二个同义配置。"单回合超 `extractMaxInputChars` 整粒跳过"降级为**配置互相矛盾时的安全网**(保留跳过防死循环 + L0 副本标死信交给 TTL) |
| **顺带修掉的静默丢失** | `renderOriginal` 原先直接 `for...of pkg.toolCalls`:对 `eventsToTurnParts` 产出的 **Map** 迭代拿到的是 `[callId, call]` 数组,工具名/参数/输出全变 undefined——`memory_recall` 展开原文(以及 sessionQuery 冷会话重建)里的工具产出一直被**静默丢弃**。新增 `toolCallsOf()`(lib/turns.js)归一数组/Map 两种形状,渲染与截断统计统一走它 |
| **可见性** | 新增审计 `extract-tool-output-truncated`(本回合几个工具输出被截短)与 `extract-turn-truncated`(单回合原长/截后长度);不再出现 `extract-oversized-turn`。控制台的系统状态展示在 R15a 接线 |
| **保留的纪律** | 不跨回合拼接/截断;默认批量上限 65536 **不往上提**(避免单次模型调用成本爆掉);关键结论可能落在被截掉的中间段——R8b(0.7.0)再做"留头留尾 + 提示词顶部截断标记 + 整理提示词说明",本次先保证"不再白聊" |
| **门禁与测试** | 新增 `pipeline` 两例(工具输出拼接 >64K 仍产出记忆且结论/报错特征保留、正文超单回合上限截断放行)、`hotbuffer` 一例(上限只对显式传参生效)、`tools` 一例(展开原文不受整理上限影响);`check:conform` 增加 §3.2 三默认值断言;§10 账本 +1 键(顶层 67 项)。测试基线 **320 项 / 317 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过 |

v1.22(去重即印证,2026-11-09;0.6.6 R14):

| 项 | 内容 |
|---|---|
| **问题与证据** | 去重命中时只写一条"重复跳过"的操作记录,不记证据(`extract.js` 旧去重分支 / `tools.js` 的 remember 命中分支)——用户反复确认、反复出现的事实证据仍是 0,照样随时间降权、退出候选(docs/legacy/REVIEW.md R14/P19) |
| **提炼侧** | 去重命中且原条目 `status==='active'` → 补一条 `kind:'reinforce', weight=evidenceWeights.system(0.5)`;`state` 类顺带 `renewStateExpiry`。**同批只记一次**:本批新建记录(`batchKey` 相同)不补、同批重复内容用内容键去重;幂等键 = 本批第一回合 outbox 的 `createdAt`(半批重试取到同一个值,不会把一次观察记成多次)。新增审计后缀 `extract-dedupe …;reinforce`,便于 R15a 统计 |
| **remember 侧** | `memory_remember` 命中已生效条目 → 同样补一条系统权重印证,返回文案改为"已印证(第 N 次,未重复写入;id)"。记**系统权重**而非用户权重:工具可被模型反复调用,用户权重(1.0)留给显式 confirm 与 R1c 的人工确认入口——否则一个爱重复的模型能自己刷分 |
| **用户质疑不翻案** | `negativeSince` 只有在该条目**没有用户级质疑**时才由通用对账清除;用户级质疑 = `weight ≥ evidenceWeights.user` 的 challenge(系统推断的 challenge 不算)。判定按权重而非新增字段:0.6.6 不升存储格式(§1),weight 本来就是"用户显式 / 系统推断"的分档(§5.3);R1c 的人工质疑入口接上后自然生效 |
| **落点** | 纯函数 `applyReinforce` + `hasUserChallenge` 放 `lib/rank.js`(单测友好);提炼去重分支与 remember 命中分支复用,不新增配置键 |
| **门禁与测试** | `pipeline` 新增 4 例(连续 3 次出现证据 +2 且不新建、无用户质疑时清 negativeSince + state 续期、有用户质疑时保留、同批重复只记一次),原 D1 remember 用例改为断言"1 条用户证据 + 1 条系统印证";测试基线 **324 项 / 321 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过 |
| **已知边界(如实)** | ① 同批幂等键用的是"本批第一回合的 outbox createdAt",若半批重试时批首回合已被消化、批组合变化,极端情况下同一次观察可能被记成两次(代价是证据多 0.5,不是数据错误);② 用户质疑守卫目前**没有真实入口**(R1c 在 0.7.0),当前数据里不存在 user 权重 challenge,该守卫等于空转——代码与测试先就位;③ 重复印证的证据时间用观察时间(批首回合登记时刻),不是重试墙钟,长期重试不会让旧观察显得新鲜 |

v1.23(关掉提炼后有上限,2026-11-09;0.6.6 R16):

| 项 | 内容 |
|---|---|
| **问题与证据** | `extractEnabled=false` 时只写 L0、不登记 outbox;而"还没整理、又不是等待删除"的 L0 副本**永不过期**(旧 sweep 只清死信与已消化条目)。用户以为只是省了模型调用,实际历史原文一直参与查找与自动带入,`hotBufferTtlHours` 的兜底在这个状态下等于没接(docs/legacy/REVIEW.md R16) |
| **两种情况必须分开** | **用户主动关掉提炼**(`extractEnabled=false`,记忆页开关)→ 启用新上限;**模型服务临时降级**(`extractEnabled` 仍为 true,只是路由/LLM 暂时不可用)→ 维持"未消化不过期",恢复后继续消化。区分依据就是配置本身,不猜运行时状态 |
| **删除前置检查** | 新增 `hotBufferUndigestedTtlHours`(默认 168h,`0`=关掉上限)。超期候选在删除前必须确认**原文仍能从会话日志读回**(`sessionQuery.readSession` 里存在覆盖 `[startSeq, endSeq]` 的事件):读得回 → 删副本 + 审计 `hot-dropped-undigested`(写明"提炼已关闭");读不回/`sessionQuery` 缺席/读盘失败 → **保留** + 审计 `hot-retained-undigested` + `logger.warn`。这是 §9.9"不物理删除"例外的最小扩展——绝不能把"唯一副本"删掉 |
| **不刷屏** | 同一进程内对同一条"读不回"只告警/审计一次(周期清扫每 30 分钟一轮);会话日志恢复后下次清扫仍会真的删除(告警去重不影响删除判定) |
| **R16b 补提炼(重新打开时)** | 用户 2026-11-09 裁决"选 C":关掉提炼期间写下的回合**不能白丢**。启动时(仅 `extractEnabled=true`)把"未消化、没有任何 outbox 引用"的 L0 副本按时间顺序补登记进 outbox,按正常攒批节奏补做一次提炼;审计 `hot-orphans-backfilled` + 日志一行。**不重复登记**:已有 outbox 行(任何状态,含 dead/skipped)的不动——重试/放弃语义归 outbox;hidden/死信/已消化跳过;停用工作区跳过。积压上限由 R16 的 168h 兜底(关掉期间更老的副本已被清),所以最多约一周的回合;补提炼的模型调用成本是用户明确接受的代价 |
| **门禁与测试** | `hotbuffer` 新增 4 例(可读回 → 删 + 审计、读不回 → 保留 + 告警且只告警一次、服务降级不删、0=不删);`pipeline` 新增 3 例(重新打开后孤儿 L0 补提炼、停用工作区不补、已有 outbox/已消化/hidden 不重复登记);`check:conform` 增加 §3.1 默认值断言;§10 账本 +1 键(顶层 68 项)。测试基线 **331 项 / 328 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过 |
| **已知边界(如实)** | ① 只有"用户主动关掉提炼"才启用清理,所以"关掉后反悔再打开"不会补回已删副本(原文在会话日志,且 R16b 只补还留在池里的那份);② 判断"读得回"依赖 `sessionQuery` 与 DSH 会话日志保留期——会话被删/清空后该副本会被永久保留并持续告警(宁可占磁盘也不删唯一副本);③ 补提炼的源码是 L0 副本(可能已按 `hotBufferTurnMaxChars` 截断、工具输出是摘要),不是原始回合;`sessionQuery` 能读回原文时优先用原文;④ 补提炼积压很大时会连续消耗模型调用(用户明确接受);⑤ 记忆池里已消化的 L0 副本仍按 `hotBufferRetainDays` 清理,与本上限互不影响 |

v1.24(来源三段判定,2026-11-09;0.6.6 R13b):

| 项 | 内容 |
|---|---|
| **问题与证据** | `memory_remember` 一律把来源写成 `source:'user'`(`lib/tools.js`),整理侧则采信模型自报的 `source`——而 `confirm`、`stagedBy`、`source` 全是模型可填参数,模型可以"自证"用户说过。结果:来源措辞("你之前说过")不可信,技术记忆/推断也被当成用户权威(docs/legacy/REVIEW.md R13 / §10 第 16 条) |
| **① 整理侧:按原文角色判定** | 新增 `lib/provenance.js`(纯函数):每回合按 `userTexts` / `assistantTexts` / toolCalls 判角色(user / assistant / mixed),整批**只有全部回合都是 user 才记 `user`**,其余(混合/助手/工具/退化副本判不清)一律 `assistant`。模型自报的 user/assistant 只作参考并被覆盖;`code`/`tool`/`quote` 是内容分类,保留。退化路径(L0 副本)按渲染标题行判角色 |
| **② remember:用户原话引用** | `memory_remember` 新增可选参数 **`userQuote`**(不是 `quote`,避免与"转贴外部资料"混淆):工具用 NFKC+空白折叠规范化后,核对它**确实出现在本会话用户消息里**(`sessionQuery.readSession` → 用户消息正文,长度 ≥4 字符);通过才记 `source:'user'`,不带/对不上/管道缺席一律 `assistant`。**confirm 不再给用户权重证据**——用户权重只给"原话核对通过"或界面确认,其余记系统权重 0.5 |
| **③ 界面确认** | `/memory/api` 的 `confirm`(控制台点确认,不经模型)写 `confirmedByUser:true`;来源措辞升到"你确认过"(优先于 source)。`source` 保留原值(确认内容为真 ≠ 确认是用户说的) |
| **④ 措辞三档 + 查不清** | 渲染口径:confirmed → "你确认过「…」";user → "你之前说过「…」";assistant → **"助手之前记下的「…」"**;unknown → "来源查不清的记录:「…」(按资料对待)";code/tool/quote 原措辞不变。工具回显与客户端标签同步(`用户说的 / 助手记下的 / 你确认过 / 来源查不清 / 代码里看到的 / 工具查到的 / 用户转贴的资料`) |
| **⑤ 旧记录回填** | 启动时一次性(global `sourceRemapVersion` 防重跑;`sessionQuery` 缺席则下次再试):有 `sessionId+sourceRange` 的按原文角色重算(可能降级为 assistant,全用户区间则升级为 user);没有可复核 provenance 的标 `source:'unknown'`(查不清,不猜);`confirmedByUser` 与 code/tool/quote 不动。审计 `source-backfilled` |
| **存储与兼容** | 唯一新增可选字段 `confirmedByUser`;`source` 枚举加 `unknown`(旧版本读到会落在 default 渲染,不报错)。**不升 domain 版本**(NEXT_STEPS §3 的裁决);global 新增 `sourceRemapVersion`(必须声明,否则会被 zod strip) |
| **门禁与测试** | 新增 `provenance` 6 例(角色/整批/来源解析/userQuote/区间角色/档位);`pipeline` 3 例(整理按角色、注入三档措辞、旧记录回填);`tools` 3 例(原话核对/不带或编造/recall 档位标签);`settings` 增加 confirmedByUser 断言;原"不带引用即用户"的用例按新语义改断言(注入/防御/tokenMeter/D1)。测试基线 **343 项 / 340 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过;客户端 bundle 重建 |
| **已知边界(如实)** | ① 整理出来的记忆**默认是"助手记下的"**——只有"整段原文全是用户消息"的回合才记 user(宁可低估,不误标用户);用户权威留给 userQuote 核对与界面确认;② `userQuote` 校验依赖本会话用户消息可读(会话管道缺席时降级为 assistant,不猜);模型可以挑真实原话,但造不出不存在的原话;③ 旧记录回填会**降级**大量历史 `source:'user'`(它们本来就是模型自报的);`unknown` 不可逆,回滚到旧版本时按 default 渲染;④ `episode` 的措辞仍是"当时聊过"(话题摘要不属于"谁说的") |

v1.25(整理过程可见,2026-11-09;0.6.6 R15a):

| 项 | 内容 |
|---|---|
| **问题与证据** | 整理失败、找不到可用模型路由、失败后等重试,全都只写 `logger.info`;用户只看到"聊完了却没记住",没有 `lastExtract`,总览健康检查也答不出"上次整理什么时候、成功没、为什么失败、丢了多少条"(docs/legacy/REVIEW.md R15a / P21) |
| **状态** | `/memory/api` 的 `stats` 增加两个**进程内**字段(重启归零;跨重启线索在审计里):`lastExtract:{at, ok, reason, batchTurns, chars}`(最近一次落定的整理;成功时 `reason` 为空)与 `drops:{lowConfidence, injection, secret, oversized}`(本次运行累计被过滤掉的候选条目,与 `cleanItems` / episode·SOUL 提议守卫 / 整粒跳过的过滤一一对应)。`overview` 原样带 `stats`,页面只读一份数据 |
| **失败记录** | 失败按 `batchKey` 限频写审计 `extract-failed`:第一次失败一条(第 1 次,将按退避重试——用户不用等重试到底才知道原因);重试耗尽/全部输入转死信再一条(彻底失败,已转死信);中间重试不写;首次即耗尽时只留最终一条。找不到模型路由按会话限频一条(路由恢复前不反复报警)。整粒跳过(配置互相矛盾的安全网)沿用具体审计 `extract-oversized-turn`,并计入 `drops.oversized` + `lastExtract.ok=false` |
| **总览页** | 健康检查的"提炼"一项:上次整理失败 → warn + 时间 + 原因(优先于积压/死信提示);成功 → ok + 上次时间/回合数/字符数;丢弃计数只在非零时多一行 info(按原因分开,不打包成"出错了")。中英词典各 +4 键 |
| **门禁与测试** | 新增 `test/extract-visibility.test.mjs` 5 例(失败可见 + 首次记录;mock timers 推进重试耗尽 → 最终记录且只两条;首次即耗尽只留最终一条;成功 + 三类丢弃计数;超长回合整粒跳过);`client-overview` +1 例(失败/丢弃/成功时间);`check:conform` +1 条(38 条)。测试基线 **349 项 / 346 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过;客户端 bundle 重建 |
| **已知边界(如实)** | ① `lastExtract`/`drops` 是进程内状态,重启后归零(持久线索看审计 `extract-failed`);② 失败记录按 `batchKey` 限频,新回合改变批组成时算新批次、会各自记一条——那是"新的失败",不是重复刷屏;③ `drops` 只统计整理管道的丢弃,不含注入预算/检索过滤;④ 手动触发整理、会话结束立即整理是 R15b(0.7.0) |

v1.26(记忆管理操作与来源追溯,2026-11-09;0.6.6 R1a):

| 项 | 内容 |
|---|---|
| **问题与证据** | 用户能在控制台看到记忆,却**改不动**:没有停用/恢复入口,不能改敏感标记,也不能彻底隐藏;详情里没有 `sessionId`/`sourceRange`,`hb_…` 翻不了,README 说的"带来源"在控制台里兑现不了(docs/legacy/REVIEW.md R1a / P3 / P33 / §4.3)。停用只能求模型调 `memory_forget` |
| **① 手动操作** | `/memory/api` 新增 `archive`(停用)/ `restore`(恢复)/ `sensitive`(手动标敏感/取消)/ `hide`(彻底隐藏)/ `expandSource`(展开来源轮次,只读)。全部沿用现有 `store.memories.update` + `search.upsertMemory` + `audit.write`,**不改存储格式、不物理删除**;操作记录:`memory-archived` / `memory-restored` / `memory-sensitive-set`,彻底隐藏沿用工具的 `forget-hard`(含打码与级联记录) |
| **② 单一实现** | 新增 `lib/ops.js`:hard forget 的级联 L0 / 终止同源 outbox / 审计正文打码,以及 `expandOriginal` 的来源读取与 hard-forget 过滤,从 `lib/tools.js` 抽出集中实现;`memory_forget(hard=true)` 与控制台「彻底隐藏」、`memory_recall` 展开与控制台「展开来源轮次」都走同一份代码——工具侧只多一道"同工作区才展开"的跨域闸门 |
| **③ 恢复语义** | 只把 `status` 改回 active 不够:清 `negativeSince`(否则旧质疑计时到点又被自动归档),`state` 类续期 `expiresAt`(否则下一次 30 分钟清扫按过期规则立刻再归档)。`hidden` 不可恢复(彻底隐藏是终态);`staged` 的停用等价于拒绝归档 |
| **④ 详情与来源** | `detail` 返回 `sessionId` / `sourceRange` / `sourceExpandable`;`hb_…` 临时原文缓存支持**只读**详情(`status:'hot'`、`readOnly:true`,含工作区/回合/区间);展开时按 `renderOriginal` 渲染原文(限 `recallFullMaxChars`),过长的区间按查询 token 取摘录;hard forget 的隐藏区间与正文一律过滤,读不回/被全部隐藏时如实报错 |
| **⑤ 控制台** | 详情页按钮组:停用(或恢复)、标为敏感(或不敏感)、彻底隐藏(**二次确认**:第一次只把按钮换成"再点一次确认…")、展开来源轮次;操作完留在详情并重拉(`archive/restore/sensitive/hide` 不退回列表),失败走错误横幅。热缓冲条目只读、不给停用/修改;已隐藏条目不提供任何操作。中英词典各 +16 键,新增 `.mem-expand-body` 样式 |
| **门禁与测试** | 新增 `test/r1a-ops.test.mjs` 5 例(三操作+留痕、恢复语义与 hidden 拒绝、彻底隐藏与工具同口径、detail/hb 只读详情、expandSource 与 hard-forget 过滤);`client-memories` +4 例(停用/恢复/改标记、二次确认隐藏、展开成功与失败、热缓冲只读详情);`check:conform` +1 条(**39 条**),REFERENCED 增加 `ops.js`。测试基线 **358 项 / 355 通过 / 0 失败 / 3 跳过**;`check:ledger` / `check:seams` / `check:conform` 通过;客户端 bundle 重建 |
| **已知边界(如实)** | ① 控制台操作是 **owner 级**(全局页面):不受 agent 工具 `canAccess` 的 private/sensitive 跨域限制(与既有的 confirm/reject 一致);② 手动敏感标记只在 `sensitiveNoCross` 打开后影响跨工作区自动带入(R4 起默认关);③ 停用/恢复/改标记**不写证据、不加分**——"这条对"是 R1c(0.7.0);④ 编辑正文是 R1b;⑤ 展开来源需要 `sessionQuery` 且会话日志仍在,会话被删后只给"读不回来" |
