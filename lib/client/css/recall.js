/**
 * 「召回」试验台 + 「审计」面板样式(v1.15)。
 *
 * 约定(SPEC §10):只写自己的 `.rc-` / `.au-` 前缀类;共享原子类在 css/base.js、
 * css/shell.js,这里不改不重复;颜色一律用 `--dsw-alias-*` 主题令牌,亮/暗主题同时成立。
 * 动效只做 120–200ms 的透明度/背景/位移过渡,不做布局动画。
 */
export const css = [
	// ── 召回:整体与表单 ────────────────────────────────────────────
	".rc-stack{display:flex;flex-direction:column;gap:12px;min-width:0}",
	".rc-form{display:flex;flex-direction:column;gap:10px;min-width:0}",
	".rc-field{display:flex;flex-direction:column;gap:4px;min-width:0}",
	".rc-label{font-size:12px;line-height:17px;font-weight:500;color:var(--dsw-alias-label-secondary)}",
	"textarea.rc-query{min-height:56px;resize:vertical;font-size:12px;line-height:18px}",
	".rc-form-row{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;min-width:0}",
	".rc-field-workspace{flex:1 1 240px;min-width:180px}",
	".rc-select{width:100%}",
	".rc-field-limit{flex:none;width:80px}",
	".rc-limit{width:100%;flex:none}",
	".rc-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap}",

	// ── 召回:摘要条 / 闸门 chips ───────────────────────────────────
	".rc-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:9px 12px;min-width:0}",
	".rc-summary-item{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-width:0}",
	".rc-summary-label{white-space:nowrap}",
	".rc-summary-value{font-size:13px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
	".rc-gates{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-width:0}",
	".rc-gate{display:inline-flex;min-width:0;max-width:100%}",

	// ── 召回:命中列表 ──────────────────────────────────────────────
	".rc-hits{display:flex;flex-direction:column;gap:6px;min-width:0}",
	".rc-hit{display:flex;flex-direction:column;gap:6px;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:8px 10px;cursor:pointer;transition:background .15s,border-color .15s}",
	".rc-hit:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".rc-hit:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",
	".rc-hit-open{border-color:var(--dsw-alias-border-l2)}",
	".rc-hit-head{display:flex;align-items:flex-start;gap:8px;min-width:0}",
	".rc-rank{flex:none;width:22px;height:22px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:22px;text-align:center;font-variant-numeric:tabular-nums}",
	".rc-hit-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}",
	".rc-hit-content{font-size:13px;line-height:19px;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}",
	".rc-hit-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);min-width:0}",
	".rc-hit-kind{color:var(--dsw-alias-label-primary)}",
	".rc-hit-time{font-variant-numeric:tabular-nums;white-space:nowrap}",
	".rc-lanes{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap}",
	".rc-lane{display:inline-flex}",
	".rc-hit-metrics{display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".rc-metric{display:inline-flex;align-items:baseline;gap:4px;min-width:0}",
	".rc-metric-label{white-space:nowrap}",
	".rc-metric-value{color:var(--dsw-alias-label-primary);font-weight:600}",
	".rc-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .15s;display:inline-flex;align-items:center;padding-top:3px}",
	".rc-hit-open .rc-chevron{transform:rotate(90deg)}",
	".rc-hit-body{display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--dsw-alias-border-l1);padding-top:8px;cursor:default;min-width:0}",
	".rc-parts-wrap{display:flex;flex-direction:column;gap:5px;min-width:0}",
	".rc-parts-title{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
	".rc-parts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;min-width:0}",
	".rc-part{display:flex;flex-direction:column;gap:1px;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);padding:5px 7px}",
	".rc-part-name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".rc-part-value{font-size:12px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
	".rc-chunk{display:flex;flex-direction:column;gap:3px;min-width:0}",
	".rc-chunk-label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
	".rc-chunk-text{margin:0;max-height:160px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);padding:7px 9px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:17px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}",
	".rc-chunk-empty{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",

	// ── 召回:注入预览 ──────────────────────────────────────────────
	".rc-preview-lines{margin:0;display:flex;flex-direction:column;gap:2px;max-height:280px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:17px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}",
	".rc-preview-line{min-height:17px}",
	".rc-preview-header{padding-bottom:4px;margin-bottom:2px;border-bottom:1px dashed var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}",
	".rc-preview-foot{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".rc-preview-over .rc-preview-budget{color:var(--dsw-alias-state-error-primary);font-weight:600}",
	".rc-preview-over-tag{color:var(--dsw-alias-state-error-primary);font-weight:600}",
	".rc-preview-empty{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",

	// ── 审计 ────────────────────────────────────────────────────────
	".au-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
	".au-select{flex:none}",
	".au-count{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}",
	".au-list{display:flex;flex-direction:column;min-width:0}",
	".au-row{display:grid;grid-template-columns:112px minmax(120px,172px) minmax(0,1fr);gap:4px 10px;align-items:start;border-bottom:.5px solid var(--dsw-alias-border-l3);padding:7px 2px;font-size:12px;line-height:18px;min-width:0}",
	".au-ts{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap;padding-top:1px}",
	".au-kind{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:18px;color:var(--dsw-alias-label-primary);word-break:break-word}",
	".au-detail{min-width:0;color:var(--dsw-alias-label-primary);word-break:break-word;white-space:pre-wrap}",
	".au-row:last-child{border-bottom:0}",

	// ── 响应式:≤900 多列退化;≤640 表单/行纵向堆叠 ─────────────────
	"@media (max-width:900px){.rc-parts{grid-template-columns:repeat(2,minmax(0,1fr))}.au-row{grid-template-columns:96px minmax(0,1fr)}.au-detail{grid-column:1 / -1}}",
	"@media (max-width:640px){.rc-form-row{align-items:stretch}.rc-field-workspace{flex-basis:100%}.rc-field-limit{width:100%}.rc-actions{margin-left:0;width:100%}.au-row{grid-template-columns:minmax(0,1fr);gap:2px}.au-detail{grid-column:auto}.au-toolbar{flex-direction:column;align-items:stretch}.au-select,.au-count{width:100%}}",
].join("");
