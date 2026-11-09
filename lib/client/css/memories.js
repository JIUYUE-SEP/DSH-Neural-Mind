/**
 * 记忆管理台样式(v1.15)。类名沿用旧浏览页的 `.mem-item*` / `.mem-detail*` 命名(测试与用户习惯连续),
 * 但因为旧样式在过渡期 legacy.js 里,这里必须**完整重定义**一份,集成删 legacy 后仍自洽。
 * 只用主题令牌;前缀 .mem-。
 */
export const css = [
	// ── 筛选条 ──────────────────────────────────────────────────────
	".mem-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;min-width:0}",
	".mem-filter-group{display:flex;flex-wrap:wrap;align-items:center;gap:2px;min-width:0}",
	".mem-filter{appearance:none;border:0;border-radius:14px;height:28px;padding:0 11px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:20px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;transition:background .15s,color .15s}",
	".mem-filter:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
	".mem-filter:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",
	".mem-filter-active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500}",
	".mem-filter-count{font-size:10px;line-height:15px;min-width:15px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:center}",
	".mem-filter-active .mem-filter-count{color:var(--dsw-alias-label-primary)}",

	// ── 列表 ────────────────────────────────────────────────────────
	".mem-list{display:flex;flex-direction:column;min-width:0;border-top:.5px solid var(--dsw-alias-border-l3)}",
	".mem-list-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:8px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".mem-item{display:flex;align-items:flex-start;gap:12px;padding:11px 10px;border-bottom:.5px solid var(--dsw-alias-border-l3);border-radius:8px;cursor:pointer;transition:background .12s;min-width:0}",
	".mem-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	".mem-item:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:-2px}",
	".mem-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}",
	".mem-item-content{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word}",
	".mem-item-meta{display:flex;flex-wrap:wrap;align-items:center;gap:3px 8px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);min-width:0}",
	".mem-item-meta>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
	".mem-item-badges{display:inline-flex;flex-wrap:wrap;gap:3px}",
	".mem-item-workspace{color:var(--dsw-alias-label-primary)}",
	".mem-item-num{font-variant-numeric:tabular-nums}",
	".mem-item-time{font-variant-numeric:tabular-nums}",
	".mem-item-end{display:flex;align-items:center;gap:8px;flex:none;padding-top:2px}",
	".mem-item-actions{display:flex;gap:6px}",
	".mem-item-chevron{color:var(--dsw-alias-label-tertiary)}",
	".mem-load-more{align-self:center;margin:14px 0 2px}",

	// ── 详情 ────────────────────────────────────────────────────────
	".mem-detail{display:flex;flex-direction:column;gap:12px;min-width:0}",
	".mem-detail-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
	".mem-back{appearance:none;border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:20px;cursor:pointer;padding:3px 8px;border-radius:6px}",
	".mem-back:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
	".mem-back:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",
	".mem-detail-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}",
	".mem-detail-actions{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}",
	".mem-detail-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:16px 18px;display:flex;flex-direction:column;gap:12px;min-width:0}",
	".mem-detail-badges{display:flex;flex-wrap:wrap;gap:5px}",
	".mem-detail-content{font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}",
	".mem-detail-section{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
	".mem-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px 22px;margin:0}",
	".mem-fact{display:flex;gap:10px;font-size:12px;line-height:18px;min-width:0;margin:0}",
	".mem-fact dt{flex:none;width:82px;color:var(--dsw-alias-label-secondary)}",
	".mem-fact dd{margin:0;min-width:0;color:var(--dsw-alias-label-primary);word-break:break-word;white-space:pre-wrap}",
	".mem-fact-value{font-variant-numeric:tabular-nums}",

	// ── 证据时间线 ──────────────────────────────────────────────────
	".mem-evidence{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}",
	".mem-evidence-row{display:flex;align-items:baseline;gap:10px;padding:5px 0;border-bottom:.5px solid var(--dsw-alias-border-l3);font-size:12px;line-height:18px;min-width:0}",
	".mem-evidence-row:last-child{border-bottom:0}",
	".mem-evidence-ts{flex:none;width:104px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".mem-evidence-kind{flex:none;color:var(--dsw-alias-state-success-primary)}",
	".mem-evidence-challenge{color:var(--dsw-alias-state-warn-primary)}",
	".mem-evidence-w{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",

	// ── 展开来源轮次(R1a)─────────────────────────────────────────
	".mem-expand-body{margin:0;font:inherit;font-size:12px;line-height:20px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto}",

	// ── 响应式 ──────────────────────────────────────────────────────
	"@media (max-width:720px){.mem-detail-actions{margin-left:0;width:100%}.mem-facts{grid-template-columns:minmax(0,1fr)}.mem-evidence-ts{width:96px}}",
].join("");
