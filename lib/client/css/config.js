/**
 * 配置面板样式(v1.15,SPEC §7.4)。前缀 `.cfg-`;共享原子类(`.mem-field` / `.mem-input` /
 * `.mem-btn` / `.mem-chip` / `.mem-badge` …)由 `css/base.js` 提供,这里不重复定义。
 * 只允许 DSH 主题令牌(`--dsw-alias-*`),亮 / 暗主题共用同一套。
 */
export const css = [
	// ── 面板容器 ────────────────────────────────────────────────────────
	".cfg{display:flex;flex-direction:column;gap:12px;min-width:0}",
	".cfg-status-card{gap:10px}",

	// ── 分组(自己实现折叠,视觉与共享 Section 同族但不是共享类)──────────
	".cfg-group{display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:10px 14px 12px}",
	".cfg-group-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}",
	".cfg-group-toggle{appearance:none;display:flex;align-items:center;gap:7px;min-width:0;flex:1;border:0;border-radius:8px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;font-weight:600;padding:4px 6px;margin-left:-4px;cursor:pointer;text-align:left;transition:background .15s}",
	".cfg-group-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".cfg-group-toggle:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",
	".cfg-chev{display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary);transition:transform .15s;flex:none}",
	".cfg-group[data-group-open='true'] .cfg-chev{transform:rotate(90deg)}",
	".cfg-group-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".cfg-group-count{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
	".cfg-group-count-changed{color:var(--dsw-alias-state-warn-primary)}",
	".cfg-group-body{display:flex;flex-direction:column;gap:10px;padding:8px 2px 0;border-top:.5px solid var(--dsw-alias-border-l3);margin-top:8px}",
	".cfg-advanced-toggle{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:2px}",
	".cfg-advanced{display:flex;flex-direction:column;gap:10px;padding:10px 0 0 12px;border-left:2px solid var(--dsw-alias-border-l1)}",

	// ── 字段行 ──────────────────────────────────────────────────────────
	".cfg-field{padding:2px 0}",
	".cfg-field+.cfg-field{margin-top:2px}",
	".cfg-field-label{width:212px}",
	".cfg-field-readonly .mem-field-label{opacity:.7}",
	".cfg-field-readonly .cfg-ctl>.mem-input,.cfg-field-readonly .cfg-ctl>.mem-select,.cfg-field-readonly .cfg-ws-check input,.cfg-field-readonly .cfg-toggle input{opacity:.55}",
	".cfg-key{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);word-break:break-all}",
	".cfg-ctl{gap:8px}",
	".cfg-ctl>.mem-input,.cfg-ctl>.mem-select{flex:1 1 220px;max-width:420px}",
	".cfg-ctl>textarea.mem-input{flex:1 1 100%;max-width:none}",
	".cfg-invalid{flex-basis:100%;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}",

	// 开关:用原生 checkbox,颜色走主题令牌
	".cfg-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}",
	".cfg-toggle input{width:15px;height:15px;margin:0;accent-color:var(--dsw-alias-button-primary-fill);cursor:pointer}",
	".cfg-toggle input:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px}",
	".cfg-toggle-text{min-width:1.5em}",
	".cfg-field-readonly .cfg-toggle{opacity:.55;cursor:default}",

	// ── 「需要关注」诊断卡 ──────────────────────────────────────────────
	".cfg-diag-list{display:flex;flex-direction:column;gap:6px}",
	".cfg-diag-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
	".cfg-diag-hint{flex:1;min-width:180px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-word}",

	// ── 搜索提示 ────────────────────────────────────────────────────────
	".cfg-match{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;padding:0 2px}",

	// ── 工作区选择器 ────────────────────────────────────────────────────
	".cfg-ws{display:flex;flex-direction:column;gap:8px;flex:1 1 100%;min-width:0}",
	".cfg-ws-error{flex-basis:100%}",
	".cfg-ws-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
	".cfg-ws-tools .mem-search{flex:1 1 220px;height:32px}",
	".cfg-ws-summary{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".cfg-ws-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
	".cfg-ws-prefix{flex:1 1 200px;min-width:0}",
	".cfg-ws-list{list-style:none;margin:0;padding:0;max-height:240px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}",
	".cfg-ws-row{display:flex;align-items:center;gap:10px;padding:5px 10px;border-top:.5px solid var(--dsw-alias-border-l3);font-size:12px;line-height:18px;min-width:0;transition:background .12s}",
	".cfg-ws-row:first-child{border-top:0}",
	".cfg-ws-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".cfg-ws-check{display:flex;align-items:center;gap:7px;flex:1;min-width:0;cursor:pointer}",
	".cfg-ws-check input{width:14px;height:14px;margin:0;accent-color:var(--dsw-alias-button-primary-fill);cursor:pointer;flex:none}",
	".cfg-ws-check input:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px}",
	".cfg-ws-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}",
	".cfg-ws-count{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}",
	".cfg-ws-time{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
	".cfg-ws-manual{display:flex;flex-direction:column;gap:6px;align-items:flex-start}",
	".cfg-ws-manual-body{display:flex;flex-direction:column;gap:5px;width:100%;min-width:0}",
	".cfg-ws-manual-body textarea.mem-input{width:100%;box-sizing:border-box}",

	// ── 向量检索:密钥 / 测试行 ─────────────────────────────────────────
	".cfg-field-embed .cfg-ctl{row-gap:6px}",
	".cfg-field-embed .cfg-ctl>.mem-input{flex:0 1 260px;max-width:340px}",
	".cfg-field-embed .mem-msg{flex-basis:100%}",

	// ── 响应式 ──────────────────────────────────────────────────────────
	"@media (max-width:900px){.cfg-field-label{width:auto}.cfg-ws-time{display:none}}",
	"@media (max-width:640px){.cfg-group{padding:8px 10px 10px}.cfg-group-head{gap:6px}.cfg-diag-row{align-items:flex-start}.cfg-ws-count{display:none}.cfg-field-embed .cfg-ctl>.mem-input{flex:1 1 100%}}",
].join("");
