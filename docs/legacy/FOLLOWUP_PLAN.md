# 记忆插件后续计划（2026-10-27 审计后修订）

> **遗留文档**：本文的长期规划已拆分替代，不反映当前状态；正文冻结，不再修改。
> 实施状态：**部分实施**（W1/W2/W7 已闭环；W3.5 未抽；W4/W6/W8 部分闭环；其余见 [NEXT_STEPS.md](../../NEXT_STEPS.md)）。
> 现行入口：[STATUS.md](../../STATUS.md) · [NEXT_STEPS.md](../../NEXT_STEPS.md) · 历史索引 [README](README.md)。

> 基线：`dsh-plugin-memory 0.6.0` 工作树（0.5.0 之后的 A9/A10/B1-B3/D1/D3）
> 认证宿主：DSH Desktop `0.2.1-rc.3` / build `be72761ee1a6` / Session V4
> 依据：2026-10-27 三路独立只读审计 + 本地全量门禁复跑
> 状态：**A9/A10/B1-B3/D1/D3 已实现；D2、默认提炼/owner API 收尾、C/E 未做**
>
> 本文件取代 `OPTIMIZATION_PLAN.md` §13 中“A1-A10 + B1-B3 已完成”的实施状态。
> C/D/E 的原始目标不变，但顺序与启动门槛按本文件执行。

---

## 0. 一句话

先修 **A9 遗忘闭环 + A10 批次/重试** 和 **L0 注入过滤**，再补 **B1 冻结评估集 / B2 性能基线 / B3 发布矩阵**，然后做 **D3 跨层去重 → D1 写入幂等 → D2 语义关系收紧**；**C 与 E 暂缓**，等真实规模/宿主证据触发。

---

## 1. 审计后的真实基线

| 项 | 审计结论 | 证据 |
|---|---|---|
| 安装 | 桌面 profile 以 `link:` 指向本工作树；`include:memory` active；4 个记忆工具对 agent 可见 | `~/.dsh/profiles/desktop/package.json`；`cordis_inspect` Tool 列表 |
| 数据 | 0 条 L2（active/staged/archived）；4 条 L0 热缓冲 + 4 条 skipped outbox（本次审计会话产生，单回合超 65536 字符，按“超大回合”跳过） | `~/.dsh/storages/memory` 实测；`extract-oversized-turn` 审计 |
| 单测 | 216 项 / 213 通过 / 0 失败 / 3 跳过（A9/A10/W3/A7/存储/openingDigest/B1/D1/D3/D2a/N1/embedding 探针+凭据写入回归 +36） | `npm test`（需 full-access，见 §6） |
| 宿主 | `check:host` 46/46；`check:shapes` 9/9；`check:conform` 28/28 | 本地复跑 |
| 发布 | release-matrix 脚本通过：36 文件 tarball、E2E 24/24、默认冒烟 26/26 | 本地复跑；但 `extract request=false` |
| 性能 | 5k 条 64 维 hybrid p95 ≈ 8ms；5k/1024 维 ≈ 15.6ms；20k 冷启动统计 ≈ 6ms；inline 预算 300ms | `tools/search-bench.mjs` + 审计微基准 |
| A1-A8 | 主体完成，测试覆盖 | 见 `OPTIMIZATION_PLAN.md` A1-A8 |
| A9 | **未闭环**：in-flight 复活、7 天隐藏元数据丢失、reembed TOCTOU | 见 §3 W1 |
| A10 | **未闭环**：退避断链、重放 LLM 输出不同即重复 | 见 §3 W2 |
| B1/B2/B3 | 仅工具落地；冻结集、基线、升级矩阵未完成 | 见 §3 W4-W6 |
| 发布卫生(审计时) | 未提交工作树、版本仍 0.5.0、无 tag、HANDOFF 仍称未装桌面 | 见 §3 W0;已收口 0.6.0 |

**结论**：代码质量与门禁基础很好，但“完成”的结论超前于证据。当前最危险的不是性能，而是 **hard forget 的承诺在并发/时间维度上不成立**，以及 **L0 热缓冲没有注入过滤**。

---

## 2. 执行原则

