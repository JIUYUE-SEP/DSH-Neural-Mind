# 实施路线（原 DESIGN §11）

> 覆盖节号：§11

> **遗留文档**：原 `DESIGN.md` §11 的分期路线，不反映当前排期；正文冻结，不再修改。
> 实施状态：**部分实施**（MVP 与 V1.1 已交付；V2/V3 未做，条目已并入 [NEXT_STEPS.md](../../NEXT_STEPS.md) 待设计池）。
> 现行入口：[DESIGN.md](../../DESIGN.md) · [NEXT_STEPS.md](../../NEXT_STEPS.md) · 历史索引 [README](README.md)。


### MVP(第一版,零必须的外部服务)——最小闭环(v1.8 减重)

**分期判据(v1.8)**:每个机制问一句"没有它,系统是否仍比没有记忆强?"——答"是"的一律后移 V1.1。**数据模型(§1)与配置 schema(§10)仍在 MVP 一次性全量落地**(版本纪律,不攒迁移债);分期只分**行为机制**——字段与配置先落地、机制后启用,启用时无需升版迁移。

- **层**:L0 热缓冲(全文 + 代码块折叠 + 工具摘要制/失败例外 + 思考块仅回忆 + **sensitive 初筛(默认关,0.6.6 R4)**)+ L1 手编只读 + L2(fact/lesson/**episode** 三类)+ L4 引用索引 + Staging(含 **confirm 当场转正** + **stagedBy 通道字段**)
- **写入**:双速通道(§3.0 接线纪律**全保留**:reason 过滤、先 outbox 后热缓冲、幂等键、per-domain 串行队列——工程质量不分期)+ remember 显式通道(带 temporal/kind 可选字段)+ 提炼(铁律:位置优先、代码值类带锚;64KB 按回合整粒舍弃、只有入输入回合标已消化;原文不可得退化热缓冲副本并记审计;quote/sensitive(字段保留,默认不产出,R4)/validUntil/todo 分类;错误签名保留规则;**关系判断走检索候选集** relationCandidateTopK,§3.2)。**矛盾处置 MVP 只做两支**:带锚漂移与同主体改口 → `supersededBy`;其余一切对立 → 非对称 challenge(按 eventTime 给旧方记,不可严格排序则互记)——争议渲染/被说服/假设演进细分支移 V1.1
- **注入防御三层**(§3.4,含通道分级 + 配额最小名额 + 降级语义写死)——安全底线不分期
- **检索**:内存 BM25(**含标识符分词**)+ 可选向量(自适应分段,150ms 份额)+ RRF;证据惰性算分;排序公式全系数(含 superseded/validUntil/staged 因子)
- **注入**:静态段 + pre-step 消息批次(step===1 门控;会话总量上限(暂不含压缩回冲);本会话排除;来源分措辞 + "以当前代码为准";包裹声明;hidden/archived 全域规则)+ recall(archived 可见渲染"已归档";展开失败记审计不记质疑)/remember/forget(**hard 屏蔽级联 L0**、同 entity 批量回显)三工具
- **SOUL 自我设定(v1.9 新增,列 MVP)**:`$DSH_HOME/SOUL.md` 真相源 + 按 agent 装段(order 410,provider 只读内存镜像)+ `soul_update` 自改工具(密钥/注入特征/长度/日预算四道检查)+ `soul_history` 版本快照与一键回滚 + 设置页 SOUL 卡(编辑/历史/diff/回滚/暂停自改)+ 外部手改探测(内容比对);domain 版本保持 `1`(加表不改字段,§4.4)
- **全局池**:git 根+子路径二级籍贯 + worktree 归并 + 本地加权(当前 ×1.0 / 异地 ×`remoteFactor`);privateWorkspaces 硬过滤(含 L0)+ **sensitive 不跨域**;**首启隐私引导(MVP,常用层 12 项见 §10,含 embedding/toolOutputOverrides/分目录隔离导向)**
- storageDomain(per-record,版本纪律)落盘 + 审计表 + outbox 对账;全套 ctx.get 降级;全部配置(§10,分层暴露)
- **实现状态(v1.8.1 回流)**:MVP 已按本节交付,真实环境端到端验证通过(0.1.5-rc.2;headless/ACP/web 三 profile 实测:双速写入、提炼落盘、outbox 对账、pre-step 注入、remember 双通道、设置页热重建)。**超前完成两项**:设置页(配置表单 + 记忆浏览/搜索 + 暂存区确认/拒绝 + 审计查看,installSection 叠加 settings.yaml 用户层 + onChange 热重建,原列 V2)、工具输出按工具分流 toolOutputOverrides(原列 V1.1,§2 首启引导已要求 MVP 可配)。实现性差异见 §13 v1.8.1 表。**v1.10 注**:本行的"installSection 叠加 settings.yaml 用户层 + onChange 热重建"是 0.1.5 交付时的形态,留痕不改写;0.2.0-rc.1 起这条通道整体换成 volatile 标记 + `loader/volatile-update`,见 §8.1。

**v1.9 收尾(2026-09-17 交付,原不在分期表内)**:三件事在 v1.9 收口时一并落地,均只影响检索/身份层,不改记忆模型与存储格式——
① **本地 embedding 服务托管**(`semanticSearch.autoStartCommand`/`autoStartWaitMs`/`autoStartWarmup` + `embed-sidecar-*` 审计):服务随 dsh 进程生灭,端口已有人听则不插手,就绪后可选预热(§5);
② **注入前绝对相关性闸门**(`relevanceGate`):RRF 名次制没有鉴别力,补"共识线 / 单路线"的绝对分准入,只卡注入(§5);
③ **L1 用户画像收口为文件单入口**(删 `profileText`)+ 手改轮询 + 设置页直接编辑该文件(§4.1)。
配套:检索评估工具四个(`tools/fusion-ab.mjs` / `inject-eval.mjs` / `gate-sweep.mjs` / `eval-fixtures.mjs`,只读)与配置账本机械对账(`tools/check-config-ledger.mjs`,已挂进 `npm test`)。

### V1.1(加固版——MVP 稳定后第一批增量,v1.8 设立;**2026-09-18 九步全部交付**,逐步留痕见 docs/legacy/IMPLEMENTATION.md,实现回流见 §13 v1.1 表)

- 矛盾处置全分支:跨来源争议非对称 challenge + "存在争议"渲染、被说服通道("你后来更新了看法")、假设演进细则、并真判无关判例(§3.2,§4.2)
- 注入前核验两级:存在性每轮对 max(eventTime,lastVerifiedAt)、锚缺失连续 3 轮才记质疑、内容级双条件触发、二进制 mtime + 召回再基线、worktree 按 anchorRoot(§4.2)
- 注入治理增量:tokenMeter 压力自适应、压缩去重联动(含字符回冲、解禁后措辞按 sessionId 动态)(§4.2)
- 常驻 lesson 区块(用户级补位,选择规则写死)与开场动态 openingDigest(§4.2)
- entity 加权(近 3 轮提及)、冷启动收紧(§2,§5.4)
- 争议/被说服/逾期 todo/已过期数值渲染变体;~~trajectory 回放~~(**V1.1 第 2 步已交付**:`mode` 枚举 `default | trajectory`,按会话日志行动链回放,不计召回续期);~~段即片段裁剪~~、~~recall 整条展开(不限代码块)~~(**v1.9 复核:这两项已随 MVP 交付**——`excerptFor` 走段命中,`recallFullMaxChars` 已接线;段即片段只余"命中段不裁到 excerptChars"的精修,**V1.1 第 2 步已交付**)
- ~~工具输出按工具分流(toolOutputOverrides,§3.1)~~(v1.8.1:已随 MVP 交付)
- SOUL 提议通道:提炼侧把反复出现的自我校准归纳成"提议"进暂存区,用户确认后才写入(永不直写,§9 第 17 条)

### V2
- L3 独立成层:话题边界裁判(Zome judge 思路);提炼产物晋升 L1(人工确认);SOUL 与 L1 的晋升路径合并(画像晋升 L1 / 人格晋升 SOUL,均人工确认)
- 设置页剩余(v1.8.1 回流后):高级层配置卡片化分组、记忆纠正(内容编辑)、~~sensitive 改标口~~(**0.6.6 R1a 提前交付**)、拦截翻案、**superseded 平反**、dead-letter 重放(配置表单/记忆浏览搜索/暂存区确认拒绝/审计查看已随 MVP+ 交付)
- **tool-guard 失败命令拦截**(negative-ledger 式;`precondition` 字段届时新增,走版本升版)
- entity 硬门槛开关(非 git workspace 归属,兑现 §9.12);forget 主题级一键级联;核验细则打磨
- 检索调优(阈值/加权实测校准,依据审计降级率);本地 embedding 选项(ONNX)

### V3
- 证据衰减后台调度(**改用 `runMaintenance()` 空闲时机**;归档扫描已由 30 分钟 `setInterval` 跑着,见 §3.0/§6)+ compaction 联动收割 + **episode 归并**
- ~~侧边栏记忆治理界面(证据明细、谱系、手动归档/恢复)~~(**v1.15/v1.26 已交付:控制台记忆管理台 + 停用/恢复/敏感/彻底隐藏**)

---

