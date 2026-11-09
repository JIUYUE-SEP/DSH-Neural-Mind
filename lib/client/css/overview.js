/**
 * 总览面板样式(v1.15)。
 *
 * 只用 `--dsw-alias-*` 主题令牌,类名一律 `.ov-` 前缀(共享原子类由 css/base.js 提供,
 * 这里不重复定义)。响应式:≤900px KPI 退两列、构成双栏退单栏;≤560px KPI 退单列。
 */
export const css = [
	// ── 面板容器 ────────────────────────────────────────────────────
	".ov{display:flex;flex-direction:column;gap:12px;min-width:0}",
	".ov-summary{display:flex;align-items:center;gap:8px;min-width:0}",

	// ── KPI 网格(桌面 3 列,对应 SPEC §7.1)─────────────────────────
	".ov-kpi{min-width:0}",
	".ov-kpi .mem-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}",

	// ── 状态自检清单 ────────────────────────────────────────────────
	".ov-health{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;min-width:0}",
	".ov-health-row{display:flex;align-items:flex-start;gap:8px;padding:7px 2px;min-width:0}",
	".ov-health-row+.ov-health-row{border-top:1px solid var(--dsw-alias-border-l1)}",
	".ov-health-dot{width:7px;height:7px;border-radius:50%;flex:none;margin-top:6px;background:var(--dsw-alias-label-tertiary)}",
	".ov-health-dot-ok{background:var(--dsw-alias-state-success-primary)}",
	".ov-health-dot-warn{background:var(--dsw-alias-state-warn-primary)}",
	".ov-health-dot-info{background:var(--dsw-alias-link)}",
	".ov-health-main{display:flex;flex-direction:column;gap:1px;min-width:0}",
	".ov-health-title{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary)}",
	".ov-health-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}",

	// ── 最近注入流水 ────────────────────────────────────────────────
	".ov-inj{display:flex;flex-direction:column;min-width:0}",
	".ov-inj-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;padding:7px 2px;min-width:0}",
	".ov-inj-row+.ov-inj-row{border-top:1px solid var(--dsw-alias-border-l1)}",
	".ov-inj-time{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".ov-inj-reason{font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary);min-width:0;overflow-wrap:anywhere}",
	".ov-inj-meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}",
	".ov-inj-scope{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);min-width:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ov-inj-session{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}",

	// ── 记忆构成(两组分布)──────────────────────────────────────────
	".ov-comp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 28px;min-width:0}",
	".ov-comp{display:flex;flex-direction:column;gap:8px;min-width:0}",
	".ov-comp-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
	".ov-comp-total{font-size:11px;font-weight:400;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
	".ov-comp-list{display:flex;flex-direction:column;gap:8px;min-width:0}",
	".ov-comp-row{display:flex;flex-direction:column;gap:4px;min-width:0}",
	".ov-comp-line{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}",
	".ov-comp-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ov-comp-count{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",

	// ── 最近审计 ────────────────────────────────────────────────────
	".ov-audit-list{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;min-width:0}",
	".ov-audit-row{display:flex;align-items:flex-start;gap:8px;padding:7px 2px;min-width:0}",
	".ov-audit-row+.ov-audit-row{border-top:1px solid var(--dsw-alias-border-l1)}",
	".ov-audit-time{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".ov-audit-kind{flex:none;font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ov-audit-detail{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}",
	".ov-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:2px}",
	".ov-foot-hint{justify-content:flex-start}",

	// ── 响应式 ──────────────────────────────────────────────────────
	"@media (max-width:900px){.ov-kpi .mem-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ov-comp-grid{grid-template-columns:minmax(0,1fr)}}",
	"@media (max-width:560px){.ov-kpi .mem-stat-grid{grid-template-columns:minmax(0,1fr)}.ov-inj-scope{max-width:140px}}",
].join("");