1. **先正确性，后性能。** A9/A10/L0 未闭环前不做 C/D 调参。
2. **每个工作包独立 commit、独立回滚。** 不把 A9/A10/B/D 混成一个无法归因的大改动。
3. **默认不升 domain version。** 若必须新增持久字段/表，单独一个包、升 v3、`compatibleVersions: [1,2]`，并先证明旧版本可读、可回滚。
4. **不物理删除记忆。** hard forget 只 hidden/归档；索引和缓存必须可重建。
5. **所有结论可复现。** 性能/准确度必须有数据集版本、命令、原始输出；单次 wall-clock 不作为 CI 硬门禁。
6. **不猜宿主字段。** E1/E2 没有真实接缝证据不启动。
7. **不在真实桌面 profile 上做实验。** 自动化只使用临时 `DSH_HOME`；真实 profile 的改动需单独确认。

---

## 3. 工作包

### W0. 冻结现场与发布卫生（0.5 天）

**目标**：先让当前工作可回退，再开始修。

改动：
- 备份 `~/.dsh/profiles/desktop/cordis.patch.yml` 与 `~/.dsh/storages/memory/`（当前有 4 条 L0 + 4 条 skipped outbox，均为本次审计会话产生；本轮已备份到 `.scratch/backup-20261027/`）。
- 将当前 A/B 工作作为一个 checkpoint commit（可拆成 A/B/docs 三个 commit；先不追求语义完美）。
- 把 `FOLLOWUP_PLAN.md`、`tools/release-matrix.mjs`、`tools/search-bench.mjs` 纳入版本控制。
- 修正 `HANDOFF.md` 中“没有在用户桌面 profile 上做任何安装或改动”的旧说法。
- **暂不改版本号**；等 W1-W6 完成后再统一升 `0.6.0`（`scope` 删除属于行为变化，不建议只升 patch）。

验收：
- `git status` 干净（除本计划/后续分支）。
- 能从 commit 复现当前 216/213/0/3 与 release-matrix 结果。

回滚：checkpoint commit 本身就是回滚点。

---

### W1. A9 遗忘闭环（P0/P1，2-3 天）

**目标**：hard forget 之后，内容不能通过“进行中的提炼”、7 天后的清扫、或重嵌入重新出现。

#### W1.1 进行中的提炼复活（P0）

问题：`flushSession` 在 LLM 调用前已读入原文；`memory_forget(hard)` 只把 outbox 标 skipped、L0 标 hidden；LLM 返回后仍落盘，没有复查。

改动（代码级建议）：
- `lib/extract.js`：在 LLM 返回后、落盘前，重新读取本批 `inputIds` 的 outbox 状态；任一为 `skipped`/缺失，或对应 L0 已 hidden，则**整批放弃落盘**，记审计 `extract-forget-race-aborted`，不标 done、不标 digested。
- `lib/extract.js` `turnText()`：在 cachedTurn / sessionQuery 两条路径之前先检查 hidden（新增共享 helper，见 W1.2），不能只在热缓冲兜底里检查。
- `lib/tools.js` `skipOutboxFor()`：保留现有逻辑，但增加“按 session + turn”兜底标记，避免只靠内容匹配。

测试：
- 新增 `test/extract-forget.test.mjs`（或扩展 pipeline）：可控 LLM 挂起 → `memory_forget(hard)` → 释放 LLM → 断言无新 L2、outbox 仍 skipped、审计存在。
- 有 `sessionQuery` 的路径也要覆盖（不能只测无 sessionQuery 的 fake）。
- 断言 hard forget 返回“已屏蔽”后，搜索结果/注入/ID recall 都拿不到正文。

验收：该场景 0 复活；测试在旧实现上必红。

#### W1.2 隐藏元数据生命周期（P1）

问题：隐藏区间只存在 hot 行；`sweep()` 对 digested 的 hidden 行 7 天后物理删除，`trajectory`/`expandOriginal` 随后失明。

改动（建议，不升版）：
- `lib/hotbuffer.js` `sweep()`：`hidden === true` 的行不物理删除；只允许显式管理清理。
- `hotBufferMaxEntries` 的未消化计数排除 hidden 行，避免 hidden 永久占用保险丝。
- 抽出 `lib/forget.js`（或 `lib/hidden.js`）：`collectHidden(sessionId)` 统一从 hidden hot + hidden memory 的 `sourceRange`/content 建立区间与 needle，供 `tools.js` 与 `extract.js` 共用。
- 若未来 hidden 行数量成为问题，再单独立项“持久隐藏区间表”（升 v3），不要在本包混入。

