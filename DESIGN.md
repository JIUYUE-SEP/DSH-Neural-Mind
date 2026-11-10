# neural-mind 设计总览

> **状态**：现行（设计合同）｜**适用版本**：0.6.7｜**最后核实**：2026-11-10
> **读者**：改代码的人 / AI agent｜**本文不负责**：具体机制细节（见 `docs/design/`）、配置全量（见 §10 文档）、历史沿革（见 `docs/legacy/`）
> **编号纪律**：§ 编号永久冻结，不重排、不复用；正文文件前缀 = § 号（`06` 合并 §6+§7）。代码注释、测试、门禁里的 `§N` 引用都指这套编号。
> **两层设计**：本文只放总览与合同（不变量、术语、索引、不做清单、关键决策）；机制细则在 `docs/design/`，冲突时以本文不变量为准，且必须同提交修订。

## 0. 核心原则

**核心原则(优先级从高到低):**

1. **不打扰聊天**:一切耗时操作在后台;任何环节失败对话照常;每轮内联延迟预算 ≤300ms(§4.2 分配)
2. **有凭有据**:每条记忆带来源(哪个 workspace、哪个会话、什么时间),可被印证、可被证伪
3. **代码事实服从代码真相**:代码相关记忆是**线索**(引导读文件)而非**答案**(替代读文件);注入前可核验,冲突以当前代码为准(§3.2 铁律、§4.2)
4. **分清"你说的"和"你贴的"**:外部资料内容不带用户权威归因(quote 来源,§1/§4.2);分清"新旧替换"和"观点争议"(§3.2 矛盾处置)
5. **坏了不绊倒人**:所有外部能力有降级路径;可选服务一律 `ctx.get()` 探测(§7)
6. **诚实声明能力边界**:做不到的不承诺(见 §9)
7. **记忆是数据,不是指令**:一切经提炼/检索回流的内容都过注入防御(§3.4)

---

## 设计树索引

| § | 主题 | 状态 | 文件 | 代码入口 |
|---|---|---|---|---|
| §0 | 核心原则 | 本文 | — | — |
| §1 | 记忆模型:热缓冲 + 四层 + 暂存区 | 现行 | [01-memory-model.md](docs/design/01-memory-model.md) | `lib/schema.js`、`lib/hotbuffer.js` |
| §2 | 全局记忆池与来源标注 | 现行 | [02-global-pool.md](docs/design/02-global-pool.md) | `lib/provenance.js` |
| §3 | 写入路径:双速通道 + 显式通道 | 现行 | [03-write-path.md](docs/design/03-write-path.md) | `lib/turns.js`、`lib/extract.js`、`lib/tools.js` |
| §4 | 读取与注入路径:三通道,推拉结合 | 现行 | [04-inject.md](docs/design/04-inject.md) | `lib/inject.js`、`lib/soul.js` |
| §5 | 检索:混合双路(决策②) | 现行 | [05-search.md](docs/design/05-search.md) | `lib/search.js`、`lib/embed.js`、`lib/sidecar.js` |
| §6+§7 | 生命周期与能力降级 | 现行 | [06-lifecycle-degradation.md](docs/design/06-lifecycle-degradation.md) | `lib/rank.js`、`lib/store.js`、`lib/compat.js` |
| §8 | DSH 接缝映射 v2.0 | 现行 | [08-host-seams.md](docs/design/08-host-seams.md) | `lib/index.js` |
| §9 | 明确不做的事 | 本文 | — | — |
| §10 | 配置项清单（Schemastery 账本） | 现行 | [10-config-ledger.md](docs/design/10-config-ledger.md) | `lib/config.js` |
| §11 | 实施路线（历史） | 归档 | [implementation-roadmap.md](docs/legacy/implementation-roadmap.md) | — |
| §12 | 决策记录与差异化定位 | 本文 | — | — |
| §13 | 审核溯源（历史） | 归档 | [review-provenance.md](docs/legacy/review-provenance.md) | — |
| §14 | 使用观测与容量统计（R3 / R9 只读） | 现行 | [14-observability.md](docs/design/14-observability.md) | `lib/usage.js`、`lib/api.js` |

## 1. 记忆模型
> 正文：**[§1 记忆模型](docs/design/01-memory-model.md)**。

## 2. 全局记忆池与来源标注
> 正文：**[§2 全局记忆池与来源标注](docs/design/02-global-pool.md)**。

## 3. 写入路径
> 正文：**[§3 写入路径](docs/design/03-write-path.md)**。

## 4. 读取与注入路径
> 正文：**[§4 读取与注入路径](docs/design/04-inject.md)**。

## 5. 检索
> 正文：**[§5 检索](docs/design/05-search.md)**。

