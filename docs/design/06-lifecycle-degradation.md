---
id: 6
title: "生命周期与能力降级（§6 + §7）"
status: 现行
since: 0.1.0
verified: 2026-11-09
code: [lib/rank.js, lib/store.js, lib/compat.js]
supersedes: []
superseded_by: null
---

# §6 + §7 生命周期与能力降级


- **事件明细账**:印证/打脸追加进 `evidence[]`(上界 `evidenceMaxEntries` 默认 64);读时按 §5.3 惰性算 E
- **"召回"的定义(写死)**:**动态注入命中与 recall 命中条目(默认/展开模式)均计召回**;trajectory 模式回放的是会话日志,不计条目召回。常用记忆永远活着,没人用的才衰减到期
- **state 类有效期(TTL,分档)**:落盘带 `expiresAt`——含数值/日期/金额/百分比的 state 默认 `stateTtlNumericDays`(10 天),其余 `stateTtlDays`(30 天);**召回即续期**,核验通过亦续期。**带 validUntil 者取 max(正常 TTL, validUntil + 7 天宽限)**——远期未来事件不会先于事件本身被归档。**importance≥8 且 E≥0 的 state 免 TTL 归档**(仍可被取代/质疑/validUntil 处置)——重大生活事件不死于沉默
- **到期处置(宽限制,不直接归档)**:state 到期 → 先 ×`validUntilFactor` 降权 + 渲染"已过期(截至 <eventTime>)",**宽限期 2×TTL** 内召回可续命;宽限过后才归档。被召回即续期恢复——月度数字不再"死于被需要之前"。**渲染口径的边界(v1.9 复核)**:降权对**所有**到期 state 生效,但"已过期(截至 …)"这句**只对数值类 state** 渲染(见 §4.2:数值类强制带"截至";非数值 state 到期只降权、不加前缀)
- **validUntil 两类语义**:事件类(todo 缺省)过期 → ×0.3 降权 + 移入"过去的事"区;**todo 行动项逾期不降权**,渲染"原定 <date>,未见完成确认",直至后续印证(用户说"交了")——**当前没有清除 todo/validUntil 的人工入口**(0.7.0 待做);逾期 deadline 该提醒不该埋葬
- **矛盾分流**(§3.2):带锚漂移/同主体改口/被说服更新/假设演进 → `supersededBy` 即时态(×0.3 + 措辞标记,不归档;**平反入口待 0.7.0,当前无清除 `supersededBy` 的代码路径**);跨来源对立(dispute)→ 双方互记 challenge 互指 `targetId`、不标取代、渲染"存在争议"(成对注入不计召回续期);并真事实判无关。**实现状态**:见 §3.2(D2a 关系护栏后,跨主体对立一律拒收)
- **归档硬规则(连续口径,统一)**:`E ≤ −2` 时记 `negativeSince`(已是负值不清零);**E 升回 > −2 即清零**;negativeSince 距今连续 ≥ `archiveDurationDays`(14)天 → `status:'archived'`。惰性路径:检索/渲染时发现满足即**回写 status**。**清零的两个半句必须在同一处判定(v1.9 复核修正)**:实现原先把"清零"只挂在 challenge 之后,于是"被质疑过、后来又反复被印证"的条目仍带着旧 `negativeSince` 被归档;现在**所有要判归档的地方**(惰性注入、周期清扫、印证写入)都先对账一次
- **显式遗忘**:`memory_forget` 直接置 archived(§4.3),不走 14 天流程;`hard=true` 追加 hidden 并级联 L0
- **staged 条目**:不适用本硬规则(§3.3 自有路径)
- **时间语义渲染分区**:pattern 永不过期;state 超 7 天 / episode 超 3 天 / 过 validUntil 的非 todo 条目 → "过去的事"区(天数可配)
- **后台调度(V3)**:借 `agent.runMaintenance()` 空闲扫描,替代纯惰性计算;episode 归并调度同属 V3。**部分已落地(v1.9 复核)**:归档扫描现在由 30 分钟一跳的 `setInterval` 跑(`lib/index.js` 的 `SWEEP_INTERVAL_MS`,随 disposer 清理),V3 要换的是"跟随 `runMaintenance` 空闲时机"而不是从零接线

---


## §7 能力依赖与降级(inject 必需 vs ctx.get 可选,已核实)


Cordis 语义:`inject` 声明的是**必需服务**——缺席则插件永不加载;可选服务必须 `ctx.get(name)` 探测。据此逐项:

| 依赖 | 声明方式 | 缺席/失败时 |
|---|---|---|
| storageDomain | `ctx.get` + `ctx.inject` 子插件兜底 | 纯内存态,重启失忆,功能照常(两条降级路径各留一行 stderr,§13 v1.9 回流) |
| sessionQuery | `ctx.get` | **整个服务在最小 bundle 里可缺席**:L4 引用索引仍在(能定位到 seq 区间),但**读回原文仍依赖 sessionQuery**——展开降级"原文已不可考"(记审计不记 challenge);提炼输入退化为热缓冲副本并记审计(§3.2) |
| llm(ctx.llm) | `ctx.get` | 慢速通道停摆(outbox 积压不丢,**热缓冲不过期**,§3.1),热缓冲+检索照常——记忆"只读模式" |
| semanticSearch(向量路) | 自建(无官方接缝) | 纯 BM25;150ms 超时/失败同(跨语言召回随之降级,如实声明;README 对研究/跨语言用户写明强烈建议配置)。凭据走 `ctx.get('credentials')`,env 直读兜底 |
| 向量维度变化(端点换模型但 `modelId` 未改) | 响应维数当场校验(同批不等长 → shape) | 跨响应维度变化记 `dim-mismatch` 并降级纯 BM25,**绝不混算**;库中旧维度向量被检索侧跳过并记账,同时触发后台重嵌入自愈(v1.13) |
| tokenMeter | `ctx.get` | 调用已接线(`measure(session)`,50ms 让路、常驻除外),但**当前认证宿主 0.2.2-rc.1 的 `measure()` 无容量字段**(返回 totalTokens/surfaceTokens 等,无 ratio/pressure/limit/contextWindow)→ 占比恒 `undefined`,压力门实际不生效,等于退回纯会话级注入总量上限;适配宿主 `contextPressure()` 后才能兑现(§4.2) |
| agentDefaultModel | `ctx.get` | 提炼路由的第二环缺席 → 用请求头里的 provider/model;**两者都没有 → 记"没有可用的模型路由",提炼留待下批(不会调用 `llm.stream()` 的默认路由)** |
| agents | `ctx.get` | SOUL 段装不上(记 stderr + 审计 `soul-inject-unavailable`),`soul_propose` 与设置页照常;**SOUL 层最典型的静默失败路径** |
| workspaceRegistry | **可选读取** | 籍贯不用它(git 根+子路径/worktree 归并/cwd,§2);控制台工作区选择器可选读注册表补标题与顺序,服务缺席/抛错时静默退回 |
| 原文读取 | 本会话=`turns.cachedTurn` 内存缓存;他会话=`ctx.get('sessionQuery')` 读会话日志 | 缓存未命中再读会话日志;**sessionQuery 是冷会话的主路径**(trajectory 也依赖它),失败才退热缓冲副本;两者都没有才"原文已不可考" |
| 检索异常 | — | **渲染"记忆检索暂时不可用",不伪装**(§4.2;检索抛错 → `search()` 返回 `null`);"没有命中"是另一回事:空结果,本轮"没想起事",对话继续 |
| storageDomain.open 卡住 | 超时(`storageOpenTimeoutMs`) | 按打开失败处理:降级纯内存态 + stderr 一行;其余功能照常注册(实测:不设超时时插件整体静默失效) |
| 观测域 `neural_mind_usage` | `storageDomain.open` + 超时(独立于主域) | 打开失败/超时 → 使用观测退化为进程内(重启归零,等价 0.6.6 行为),主域读写与注入照常;stderr 一行(§14) |
| systemPrompt(SOUL 段) | `agent/created` + `agent.ctx.inject` | 装不上则不注入 SOUL(记日志),`soul_propose` 仍能落提议(采纳前不写文件);`complete: true` 的人设下本就缺席(§4.4) |
| SOUL 文件 | 直接读盘(异步,装配路径之外) | 启动首读的**非 ENOENT 错误** → 不注入 + 记 `soul-read-failed`;`ENOENT` = 有意清空(镜像置空);**运行期读错 → 保留旧镜像继续注入**(§4.4);写盘失败 → 工具返回可行动错误,内存镜像不变 |
| tools(记忆工具,含 SOUL) | `ctx.get('tools')` + `ctx.inject(['tools'])` 兜底 | **两条路都拿不到**才不注册(打一行 stderr);注入与检索照常。`inject` 兜底是为了等晚挂载的服务(§13 实现回流) |

---


## 修订记录

- 2026-11-09：从 DESIGN.md §6、§7 原样合并拆出（内容未改语义）
- 2026-11-10：§7 降级表补 `neural_mind_usage` 观测域（独立打开，失败退化为进程内，0.6.7 §14）