测试：
- 8 天前 hidden+digested L0 不被 sweep 删除；`trajectory`/`expandOriginal` 仍过滤。
- hidden+undigested 不计入 fuse 计数。
- 可见记忆的 `sourceRange` 跨隐藏区间时，只返回未隐藏片段并记审计（A9 原要求）。

验收：时间推进后不复活；测试覆盖 sweep 前后。

#### W1.3 重嵌入 TOCTOU（P2，可与 W1.1 同批）

问题：reembedder 先快照文本，逐条发送；中途 hidden/archived 仍出站。

改动：
- `lib/embed.js`：每条发送前重新读 store，跳过 hidden/archived/private；记录跳过条数与原因（A9 要求）。
- 批量快照只作为候选列表，不作为“当前可发送”的依据。

测试：第一条 embedding 调用期间把第二条置 hidden/archived，断言第二个请求体不含它；审计有跳过记录。

验收：A9 的“hidden/private 不出站”在竞态下也成立。

**W1 回滚**：纯代码 + 测试；W1.2 若选择不升版，无数据迁移；若未来升版，独立回滚。

---

### W2. A10 批次完整性与重试（P1，2-3 天）

**目标**：第二次失败后仍能按退避自动恢复；重放不因 LLM 措辞变化产生重复记录；关系/SOUL 失败不被“批次完成”掩盖。

#### W2.1 退避断链（P1）

问题：`scheduleRetry` 固定 60s；第二次失败后 `nextRetryAt=+5m`，60s 醒来时 `pendingFor()` 为空，直接 return，不再排定时器。

改动（`lib/extract.js` + `lib/outbox.js`）：
- `outbox` 暴露 `nextDueAt(sessionId)` 或 `pendingFor` 返回全部 + 由调用方过滤。
- `scheduleRetry(sessionId, ms)` 按最早 `nextRetryAt` 计算 delay；`flushSession` 结束时若 `pendingCount>0` 但本轮无 due 项，重新按最早 due 排一次。
- 定时器句柄仍按 session 去重；`dispose` 清理。
- 测试用可控时钟/短退避（不要等真实 5 分钟）。

测试（新增 `test/outbox.test.mjs`）：
- 失败 #1 → 60s 后重试；失败 #2 → 300s 后重试；不产生新回合也能恢复。
- 重试耗尽 → dead-letter + 审计；L0 标死信。
- 重启 `reconcile` 清 `nextRetryAt` 后立即重试。

验收：第二/第三次退避都能自动触发；无新回合也能恢复。

#### W2.2 重放重复（P1）

问题：重放重新调 LLM；去重键 `batchKey+kind+content` 只在逐字相同时成立。

**已拍板（2026-10-27）：走方案 A。** 实现细化为**独立存储域**，而不是把 `memory` 域从 v2 升到 v3：

- 新增独立域 `memory_extract`（version 1，`per-record`，`invalidRecords: backup-and-skip`），表 `batches`；记录 `{ batchKey, sessionId, payload, createdAt }`，key 用 `bt_<batchKey>`。
- `memory` 域**保持 v2 不变**；旧插件回滚时只忽略 `memory_extract` 域，不丢 `memory` 记录。这比“v3 + compatible [1,2]”更符合“旧插件可读”：宿主的 per-record JSON 后端会把不认识的版本戳当 absent 丢弃，v3 记录在旧插件侧会消失；独立域没有这个问题。
- `lib/store.js` 增加第二个域句柄；`storageDomain` 缺席/打开失败时降级为进程内 payload Map + 审计 `extract-batch-payload-unavailable`（提取仍可用，只是崩溃重放退化为现状）。
- 流程：LLM 返回并 `safeJsonExtract` 成功后，先把 `{parsed, batchKey, inputIds, ws, sessionId}` 写入 `batches`，再落事实/关系/SOUL；重放时先查 payload，命中则直接复用，不再调 LLM。批次 `markDone` 后删除 payload；启动时清理超过 7 天的孤儿 payload。
- payload 是短命的中间副本，和记忆池同样落盘明文；完成即删。含 private 内容的批次仍会写 payload，README 要如实说明；若不能接受，可在 W2 追加“private 批次不写 payload、退化为重放”开关。

无论实现方式：
- `completed` 检查移到 LLM 调用之前；已完成批次不再重复调用。
- `applyRelations` 不再用 `bestEffort` 吞掉所有关系写失败；关系/SOUL 全部成功后才写 `extract-batch-done`，否则让批次失败重放。
- 关系证据的幂等键统一为 `(来源事实 eventTime, kind, targetId)`，避免重放重复证据。

