/**
 * v1.15 共享样式:原子组件(components.js)与通用版式。
 * 只允许 DSH 主题令牌(--dsw-alias-*);不写死 hex 色值。
 */
export const css = [
	// ── 图标与工具类 ────────────────────────────────────────────────
	".mem-icon{display:inline-block;flex:none;vertical-align:-2px}",
	".mem-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
	".mem-num{font-variant-numeric:tabular-nums}",
	".mem-muted{color:var(--dsw-alias-label-secondary)}",
	".mem-row{display:flex;align-items:center;gap:8px;min-width:0}",
	".mem-wrap{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}",
	".mem-col{display:flex;flex-direction:column;gap:8px;min-width:0}",
	".mem-spacer{flex:1}",

	// ── 卡片 ────────────────────────────────────────────────────────
	".mem-card{display:flex;flex-direction:column;gap:12px;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:16px 18px}",
	".mem-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}",
	".mem-card-heading{display:flex;flex-direction:column;gap:2px;min-width:0}",
	".mem-card-title{margin:0;font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}",
	".mem-card-sub{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}",
	".mem-card-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",

	// ── 提示条 / 横幅 ───────────────────────────────────────────────
	".mem-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
	".mem-msg{border-radius:8px;padding:7px 10px;font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-2)}",
	".mem-msg-error{color:var(--dsw-alias-state-error-primary)}",
	".mem-msg-ok{color:var(--dsw-alias-state-success-primary)}",
	".mem-banner{display:flex;align-items:flex-start;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 12px;background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:18px}",
	".mem-banner>.mem-icon{margin-top:2px}",
	".mem-banner-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}",
	".mem-banner-title{font-weight:600}",
	".mem-banner-text{color:var(--dsw-alias-label-secondary);word-break:break-word}",
	".mem-banner-action{flex:none;display:flex;align-items:center;gap:6px}",
	".mem-banner-ok{border-color:var(--dsw-alias-state-success-primary)}",
	".mem-banner-ok>.mem-icon{color:var(--dsw-alias-state-success-primary)}",
	".mem-banner-warn{border-color:var(--dsw-alias-state-warn-primary)}",
	".mem-banner-warn>.mem-icon{color:var(--dsw-alias-state-warn-primary)}",
	".mem-banner-error{border-color:var(--dsw-alias-state-error-primary)}",
	".mem-banner-error>.mem-icon{color:var(--dsw-alias-state-error-primary)}",
	".mem-banner-info>.mem-icon{color:var(--dsw-alias-link)}",

	// ── 按钮 ────────────────────────────────────────────────────────
	".mem-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:4px 10px;font:inherit;font-size:12px;line-height:18px;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;gap:5px;transition:background .15s,border-color .15s}",
	".mem-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}",
	".mem-btn:disabled{opacity:.45;cursor:default}",
	".mem-btn:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px}",
	".mem-btn-primary{background:var(--dsw-alias-button-primary-fill);border-color:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
	".mem-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-fill);opacity:.9;border-color:var(--dsw-alias-button-primary-fill)}",
	".mem-btn-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}",
	".mem-btn-ghost:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:transparent}",
	".mem-btn-sm{padding:2px 8px;font-size:11px;line-height:16px;border-radius:6px}",
	".mem-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}",

	// ── 输入控件 ────────────────────────────────────────────────────
	".mem-input{flex:1;min-width:0;appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;padding:5px 9px;font:inherit;font-size:12px;line-height:18px}",
	".mem-input::placeholder{color:var(--dsw-alias-label-tertiary)}",
	".mem-input:focus{outline:none;border-color:var(--dsw-alias-border-l2)}",
	".mem-input:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",
	"textarea.mem-input{min-height:64px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:18px}",
	".mem-select{flex:none;appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;padding:4px 26px 4px 9px;font:inherit;font-size:12px;line-height:18px;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--dsw-alias-label-tertiary) 50%),linear-gradient(135deg,var(--dsw-alias-label-tertiary) 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 9px) 50%;background-size:4px 4px,4px 4px;background-repeat:no-repeat}",
	".mem-select:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",

	// 配置字段行(配置面板复用;其余面板也可用)
	".mem-field{display:flex;align-items:flex-start;gap:12px;min-width:0}",
	".mem-field-label{flex-shrink:0;width:190px;padding-top:5px;font-size:12px;display:flex;flex-direction:column;gap:2px;min-width:0}",
	".mem-field-name{font-weight:500;color:var(--dsw-alias-label-primary)}",
	".mem-field-desc{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:15px}",
	".mem-field-ctl{flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}",
	".mem-field-full{flex-basis:100%;min-width:0}",

	// ── 徽章 / 胶囊 ─────────────────────────────────────────────────
	".mem-badge{border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);flex-shrink:0;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}",
	".mem-badge-ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}",
	".mem-badge-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}",
	".mem-badge-error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}",
	".mem-badge-info{color:var(--dsw-alias-link);border-color:var(--dsw-alias-link)}",
	".mem-badge-muted{color:var(--dsw-alias-label-secondary)}",
	".mem-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:nowrap;max-width:100%;min-width:0}",
	".mem-chip-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
	".mem-chip-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:none}",
	".mem-chip-ok .mem-chip-dot{background:var(--dsw-alias-state-success-primary)}",
	".mem-chip-warn .mem-chip-dot{background:var(--dsw-alias-state-warn-primary)}",
	".mem-chip-error .mem-chip-dot{background:var(--dsw-alias-state-error-primary)}",
	".mem-chip-info .mem-chip-dot{background:var(--dsw-alias-link)}",
	".mem-chip-ok{color:var(--dsw-alias-label-primary)}",
	".mem-chip-warn{border-color:var(--dsw-alias-state-warn-primary)}",
	".mem-chip-error{border-color:var(--dsw-alias-state-error-primary)}",
	".mem-chip-accent{border-color:var(--dsw-alias-link);color:var(--dsw-alias-link)}",
	".mem-chip-accent .mem-chip-dot{background:var(--dsw-alias-link)}",

	// ── KPI / 网格 ─────────────────────────────────────────────────
	".mem-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}",
	".mem-stat{display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;min-width:0}",
	".mem-stat-label{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:5px}",
	".mem-stat-value{font-size:22px;line-height:28px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;word-break:break-word}",
	".mem-stat-sub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".mem-stat-warn .mem-stat-value{color:var(--dsw-alias-state-warn-primary)}",
	".mem-stat-error .mem-stat-value{color:var(--dsw-alias-state-error-primary)}",
	".mem-stat-ok .mem-stat-value{color:var(--dsw-alias-label-primary)}",
	".mem-stat-muted .mem-stat-value{color:var(--dsw-alias-label-secondary);font-size:17px;line-height:24px}",
	".mem-grid{display:grid;gap:12px;min-width:0}",
	".mem-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}",
	".mem-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}",
	".mem-grid-side{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)}",

	// ── 工具条 / 搜索框 ─────────────────────────────────────────────
	".mem-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}",
	".mem-search{flex:1;min-width:180px;height:36px;display:flex;align-items:center;gap:8px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-layer-1);transition:border-color .15s}",
	".mem-search:hover{border-color:var(--dsw-alias-border-l2)}",
	".mem-search:focus-within{border-color:var(--dsw-alias-border-l2)}",
	".mem-search-input{flex:1;min-width:0;border:0;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none;padding:0}",
	".mem-search-input::placeholder{color:var(--dsw-alias-label-tertiary)}",
	".mem-search-icon{color:var(--dsw-alias-label-tertiary);flex:none;display:block}",
	".mem-search-clear{border:0;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:15px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:4px;flex:none}",
	".mem-search-clear:hover{color:var(--dsw-alias-label-primary)}",
	".mem-btn-toolbar{height:36px;padding:0 12px;border-radius:10px;font-size:13px}",

	// ── 空态 / 骨架 ─────────────────────────────────────────────────
	".mem-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:34px 20px;text-align:center;color:var(--dsw-alias-label-secondary)}",
	".mem-empty-icon{color:var(--dsw-alias-label-tertiary);margin-bottom:2px}",
	".mem-empty-title{font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-secondary)}",
	".mem-empty-hint{font-size:12px;line-height:18px;max-width:520px}",
	".mem-empty-action{margin-top:6px;display:flex;gap:6px}",
	".mem-skeleton{display:flex;flex-direction:column;gap:8px;padding:4px 0}",
	".mem-skeleton-line{height:12px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);animation:mem-skeleton-pulse 1.4s ease-in-out infinite}",
	"@keyframes mem-skeleton-pulse{0%,100%{opacity:.55}50%{opacity:1}}",

	// ── 占比条 ──────────────────────────────────────────────────────
	".mem-bar{height:7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;min-width:0}",
	".mem-bar-fill{height:100%;border-radius:999px;background:var(--dsw-alias-link);transition:width .2s}",
	".mem-bar-warn .mem-bar-fill{background:var(--dsw-alias-state-warn-primary)}",
	".mem-bar-ok .mem-bar-fill{background:var(--dsw-alias-state-success-primary)}",
	".mem-bar-muted .mem-bar-fill{background:var(--dsw-alias-label-tertiary)}",

	// ── 折叠分组(components.js 的 Section;配置/召回/总览共用)──────────
	".mem-section{display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l1)}",
	".mem-section-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-top:8px}",
	".mem-section-title{display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none;border-radius:6px}",
	".mem-section-title:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px}",
	".mem-section-chev{color:var(--dsw-alias-label-tertiary);transition:transform .15s}",
	".mem-section-open .mem-section-chev{transform:rotate(90deg)}",
	".mem-section-count{font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:0 6px}",
	".mem-section-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
	".mem-section-actions{margin-left:auto;display:inline-flex;align-items:center;gap:6px}",
	".mem-section-body{display:flex;flex-direction:column;gap:8px;padding:8px 0 2px}",

	// ── 面板开关(SOUL 卡沿用;保持旧类名兼容)────────────────────────
	".mem-switch{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}",
	".mem-switch .dot{width:22px;height:13px;border-radius:999px;background:var(--dsw-alias-border-l3);position:relative;flex-shrink:0;transition:background .15s}",
	".mem-switch .dot::after{content:'';position:absolute;top:1.5px;left:2px;width:10px;height:10px;border-radius:50%;background:#fff;transition:left .15s}",
	".mem-switch[data-on='true'] .dot{background:var(--dsw-alias-state-success-primary)}",
	".mem-switch[data-on='true'] .dot::after{left:10px}",
	".mem-switch[data-disabled='true']{opacity:.45;cursor:default}",
	".mem-switch:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px;border-radius:6px}",

	// ── 响应式 ──────────────────────────────────────────────────────
	"@media (max-width:900px){.mem-grid-2,.mem-grid-3,.mem-grid-side{grid-template-columns:minmax(0,1fr)}.mem-field{flex-direction:column;gap:4px}.mem-field-label{width:auto}}",
	"@media (max-width:640px){.mem-stat-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.mem-toolbar{gap:6px}}",
].join("");