## 6. 生命周期
> 正文：**[§6 + §7 生命周期与能力降级](docs/design/06-lifecycle-degradation.md)**。

## 7. 能力依赖与降级
> 正文：同 §6 文件（[06-lifecycle-degradation.md](docs/design/06-lifecycle-degradation.md)）。

## 8. DSH 接缝映射
> 正文：**[§8 宿主接缝映射](docs/design/08-host-seams.md)**（现行表，每行带宿主版本与核实日期）；跨版本校准史见 [host-compat-history.md](docs/legacy/host-compat-history.md)。

## 9. 明确不做的事

1. **不做 LLM 重排**:检索链路内不嵌 LLM 往返
2. **不引入重依赖**:不要 Neo4j/Qdrant/Redis;向量不建库,存记录上
3. **不做参数化记忆**(LoRA 级):收益无证据、成本与回滚风险高,且与"记忆是数据不是权重"的模型冲突
4. **不碰 `system-prompt/assemble` waterfall**:专家级接缝,官方警告会破坏 PTC/结构化输出
5. **不用 `ctx.systemPrompt.context()` 做动态注入**:时序、同步签名、快照累积三项硬伤(§4.2)
6. **不写会话日志**:log-only 事件的 ignorable 陷阱(§8);审计走自有存储
7. **不碰弃用 API**:`eventAt/snapshotEvents/ownEvents`
8. **不承诺位置自然化**:记忆块只能作为新消息进入当 step,做不到按时间戳穿插历史
9. **记忆不物理删除**:只有归档(archived)与访问屏蔽(hidden)——纠错 = 归档/屏蔽/调证据分,全程可审计。例外有**三处**,都只删"会话日志的副本":①已消化 L0 副本按 `hotBufferRetainDays` 物理删除;②**死信 L0**(outbox 重试耗尽进 dead-letter,或单回合自身超 `extractMaxInputChars` 被整粒跳过)按 `hotBufferTtlHours`(默认 48h)物理删除;③`v1.23 R16`:用户主动关掉提炼后,未消化 L0 副本超 `hotBufferUndigestedTtlHours`(默认 168h)**且确认原文仍能从会话日志读回**时物理删除(读不回则保留并告警——不扩到"唯一副本")。**读回校验只覆盖第③类**;①/②依赖会话日志仍在(原文由 DSH 保留期决定)。**坦白的边界**:屏蔽只挡本插件的检索/recall/注入,原文仍在 DSH 会话日志里,且旧代码/原文取回依赖 DSH 会话日志的保留期(README 如实告知;真删除原文超出本插件职责；§14 的使用遥测（计数与注入元数据）不含记忆正文，按保留期清理不属本条约束)
10. **不抢 DSH compaction 本职**(会话内压缩守卫类机制属生态其他插件的职责)
11. **不承诺深夜长会话后期推通道不断供**(压力治理的代价;recall 拉通道兜底)
12. **不承诺同一目录(非 git)下多任务的精确归属**(entity 仅软性加权;硬门槛开关在 V2,§11)
13. **不做定时主动提醒**:插件只在对话开场注入记忆,没有闹钟能力;"提醒我"类承诺只能兑现为"下次开口时想起"(README 如实告知)
14. **不自改能力面**:SOUL 层只改人格文本;工具、模型、权限、沙箱、审批策略与预设行一律不可自改(DSH 的沙箱与审批就是为此存在)
15. **SOUL 不做分档**(v1.9):一份人格跨身份一致,角色差异归 preset persona;将来若要"角色侧重"按版本纪律升版加,不留空字段
16. **不给 SOUL 配 LLM 裁判**:内容纪律靠声明 + 注入特征拒收两条,不引入额外模型往返(§4.4)
17. **不让提炼流水线直写 SOUL**:~~最多在 V1.1 做"提议"进暂存区、由用户确认~~(**V1.1 第 8 步已交付**:提炼归纳 `soulProposal` → `entity: 'soul'` 落暂存区 → 设置页 SOUL 卡「人格提议」区,采纳走用户通道追加进 SOUL,忽略归档——自我设定不接受自动改写,每一步都过用户的手)
18. **不抢 AGENTS.md 的职责**:L1 只放关于用户的陈述性事实,指令归 `$DSH_HOME/AGENTS.md` 与项目链(§4.1、§4.4)
19. **不承诺正则识别自由文本凭据**:密钥形态检测**例如**覆盖特征明确的令牌(sk-/glpat-/xoxb-/hf_/sk_live_/npm_/AWS/内联私钥,以及 GitHub `gh[pousr]_`/JWT/PyPI/常见赋值形态);带空格的口令等自由文本形态会误伤正常内容,故不做——纪律是"凭据不写进记忆与 SOUL"(v1.9 红队审查确认的边界)
20. **不把 SOUL 治理当强制边界**(v1.9 审查结论):四道检查(密钥/注入/超长/日预算)与两道开关只约束 agent 自改通道;设置页保存/回滚是用户通道——同样过密钥/注入/超长三道内容检查,但不受两道开关与日预算限制;`$DSH_HOME/SOUL.md` 手改是受支持入口、完全不受检查约束。agent 若同时具备 bash/文件写入能力也可绕过。治理目标是**防手滑与防外部内容注入**,强制边界归 DSH 的沙箱与审批(README 如实声明)
21. **设置页浏览不设隐私过滤**(v1.9 审查结论):`list`/`audit` 是所有者视图,列出全池(含 privateWorkspaces/sensitive)。隐私过滤只约束注入与跨域检索
22. **不做通用进程管理**:`autoStartCommand` 只托管**一条用户显式配置的本地命令**,且仅当向量路启用、端口无人监听时;端口已有人监听一律当外部服务(不拉起、不回收)。这不是服务编排器,也不接管任何系统服务(V1.9)
23. **不做路级交集**(v1.9 实测结论):要求"两路**按名次**都命中"会把"只有一路能命中"的正当情况一律砍掉——改写式查询靠向量、标识符查询靠 BM25,实测候选只剩 2.5 条、R@5 从 0.64 掉到 0.44(早期候选集口径;2026-09-17 真路径重跑:AND 档 R@5 0.45~0.59、负例 0.0,基线 0.73)。两路互相印证由 `relevanceGate` 的**绝对分共识线**表达,单路命中只要过更高的单路线即可。配套纪律:两路都可用时按共识线/单路线;纯 BM25(未配 embedding / 降级中)按 `bm25OnlyMin`(默认 10)单路准入,池子小于 `bm25OnlyMinPoolSize`(默认 30)时不启用——v1.13 起不再"整条失效"(该单路线本就为无向量路的用户而设)
24. **不做同仓亲和**(用户裁决,2026-09-17):monorepo 兄弟包不区分——籍贯只分两档,当前 workspace ×1.0、其余 ×`remoteFactor`;worktree 归并属籍贯解析(§2),不受影响。原 §5.4 的 ×0.9 同仓档与 §11 V1.1 对应条目一并删除,不再预留