测试：
- 同 batch 第二次 `put` 抛错 → 重启 → LLM 输出换措辞 → 仍只有一条事实。
- 崩溃在“payload 已写、事实未落盘”与“事实已落盘、marker 未写”两个窗口。
- 关系/SOUL 中途失败 → 重放补齐，不重复。
- 旧 A10 测试要改成“不同输出”版本，避免 false-green。

验收：半批不丢、已落盘不重、不同措辞重放不重复、关系不丢。

**W2 回滚**：`memory` 域仍是 v2；回滚只需忽略/删除 `memory_extract` 域，`memory` 记录与旧插件完全兼容。先在临时 `DSH_HOME` 做“旧插件打开新数据 → 仍能读 memory 域；新插件读旧数据 → 正常”的双向测试。

---

### W3. 注入与渲染修正（P1/P2，2-3 天）

#### W3.1 L0 注入过滤（P1，安全）

- `lib/inject.js` 渲染 hot 内容前跑 `detectInjection`；命中时加显式“可疑内容，仅作资料”标记，并对 `[用户]`/`[助手]`/`[工具]`/`SYSTEM:` 等角色行做转义/缩进，避免伪造块结构。
- 评估是否在 `hotbuffer.writeTurn` 落盘时也记审计（不静默丢用户数据）。
- 测试：L0 内容含“忽略以上所有指令” → 注入块有标记且不能以原始角色行出现；正常 L0 不回归。

#### W3.2 excerpt 预算（P1）

- `lib/search.js` `excerptFor()`：只有 `record.chunks?.length > 1` 时才把 `hitChunkText` 当整段直出；单 chunk（≤8192 字）仍走 `excerptChars` 窗口。
- 测试：1617 字未分段记录 + 向量命中 → 注入长度 ≤ `excerptChars` 级别；2000 字双路命中不被静默丢；搜索路径同样裁剪。

#### W3.3 A5 常驻/digest 状态语义（P2）

- 抽出与 `renderHit` 共享的状态渲染函数；resident/digest 至少带 `suspect`、todo 逾期、state 过期/截止、staged、workspace 标签。
- 测试：suspect resident、todo 逾期、state 过期、异地 entity=user。

#### W3.4 openingDigest 可见性（P2）

- 用 `eligible`/`canAccess` 替代裸判断；`(unknown)` 不作为真实同域；sensitive 不跨域；必要时记审计。
- 测试：current cwd 缺失 + 3 条 `(unknown)`（含 sensitive）→ digest 不注入 sensitive；search 与 digest 可见集合一致。

#### W3.5 A2 精确账目（P2）

- 把分区标题/分隔符/常驻块前导换行计入单轮 `used`；压力路径追加常驻块前检查 `injectMaxChars`/`sessionInjectMaxChars`。
- 抽一个纯函数 `measureInjection(text/blocks)` 供测试断言“最终文本 = 账目”。
- 测试：小上限边界、digest+resident 同轮、压力路径。

#### W3.6 A7 factIndex（P2）

- `rawItems` 保留 LLM 原始下标；超过 `extractMaxFacts` 的事实被丢弃时，相关 relation 直接拒绝并审计，不得把下标映射到 lesson。
- 测试：6 facts + 1 lesson，relation 指向第 6 条 → 拒绝，不写错 target。

#### W3.7 store 超时晚成功（P2）

- `withTimeout` 超时后若原 open 晚 resolve，调用 `domain.close()`，避免句柄/锁泄漏。
- 测试：延迟 2×timeout 的 fake open → 断言 close 被调用、后续 open 不受 already-open 影响。

**W3 回滚**：纯代码；W3.1 只改渲染/标记，不改存储。

---

### W4. B1 冻结评估集（2-3 天）

**目标**：不依赖 live pool、不依赖 Ollama，能离线、确定性地比较准确度。

新增：
- `test/fixtures/eval/frozen-v1/`：
  - `pool.json`：合成/脱敏记录，覆盖 active/staged/archived、L0、private/sensitive/hidden、同主体不同时间、不同主体相似表述。
  - `queries.json`：中文原词/改写/跨语言、同义事实、困难负例、无关负例。
  - `relations.json`：`same / update / conflict / unrelated` 标注，供 D2。
  - `vectors.json`：固定维度向量（64/256），或确定性 fake embedder；不连网络。
