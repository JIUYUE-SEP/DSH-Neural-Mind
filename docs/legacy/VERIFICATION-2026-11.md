# 验证与门禁

> **遗留文档**：2026-11-09 及之前的验证记录与操作手册快照，不反映当前状态；正文冻结，不再修改。
> 实施状态：**已实施**（0.6.0–0.6.5 的验证已执行并记录；0.6.6 候选的 `verify:release` 结果未入库原始日志，待重跑）。
> 现行入口：[STATUS.md](../../STATUS.md)（当前数字与复现命令）· 历史索引 [README](README.md)。

## 1. 最快自检

```powershell
npm test
```

预期：

```text
358 项 / 355 通过 / 0 失败 / 3 跳过
```

> 0.6.5 已发布版本为 307/304/0/3；0.6.6 各项会逐次抬升（R4 312、R18 313、R13a 316、R8a 320、R14 324、R16 328、R16b 331、R13b 343、R15a 349、R1a 358）。

> 如果在 DSH 的 `workspace-write` 沙箱里跑 `node --test`，可能出现 `spawn EPERM` 假失败
> （测试子进程被沙箱拦截），切到 full-access，或使用：
>
> ```powershell
> node --test --test-isolation=none test/*.test.mjs
> ```

## 2. 全量门禁

```powershell
npm run verify:release
```

它依次执行：

1. `npm test`（配置账本 + 接缝 + 358 项单测）
2. `check:host`（live 宿主 51 条接缝）
3. `check:shapes`（Session V4 形状 9 项）
4. `check:conform`（代码 ↔ 文档 39 条）
5. `e2e-conversation`（隔离 DSH + mock LLM，24 项）
6. `release-matrix`（真实 tarball + 升级 smoke + 默认冒烟 + N1 长驻提炼）

预期：

```text
24/24 E2E
UPGRADE SMOKE PASS
26/26 默认冒烟
N1 DEFAULT-EXTRACT PASS
RELEASE-MATRIX PASS
```

> **0.6.6 候选包（2026-11-09）**：`verify:release` 整体通过——npm test **358/355/0/3**、`check:host` 51/51、`check:shapes` 9/9、`check:conform` 39/0、E2E **24/24**、`release-matrix` PASS（59 文件 tarball，含 MIT LICENSE；升级 smoke **0.5.0 → 0.6.6**、默认冒烟 26/26、N1 PASS）。升级 smoke 的版本断言已改为从候选包文件名解析（此前硬编码 `0.6.5`，新版本打包产物名不带 `-candidate` 时会误报）。

## 3. 单独跑

```powershell
node tools/check-config-ledger.mjs   # §10 配置账本
node tools/check-seams.mjs           # DSH 接缝 12 项
node tools/check-host-compat.mjs     # live 宿主 51 条
node tools/check-session-shapes.mjs  # Session V4 形状 9 项
node tools/check-code-vs-docs.mjs    # 代码 ↔ 文档 39 条
```

## 4. 评估与性能

```powershell
# B1 冻结评估（离线、不读真实池、不连网络；R18 起分 hybrid / bm25 两条路径）
node tools/eval-frozen.mjs --lane both
# 报告：bench-results/frozen-v2.json（同时存两组指标）

# B2 确定性基准
node tools/search-bench.mjs --sizes 1000,5000,20000 --queries 20 --rounds 3
# 报告：bench-results/search-bench.json
```

0.6.6 的参考数字(R18 在 2026-11-09 重跑;性能沿用 0.6.0 基线);冻结集口径如下(评估基准时间固定、v2 为确定性 1024 维向量,指标不随真实日期漂移)。**R18 起两条评估路径分开报**(`--lane bm25|hybrid|both`):

