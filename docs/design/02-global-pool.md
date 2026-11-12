---
id: 2
title: "全局记忆池与来源标注"
verified: 2026-11-09
code: [lib/provenance.js, lib/workspace.js]
---

# §2 全局记忆池与来源标注


**物理一个池子,逻辑有籍贯,读取本地优先。**

- **不隔离**:所有 workspace 的记忆进同一个存储域,全局可检索。理由:用户偏好天然跨项目
- **籍贯标签**:每条记忆(含 L0)带 `workspaceId` + `sessionId`。`workspaceId` = **git 仓库根 canonical 路径 + 相对子路径**(monorepo 区分 "packages/web"/"packages/api");worktree 经 `git rev-parse --git-common-dir` 归并同仓(核验仍以 `anchorRoot` 为准,§4.2);非 git 目录回退 canonical cwd。**籍贯不用 workspaceRegistry**(可选能力且强制依赖多,§7);控制台工作区选择器会**可选读取**注册表(缺席静默退回,`lib/api.js:326`)
- **本地优先**(§5.4 查表):当前 workspace ×1.0,其余一律 ×`remoteFactor`(默认 0.8)——**只分两档,不做同仓亲和**(2026-09-17 裁决:monorepo 兄弟包不区分);**冷启动收紧期内**纯异地系数 ×0.625(默认 `remoteFactor` 0.8×0.625=0.5),及格线 ×2——相对序不变,不倒挂
- **注入报籍贯**:渲染带来源前缀;monorepo 内区分到子路径
- **冷启动收紧**:本地 active 记忆 < `coldStartMinLocal`(默认 10)条时生效(同上档位);随本地池增长自动恢复。**只管制异地准入**——openingDigest 只选本地条目,与此解耦(§4.2)
- **隐私边界**:
  - 检索固定 `global`;`workspace` 只用于来源标签、排序与 private/sensitive 边界(不再提供 workspace-only 模式)
  - `privateWorkspaces: string[]`——名单内只进不出;**L0 热缓冲同样过硬过滤**
  - **内容级敏感标记(0.6.6 R4 起默认关)**:`sensitive` 字段与开关保留,但**默认不自动产生**——整理提示词不再要求模型标、`sensitiveKeywords` 默认空(初筛机制仍在,默认词表空→恒不命中,填词即恢复)、L0 初筛同样只按词表;`sensitiveNoCross` 默认 `false`,即被标记的条目也照常跨 workspace。要按敏感内容隔离:自己打开 `sensitiveNoCross` 并填词表 / 手动标记(手动改标入口 R1a),类目仍是健康/情绪/亲密关系/**薪酬/人事变动/合同与未公开经营数据**(参考 `lib/text.js` 的 `DEFAULT_SENSITIVE_KEYWORDS`)。**默认关的理由**(docs/legacy/REVIEW.md R4):本机单人使用,"不跨域"没有价值;而 `prescreenSensitive` 是"包含就算",实测 emo⊂memory、NDA⊂standard、诊断⊂诊断卡,把技术记忆误标——误伤是实打实的
  - **首次运行引导配置隐私项,从 V2 提前到 MVP**;README 写明:研究/跨语言用法强烈建议配置 embedding;办公用户建议为表格/搜索类工具配置 `toolOutputOverrides`;**分开目录才有隔离**;0.6.6 起敏感自动标记默认关(见上条),手动改标入口随 R1a 提供。`coldStartMinLocal` 属高级层,README 不展开,见 §10 账本
  - 落盘明文:威胁模型声明(本机单人使用);存储目录建议 0600;**敏感字段检测**(token/密钥形态)在 L2 提炼 / SOUL / 显式通道拒绝落盘并进审计——**热缓冲 L0 原文不做密钥检测**(只做敏感词初筛),原文仍可能随 L0 进入 embedding 请求,这是已知边界
- **工作区启用开关(v1.14)**:`disabledWorkspaces` 命中 = 记忆插件在该工作区**完全不介入**(不写 L0/outbox、不提炼、不召回、不注入、工具明确拒绝)。**这是运行开关,不是检索域隔离**——检索仍固定 global,private/sensitive 边界不变;停用前已写的记忆仍在池子里,只是该工作区不再新增。停用的工作区同样记入"见过的工作区"(否则 UI 里消失后无法再启用)
- **同名撞车对策**:本地加权 + entity 加权(§5.4)+ 单路及格线 + 有界预算
- **已知限制坦白**:同一目录(非 git)下并行多任务时,记忆归属只能靠 entity 软性加权,区分较弱;entity 硬门槛开关在 V2(§11)

---


## 修订记录

- 2026-11-09：从 DESIGN.md §2 原样拆出（内容未改语义）