- `tools/eval-frozen.mjs`（或 `inject-eval.mjs --frozen`）：
  - 复用 `createSearch`，固定 `rrfK=60`；
  - 输出 R@1/R@5/MRR、负例误注入率、平均注入条数、L0/L2 重复率；
  - 结果写 JSON 到 `bench-results/`，带数据集版本、commit、Node、配置。
- `tools/relation-eval.mjs`：same/update/conflict/unrelated 混淆矩阵；D2 前必须有基线。

验收：
- 在空 `DSH_HOME`、断网环境可跑；结果与 live pool 无关；重复运行指标一致（除浮点）。
- 文档写明“search 候选口径”与“最终渲染注入口径”，不混用。

---

### W5. B2 性能基线（1-2 天）

**目标**：记录 C 决策所需的真实数字，而不是只有 search 的即席输出。

扩展 `tools/search-bench.mjs`（或新 `tools/bench.mjs`）：
- 测 `remember`、`extract` 候选准备、`search`、`inject`（pre-step 渲染+预算）、L0/L2 重叠、常驻/digest、压缩回冲。
- 规模：1k/5k/20k；冷/热；64/256/1024 维；固定 seed。
- 输出 p50/p95/max、CPU、RSS、inline 超预算率；至少 3-5 轮，保留原始 JSON。
- 结果提交到 `bench-results/`，文档只引用 JSON，不手写数字。

**C 的启动门槛**（写死）：
- search/inject p95 连续多轮 > 100ms，或出现 inline 预算超时；或池子 > 20k 且用户可感知卡顿；
- 且 `openingDigest` 等同步路径已被单独测量（它不在 C1/C2 原范围）；
- 否则 C1/C2/C3/C4 不做。

验收：有可复现 JSON；能明确回答“C 是否需要”。

---

### W6. B3 发布矩阵补全（2-3 天）

在现有 `tools/release-matrix.mjs` 上补：
1. **升级**：`--previous <tarball>`，旧包安装 → 写记忆/配置 → 新包安装 → 读回、检索、重启；覆盖 `scope: workspace` 旧配置警告。
2. **重启/热重建**：同一 `DSH_HOME` 重启；设置页/volatile 改一次配置触发热重建；断言 store/corpus 一致。
3. **owner 设置页/API**：`stats/list/search/confirm/reject/audit` 同源校验；owner 搜索与列表可见集合一致；hidden/private 标记。
4. **client bundle 新鲜度**：`build-client --check` 进矩阵。
5. **默认提炼**：长驻 profile 跑 6 轮或 `extractBatchTurns:1` 并等待后台提炼；断言 `extract request=true`、L2 落盘、SOUL 段注入；不能再用“headless 提前退出”作为默认冒烟通过的理由。
6. **报告持久化**：成功也写 `release-matrix.json` 到 `bench-results/`，不只放临时目录。

验收：矩阵覆盖计划 §7.2 的“打包/默认/升级/存储/设置页”行；失败时保留临时 home 排查。

---

### W7. D3 L0/L2 跨层去重（1-2 天）

**目标**：同一事实不再以 L2 原子事实 + L0 整轮副本各注入一次。

规则：
- 只在同一 workspace、同一 session/sourceRange、相容时间语义内去重；按规范化内容（NFC/trim/空白折叠）+ 实体/时间判断。
- 只处理“同一事实的重复展示”；争议对、被取代依据、不同时间、不同主体、不同有效期一律保留。
- 优先保留信息量更高的一份：原子事实完整则折叠 L0 副本；L0 还含额外上下文则保留 L0、抑制 L2 行；决策可审计。
- 不修改 L0/L2 记录，只影响渲染。

测试：
- E2E 的 BLUE-FALCON 同事实双份 → 只出现一份。
- 不同时间/主体/争议对/被取代依据不合并。
- 压缩后重新注入、常驻/digest 与命中行不重复。

验收：同事实重复率下降；关键负例零变化；预算节省可计量。

---

### W8. D1 精确规范化去重与幂等写入（3-5 天）

**目标**：同一 workspace、同一 entity、同一规范化内容只保留一条；并发 remember 不双写；staged→confirm 语义明确；重复写入不自动 reinforce。

**已拍板（2026-10-27）：按“加可选 entity + 保守规范化”执行。**

