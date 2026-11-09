# Release artifacts (B3)

两份固定 tarball，用于"上一版 → 候选版"的升级/回滚测试。

| 文件 | 来源 | 说明 |
|---|---|---|
| `dsh-plugin-memory-0.5.0-pre-f0ec867.tgz` | `f0ec867`（A/B 改动前的已提交基线） | 36 个文件；通过 `git archive` 导出后 `npm pack`。**文件名保留改名前的旧名**：它是真实的 0.5.0 历史产物，也是升级测试里"旧包写旧存储域"的那一端 |
| `neural-mind-0.6.6-candidate.tgz` | 最终 HEAD 工作树（0.6.6；正确性补丁 R4 / R18 / R13a / R8a / R14 / R15a / R16 / R16b / R13b / R1a / R26 + 改名 `neural-mind`；含 MIT LICENSE；2026-11-09 文档重整 + 源码逐条抽查 + R26 画像路径修复 + 改名/存储迁移后重打包） | 59 个文件、339,282 B；`npm pack` |

校验：

```sh
sha256sum -c SHA256SUMS
# Windows: Get-FileHash <file> -Algorithm SHA256
```

注意：

- 上一版是 `0.5.0`，候选是 `0.6.6`；B3 测的是真实版本升级。
- GitHub Release `v0.6.6` 的 asset 就是本候选包（文件名保留 `-candidate`，SHA256 与 `SHA256SUMS` 一致）。
- tarball 是冻结快照，不包含 `tools/` 与 `test/`。
- 候选包由当前工作树生成；工作树有未提交改动时，包内容与 commit 不对应。