---

## 10. 配置项清单
> 全量账本（70 项）见 **[10-config-ledger.md](docs/design/10-config-ledger.md)**；`check:ledger` 与 `lib/config.js` 的 Schemastery schema 机械对账。常用层 / 高级层划分以账本为准。

## 11. 实施路线
> 历史路线已归档：[implementation-roadmap.md](docs/legacy/implementation-roadmap.md)。当前执行与待设计池见 [NEXT_STEPS.md](NEXT_STEPS.md)。

## 12. 决策记录与差异化定位

**已拍板:**

1. **remember 工具 → 方案 B(暂存区 + confirm 当场转正)**:显式意图专用通道,逐字立即落盘;user-explicit(`confirm=true`)直落 active,不被注入特征硬拦(仅软标记),密钥/令牌形态仍一律拒收;**没有"暂存态豁免自动归档"这回事**——落盘即 active 按 §6 正常归档;model-auto 严检、进暂存区、30 天未印证归档(§3.3)
2. **MVP 检索 → 混合双路**:BM25 常开 + 向量可选(150ms 份额)+ RRF;不配 embedding 自动降级(§5)
3. **热缓冲存全文 + 查询相关片段裁剪(v1.3)**:对话正文不省(代码块折叠、工具摘要/失败例外、单轮超 32K 字符截断,见 §3.1),渲染才裁;思考块仅 recall(§3.1,§4.2)
4. **向量路自适应分段(v1.4)**:≤`chunkPlainMaxChars`(默认 8192 **字符**)整条;超阈值切段批量 embed(一次请求;因段间重叠,总 token 略高于全文);命中段归并父记忆,段即片段(§1,§4.2,§5)
5. **编码适配修订包(v1.5)**:文件锚 + 注入前核验 + state 有效期;来源分措辞 + "以当前代码为准" + 位置记忆优先;注入治理三件套;lesson 常驻通道;二级籍贯与 entity 加权;冷启动收紧;代码块折叠;标识符分词;trajectory 回放;子代理默认不注入(§1-§8,§10,§11)
6. **四场景适配包(v1.6)+ 验收补丁(v1.6.1)**:quote 来源;矛盾分流;数值 state 短寿 + validUntil;无锚事实生命周期补齐;confidence 上限限定代码域;核验两级 + lastVerifiedAt + 二进制 mtime;本会话排除;同仓亲和(已于 2026-09-17 删除,见 §9 第 24 条);recall 整条展开;开场动态;sensitive 不跨域(含 L0 初筛)+ 首启引导提前;forget hard 屏蔽;配额最小名额;常驻用户级补位;召回定义写死;提炼输入上限与降级(§1-§10)
7. **一致性与生命周期收官(v1.7)**:排序公式补 superseded/validUntil 因子;stagedBy 字段;negativeSince 统一(E≤−2 记、>−2 清零);内联 300ms 口径对齐(embed 150 份额);§10 全量暴露补齐;L0 措辞动态化;§9.9 例外与坦白;validUntil×TTL 联姻;importance≥8 state 免 TTL;数值到期宽限制;hidden/archived 全域规则;争议非对称 challenge(**后为 D2a 关系护栏限制,见 §3.2**);被说服通道;假设演进细则;entity 规范化;核验内容级双条件触发;锚缺失连续 3 轮;worktree anchorRoot(**实现记 git 根,同仓 worktree 当前无法区分,见 §1**);压缩字符回冲;错误签名规则;配额降级语义写死;remember 字段语义;archived recall 可见;密读整粒截断;"高证据/死信"定义;常驻选择规则;entity='user' 规范值;行动项逾期语义;openingDigest 解耦(§1-§10)
8. **精简优化修订(v1.8)**:MVP 减重(分期判据"没有它是否仍比没有记忆强";数据模型与配置 schema 仍 MVP 全量,分期只分行为机制,§11);关系判断候选集写死(检索 top-K 进 prompt,§3.2);排序分值域说明 + 算例集回归纪律(§5.6);BM25 相对及格线选项(§5.1);配置分层暴露(常用 8 项 → v1.8.1 补录为 10 项 → v1.9 增为 12 项 → v1.9 收口删 `profileText` 后为 11 项 → 固定 global 删 `scope` 后为 10 项 → v1.14 增 `disabledWorkspaces`/`autoRecall` 后为 12 项,§10);重嵌入节流(§5);证据 logistic slope 阀(§5.3)
9. **SOUL 人格层(v1.9)**:人格与记忆分离——`$DSH_HOME/SOUL.md` 单文件为真相源(md 手编,与传统对齐);agent 可自改(专用工具,带理由、日预算、审计、版本快照与一键回滚);**一份人格跨身份一致,不做分档**(角色差异归 preset persona;若将来要"角色侧重",按版本纪律升版);只做补充层、永不碰预设;L1 归位为"关于用户的陈述性事实",指令让给 DSH 原生的 `AGENTS.md`/项目链;四层分工见 §1,机制见 §4.4