改动：
- `lib/text.js`：`normalizeContent`（NFC、trim、空白折叠；不删数字/标点/否定词，不做大小写忽略）+ `contentFingerprint`。
- `lib/tools.js` `memory_remember`：增加可选 `entity` 参数（当前 schema 没有，D1 必须补）；写入前按 `workspace + normalized entity + normalized content` 查候选桶。
- `lib/search.js` 或新 `lib/dedupe.js`：内存索引（启动重建、写后更新）；D1 不依赖持久唯一键，但进程内必须串行化。
- 并发：remember 与 extract 共用一个 `SerialQueue`（或 per-key in-flight map）；同一 key 的第二个请求等待第一个完成后再查。
- 匹配策略（写死，避免“看着差不多就合并”）：
  - 两边 entity 都非空且规范化后相等 + workspace 相同 + 内容规范化相等 → 命中。
  - 两边 entity 都为空：仅当 workspace、`kind`、`temporal` 都相同且内容规范化相等才命中；否则不合并。
  - 一边有 entity、一边为空：不合并。
  - `kind`/`temporal`/`validUntil`/`expiresAt` 不一致：不直接合并，留给 D2 关系裁决或保留独立记录。
  - `workspaceId = '(unknown)'`：还要求同 `sessionId`，并在审计标记；否则不合并。
- 已存在记录：
  - active/staged：返回既有 ID；`confirm=true` 且既有为 staged → 转正 + 加一条 user reinforce；已有 active 不重复加证据。
  - hidden/archived：不复活、不覆盖；返回“已存在但已屏蔽/归档”，不泄露正文。
- 重复写入：不重复 `put`、不重复 embedding、不自动加 reinforce。
- extract 写入复用同一 helper（否则 D1 只覆盖 remember，提炼仍会造重复）；语义近似留给 D2。
- 不做物理删除；不迁移既有重复记录（后续可做管理工具）。

测试：
- 并发两次 remember 同内容 → 只一条、同 ID。
- staged→confirm 重试 → 一条且转正。
- 重复 remember → 不增 evidence、不重复 embedding。
- `(unknown)`、hidden/archived 碰撞、entity 不同不合并。
- extract 重复事实 + remember 同事实 → 不双写。

验收：重复记录率下降；无证据膨胀；无 hidden 复活；并发测试通过。

---

### W9. D2 语义近似关系收紧（3-5 天，B1 后）

- 候选只在同 workspace、同非空 entity、相容时间语义内选；相似度只提供候选，不直接判 same/superseded。
- 保留并行有效冲突事实、不同主体、不同有效期；争议对/证据链可回溯。
- 复用 A7 allowlist；D2 不能替代 A7 的可见性边界。
- 用 B1 的冻结关系集做前后对比；DESIGN 更新 + 回滚方案；行为收紧需单独发布说明。

验收：关系混淆矩阵不低于基线；关键负例零错误合并/取代；逐查询差分可复现。

---

### W10. 收口与发布（1 天）

- 版本升 **0.6.0**（A/B 行为变化 + 新测试/门禁）。
- 更新 `README.md` / `DESIGN.md` / `IMPLEMENTATION.md` / `HANDOFF.md` / `OPTIMIZATION_PLAN.md` 的状态与数字；修正 volatile 27→26、`[未实现]` 旧注释、`162 项` 旧基线。
- `verify:release` 全跑：`npm test` + host + shapes + conform + e2e + release-matrix。
- 打 tag；从 tarball 在全新 `DSH_HOME` 安装验证；**不自动改真实桌面 profile**。
- 回滚包：保留上一发布 tarball + 数据备份说明。

---

## 4. 暂缓项与触发条件

### C：默认不做

当前 5k/1024 维 hybrid p95 ≈ 15.6ms，20k 冷启动统计 ≈ 6ms，远低于 300ms inline 预算。C1/C2/C3/C4 都不应现在做。

唯一可能的例外：`openingDigest` 的同步全表生命周期计算在 20k 条、10 条 evidence 时约 82–114ms，且不在 C1/C2 原范围；若 B2 证明它导致零命中轮超预算，先单独优化它，而不是先做 C1/C2。

重新立项条件（全部满足）：
- B2 有记录的多轮数据；
- search/inject p95 > 100ms 或出现 inline 超时；
- 池子 > 20k，且用户可感知；
- 差分测试能证明索引/缓存不改变结果顺序与过滤语义。

### E：暂缓