| 指标 | 结果 |
|---|---|
| **frozen-v2 混合路(hybrid,配了 embedding;`--lane hybrid`)** R@1 / R@5 / MRR | **1.0 / 1.0 / 1.0**（37 正例;v1.13 默认闸门开） |
| **frozen-v2 纯关键词路径(bm25,未配 embedding 的默认档;`--lane bm25`)** R@1 / R@5 / MRR | **1.0 / 1.0 / 1.0**(R18 把 `bm25OnlyMin` 2→10 后;旧默认 0.973 / 1.0 / 0.98) |
| frozen-v2 负例注入 | 两条路径均 **2/13**(均 0.77 条):全部是困难负例(omega 预算 / 私有项目数据库);**闲聊类 0 注入**。R18 前纯关键词路径为 6/13(均 2.15 条) |
| frozen-v2 正例平均注入条数 | 5.0(单轮上限 5;目标均排第 1;两条路径一致) |
| frozen-v2 关系候选召回 | 0.375（top-8;含 2 条 update 对，旧记录已标 superseded 被 ×0.3 降权，属后验状态偏差） |
| frozen-v1（历史基线，保留冻结） | R@1/R@5/MRR 0.875 / 0.875 / 0.875；负例 1/5；关系候选召回 0.857 |
| 20k hybrid search p95 | ≈ 35ms |
| 20k inject 候选 p95 | ≈ 33ms |
| 20k openingDigest p95 | ≈ 94ms |

## 5. 对话 / 升级 / 发布

```powershell
npm run test:e2e
npm run test:e2e:default
npm run test:default-extract   # N1: SDK stdio 长驻 profile，默认批次 6
npm run test:upgrade
npm run test:release-matrix
```

`test:default-extract` 接受 `--plugin <tarball>`；默认用当前工作树。

`test:upgrade` 使用：

- 上一版：`bench-results/artifacts/dsh-plugin-memory-0.5.0-pre-f0ec867.tgz`
- 候选版：`bench-results/artifacts/dsh-plugin-memory-0.6.6-candidate.tgz`

也可以显式指定：

```powershell
node tools/upgrade-smoke.mjs --previous <old.tgz> --candidate <new.tgz> --keep
```

## 6. 已知跳过与限制

3 项 skip 都有判据：

- 建 symlink 需要开发者模式（2 项，探测能不能建，不猜平台）；
- sidecar 看门狗是 POSIX shell，Windows 无 `/bin/sh`（1 项）。

已知限制：

- headless 一次性任务仍可能 `extract request=false`（预期：进程在后台提炼前退出）；N1 的 SDK stdio 长驻验收已覆盖默认批次提炼。
- D2b（关系调优 + 冻结关系集扩展）未做；D2a 安全护栏已交付。
- owner API / 热重建未进自动矩阵。
- `/memory/api` 的威胁模型是“本机单用户”，没有额外 token 鉴权。

## 7. 发布前检查

1. `npm run verify:release` 全绿；
2. `package.json` 版本已升；
3. 候选 tarball 重新生成并更新 SHA256；
4. 本地 tag 与提交一致；
5. 用户确认后才 `git push` / `gh release create`；
6. 仓库已公开（2026-11-09，MIT License）；如需改回 private 要明确说明。

## 8. UI 视觉验收（v1.15 记忆控制台）

浏览器的真实观感无法用单测覆盖，v1.15 用**离线渲染 + 无头 Edge 截图**做视觉验收（工具在 `.scratch/ui-redesign/`，被 gitignore，不入库；不影响发布包）：

```powershell
# 1) 用真实源码/真实中文词典 + 假 /memory/api 数据，渲染 7 页签 × 4 状态 × 亮/暗 = 56 页（另 5 张单页，共 61 张）
node .scratch/ui-redesign/preview.mjs           # 产物在 .scratch/ui-redesign/out/

# 2) 无头 Edge 截图（DSH 沙箱内 Edge 会崩，必须在 full-access 下执行）
pwsh -File .scratch/ui-redesign/shots.ps1 -Run  # 推荐集合 14 张 → out/shots/
```

验收口径与结果（2026-11-07）：

- 7 个页签 × 正常态全部截图核对：总览 KPI/健康检查、记忆列表与管理台详情（证据时间线）、召回结果与注入预览、配置（诊断卡/分组/字段）、画像、SOUL（开关/历史/提议）、审计（类型筛选）；
- **亮色与暗色都成立**（只用 `--dsw-alias-*` 令牌，无写死色值）；
- 空态 / 错误态 / 加载态三态各页签都有截图；页头状态条与总览「单行健康摘要」在 v1.15 集成期去重；
- 集成阶段删除过渡层 `css/legacy.js` + `i18n/legacy.js` 后**重新渲染并重拍**，确认无样式回退（`Section` / 搜索图标 / SOUL 覆盖层等已迁入 base 或面板样式）；
- 该验收是**静态渲染**：真实宿主里的异步请求、滚动容器与主题切换仍以装机后人工体验为准（`node tools/probe-api.mjs` 可先探 `/memory/api` 是否注册）。