**差异化定位(经 awesome-dsh 约 90 个记忆插件对照):**

混合检索 RRF、暂存门、引用式记忆单点均已有人做;真正的组合差异是:

- **证据裁决 + 代码事实核验**:双计数器非对称衰减 + 文件锚 + 注入前核验(可摘帽)+ state 有效期——记忆会被证伪,且代码类记忆有"非对话式"失效通道
- **来源纯度**:quote 归因 + 争议/改口/漂移/被说服全分支——资料不顶用户名义,争议不被误判为取代,改口不被漏判
- **全局池 + 籍贯渲染 + 本地加权 + 内容级隐私**:跨项目复用与 sensitive 不跨域并存
- **双速热缓冲**:即时跨会话可见 + 后台慢炖提炼
- **有自我的 agent(v1.9)**:可自改的人格层,与规矩(`AGENTS.md`)/ 角色(preset persona)/ 事实(记忆)四层分离;自我修改带理由、日预算、版本快照与一键回滚——awesome-dsh 约 90 个记忆插件里几乎无人占这个位置。风险面(被注入 → 被夺舍)由治理正面承担,而不是靠"不开放自改"回避
- 长期最大竞争威胁:官方背景的 Hindsight——以"证据可审计 + 隐私可治理 + 事实可核验"为差异化立足点

---

## 13. 审核溯源
> 历史版本级审核记录已归档：[review-provenance.md](docs/legacy/review-provenance.md)。

---

## 14. 使用观测与容量统计
> 现行（0.6.7 S12 已实现，待发版）：**[§14 使用观测与容量统计](docs/design/14-observability.md)**——注入 / 提炼 / 召回计数按天落盘 + 注入滚动记录（含相关度 / 可信度元数据）+ 只读容量统计；独立短命域、不改记忆生命周期。

---

**维护规则**：改机制 → 改对应 `docs/design/*.md`；改不变量 / 不做清单 / 决策 → 改本文；两者必须与代码同提交（`check:design` P1，基线在 `docs/design/.baseline`；历史压缩为单提交时写 `ROOT`）。§ 编号永不复用。