- **E1 tokenMeter**：等宿主 `request/context` 的 `contextWindow` 字段有真实、稳定的形状与生命周期证据；事件缺席/形状不符继续回退字符预算。先加形状测试，再启用。
- **E2 Windows sidecar**：只有确实需要 Windows `autoStartCommand` 才立项；默认空命令的安装不因此受阻。

---

## 5. 依赖与里程碑

```text
W0 冻结
  ├─ W1 A9 ─┐
  ├─ W2 A10 ─┼─ W3 注入/渲染 ─ W4 B1 ─ W5 B2 ─ W6 B3
  └──────────┘                         │
                                       ├─ W7 D3
                                       ├─ W8 D1
                                       └─ W9 D2（需 B1）
                                                    │
                                                  W10 发布
```

| 里程碑 | 包含 | 通过标准 |
|---|---|---|
| M0 现场冻结 | W0 | commit/备份/文档指针 |
| M1 正确性回补 | W1+W2+W3 | A9/A10 边界测试全绿；全量测试无失败 |
| M2 可信评估/发布门禁 | W4+W5+W6 | 冻结集可离线复现；基线 JSON；升级矩阵通过 |
| M3 记忆质量 | W7+W8 | 同事实不重复；并发/重复写入幂等；负例零回归 |
| M4 关系收紧/发布 | W9+W10 | 关系负例零错误合并；`verify:release` 全绿；0.6.0 tag |

**粗估（单人，熟悉代码库）**：W1-W3 约 5-8 天；W4-W6 约 5-8 天；W7-W9 约 7-12 天；W10 约 1 天。不含 C/E。

---

## 6. 风险与决策点

1. **A9 hidden 元数据的持久化**：本计划优先“不升版”的方案（hidden L0 不 sweep + 共享 helper）。若 hidden 行数量成为问题，再单独立项 v3，不在 W1 混入。
2. **A10 重放方案**：A（write-ahead payload + domain v3）正确性最好；B（确定性 ID）不升版但有 LLM 顺序风险。需在 W2 开始前拍板。
3. **D1 entity 语义**：`memory_remember` 当前没有 entity 参数；加参数会影响工具合同和客户端文档，但 D1 必须有主体桶。若不想改公开参数，可先只对“空 entity + 完全规范化内容”做严格去重，D2 再扩展；需明确接受覆盖面变小。
4. **D2 行为收紧**：从“可跨 workspace 的公共关系”收紧到“同 workspace”是行为变化，必须有冻结集对比、DESIGN 更新和回滚；不能在 A7 未稳定时做。
5. **测试环境**：DSH `workspace-write` 沙箱下 `npm test` 会因 `node --test` 子进程 `spawn EPERM` 假失败；统一用 full-access 或 `--test-isolation=none` 跑，报告里注明。
6. **真实 profile**：当前桌面 profile 是 `link:` 工作树，任何编辑即时生效。W1-W3 期间建议只在隔离 `DSH_HOME` 验证；要装回桌面时单独确认。
7. **数据备份**：当前池为空，是最好的迁移窗口；在 W2 若升 v3，先在临时 home 做 v2→v3→v2 兼容测试，再碰真实数据。

---

## 7. 第一周执行清单

- [ ] W0：备份 profile patch + memory 目录；提交当前 A/B checkpoint；把本计划/两个新工具纳入 git；修正 HANDOFF 的安装声明。
- [ ] W1.1：先写“in-flight hard forget”失败测试（可控 LLM），再修 `extract.js`/`tools.js`；确认旧实现必红。
- [ ] W2.1：先写退避失败测试（可控时钟/短退避），再修 `scheduleRetry`/`pendingFor`。
- [ ] W3.1：L0 注入过滤 + 角色行转义；测试“忽略以上指令”不原样进注入。
- [ ] W3.2：excerpt 单 chunk 修复；测试 1617 字记录。
- [ ] 跑 `npm test` + host + shapes + conform；记录到 `.scratch/audit/`。
- [ ] 开始 W4：冻结集目录与 `pool.json`/`queries.json` 骨架；先不接 live pool。

---

## 8. 变更记录

- 2026-10-27：审计后首版。取代 `OPTIMIZATION_PLAN.md` §13 的完成状态；新增 W0-W10、C/E 触发条件、A9/A10 修复方案与测试矩阵。
- 2026-10-27：拍板 A10 走**方案 A**（独立 `memory_extract` 域 v1，不升 `memory` v2）；D1 按**加可选 entity + 保守规范化匹配**执行。两项已写入 W2/W8。
