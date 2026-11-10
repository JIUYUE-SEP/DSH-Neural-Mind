# Release artifacts (B3)

三份固定 tarball：上一版基线（0.5.0）、已发布的 0.6.6 候选、当前 0.6.7 候选。用于"上一版 → 候选版"的升级 / 回滚测试。

| 文件 | 来源 | 说明 |
|---|---|---|
| `dsh-plugin-memory-0.5.0-pre-f0ec867.tgz` | `f0ec867`（A/B 改动前的已提交基线） | 36 个文件；通过 `git archive` 导出后 `npm pack`。**文件名保留改名前的旧名**：它是真实的 0.5.0 历史产物，也是升级测试里"旧包写旧存储域"的那一端 |
| `neural-mind-0.6.6-candidate.tgz` | 最终 HEAD 工作树（0.6.6；正确性补丁 R4 / R18 / R13a / R8a / R14 / R15a / R16 / R16b / R13b / R1a / R26 + 改名 `neural-mind`；含 MIT LICENSE） | 59 个文件、339,282 B；`npm pack`。**已作为 GitHub Release `v0.6.6` 的 asset 发布**（文件名保留 `-candidate`） |
| `neural-mind-0.6.7-candidate.tgz` | 最终 HEAD 工作树（0.6.7；S12 使用观测：独立域 `neural_mind_usage` + 注入质量元数据 + `usage`/`pool` 只读接口与总览用量卡） | 60 个文件、353,521 B；`npm pack`。待发布为 `v0.6.7` asset |

校验：

```sh
sha256sum -c SHA256SUMS
# Windows: Get-FileHash <file> -Algorithm SHA256
```

注意：

- 升级 smoke 默认基线是 `0.5.0`、候选是 `0.6.7`；B3 测的是真实版本升级。
- GitHub Release `v0.6.6` 的 asset 是 0.6.6 候选包；`v0.6.7` 发布后对应 0.6.7 候选包（SHA256 与 `SHA256SUMS` 一致）。
- tarball 是冻结快照，不包含 `tools/` 与 `test/`。
- 候选包由当前工作树生成；工作树有未提交改动时，包内容与 commit 不对应。
