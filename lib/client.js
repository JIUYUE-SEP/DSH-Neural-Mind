window.__ModuleLoader__.load({
	id: "neural-mind",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region lib/client/css/base.js
	var mod_css_base_js = (function () {
		var exps = {};
/**
 * v1.15 共享样式:原子组件(components.js)与通用版式。
 * 只允许 DSH 主题令牌(--dsw-alias-*);不写死 hex 色值。
 */
const css = [
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
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css/shell.js
	var mod_css_shell_js = (function () {
		var exps = {};
/**
 * v1.15 页面外壳样式:页头、状态条、页签、面板容器。
 * 版式沿用宿主管理页(高度 100% + 页内滚动),内容区放宽到 1120px 以容纳看板。
 */
const css = [
	".mem-page{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}",
	".mem-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}",
	".mem-content{max-width:1120px;margin:0 auto;padding:26px clamp(20px,3.5vw,40px) 56px;display:flex;flex-direction:column;gap:16px;box-sizing:border-box}",
	".mem-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 18px;flex-wrap:wrap}",
	".mem-head-main{display:flex;flex-direction:column;gap:4px;min-width:0}",
	".mem-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
	".mem-title{margin:0;font-size:22px;line-height:30px;font-weight:600;letter-spacing:.2px}",
	".mem-intro{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);max-width:760px}",
	".mem-head-actions{display:flex;align-items:center;gap:8px;flex:none;padding-top:2px}",
	".mem-status{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-height:24px}",
	".mem-status .mem-chip{cursor:default}",
	".mem-tabs{display:flex;align-items:center;gap:2px;max-width:100%;overflow-x:auto;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1);align-self:flex-start;scrollbar-width:none}",
	".mem-tabs::-webkit-scrollbar{display:none}",
	".mem-tab{appearance:none;border:0;border-radius:8px;height:30px;padding:0 12px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background .15s,color .15s;flex:none}",
	".mem-tab:hover{color:var(--dsw-alias-label-primary)}",
	".mem-tab:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:1px}",
	".mem-tab-active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}",
	".mem-tab-count{font-size:10px;line-height:15px;min-width:15px;height:15px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}",
	".mem-tab-active .mem-tab-count{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}",
	".mem-body{display:flex;flex-direction:column;min-width:0}",
	".mem-panel{display:flex;flex-direction:column;gap:12px;min-width:0}",
	".mem-panel[hidden]{display:none}",
	".mem-panel-loading{display:flex;flex-direction:column;gap:10px}",
	"@media (max-width:720px){.mem-head-actions{width:100%;justify-content:flex-end}.mem-tabs{width:100%}.mem-title{font-size:20px;line-height:28px}}",
].join("");
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css/overview.js
	var mod_css_overview_js = (function () {
		var exps = {};
/**
 * 总览面板样式(v1.15)。
 *
 * 只用 `--dsw-alias-*` 主题令牌,类名一律 `.ov-` 前缀(共享原子类由 css/base.js 提供,
 * 这里不重复定义)。响应式:≤900px KPI 退两列、构成双栏退单栏;≤560px KPI 退单列。
 */
const css = [
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
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css/memories.js
	var mod_css_memories_js = (function () {
		var exps = {};
/**
 * 记忆管理台样式(v1.15)。类名沿用旧浏览页的 `.mem-item*` / `.mem-detail*` 命名(测试与用户习惯连续),
 * 但因为旧样式在过渡期 legacy.js 里,这里必须**完整重定义**一份,集成删 legacy 后仍自洽。
 * 只用主题令牌;前缀 .mem-。
 */
const css = [
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
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css/recall.js
	var mod_css_recall_js = (function () {
		var exps = {};
/**
 * 「召回」试验台 + 「审计」面板样式(v1.15)。
 *
 * 约定(SPEC §10):只写自己的 `.rc-` / `.au-` 前缀类;共享原子类在 css/base.js、
 * css/shell.js,这里不改不重复;颜色一律用 `--dsw-alias-*` 主题令牌,亮/暗主题同时成立。
 * 动效只做 120–200ms 的透明度/背景/位移过渡,不做布局动画。
 */
const css = [
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
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css/config.js
	var mod_css_config_js = (function () {
		var exps = {};
/**
 * 配置面板样式(v1.15,SPEC §7.4)。前缀 `.cfg-`;共享原子类(`.mem-field` / `.mem-input` /
 * `.mem-btn` / `.mem-chip` / `.mem-badge` …)由 `css/base.js` 提供,这里不重复定义。
 * 只允许 DSH 主题令牌(`--dsw-alias-*`),亮 / 暗主题共用同一套。
 */
const css = [
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
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css/persona.js
	var mod_css_persona_js = (function () {
		var exps = {};
/**
 * 画像 & SOUL 面板样式(v1.15,ui-persona)。
 *
 * 两部分:
 *  1. 新版的局部版式(前缀 `.per-` / `.soul-`),补共享原子组件覆盖不到的信息层级;
 *  2. 从 `css/legacy.js` **迁入**的旧 SOUL/画像类名(覆盖层、diff、编辑器、开关容器、版本行等)。
 *     面板与测试仍按旧类名找元素,迁移时保持类名不变;legacy.js 随后由集成阶段删除。
 *
 * 只使用 `--dsw-alias-*` 主题令牌(以及既有的 rgba 覆盖层/diff 底色写法);
 * `.mem-switch`、`.mem-input`、`.mem-btn` 等共享类由 css/base.js 提供,这里不重复定义。
 */
const css = [
	// ── 画像:头部元信息 / 工具栏 / 等宽编辑区 ──────────────────────
	".per-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;min-width:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".per-meta-path{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-all;min-width:0}",
	".per-editor-wrap{display:flex;flex-direction:column;gap:6px;min-width:0}",
	"textarea.mem-profile-text{width:100%;min-height:46vh;box-sizing:border-box;resize:vertical;font-size:12px;line-height:20px}",
	"textarea.per-editor{width:100%;min-height:46vh;box-sizing:border-box;resize:vertical;font-size:12px;line-height:20px;field-sizing:content}",
	".per-editor:focus-visible{outline:2px solid var(--dsw-alias-link);outline-offset:2px}",
	".per-editor-foot{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;min-width:0}",
	".per-charcount{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
	".per-charcount[data-over='true']{color:var(--dsw-alias-state-error-primary);font-weight:600}",
	".per-over{font-size:11px;line-height:17px;color:var(--dsw-alias-state-error-primary)}",
	".mem-badge-over{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}",

	// ── SOUL:头部元信息 / 预览 / 提议 / 历史 ───────────────────────
	".soul-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;min-width:0;font-size:11px;line-height:17px;font-variant-numeric:tabular-nums}",
	".soul-preview{display:flex;flex-direction:column;gap:8px}",
	".soul-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}",
	".soul-preview-title{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary)}",
	".soul-proposals{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}",
	".soul-history{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}",
	".soul-foot{border-top:1px dashed var(--dsw-alias-border-l1);padding-top:10px}",
	".soul-over-hint{color:var(--dsw-alias-state-error-primary)}",

	// ── 以下从 legacy.js 迁入:SOUL 覆盖层 / diff / 编辑器 / 版本行 ──
	".mem-soul-toggles{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
	".mem-soul-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary)}",
	".mem-soul-meta code,.mem-soul-preview code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}",
	".mem-soul-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);padding:8px 10px;display:flex;flex-direction:column;gap:6px}",
	".mem-soul-preview pre{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:17px;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:var(--dsw-alias-label-primary)}",
	".mem-soul-preview-foot{display:flex;justify-content:space-between;align-items:center;gap:10px}",
	".mem-soul-hist-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}",
	".mem-soul-hist{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto}",
	".mem-soul-v{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 8px;font-size:12px}",
	".mem-soul-v .when{color:var(--dsw-alias-label-secondary);flex-shrink:0;min-width:64px}",
	".mem-soul-v .why{flex:1;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".mem-soul-v .delta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary)}",
	".mem-soul-v .acts{display:flex;gap:6px;margin-left:auto}",
	".mem-badge-agent{color:var(--dsw-alias-link);border-color:var(--dsw-alias-link)}",
	".mem-badge-user{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}",
	".mem-badge-ext{color:var(--dsw-alias-label-tertiary)}",
	".mem-soul-confirm{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:6px;padding:5px 8px;font-size:12px}",
	".mem-diff{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);padding:6px 0;overflow:auto;flex:1;min-height:0}",
	".mem-diff pre{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:18px}",
	".mem-diff .ln{display:block;padding:0 10px;white-space:pre-wrap;word-break:break-word}",
	".mem-diff .add{background:var(--dsw-alias-state-success-tertiary)}",
	".mem-diff .del{background:rgba(236,19,19,.08);text-decoration:line-through}",
	"body[data-ds-dark-theme] .mem-diff .del{background:rgba(236,19,19,.16)}",
	// 覆盖层:整屏模态(设置面板是宿主 DOM 且类名是 CSS Modules 哈希,不做祖先定位)
	".mem-overlay{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1);padding:32px}",
	".mem-overlay-panel{display:flex;flex-direction:column;width:min(1040px,100%);height:min(760px,100%);border-radius:24px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.28)}",
	".mem-overlay-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
	".mem-overlay-head h3{margin:0;font-size:15px}",
	".mem-overlay-sub{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}",
	".mem-overlay-body{flex:1;min-height:0;display:flex;gap:14px;padding:14px 20px}",
	".mem-overlay-confirm{padding:10px 20px 0}",
	".mem-overlay-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}",
	".mem-overlay-side{flex:none;width:240px;display:flex;flex-direction:column;gap:6px;min-height:0}",
	".mem-overlay-side .mem-soul-hist{max-height:none;flex:1}",
	".mem-overlay-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 20px 16px;border-top:1px solid var(--dsw-alias-border-l1)}",
	".mem-editor{flex:1;width:100%;min-height:0;resize:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:19px;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}",
	".mem-editor:focus{outline:none;border-color:var(--dsw-alias-border-l3)}",
	".mem-charcount{font-size:11px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
	".mem-charcount[data-over='true']{color:var(--dsw-alias-state-error-primary);font-weight:600}",

	// ── 响应式:窄屏编辑区收矮、覆盖层侧栏落到正文下方 ─────────────
	"@media (max-width:900px){.mem-overlay-body{flex-direction:column;overflow:auto}.mem-overlay-side{width:auto}.mem-overlay-side .mem-soul-hist{max-height:240px}}",
	"@media (max-width:640px){.per-editor{min-height:36vh}.mem-overlay{padding:12px}.mem-overlay-panel{height:100%;border-radius:16px}}",
].join("");
		exps["css"] = css;
		return exps;
	})();
		//#endregion
		//#region lib/client/css.js
	var mod_css_js = (function () {
		var exps = {};
		var base = mod_css_base_js["css"];
		var shell = mod_css_shell_js["css"];
		var overview = mod_css_overview_js["css"];
		var memories = mod_css_memories_js["css"];
		var recall = mod_css_recall_js["css"];
		var config = mod_css_config_js["css"];
		var persona = mod_css_persona_js["css"];
/**
 * 样式聚合入口:各面板只往自己的 `css/<panel>.js` 里加样式,这里统一拼成一份字符串注入。
 *
 * 顺序 = 层叠优先级(后者覆盖同名的前者):
 *   base(共享原子组件 + 通用版式)→ shell(页面外壳)→ 各面板。
 *
 * 只允许 DSH 主题令牌;`TAG_ID` 的 querySelector 栅栏保证重复调用也只插一份。
 * (v1.15 集成阶段已删除过渡期的 `css/legacy.js`,所有类都由下面这些模块自洽提供。)
 */

const CSS = [base, shell, overview, memories, recall, config, persona].join("");

const TAG_ID = "neural-mind/page.css";

/** 样式注入:工厂每次被调都试一次,querySelector 栅栏保证重复登记/调用也只插一份。 */
function injectCss() {
	if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(TAG_ID) + "]") === null) {
		const tag = document.createElement("style");
		tag.dataset.plugin = "neural-mind";
		tag.dataset.pluginCss = TAG_ID;
		tag.textContent = CSS;
		document.head.appendChild(tag);
	}
}
		exps["injectCss"] = injectCss;
		return exps;
	})();
		//#endregion
		//#region lib/client/i18n/base.js
	var mod_i18n_base_js = (function () {
		var exps = {};
/**
 * 共享词典(页面外壳 + 通用组件 + 状态词)。
 * 面板词典在同目录的 `<panel>.js` 里,由 locale.js 合并。
 */
const zh = {
	tab: "记忆",
	pageIntro: "长期记忆池 · 自动记住、自动想起。这里可以看它记得什么、怎么用、为什么没想起。",
	navOverview: "总览",
	navMemories: "记忆",
	navRecall: "召回",
	navConfig: "配置",
	navProfile: "画像",
	navSoul: "SOUL",
	navAudit: "审计",
	headerRefresh: "刷新",
	headerRefreshing: "刷新中…",
	headerRefreshHint: "重新拉取整页数据(不改配置)",
	stStorage: "存储",
	stStoragePersisted: "已落盘",
	stStorageMemory: "内存态",
	stStorageMemoryHint: "存储服务未就绪:本次运行不落盘,重启会丢记忆。其余功能照常。",
	stStorageUnknown: "未知",
	stVector: "向量路",
	stVectorOn: "已开启",
	stVectorOff: "未开启",
	stVectorNoKey: "缺凭据",
	stVectorHint: "向量路关闭时按纯 BM25 检索,仍可正常召回(只是不懂近义改写)。",
	stVectorDisabledHint: "语义检索总开关关闭:不配置端点、不发 embedding 请求,按纯 BM25 检索。",
	stVectorNoKeyHint: "端点与模型已配置,但凭据解析不到:向量路会自动降级为纯 BM25。到「配置 → 向量检索」补凭据或勾选「本地端点免密钥」。",
	stVectorOnHint: "混合检索:BM25 关键词路 + 向量语义路,两路结果用 RRF 融合后按重要度/时效/证据排序。",
	stRecall: "召回",
	stRecallOn: "开",
	stRecallOff: "仅手动",
	stRecallHint: "自动召回关闭时不再自动注入;手动 memory_recall 工具照常可用。",
	stRecallOffHint: "自动注入已关闭:记忆照常写入,但对话里不会自动想起。需要时让模型调用 memory_recall,或在「配置 → 注入与召回」重新打开。",
	stScope: "工作区范围",
	stScopeAll: "全部启用",
	stScopeSome: "{n} 个停用",
	stScopeHint: "停用的工作区完全不介入:不写记忆、不提炼、不召回、不注入。",
	statusOk: "正常",
	statusWarn: "注意",
	statusError: "异常",
	statusInfo: "提示",
	statsStaged: "暂存",
	commonLoading: "加载中…",
	commonError: "加载失败",
	commonRetry: "重试",
	commonRefresh: "刷新",
	commonEmpty: "暂无数据",
	commonEmptyHint: "还没有内容。",
	commonSave: "保存",
	commonCancel: "取消",
	commonClose: "关闭",
	commonReset: "重置",
	commonAll: "全部",
	commonSearch: "搜索",
	commonClear: "清除",
	commonCopy: "复制",
	commonCopied: "已复制",
	commonCopyFailed: "复制失败",
	commonMore: "加载更多",
	commonShowMore: "查看更多",
	commonChars: "字符",
	commonCount: "{n} 条",
	commonItems: "{n} 项",
	commonUnknown: "未知",
	commonEnabled: "已启用",
	commonDisabled: "已停用",
	commonOn: "开",
	commonOff: "关",
	commonBack: "返回",
	commonOpen: "打开",
	commonNoData: "没有数据",
	commonNone: "无",
	commonJustNow: "刚刚",
	commonMinutesAgo: "{n} 分钟前",
	commonHoursAgo: "{n} 小时前",
	commonDaysAgo: "{n} 天前",
	commonUpdatedAt: "更新于 {time}",
	commonVersion: "版本",
	commonNow: "现在",
	commonUnknownTime: "—",
};

const en = {
	tab: "Memory",
	pageIntro: "Long-term memory pool · remembers and recalls on its own. See what it knows, how it's used, and why it stayed quiet.",
	navOverview: "Overview",
	navMemories: "Memories",
	navRecall: "Recall",
	navConfig: "Config",
	navProfile: "Profile",
	navSoul: "SOUL",
	navAudit: "Audit",
	headerRefresh: "Refresh",
	headerRefreshing: "Refreshing…",
	headerRefreshHint: "Reload the whole page (does not change config)",
	stStorage: "Storage",
	stStoragePersisted: "Persisted",
	stStorageMemory: "In-memory",
	stStorageMemoryHint: "Storage service is not ready: nothing is persisted this run, a restart forgets everything. Everything else still works.",
	stStorageUnknown: "Unknown",
	stVector: "Vector lane",
	stVectorOn: "Enabled",
	stVectorOff: "Off",
	stVectorNoKey: "No key",
	stVectorHint: "With the vector lane off, search is BM25-only (still works, just no semantic matching).",
	stVectorDisabledHint: "Semantic search master switch is off: no endpoint, no embedding requests, BM25-only.",
	stVectorNoKeyHint: "Endpoint and model are configured but no credential resolves: the vector lane silently falls back to BM25. Add a key or enable “keyless local endpoint” under Config → Vector search.",
	stVectorOnHint: "Hybrid retrieval: BM25 keyword lane + vector semantic lane, fused with RRF, then ranked by importance/recency/evidence.",
	stRecall: "Recall",
	stRecallOn: "On",
	stRecallOff: "Manual only",
	stRecallHint: "When auto recall is off there is no automatic injection; the manual memory_recall tool keeps working.",
	stRecallOffHint: "Automatic injection is off: memories are still written, they just never surface in conversation on their own. Ask the model to call memory_recall, or turn it back on under Config → Injection & recall.",
	stScope: "Workspaces",
	stScopeAll: "All enabled",
	stScopeSome: "{n} disabled",
	stScopeHint: "Disabled workspaces are fully opted out: no writes, no extraction, no recall, no injection.",
	statusOk: "OK",
	statusWarn: "Attention",
	statusError: "Error",
	statusInfo: "Info",
	statsStaged: "Staged",
	commonLoading: "Loading…",
	commonError: "Load failed",
	commonRetry: "Retry",
	commonRefresh: "Refresh",
	commonEmpty: "No data",
	commonEmptyHint: "Nothing here yet.",
	commonSave: "Save",
	commonCancel: "Cancel",
	commonClose: "Close",
	commonReset: "Reset",
	commonAll: "All",
	commonSearch: "Search",
	commonClear: "Clear",
	commonCopy: "Copy",
	commonCopied: "Copied",
	commonCopyFailed: "Copy failed",
	commonMore: "Load more",
	commonShowMore: "Show more",
	commonChars: "chars",
	commonCount: "{n}",
	commonItems: "{n}",
	commonUnknown: "Unknown",
	commonEnabled: "Enabled",
	commonDisabled: "Disabled",
	commonOn: "On",
	commonOff: "Off",
	commonBack: "Back",
	commonOpen: "Open",
	commonNoData: "No data",
	commonNone: "None",
	commonJustNow: "just now",
	commonMinutesAgo: "{n} min ago",
	commonHoursAgo: "{n} h ago",
	commonDaysAgo: "{n} d ago",
	commonUpdatedAt: "Updated {time}",
	commonVersion: "Version",
	commonNow: "now",
	commonUnknownTime: "—",
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/i18n/overview.js
	var mod_i18n_overview_js = (function () {
		var exps = {};
/**
 * 总览面板词典(v1.15)。key 前缀 `ov*`;共享词(存储/向量/召回/工作区状态等)见
 * `i18n/base.js`,不在此重复定义。
 *
 * 文案原则:诚实(内存态要明说重启失忆)、不吓人(降级不是错误)、口语化、可行动。
 */
const zh = {
	// ── KPI ────────────────────────────────────────────────────────
	ovKpiTitle: "记忆盘子",
	ovKpiSub: "一眼看完:存了多少、消化到哪、向量覆盖多少。",
	ovKpiLongTerm: "长期记忆",
	ovKpiLongTermSub: "活跃 {active} · 暂存 {staged} · 归档 {archived}",
	ovKpiHot: "热缓冲",
	ovKpiHotSub: "未消化 {n}",
	ovKpiHotClean: "已全部消化",
	ovKpiOutbox: "提炼队列",
	ovKpiOutboxSub: "待处理 {pending} · 死信 {dead}",
	ovKpiEmbedded: "向量覆盖",
	ovKpiEmbeddedOff: "未启用",
	ovKpiEmbeddedHint: "语义检索关着:按纯 BM25 检索,召回仍可用。",
	ovKpiEmbeddedEmpty: "还没有可向量化的记忆",
	ovKpiInjection: "本次运行注入",
	ovKpiInjectionSub: "{chars} 字符 · 命中 {records} 条",
	ovKpiWorkspaces: "工作区",
	ovKpiWorkspacesSub: "启用 {enabled} · 停用 {disabled}",

	// ── 顶部单行健康摘要 ────────────────────────────────────────────
	ovHealthTopOk: "健康检查:全部正常",
	ovHealthTopWarn: "健康检查:{n} 项需关注",
	ovHealthTopInfo: "健康检查:{n} 项提示",

	// ── 状态自检 ───────────────────────────────────────────────────
	ovHealthTitle: "状态自检",
	ovHealthSub: "逐项检查,不拦路;有降级会说明后果。",
	ovCheckStorage: "存储落盘",
	ovCheckStorageOk: "记忆已落盘,重启不丢。",
	ovCheckStorageWarn: "当前是内存态:重启会丢记忆,其余功能照常。",
	ovCheckVector: "向量路",
	ovCheckVectorOk: "混合检索可用:{model} · {dim} 维。",
	ovCheckVectorOff: "语义检索已关闭,按纯 BM25 检索,召回仍可用。",
	ovCheckVectorUnconfigured: "已开启但端点/模型没配全,向量路会降级为纯 BM25。",
	ovCheckVectorNoKey: "凭据解析不到,向量路会降级为纯 BM25;本地端点可勾选免密钥。",
	ovCheckVectorFailure: "上次调用失败:{reason};本轮可能已降级为纯 BM25。",
	ovCheckExtract: "后台提炼",
	ovCheckExtractOk: "热缓冲消化正常,队列无积压。",
	ovCheckExtractOff: "后台提炼已关闭:热缓冲不会自动沉淀成长期记忆。",
	ovCheckExtractBacklog: "热缓冲有 {n} 条未消化,稍后会自动处理;着急可手动触发。",
	ovCheckExtractDead: "提炼队列有 {n} 条死信,建议到配置页看看日志。",
	ovCheckExtractLastOk: "上次整理 {time}:{turns} 回合 / {chars} 字符,成功。",
	ovCheckExtractFailed: "上次整理 {time} 失败:{reason};后台会按退避重试,详情见「审计」页。",
	ovCheckExtractDrops: "整理丢弃",
	ovCheckExtractDropsDesc: "本次运行丢弃 {n} 条:低置信度 {low} · 注入特征 {injection} · 密钥形态 {secret} · 超长 {oversized}。",
	ovCheckRecall: "自动召回",
	ovCheckRecallOk: "开着的:对话开始时会自动挑相关记忆注入。",
	ovCheckRecallWarn: "自动召回关闭:记忆照常写入,但对话里不会自动想起;手动 memory_recall 仍可用。",
	ovCheckWorkspace: "工作区范围",
	ovCheckWorkspaceOk: "所有工作区都参与记忆。",
	ovCheckWorkspaceInfo: "有 {n} 个工作区停用,完全不参与写入/召回/注入。",
	ovCheckProfile: "用户画像",
	ovCheckProfileOk: "画像已配置,会随上下文一起注入。",
	ovCheckProfileInfo: "画像文件还没配置,注入里会少一层用户偏好。",
	ovCheckSoul: "SOUL 自改层",
	ovCheckSoulOk: "SOUL 开着:当前 {chars} 字符,{versions} 个版本。",
	ovCheckSoulInfo: "SOUL 层关闭:自改与版本都不生效。",

	// ── 最近注入 ───────────────────────────────────────────────────
	ovInjectTitle: "最近注入",
	ovInjectSub: "只记模式、计数与原因;不记注入正文与查询。",
	ovInjectEmpty: "本次运行还没有注入记录",
	ovInjectEmptyHint: "正常聊几轮,这里会写清每次注入/跳过和原因。",
	ovInjectChars: "{n} 字符",
	ovInjectRecords: "{n} 条",
	ovModeInject: "注入",
	ovModeResident: "常驻",
	ovModeDigest: "摘要",
	ovModeSkip: "跳过",
	ovReasonWorkspaceDisabled: "工作区已停用",
	ovReasonAutoRecallOff: "自动召回已关闭",
	ovReasonNoQuery: "没有可检索的查询",
	ovReasonPressure: "上下文压力高,主动让位",
	ovReasonInlineTimeout: "检索超时,先跳过",
	ovReasonSearchUnavailable: "检索暂不可用",
	ovReasonNoHits: "没有命中相关记忆",
	ovReasonSubagent: "子代理会话不注入",
	ovInjectQuality: "相关 {r} · 可信 {c}",
	ovInjectQualityHint: "注入时的融合相关度与记忆可信度(只记录,不参与注入选择)",
	ovInjectLowTrust: "低可信 {n}",

	// ── 使用量(0.6.7 §14)───────────────────────────────────────────
	ovUsageTitle: "使用量",
	ovUsageSub: "落盘的注入 / 跳过 / 提炼 / 召回计数(跨重启可读;质量均值只作展示)。",
	ovUsageInject: "今日注入",
	ovUsageSkip: "今日跳过",
	ovUsageExtract: "提炼成功",
	ovUsageRecall: "召回调用",
	ovUsageAvg: "质量均值",
	ovUsageRelevance: "相关 {v}",
	ovUsageConfidence: "可信 {v}",
	ovUsageRetention: "日汇总 {d} 天 / 明细 {detail} 天",
	ovUsageUnavailable: "用量未落盘",
	ovUsageUnavailableHint: "storageDomain 缺席、观测域打开失败或 usageLog 关闭时,只保留进程内计数(重启归零)。",

	// ── 记忆构成 ───────────────────────────────────────────────────
	ovCompTitle: "记忆构成",
	ovCompSub: "按类型与状态看分布,占比按各自合计算。",
	ovCompKinds: "按类型",
	ovCompStatus: "按状态",
	ovKindFact: "事实",
	ovKindLesson: "经验",
	ovKindEpisode: "事件",
	ovStatusActive: "活跃",
	ovStatusStaged: "暂存",
	ovStatusArchived: "归档",

	// ── 最近审计 ───────────────────────────────────────────────────
	ovAuditTitle: "最近审计",
	ovAuditSub: "写入/确认/配置变更都会留痕,完整记录在「审计」页。",
	ovAuditEmpty: "本次运行还没有审计记录",
	ovAuditEmptyHint: "写记忆、确认暂存、改 SOUL 之后,这里会出现留痕。",
	ovJumpAudit: "查看全部审计",
	ovJumpHint: "切到「审计」页签可以看全部记录。",

	// ── 空池 / 加载 / 错误 ─────────────────────────────────────────
	ovEmptyTitle: "长期记忆还是空的",
	ovEmptyHint: "正常聊几轮后会先进入热缓冲,消化后才沉淀成长期记忆——不用做额外操作。",
	ovEmptyHotHint: "长期池还是空的;热缓冲里已有 {n} 条,消化后会自动进来。",
};

const en = {
	// ── KPI ────────────────────────────────────────────────────────
	ovKpiTitle: "Memory at a glance",
	ovKpiSub: "How much is stored, how far digestion got, how well vectors cover it.",
	ovKpiLongTerm: "Long-term memories",
	ovKpiLongTermSub: "active {active} · staged {staged} · archived {archived}",
	ovKpiHot: "Hot buffer",
	ovKpiHotSub: "{n} not digested yet",
	ovKpiHotClean: "All digested",
	ovKpiOutbox: "Extraction queue",
	ovKpiOutboxSub: "pending {pending} · dead {dead}",
	ovKpiEmbedded: "Vector coverage",
	ovKpiEmbeddedOff: "Off",
	ovKpiEmbeddedHint: "Semantic search is off: BM25-only retrieval, recall still works.",
	ovKpiEmbeddedEmpty: "Nothing to embed yet",
	ovKpiInjection: "Injections this run",
	ovKpiInjectionSub: "{chars} chars · {records} memories",
	ovKpiWorkspaces: "Workspaces",
	ovKpiWorkspacesSub: "enabled {enabled} · disabled {disabled}",

	// ── Top single-line health summary ─────────────────────────────
	ovHealthTopOk: "Health check: all good",
	ovHealthTopWarn: "Health check: {n} need attention",
	ovHealthTopInfo: "Health check: {n} notes",

	// ── Health checks ──────────────────────────────────────────────
	ovHealthTitle: "Self-check",
	ovHealthSub: "Each item stands alone; degradations say what they cost.",
	ovCheckStorage: "Storage",
	ovCheckStorageOk: "Memories are persisted and survive a restart.",
	ovCheckStorageWarn: "In-memory only: a restart forgets memories. Everything else works.",
	ovCheckVector: "Vector lane",
	ovCheckVectorOk: "Hybrid retrieval available: {model} · {dim} dims.",
	ovCheckVectorOff: "Semantic search is off; BM25-only retrieval still recalls fine.",
	ovCheckVectorUnconfigured: "Enabled but endpoint/model incomplete; the vector lane falls back to BM25.",
	ovCheckVectorNoKey: "No credential resolves; the vector lane falls back to BM25. Keyless local endpoints can opt in.",
	ovCheckVectorFailure: "Last call failed: {reason}; this run likely fell back to BM25.",
	ovCheckExtract: "Background extraction",
	ovCheckExtractOk: "Hot buffer is digesting normally; queue is clear.",
	ovCheckExtractOff: "Background extraction is off: the hot buffer won't settle into long-term memory.",
	ovCheckExtractBacklog: "{n} hot-buffer entries are waiting; handled automatically soon (or trigger manually).",
	ovCheckExtractDead: "{n} dead letters in the extraction queue; check the logs under Config.",
	ovCheckExtractLastOk: "Last extraction at {time}: {turns} turns / {chars} chars, succeeded.",
	ovCheckExtractFailed: "Last extraction failed at {time}: {reason}. Retries continue with backoff; see Audit for details.",
	ovCheckExtractDrops: "Extraction drops",
	ovCheckExtractDropsDesc: "{n} candidates dropped this run: low confidence {low} · injection patterns {injection} · secret patterns {secret} · oversized {oversized}.",
	ovCheckRecall: "Auto recall",
	ovCheckRecallOk: "On: relevant memories are injected automatically when a conversation starts.",
	ovCheckRecallWarn: "Auto recall is off: memories are still written, they just never surface on their own; manual memory_recall works.",
	ovCheckWorkspace: "Workspace scope",
	ovCheckWorkspaceOk: "Every workspace takes part in memory.",
	ovCheckWorkspaceInfo: "{n} workspaces disabled: fully opted out of writes/recall/injection.",
	ovCheckProfile: "User profile",
	ovCheckProfileOk: "Profile configured and injected with context.",
	ovCheckProfileInfo: "No profile file yet; injection loses one layer of user preference.",
	ovCheckSoul: "SOUL self-edit layer",
	ovCheckSoulOk: "SOUL is on: {chars} chars, {versions} versions.",
	ovCheckSoulInfo: "SOUL layer is off: self-edits and versions are inactive.",

	// ── Recent injections ──────────────────────────────────────────
	ovInjectTitle: "Recent injections",
	ovInjectSub: "Mode, counts and reason only; never the injected text or your query.",
	ovInjectEmpty: "No injections this run yet",
	ovInjectEmptyHint: "Chat a few turns and every injection/skip will show up here with its reason.",
	ovInjectChars: "{n} chars",
	ovInjectRecords: "{n} records",
	ovModeInject: "Injected",
	ovModeResident: "Resident",
	ovModeDigest: "Digest",
	ovModeSkip: "Skipped",
	ovReasonWorkspaceDisabled: "Workspace disabled",
	ovReasonAutoRecallOff: "Auto recall is off",
	ovReasonNoQuery: "No query to search",
	ovReasonPressure: "Context pressure, gave way",
	ovReasonInlineTimeout: "Retrieval timed out",
	ovReasonSearchUnavailable: "Retrieval unavailable",
	ovReasonNoHits: "No relevant hits",
	ovReasonSubagent: "Subagent session, skipped",
	ovInjectQuality: "rel {r} · trust {c}",
	ovInjectQualityHint: "Fused relevance and memory confidence at injection time (recorded only, never used for selection)",
	ovInjectLowTrust: "low trust {n}",

	// ── Usage (0.6.7 §14)───────────────────────────────────────────
	ovUsageTitle: "Usage",
	ovUsageSub: "Persisted injection / skip / extraction / recall counts (survive restarts; quality averages are display-only).",
	ovUsageInject: "Injected today",
	ovUsageSkip: "Skipped today",
	ovUsageExtract: "Extractions ok",
	ovUsageRecall: "Recall calls",
	ovUsageAvg: "Quality avg",
	ovUsageRelevance: "rel {v}",
	ovUsageConfidence: "trust {v}",
	ovUsageRetention: "daily {d} d / detail {detail} d",
	ovUsageUnavailable: "Usage not persisted",
	ovUsageUnavailableHint: "When storageDomain is missing, the usage domain fails to open, or usageLog is off, only in-process counts remain (reset on restart).",

	// ── Memory composition ─────────────────────────────────────────
	ovCompTitle: "Memory composition",
	ovCompSub: "Distributions by kind and by status; ratios are within each group.",
	ovCompKinds: "By kind",
	ovCompStatus: "By status",
	ovKindFact: "Fact",
	ovKindLesson: "Lesson",
	ovKindEpisode: "Episode",
	ovStatusActive: "Active",
	ovStatusStaged: "Staged",
	ovStatusArchived: "Archived",

	// ── Recent audit ───────────────────────────────────────────────
	ovAuditTitle: "Recent audit",
	ovAuditSub: "Writes, confirmations and config changes are recorded; full trail under Audit.",
	ovAuditEmpty: "No audit entries this run yet",
	ovAuditEmptyHint: "Write a memory, confirm a staged one, or edit SOUL and the trail appears here.",
	ovJumpAudit: "View full audit",
	ovJumpHint: "Switch to the Audit tab to see the full trail.",

	// ── Empty pool / loading / error ───────────────────────────────
	ovEmptyTitle: "Long-term memory is still empty",
	ovEmptyHint: "After a few normal turns memories land in the hot buffer first, then settle into long-term memory — nothing extra to do.",
	ovEmptyHotHint: "Long-term pool is still empty; {n} entries already sit in the hot buffer and will settle in automatically.",
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/i18n/memories.js
	var mod_i18n_memories_js = (function () {
		var exps = {};
/** 记忆管理台词典(v1.15);前缀 mem*,与 base / 其它面板不重复。 */
const zh = {
	memTitle: "记忆管理台",
	memHint: "搜索、筛选、查看详情;暂存记忆可在这里确认或拒绝。改动只发生在你点下的那一刻。",
	memSearchPlaceholder: "搜索内容 / entity / id…",
	memSortLabel: "排序",
	memSortNew: "最新在前",
	memSortOld: "最早在前",
	memSortImportance: "重要度优先",
	memFiltersLabel: "筛选",
	memAll: "全部",
	memActive: "活跃",
	memStaged: "暂存",
	memArchived: "已归档",
	memKindAll: "全部类型",
	memKindFact: "事实",
	memKindLesson: "经验",
	memKindEpisode: "话题",
	memWorkspaceAll: "全部工作区",
	memWorkspaceLabel: "工作区",
	memPoolEmptyTitle: "记忆池还是空的",
	memPoolEmptyHint: "正常聊几轮后,回合内容会先进热缓冲,再由后台提炼成长期记忆。也可以让模型用 memory_remember 显式记一条。",
	memNoSearchTitle: "没有匹配的记忆",
	memNoSearchHint: "换个关键词试试;搜索只匹配正文 / entity / id 的字面片段。",
	memNoFilterTitle: "当前筛选下没有记忆",
	memNoFilterHint: "放宽状态、类型或工作区筛选再看看。",
	memCount: "共 {n} 条",
	memShown: "已显示 {shown} / {total}",
	memLoadMore: "加载更多",
	memScore: "相关度",
	memFieldFacts: "详细信息",
	memFieldStatus: "状态",
	memFieldKind: "类型",
	memFieldSource: "来源",
	memFieldEntity: "实体",
	memFieldWorkspace: "工作区",
	memFieldTemporal: "时间语义",
	memFieldImportance: "重要度",
	memFieldCreated: "创建时间",
	memFieldEventTime: "事件时间",
	memFieldValidUntil: "有效期",
	memFieldConfidence: "置信度",
	memFieldEmbedding: "向量段数",
	memFieldFiles: "文件锚",
	memFieldId: "ID",
	memFieldSupersededBy: "被取代",
	memChunks: "段",
	memTemporalPattern: "长期模式",
	memTemporalState: "当前状态",
	memTemporalEpisode: "事件片段",
	memSourceUser: "用户说的",
	memSourceAssistant: "助手记下的",
	memSourceCode: "代码",
	memSourceTool: "工具",
	memSourceQuote: "转贴",
	memSourceUnknown: "来源查不清",
	memSourceConfirmed: "你确认过",
	memBadgeStaged: "暂存",
	memBadgeStagedHint: "暂存记忆:确认后转正,拒绝则归档(可审计,不物理删除)",
	memBadgeArchived: "已归档",
	memBadgeSensitive: "sensitive",
	memBadgePrivate: "私有目录",
	memBadgePrivateHint: "privateWorkspaces:只在同目录内检索,不跨 workspace 注入",
	memBadgeHidden: "已屏蔽",
	memBadgeHiddenHint: "硬屏蔽(hard):检索、召回、注入全域不可见,只在浏览里留档",
	memBadgeSoul: "人格提议",
	memBadgeSoulHint: "SOUL 提议请到 SOUL 页签采纳或忽略",
	memEvidenceTitle: "证据时间线",
	memEvidenceEmpty: "还没有证据记录。",
	memEvidenceReinforce: "印证",
	memEvidenceChallenge: "质疑",
	memEvidenceWeight: "权重",
	memBack: "返回列表",
	memDetailTitle: "记忆详情",
	memDetailError: "详情加载失败",
	memRetry: "重试",
	memCopyId: "复制 ID",
	memCopyContent: "复制正文",
	memCopied: "已复制",
	memCopyFailed: "复制失败",
	memConfirm: "确认",
	memReject: "拒绝",
	memActionFailed: "操作失败",
	memStagedHint: "暂存记忆:确认后转为长期记忆;拒绝则归档。",
	// ── R1a:管理操作与来源追溯 ──────────────────────────────────────
	memArchive: "停用",
	memRestore: "恢复",
	memMarkSensitive: "标为敏感",
	memUnmarkSensitive: "标为不敏感",
	memHide: "彻底隐藏",
	memHideConfirm: "再点一次确认彻底隐藏",
	memHideHint: "彻底隐藏后检索/召回/注入全域不可见,且不能恢复;原文仍在会话日志里。",
	memExpandSource: "展开来源轮次",
	memExpandedTitle: "来源轮次",
	memExpandedHint: "旧内容,以当前为准;已彻底隐藏的区间不会展示。",
	memExpandedError: "来源展开失败",
	memBadgeHot: "热缓冲",
	memReadOnlyHint: "热缓冲条目只读:不可停用/修改,可展开来源轮次。",
	memFieldSession: "来源会话",
	memFieldSourceRange: "原文区间",
	memFieldTurn: "回合",
};

const en = {
	memTitle: "Memory console",
	memHint: "Search, filter, and inspect. Staged memories can be confirmed or rejected here; nothing changes until you click.",
	memSearchPlaceholder: "Search content / entity / id…",
	memSortLabel: "Sort",
	memSortNew: "Newest first",
	memSortOld: "Oldest first",
	memSortImportance: "Importance first",
	memFiltersLabel: "Filters",
	memAll: "All",
	memActive: "Active",
	memStaged: "Staged",
	memArchived: "Archived",
	memKindAll: "All kinds",
	memKindFact: "Fact",
	memKindLesson: "Lesson",
	memKindEpisode: "Episode",
	memWorkspaceAll: "All workspaces",
	memWorkspaceLabel: "Workspace",
	memPoolEmptyTitle: "The pool is still empty",
	memPoolEmptyHint: "After a few normal turns, exchanges land in the hot buffer and are distilled into long-term memories. The model can also use memory_remember explicitly.",
	memNoSearchTitle: "No matching memories",
	memNoSearchHint: "Try another keyword; search matches literal fragments in content / entity / id.",
	memNoFilterTitle: "Nothing matches these filters",
	memNoFilterHint: "Loosen the status, kind, or workspace filter and look again.",
	memCount: "{n} memories",
	memShown: "Showing {shown} / {total}",
	memLoadMore: "Load more",
	memScore: "Relevance",
	memFieldFacts: "Details",
	memFieldStatus: "Status",
	memFieldKind: "Kind",
	memFieldSource: "Source",
	memFieldEntity: "Entity",
	memFieldWorkspace: "Workspace",
	memFieldTemporal: "Temporal",
	memFieldImportance: "Importance",
	memFieldCreated: "Created",
	memFieldEventTime: "Event time",
	memFieldValidUntil: "Valid until",
	memFieldConfidence: "Confidence",
	memFieldEmbedding: "Vector chunks",
	memFieldFiles: "File anchors",
	memFieldId: "ID",
	memFieldSupersededBy: "Superseded by",
	memChunks: "chunks",
	memTemporalPattern: "Pattern",
	memTemporalState: "State",
	memTemporalEpisode: "Episode",
	memSourceUser: "user",
	memSourceAssistant: "assistant",
	memSourceCode: "code",
	memSourceTool: "tool",
	memSourceQuote: "quote",
	memSourceUnknown: "unclear source",
	memSourceConfirmed: "confirmed by you",
	memBadgeStaged: "staged",
	memBadgeStagedHint: "Staged memory: confirm to promote it, reject to archive it (audited, never deleted)",
	memBadgeArchived: "archived",
	memBadgeSensitive: "sensitive",
	memBadgePrivate: "private",
	memBadgePrivateHint: "privateWorkspaces: only searchable inside the same workspace",
	memBadgeHidden: "blocked",
	memBadgeHiddenHint: "Hard-forgotten: invisible to search, recall and injection; kept here for the record",
	memBadgeSoul: "persona proposal",
	memBadgeSoulHint: "Adopt or ignore SOUL proposals on the SOUL tab",
	memEvidenceTitle: "Evidence timeline",
	memEvidenceEmpty: "No evidence recorded yet.",
	memEvidenceReinforce: "reinforce",
	memEvidenceChallenge: "challenge",
	memEvidenceWeight: "weight",
	memBack: "Back to list",
	memDetailTitle: "Memory detail",
	memDetailError: "Detail failed to load",
	memRetry: "Retry",
	memCopyId: "Copy ID",
	memCopyContent: "Copy content",
	memCopied: "Copied",
	memCopyFailed: "Copy failed",
	memConfirm: "Confirm",
	memReject: "Reject",
	memActionFailed: "Action failed",
	memStagedHint: "Staged memory: confirm to promote it, reject to archive it.",
	// ── R1a: management actions and provenance ─────────────────────
	memArchive: "Disable",
	memRestore: "Restore",
	memMarkSensitive: "Mark sensitive",
	memUnmarkSensitive: "Unmark sensitive",
	memHide: "Hide completely",
	memHideConfirm: "Click again to hide completely",
	memHideHint: "After hiding, it is invisible to search, recall and injection and cannot be restored; the original text stays in the session log.",
	memExpandSource: "Show source turns",
	memExpandedTitle: "Source turns",
	memExpandedHint: "Old content, current state wins; hard-forgotten ranges are not shown.",
	memExpandedError: "Failed to expand source",
	memBadgeHot: "hot buffer",
	memReadOnlyHint: "Hot-buffer entries are read-only: no disabling or editing, but source turns can be expanded.",
	memFieldSession: "Source session",
	memFieldSourceRange: "Source range",
	memFieldTurn: "Turn",
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/i18n/recall.js
	var mod_i18n_recall_js = (function () {
		var exps = {};
/**
 * 「召回」试验台 + 「审计」面板词典(v1.15)。
 *
 * key 前缀:`rc*` = 召回,`au*` = 审计;共享词(common、nav 系列)在 i18n/base.js,
 * 这里只放本面板自己的文案。插值统一用 `{name}` 占位。
 *
 * 文案纪律:说人话、说清"为什么会这样"(闸门/降级不是错误),并明示只读。
 */
const zh = {
	// ── 召回:页面与说明 ─────────────────────────────────────────────
	rcTitle: "召回试验",
	rcSub: "跑一次查询,看两路候选、闸门和注入预览;只读,不改任何状态。",
	rcReadOnly: "只读试验",
	rcNote: "本试验不写记忆、不改变任何状态。闸门只作用于自动注入路径,所以这里看到的注入预览,就是「下一轮真的会注入什么」的近似。",
	rcIdleHint: "输入查询后点「运行试验」。本试验只读,不会写记忆。",

	// ── 召回:表单 ───────────────────────────────────────────────────
	rcQueryLabel: "查询内容",
	rcQueryPlaceholder: "例如:上次说的部署脚本放哪了?",
	rcWorkspaceLabel: "工作区",
	rcWorkspaceAny: "不指定(全部)",
	rcWorkspaceHint: "不选工作区时按「无本地工作区」口径收紧(异地门槛×2);选你当前所在的工作区,结果更接近下一次真实注入。",
	rcWorkspacesFailed: "工作区列表加载失败",
	rcLimitLabel: "条数",
	rcRun: "运行试验",
	rcClear: "清空",
	rcQueryRequired: "先输入一句查询再运行。",
	rcLimitInvalid: "条数需是 1–20 之间的整数(与宿主单次试验上限一致)。",

	// ── 召回:结果摘要与闸门 ─────────────────────────────────────────
	rcResultTitle: "试验结果",
	rcResultSub: "候选池、两路命中、闸门与最终排序都在这里;点一行展开排序系数和命中片段。",
	rcSummaryPool: "候选池",
	rcSummaryBm25: "BM25 命中",
	rcSummaryVector: "向量命中",
	rcSummaryVectorLane: "向量路",
	rcVectorOn: "开",
	rcVectorOff: "关",
	rcVectorRanHint: "这次查询向量路真的跑起来了(embedding 可用且未超时)。",
	rcVectorOffHint: "这次向量路没跑起来(未启用/未配置/超时降级),结果按纯 BM25 口径;注入预览同理。",
	rcColdStart: "冷启动收紧",
	rcColdStartHint: "本地活跃记忆还少:检索按冷启动口径收紧了异地准入(异地及格线×2、异地系数×0.625)。",
	rcGate: "闸门",
	rcGateOnHint: "注入前的相关性闸门开着:不满足的命中不会进入自动注入。",
	rcGateOffHint: "闸门已关闭:只要过了单路及格线就会进入注入候选,无关查询更容易被注入。",
	rcGateConsensus: "共识线",
	rcGateConsensusHint: "两路都够强才放行,用于「互相印证」。",
	rcGateSolo: "单路线",
	rcGateSoloHint: "只有一路命中时,这一路必须达到更高的分数才放行。",
	rcGateBm25Only: "纯 BM25 门槛",
	rcGateBm25OnlyHint: "向量路没跑起来时,按关键词原始分的绝对线准入;候选池小于设定条数时不启用(绝对分随池子大小漂移)。",
	rcRuleConsensus: "BM25≥{bm25} 且 cos≥{cos}",
	rcRuleSolo: "BM25≥{bm25} 或 cos≥{cos}",
	rcRuleBm25Only: "BM25≥{min}(池≥{pool})",

	// ── 召回:命中行 ─────────────────────────────────────────────────
	rcMetricScore: "综合分",
	rcMetricRelevance: "相关性",
	rcMetricBm25Raw: "BM25 原始",
	rcMetricCos: "cos",
	rcBadgeBm25: "BM25",
	rcBadgeVector: "向量",
	rcLaneBm25Hint: "BM25 关键词路命中。",
	rcLaneVectorHint: "向量语义路命中(语义相近,不一定有相同词)。",
	rcLaneMissHint: "这一路没命中:这条是另一路带进来的。",
	rcPartsTitle: "排序系数(相乘得到综合分)",
	rcPartRelevance: "RRF 融合相关度",
	rcPartTime: "时效衰减",
	rcPartEvidence: "证据系数",
	rcPartWorkspace: "工作区系数",
	rcPartEntity: "实体加权",
	rcPartStatus: "状态系数",
	rcPartE: "证据净分 E",
	rcPartsEmpty: "这次结果没有排序系数明细。",
	rcChunkTitle: "命中片段",
	rcChunkEmpty: "这条没有向量片段(没走向量路,或片段不可得)。",

	// ── 召回:注入预览 ───────────────────────────────────────────────
	rcPreviewTitle: "注入预览",
	rcPreviewSub: "按当前注入预算拼出来的文本,近似下一轮自动注入的内容。",
	rcPreviewEmpty: "这条查询不会注入任何内容(没命中,或命中都被闸门/预算挡掉了)。",
	rcPreviewBudget: "{chars} / {max} 字符",
	rcPreviewOver: "超预算 {over} 字符",
	rcPreviewItemBudget: "{n} / {max} 条",
	rcEmptyTitle: "没有命中",
	rcEmptyHint: "检索是正常的,只是这句查询没匹配到记忆。换个说法、选对工作区或调大条数再试。",
	rcUnavailable: "检索不可用",

	// ── 审计 ────────────────────────────────────────────────────────
	auTitle: "审计",
	auSub: "拦截、降级、死信、归档都在这里留痕;只读,不会改写记忆。",
	auFilterKind: "类型",
	auFilterAll: "全部类型",
	auSearchPlaceholder: "搜索类型 / 详情…",
	auCount: "{shown} / {total} 条",
	auEmptyTitle: "还没有审计记录",
	auEmptyHint: "记忆的写入、注入、降级等动作会在这里留痕;现在还是空的。",
	auNoMatchTitle: "没有匹配的记录",
	auNoMatchHint: "换个类型或关键词试试;也可以清除筛选。",
	auResetFilters: "清除筛选",
};

const en = {
	// ── Recall: intro ───────────────────────────────────────────────
	rcTitle: "Recall lab",
	rcSub: "Run one query to inspect both lanes, the gate and the injection preview. Read-only, no state changes.",
	rcReadOnly: "Read-only experiment",
	rcNote: "This experiment never writes memory or changes any state. The gate only applies to the automatic injection path, so the preview here approximates what the next turn would actually inject.",
	rcIdleHint: "Type a query, then run the experiment. It is read-only and never writes memory.",

	// ── Recall: form ────────────────────────────────────────────────
	rcQueryLabel: "Query",
	rcQueryPlaceholder: "e.g. where did we put the deploy script?",
	rcWorkspaceLabel: "Workspace",
	rcWorkspaceAny: "Unspecified (all)",
	rcWorkspaceHint: "With no workspace selected the preview uses the “no local workspace” rule (remote thresholds ×2); selecting your current workspace is more accurate.",
	rcWorkspacesFailed: "Failed to load workspaces",
	rcLimitLabel: "Limit",
	rcRun: "Run experiment",
	rcClear: "Clear",
	rcQueryRequired: "Type a query before running.",
	rcLimitInvalid: "Limit must be an integer between 1 and 20 (the host caps one experiment at 20).",

	// ── Recall: summary & gate ──────────────────────────────────────
	rcResultTitle: "Result",
	rcResultSub: "Candidate pools, both lanes, the gate and the final ranking; click a row to expand its score factors and matched chunk.",
	rcSummaryPool: "Candidate pool",
	rcSummaryBm25: "BM25 hits",
	rcSummaryVector: "Vector hits",
	rcSummaryVectorLane: "Vector lane",
	rcVectorOn: "on",
	rcVectorOff: "off",
	rcVectorRanHint: "The vector lane really ran for this query (embedding available and not timed out).",
	rcVectorOffHint: "The vector lane did not run (disabled / not configured / timed out), so results are BM25-only — and so is the injection preview.",
	rcColdStart: "Cold-start tightening",
	rcColdStartHint: "Few local active memories: remote admission is tightened (remote thresholds ×2, remote factor ×0.625).",
	rcGate: "Gate",
	rcGateOnHint: "The relevance gate before injection is on: hits that don't qualify never reach automatic injection.",
	rcGateOffHint: "The gate is off: anything above the per-lane floor can be injected, so off-topic queries slip in more easily.",
	rcGateConsensus: "Consensus",
	rcGateConsensusHint: "Only rows strong in both lanes pass — mutual confirmation.",
	rcGateSolo: "Solo lane",
	rcGateSoloHint: "When only one lane matched, that lane must clear a higher bar.",
	rcGateBm25Only: "BM25-only floor",
	rcGateBm25OnlyHint: "When the vector lane is unavailable, admission needs an absolute raw BM25 score; disabled for small pools because absolute scores drift with corpus size.",
	rcRuleConsensus: "BM25≥{bm25} and cos≥{cos}",
	rcRuleSolo: "BM25≥{bm25} or cos≥{cos}",
	rcRuleBm25Only: "BM25≥{min} (pool≥{pool})",

	// ── Recall: hit rows ────────────────────────────────────────────
	rcMetricScore: "score",
	rcMetricRelevance: "relevance",
	rcMetricBm25Raw: "BM25 raw",
	rcMetricCos: "cos",
	rcBadgeBm25: "BM25",
	rcBadgeVector: "Vector",
	rcLaneBm25Hint: "Matched by the BM25 keyword lane.",
	rcLaneVectorHint: "Matched by the vector semantic lane (similar meaning, not necessarily the same words).",
	rcLaneMissHint: "This lane missed; the other lane brought this row in.",
	rcPartsTitle: "Score factors (multiplied into the final score)",
	rcPartRelevance: "RRF fused relevance",
	rcPartTime: "Recency decay",
	rcPartEvidence: "Evidence factor",
	rcPartWorkspace: "Workspace factor",
	rcPartEntity: "Entity boost",
	rcPartStatus: "Status factor",
	rcPartE: "Net evidence E",
	rcPartsEmpty: "No score factors in this result.",
	rcChunkTitle: "Matched chunk",
	rcChunkEmpty: "No vector chunk for this row (the vector lane missed, or no chunk is available).",

	// ── Recall: injection preview ───────────────────────────────────
	rcPreviewTitle: "Injection preview",
	rcPreviewSub: "Text assembled with the current injection budgets — approximately what the next automatic injection would contain.",
	rcPreviewEmpty: "This query would inject nothing (no hits, or all blocked by the gate/budget).",
	rcPreviewBudget: "{chars} / {max} chars",
	rcPreviewOver: "over budget by {over} chars",
	rcPreviewItemBudget: "{n} / {max} items",
	rcEmptyTitle: "No hits",
	rcEmptyHint: "Retrieval worked; this query just matched no memories. Try other wording, pick the right workspace, or raise the limit.",
	rcUnavailable: "Recall unavailable",

	// ── Audit ───────────────────────────────────────────────────────
	auTitle: "Audit",
	auSub: "Every interception, degradation, dead-letter and archive is recorded here; read-only.",
	auFilterKind: "Type",
	auFilterAll: "All types",
	auSearchPlaceholder: "Search type / detail…",
	auCount: "{shown} / {total} rows",
	auEmptyTitle: "No audit records yet",
	auEmptyHint: "Writes, injections, degradations and other actions leave a trace here; nothing so far.",
	auNoMatchTitle: "No matching records",
	auNoMatchHint: "Try another type or keyword, or clear the filters.",
	auResetFilters: "Clear filters",
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/i18n/config.js
	var mod_i18n_config_js = (function () {
		var exps = {};
/**
 * 配置面板词典(v1.15 重设计)。
 *
 * 约定:本文件是配置面板**自包含**的词典——面板里出现的每个字面量 key 都在这里给出
 * 中英文(不再依赖 i18n/legacy.js,那只是过渡期的旧文案)。与 i18n/base.js 共享的词
 * (commonLoading / commonOn / commonOff …)不在这里重复定义,`test/client-locale.test.mjs`
 * 会守「片段之间不得无声覆盖」。
 *
 * 动态拼接的 key(字段标签 `f_<键名>` 与说明 `f_<键名>_desc`)不在静态检查范围内,
 * 由 `GROUPS` 的 26 个键与这里的 `f_*` 条目逐一对齐保证。
 */
const zh = {
	// ── 顶部状态条 ──────────────────────────────────────────────────────
	configTitle: "配置",
	configHint: "改动即保存并立即生效(插件热重建);「重置」把这一项恢复为组合层默认值。",
	cfgService: "设置服务",
	cfgServiceReady: "可写",
	cfgServiceReadonly: "只读",
	cfgServiceLoading: "连接中…",
	cfgServiceUnavailable: "不可用",
	cfgServiceHint: "设置服务由 DSH configForms 提供,状态决定这里能不能写。",
	cfgAutoSave: "改动即保存",
	cfgAutoSaveHint: "每次修改都会立刻写入设置服务并生效;写入失败会在下方横幅提示,不会静默丢弃。",
	cfgOverriddenCount: "已覆盖 {n} 项",
	cfgOverriddenHint: "「已覆盖」= 你显式改过、盖住了组合层默认值;点该项的「重置」可恢复。",
	cfgFieldCount: "共 {n} 项可调",
	configUnavailable: "设置服务未挂载或仍在启动;当前以 cordis.patch.yml 配置运行。",
	configUnavailableHint: "重启 dsh 后这里会出现表单;现在字段不渲染,避免改了个假值。",
	configReadonly: "当前页面只读(非本机访问,或设置服务未就绪),字段不可改。",
	configWriteFailed: "这次修改没有生效(宿主拒绝或页面只读)。",
	cfgWriteError: "写入未生效",

	// ── 「需要关注」诊断卡 ──────────────────────────────────────────────
	cfgDiagTitle: "需要关注",
	cfgDiagSub: "根据当前配置值本地计算,不发请求;点「去设置」跳到对应分组。",
	cfgDiagCount: "需要关注 {n} 项",
	cfgDiagOk: "配置检查通过",
	cfgDiagOkHint: "开关、端点与作用域都符合预期;注入与向量路按当前配置工作。",
	cfgDiagGo: "去设置",
	cfgDiagVectorIncomplete: "向量路已开启,但端点 / 模型不全",
	cfgDiagVectorIncompleteHint: "缺 {missing} 时向量路会自动降级为纯 BM25;补全后立刻恢复混合检索。",
	cfgDiagVectorKey: "向量路缺凭据变量名,且未允许免密钥",
	cfgDiagVectorKeyHint: "需要鉴权的端点会请求失败;填一个凭据变量名,或勾选「本地端点可免密钥」。",
	cfgDiagVectorOff: "向量路关闭,按纯 BM25 检索",
	cfgDiagVectorOffHint: "关键词检索照常工作,只是不懂近义改写;需要语义检索时打开开关并填端点。",
	cfgDiagVectorFailed: "上次向量请求失败:{error}",
	cfgDiagVectorFailedHint: "已自动降级纯 BM25;修好端点后可在「向量检索」里点「测试连接」验证。",
	cfgDiagRecallOff: "自动召回已关闭",
	cfgDiagRecallOffHint: "记忆照常写入,但对话里不会自动想起;手动 memory_recall 工具仍可用。",
	cfgDiagExtractOff: "后台提炼已关闭",
	cfgDiagExtractOffHint: "热缓冲只进不出,长期记忆不会增长;打开「后台提炼」才会消化。",
	cfgDiagDisabledWs: "已停用 {n} 个工作区",
	cfgDiagDisabledWsHint: "停用的工作区完全不介入:不写、不提炼、不召回、不注入。",
	cfgDiagPrivate: "有 {n} 个隐私目录",
	cfgDiagPrivateHint: "隐私目录只进不出:记忆不跨目录注入;确认是有意为之即可。",
	cfgDiagProfileEmpty: "画像文件未配置",
	cfgDiagProfileEmptyHint: "「画像」页会是空的;在下方「用户画像」里填一个 md 文件路径即可。",
	cfgDiagMemoryOnly: "存储未落盘(内存态)",
	cfgDiagMemoryOnlyHint: "本次运行不落盘,重启会丢记忆;其余功能照常,存储服务恢复后自动落盘。",
	cfgDiagNoWorkspace: "还没有工作区记录",
	cfgDiagNoWorkspaceHint: "选择器会读 DSH 工作区注册表;这里为空说明注册表读不到,且插件还没记录过任何回合。",
	cfgDiagBootFailed: "记忆回合管道未启动:{error}",
	cfgDiagBootFailedHint: "页面还能开,但回合不会被记录(工作区/记忆都不会增长)。先看宿主 stderr 的 [memory] 行;重启应用或切一次配置可触发重建。",

	// ── 设置目录 / 搜索 ────────────────────────────────────────────────
	cfgSearchPlaceholder: "搜索设置:名称 / 说明 / 键名…",
	cfgSearchMatches: "匹配 {n} 项",
	cfgSearchEmpty: "没有匹配的设置项,换个关键词试试。",
	cfgExpandAll: "全部展开",
	cfgCollapseAll: "全部收起",
	cfgGroupChanged: "已改 {n} 项",
	cfgGroupCount: "{n} 项",
	cfgAdvancedHint: "不常改:超时、托管启动、预热",
	showAdvanced: "显示高级选项",
	hideAdvanced: "收起高级选项",
	cfgKeyHint: "配置键名(写入路径)",
	cfgNumberInvalid: "请输入数字;已保留上次有效值",
	cfgNumberRequired: "不能为空;已保留上次有效值",
	cfgLinesPlaceholder: "每行一条",
	cfgDictPlaceholder: "工具名=summary|head,每行一条",
	overridden: "已覆盖",
	cfgOverrideHint: "你显式改过这一项(盖过组合层默认值)",
	reset: "重置",
	cfgResetHint: "恢复为组合层默认值",

	// ── 分组标题 ───────────────────────────────────────────────────────
	groupPrivacy: "隐私与作用域",
	groupEmbedding: "向量检索",
	groupWrite: "写入与提炼",
	groupInject: "注入与召回",
	groupProfile: "用户画像",

	// ── 工作区选择器 ───────────────────────────────────────────────────
	cfgWsSearch: "搜索工作区(名称 / 路径)…",
	cfgWsSummary: "{total} 个已知工作区 · 停用 {disabled} 个",
	cfgWsCount: "{n} 条记忆",
	cfgWsLastSeen: "最近 {time}",
	cfgWsNeverSeen: "未记录出现时间",
	cfgWsEnableAll: "全部启用",
	cfgWsDisableAll: "全部停用",
	cfgWsPrefixHint: "勾选 = 启用;取消勾选 = 停用。写入口径是 disabledWorkspaces(支持前缀)。",
	cfgWsManual: "手动添加路径",
	cfgWsManualHint: "每行一个 workspaceId 或前缀;留空 = 全部启用。",
	cfgWsManualCount: "手动条目 {n} 项",
	cfgWsEmpty: "还没有已知工作区;可在下方手动添加",
	cfgWsNoMatch: "没有匹配的工作区",
	cfgWsLoading: "加载工作区…",
	cfgWsError: "工作区列表加载失败",

	// ── 向量检索:密钥管理 + 连接测试 ──────────────────────────────────
	embedKeyLabel: "API Key(只写不显示)",
	embedKeyHint: "保存到 DSH credentials;不回显、不写入插件配置。",
	embedKeySave: "保存密钥",
	embedKeyClear: "清除已存密钥",
	embedKeySaved: "密钥已保存",
	embedKeyCleared: "已清除存储的密钥",
	embedKeyMissing: "未配置,请填入 Key",
	embedKeyConfigured: "已配置",
	embedKeyNeedName: "先在上方「凭据变量名」填一个名字并保存,例如 SILICONFLOW_API_KEY。",
	embedKeyOptionalNoName: "已勾选本地免密钥;此端点无需填变量名或 Key,需要鉴权时再填变量名。",
	embedKeyPlaceholderUpdate: "已配置;输入新值可覆盖",
	embedKeyOptionalHint: "已勾选「本地端点可免密钥」,此端点可留空",
	embedKeyUnavailable: "DSH credentials 服务缺席;请改用环境变量",
	cfgEmbedKeySource: "来源 {source}",
	embedTest: "测试 embedding 连接",
	embedTesting: "测试中…",
	embedTestHint: "发一条固定短文本,验证 baseUrl / modelId / 凭据是否可用;不读写记忆。",
	embedTestDims: "维",
	cfgEmbedFailed: "连接失败",

	// ── 26 个字段:标签 ─────────────────────────────────────────────────
	f_privateWorkspaces: "隐私目录(每行一个)",
	f_disabledWorkspaces: "停用的工作区(每行一个)",
	f_sensitiveNoCross: "sensitive 不跨域注入(默认关)",
	f_sensitiveKeywords: "敏感词表(默认空=不自动标)",
	f_enabled: "启用向量路",
	f_baseUrl: "端点 baseUrl",
	f_modelId: "模型名",
	f_apiKeyEnv: "凭据变量名",
	f_apiKeyOptional: "本地端点可免密钥",
	f_timeoutMs: "查询超时(ms)",
	f_autoStartCommand: "托管启动命令",
	f_autoStartWaitMs: "就绪等待(ms)",
	f_autoStartWarmup: "就绪即预热",
	f_extractEnabled: "后台提炼",
	f_extractBatchTurns: "攒批轮数",
	f_extractIdleMinutes: "空闲触发(分钟)",
	f_toolOutputStorage: "工具输出存法",
	f_toolOutputOverrides: "按工具分流(每行 工具名=summary|head)",
	f_failedToolOutputChars: "失败输出截断(字符)",
	f_autoRecall: "自动召回注入",
	f_injectMaxItems: "单轮注入条数",
	f_injectMaxChars: "单轮注入字符",
	f_sessionInjectMaxChars: "会话注入总量",
	f_excerptChars: "片段裁剪(字符)",
	f_profileFile: "画像文件路径",
	f_profilePollSeconds: "手改探测间隔(秒)",

	// ── 26 个字段:说明 ─────────────────────────────────────────────────
	f_privateWorkspaces_desc: "只进不出:这些目录的记忆不在其它目录检索 / 注入;含 L0 热缓冲。",
	f_disabledWorkspaces_desc: "workspaceId 或其前缀;留空 = 全部启用。停用后不写记忆、不提炼、不召回、不注入。",
	f_sensitiveNoCross_desc: "默认关:自动敏感标记已停用(个人使用不需要)。打开后,标了 sensitive 的条目才不跨工作区注入。",
	f_sensitiveKeywords_desc: "默认空 = 不自动标记。要启用初筛时自己填词(可参考预设:健康 / 情绪 / 亲密关系 / 薪酬 / 人事 / 合同类)。",
	f_enabled_desc: "语义检索总开关;关掉后按纯 BM25 检索,不发 embedding 请求。",
	f_baseUrl_desc: "OpenAI 兼容端点,如 https://api.openai.com/v1;留空 = 纯 BM25。",
	f_modelId_desc: "embedding 模型;换模型后旧向量作废,后台自动重嵌入。",
	f_apiKeyEnv_desc: "只填变量名;值放 ~/.dsh/.credentials.yaml 或环境变量。",
	f_apiKeyOptional_desc: "本地无鉴权服务(自建 / Ollama)允许留空变量名与 Key;填了 Key 仍会发送。",
	f_timeoutMs_desc: "单次内联查询的份额;超时降级纯 BM25,不阻塞对话。",
	f_autoStartCommand_desc: "留空 = 不接管;填了则 dsh 启动时拉起、退出时回收(端口已被占用则不插手)。",
	f_autoStartWaitMs_desc: "拉起后等待端口就绪的审计窗口;超时只记一条 unready,不影响使用。",
	f_autoStartWarmup_desc: "拉起后立刻把模型拉进显存:第一条检索不再冷启动,代价是 dsh 运行期间占显存。",
	f_extractEnabled_desc: "慢速通道总开关;关掉后热缓冲不消化,长期记忆不再增长。",
	f_extractBatchTurns_desc: "每会话累计这么多轮触发一次提炼。",
	f_extractIdleMinutes_desc: "会话安静这么久后触发提炼。",
	f_toolOutputStorage_desc: "summary = 摘要;head = 保留前 500 字符。",
	f_toolOutputOverrides_desc: "搜索 / 表格类工具建议单独开大;不写的工具走上面的默认存法。",
	f_failedToolOutputChars_desc: "失败调用保留的字符数,便于复盘。",
	f_autoRecall_desc: "关闭后仍正常写记忆,只是对话里不自动注入;手动 memory_recall 工具照常可用。",
	f_injectMaxItems_desc: "一轮对话最多注入几条记忆;调大更容易注入过多。",
	f_injectMaxChars_desc: "单轮注入总字符上限;超限直接丢整条,不做截断。",
	f_sessionInjectMaxChars_desc: "整个会话的注入字符预算;用尽后只放行暂存 / 高证据的新记忆。",
	f_excerptChars_desc: "查询相关片段裁剪预算;越小越省 token,但上下文更碎。",
	f_profileFile_desc: "如 ~/.dsh/neural-mind-profile.md;这是画像的唯一真相源,手改后下一轮生效。",
	f_profilePollSeconds_desc: "改文件后下轮生效;设为 5 即每 5 秒最多查一次。",
};

const en = {
	// ── Status strip ───────────────────────────────────────────────────
	configTitle: "Configuration",
	configHint: "Changes save and apply immediately (the plugin hot-rebuilds). Reset restores a field to its composed default.",
	cfgService: "Settings",
	cfgServiceReady: "writable",
	cfgServiceReadonly: "read-only",
	cfgServiceLoading: "connecting…",
	cfgServiceUnavailable: "unavailable",
	cfgServiceHint: "The settings service is provided by DSH configForms; its state decides whether this page can write.",
	cfgAutoSave: "saved on change",
	cfgAutoSaveHint: "Every edit is written to the settings service right away. A failed write is shown in the banner below — never silently dropped.",
	cfgOverriddenCount: "{n} overridden",
	cfgOverriddenHint: "Overridden = you explicitly set it, hiding the composed default. Click Reset on that row to restore.",
	cfgFieldCount: "{n} settings",
	configUnavailable: "The settings service is not mounted yet; the plugin runs on cordis.patch.yml config.",
	configUnavailableHint: "Restart dsh and the form appears here. Fields stay hidden meanwhile so you never edit a phantom value.",
	configReadonly: "This page is read-only (not a loopback session, or the settings service is not ready); fields cannot be changed.",
	configWriteFailed: "The change did not take effect (rejected by the host, or the page is read-only).",
	cfgWriteError: "Write did not apply",

	// ── Diagnostics ────────────────────────────────────────────────────
	cfgDiagTitle: "Needs attention",
	cfgDiagSub: "Computed locally from current values — no requests. “Open” jumps to the matching group.",
	cfgDiagCount: "{n} to review",
	cfgDiagOk: "Config checks passed",
	cfgDiagOkHint: "Switches, endpoints and scope all look right; injection and the vector lane follow this config.",
	cfgDiagGo: "Open",
	cfgDiagVectorIncomplete: "Vector lane is on, but endpoint / model is incomplete",
	cfgDiagVectorIncompleteHint: "Without {missing} the vector lane silently falls back to BM25; filling it in restores hybrid retrieval.",
	cfgDiagVectorKey: "Vector lane has no credential name and keyless is off",
	cfgDiagVectorKeyHint: "An endpoint that needs auth will fail. Set a credential variable name, or enable “keyless local endpoint”.",
	cfgDiagVectorOff: "Vector lane off — BM25-only retrieval",
	cfgDiagVectorOffHint: "Keyword search still works, it just cannot match paraphrases. Turn it on and set an endpoint for semantic search.",
	cfgDiagVectorFailed: "Last vector request failed: {error}",
	cfgDiagVectorFailedHint: "Fell back to BM25 automatically; after fixing the endpoint, use Test connection under Vector search.",
	cfgDiagRecallOff: "Auto recall is off",
	cfgDiagRecallOffHint: "Memories are still written, but they never surface on their own. The manual memory_recall tool keeps working.",
	cfgDiagExtractOff: "Background extraction is off",
	cfgDiagExtractOffHint: "The hot buffer never digests, so long-term memory stops growing. Turn on Background extraction to digest it.",
	cfgDiagDisabledWs: "{n} workspaces disabled",
	cfgDiagDisabledWsHint: "Disabled workspaces are fully opted out: no writes, no extraction, no recall, no injection.",
	cfgDiagPrivate: "{n} private workspaces",
	cfgDiagPrivateHint: "Private workspaces are write-only: memories never inject across them. Just confirm this is intentional.",
	cfgDiagProfileEmpty: "Profile file is not configured",
	cfgDiagProfileEmptyHint: "The Profile tab stays empty. Set an md file path under User profile below.",
	cfgDiagMemoryOnly: "Storage is in-memory",
	cfgDiagMemoryOnlyHint: "Nothing is persisted this run, so a restart forgets everything. Everything else still works; storage persists once available.",
	cfgDiagNoWorkspace: "No workspaces recorded yet",
	cfgDiagNoWorkspaceHint: "The picker reads the DSH workspace registry; empty here means the registry is unavailable and no turn has been recorded yet.",
	cfgDiagBootFailed: "Memory turn pipeline not started: {error}",
	cfgDiagBootFailedHint: "The page still opens, but turns are never recorded (no workspaces or memories grow). Check the host stderr for [memory] lines; restarting the app or saving the config once triggers a rebuild.",

	// ── Directory / search ─────────────────────────────────────────────
	cfgSearchPlaceholder: "Search settings: name / description / key…",
	cfgSearchMatches: "{n} matches",
	cfgSearchEmpty: "No setting matches; try another keyword.",
	cfgExpandAll: "Expand all",
	cfgCollapseAll: "Collapse all",
	cfgGroupChanged: "{n} changed",
	cfgGroupCount: "{n} settings",
	cfgAdvancedHint: "Rarely needed: timeout, managed start, warmup",
	showAdvanced: "Show advanced options",
	hideAdvanced: "Hide advanced options",
	cfgKeyHint: "Config key (write path)",
	cfgNumberInvalid: "Enter a number; the previous value is kept",
	cfgNumberRequired: "Cannot be empty; the previous value is kept",
	cfgLinesPlaceholder: "One per line",
	cfgDictPlaceholder: "tool=summary|head, one per line",
	overridden: "overridden",
	cfgOverrideHint: "You set this explicitly (overrides the composed default)",
	reset: "Reset",
	cfgResetHint: "Restore the composed default",

	// ── Group titles ───────────────────────────────────────────────────
	groupPrivacy: "Privacy & scope",
	groupEmbedding: "Vector search",
	groupWrite: "Writing & extraction",
	groupInject: "Injection & recall",
	groupProfile: "User profile",

	// ── Workspace picker ───────────────────────────────────────────────
	cfgWsSearch: "Search workspaces (name / path)…",
	cfgWsSummary: "{total} known workspaces · {disabled} disabled",
	cfgWsCount: "{n} memories",
	cfgWsLastSeen: "last {time}",
	cfgWsNeverSeen: "no activity recorded",
	cfgWsEnableAll: "Enable all",
	cfgWsDisableAll: "Disable all",
	cfgWsPrefixHint: "Checked = enabled; unchecked = disabled. Writes go to disabledWorkspaces (prefixes supported).",
	cfgWsManual: "Add paths manually",
	cfgWsManualHint: "One workspaceId or prefix per line; empty = all enabled.",
	cfgWsManualCount: "{n} manual entries",
	cfgWsEmpty: "No known workspaces yet; add paths manually below",
	cfgWsNoMatch: "No workspace matches",
	cfgWsLoading: "Loading workspaces…",
	cfgWsError: "Failed to load workspaces",

	// ── Vector search: key management + connection test ────────────────
	embedKeyLabel: "API Key (write-only)",
	embedKeyHint: "Stored in DSH credentials; never echoed or written into plugin config.",
	embedKeySave: "Save key",
	embedKeyClear: "Clear stored key",
	embedKeySaved: "Key saved",
	embedKeyCleared: "Stored key cleared",
	embedKeyMissing: "Not configured; enter a key",
	embedKeyConfigured: "Configured",
	embedKeyNeedName: "Set and save a credential variable name above first, e.g. SILICONFLOW_API_KEY.",
	embedKeyOptionalNoName: "Keyless local endpoint is on: no name or key needed. Fill a name only if this endpoint needs auth.",
	embedKeyPlaceholderUpdate: "Configured; enter a new value to replace",
	embedKeyOptionalHint: "“Keyless local endpoint” is on, so this endpoint may leave the key empty",
	embedKeyUnavailable: "DSH credentials service unavailable; use an environment variable instead",
	cfgEmbedKeySource: "source {source}",
	embedTest: "Test embedding connection",
	embedTesting: "Testing…",
	embedTestHint: "Send one fixed short text to verify baseUrl / modelId / credentials; no memory is read or written.",
	embedTestDims: "dims",
	cfgEmbedFailed: "Connection failed",

	// ── Field labels ───────────────────────────────────────────────────
	f_privateWorkspaces: "Private workspaces (one per line)",
	f_disabledWorkspaces: "Disabled workspaces (one per line)",
	f_sensitiveNoCross: "No sensitive cross-workspace injection (off by default)",
	f_sensitiveKeywords: "Sensitive keywords (empty = no auto-marking)",
	f_enabled: "Enable vector lane",
	f_baseUrl: "Endpoint baseUrl",
	f_modelId: "Model id",
	f_apiKeyEnv: "Credential variable name",
	f_apiKeyOptional: "Keyless local endpoint",
	f_timeoutMs: "Query timeout (ms)",
	f_autoStartCommand: "Managed start command",
	f_autoStartWaitMs: "Readiness window (ms)",
	f_autoStartWarmup: "Warm up when ready",
	f_extractEnabled: "Background extraction",
	f_extractBatchTurns: "Batch turns",
	f_extractIdleMinutes: "Idle trigger (minutes)",
	f_toolOutputStorage: "Tool output storage",
	f_toolOutputOverrides: "Per-tool overrides (tool=summary|head per line)",
	f_failedToolOutputChars: "Failed output chars",
	f_autoRecall: "Automatic recall injection",
	f_injectMaxItems: "Max items / turn",
	f_injectMaxChars: "Max chars / turn",
	f_sessionInjectMaxChars: "Session inject budget",
	f_excerptChars: "Excerpt chars",
	f_profileFile: "Profile file path",
	f_profilePollSeconds: "File poll interval (s)",

	// ── Field descriptions ─────────────────────────────────────────────
	f_privateWorkspaces_desc: "Write-only: memories from these folders never search or inject elsewhere (incl. the L0 hot buffer).",
	f_disabledWorkspaces_desc: "workspaceId or a prefix; empty = all enabled. Disabled workspaces are never written, extracted, recalled or injected.",
	f_sensitiveNoCross_desc: "Off by default: automatic sensitive marking is disabled (personal single-user use). Turn on to keep sensitive-tagged entries from injecting across workspaces.",
	f_sensitiveKeywords_desc: "Empty by default = no auto-marking. Fill in keywords to enable the prescreen (presets: health / emotion / relationships / salary / HR / contracts).",
	f_enabled_desc: "Semantic search master switch; off means BM25-only, no embedding requests at all.",
	f_baseUrl_desc: "OpenAI-compatible endpoint, e.g. https://api.openai.com/v1; empty = BM25-only.",
	f_modelId_desc: "Embedding model; changing it voids old vectors and re-embeds in the background.",
	f_apiKeyEnv_desc: "Name only; the value lives in ~/.dsh/.credentials.yaml or the environment.",
	f_apiKeyOptional_desc: "Local servers without auth (self-hosted / Ollama) may leave name and key empty; a configured key is still sent.",
	f_timeoutMs_desc: "Inline share of one query; on timeout it falls back to BM25 without blocking the turn.",
	f_autoStartCommand_desc: "Empty = hands off; otherwise dsh starts it on boot and reclaims it on exit (never touches an occupied port).",
	f_autoStartWaitMs_desc: "Audit-only window after start; a timeout records one unready line and changes nothing.",
	f_autoStartWarmup_desc: "Load the model into VRAM right after start: the first search never pays the cold start, at the cost of VRAM while dsh runs.",
	f_extractEnabled_desc: "Slow-lane master switch; when off the hot buffer never digests and long-term memory stops growing.",
	f_extractBatchTurns_desc: "Turns accumulated per session before one extraction runs.",
	f_extractIdleMinutes_desc: "Extract after the session has been quiet this long.",
	f_toolOutputStorage_desc: "summary = digest; head = keep the first 500 chars.",
	f_toolOutputOverrides_desc: "Open up search / spreadsheet tools individually; tools not listed use the default above.",
	f_failedToolOutputChars_desc: "Chars kept from failed calls, for later review.",
	f_autoRecall_desc: "Off still records memories; it just stops auto-injection. The manual memory_recall tool keeps working.",
	f_injectMaxItems_desc: "How many memories may inject per turn; raising it makes over-injection more likely.",
	f_injectMaxChars_desc: "Total chars per turn; overflow drops whole memories instead of truncating.",
	f_sessionInjectMaxChars_desc: "Inject budget for the whole session; once spent, only staged / high-evidence new memories pass.",
	f_excerptChars_desc: "Excerpt budget for query-relevant snippets; smaller saves tokens but fragments context.",
	f_profileFile_desc: "e.g. ~/.dsh/neural-mind-profile.md; this file is the single source of truth, hand edits apply next turn.",
	f_profilePollSeconds_desc: "Hand edits apply next turn; 5 means at most one check per 5s.",
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/i18n/persona.js
	var mod_i18n_persona_js = (function () {
		var exps = {};
/**
 * 画像 & SOUL 面板词典(v1.15)。
 * 说明:v1.15 把画像/SOUL 旧词典(原 i18n/legacy.js)中仍被这两个面板引用的键**原样迁入**,
 * 保持 key 名不变(行为与文案承诺不变);新增的 per 前缀 / soul 前缀键补充在下方。legacy 文件已退役。
 */
const zh = {
	perPoll: "轮询间隔 {n}s",
	perInjected: "本轮注入 {n} 字符",
	perLimit: "上限 {n} 字符(每轮注入)",
	perOverLimit: "已超上限 {n} 字符,保存会被后端拒绝",
	perMissingTitle: "画像文件不存在",
	perMissing: "路径指向的文件不存在({path}),当前按空画像处理、不会注入任何内容。请检查路径是否写错(支持 ~/… 展开),或保存一次创建该文件。",
	perTruncatedTitle: "文件过大,只载入了前一段",
	perTruncated: "画像文件超过 {n} 字符上限,这里只载入前 {n} 字符;为避免覆盖丢掉尾部内容,保存已禁用——请先手动备份 / 精简源文件(或直接编辑文件)。",
	perUnconfigured: "画像文件还没配置",
	perGoConfig: "去配置画像文件",
	perEditorPlaceholder: "写下关于用户的事实、偏好与边界…",
	soulPreviewTitle: "当前版本",
	soulEmptyTitle: "还没有 SOUL",
	soulNoVersions: "还没有历史版本;保存一次就会留痕。",
	soulEditorPlaceholder: "写下人格设定:性格、信条、口吻…",
	soulOverLimit: "超过上限 {n} 字符,先精简再保存",
	profileTitle: "用户画像",
	profileHint: "每轮固定注入;唯一真相源是这个 md 文件,这里编辑即写回该文件。",
	profileSave: "保存",
	profileReload: "重新加载",
	profileUndo: "放弃修改",
	profileReloadBlocked: "有未保存修改;先保存或放弃再重新加载",
	profileSaved: "已保存",
	profileDirty: "未保存",
	profileEmpty: "还没有画像内容。",
	profileNoFile: "还没配置 profileFile(先在「配置 → L1 用户画像」里填文件路径)。",
	profileChars: "字符",
	soulTitle: "SOUL(自我设定)",
	soulMaster: "启用 SOUL 层",
	soulMasterHint: "关掉=整层停用:段不注入、提议通道一并停用、soul_propose 工具也不再注册(避免\"看得见却一调就被拒\")",
	soulSelfEdit: "允许提议",
	soulSelfEditDisabled: "总开关关闭时,提议一并停用",
	soulNoFile: "文件不存在",
	soulCharsUnit: "字符",
	soulTodayEdit: "今日提议",
	soulLastVersion: "最后一版",
	soulPreviewHint: "预览前 3 行",
	soulEdit: "编辑 →",
	soulRecentVersions: "最近 3 版",
	soulAllHistory: "全部历史 / 编辑 →",
	soulDiff: "diff",
	soulRollback: "回滚",
	soulEmptyBody: "还没有 SOUL。它是你自己的人格设定(性格、信条、口吻),跨会话、跨身份一致;agent 只能**提议**改写,你采纳才落笔,每个版本都会留痕。你可以现在写第一版,也可以留给它提。",
	soulCreate: "写第一版",
	soulFootHint: "SOUL 是人格设定,不是记忆:不进检索、不受遗忘机制处置。与系统人设、AGENTS.md、你当场的要求冲突时,一律以后者为准。",
	soulEditorTitle: "SOUL 编辑",
	soulEditorSub: "保存后会成为一个新版本(历史不删)",
	soulCancel: "取消",
	soulSave: "保存",
	soulClose: "关闭",
	soulSaved: "已保存",
	soulProposals: "人格提议",
	soulProposalHint: "自我校准的候选;**整篇**来自 agent(采纳前先看 diff),追加一句来自提炼器",
	soulProposalReplace: "整篇",
	soulProposalAppend: "追加",
	soulProposalView: "查看",
	soulProposalDiffTitle: "提议对比",
	soulProposalDiffHint: "采纳 = 用这份提议整篇替换当前 SOUL(旧内容进版本历史,可回滚);不采纳就忽略。",
	soulProposalAdoptHere: "采纳这份",
	soulAdopt: "采纳",
	soulIgnore: "忽略",
	soulAdopted: "已采纳",
	soulIgnored: "已忽略",
	soulUnsaved: "未保存",
	soulConfirm: "回滚到这一版之前?当前内容会被写回旧版并新增一版,历史不删。",
	soulConfirmOk: "确认回滚",
	soulDiffTitle: "与当前版本对比",
	soulDiffHint: "回滚会写回这一版的旧内容并新增一版;旧版本永远保留,可再回滚回来。",
	soulUnpersisted: "存储未落盘,历史不可用",
	soulVersionCount: "历史版本",
	soulAuthorAgent: "agent",
	soulAuthorUser: "用户",
	soulAuthorExternal: "外部",
};

const en = {
	perPoll: "polled every {n}s",
	perInjected: "{n} chars injected this turn",
	perLimit: "limit {n} chars (injected every turn)",
	perOverLimit: "Over the {n}-char limit; the backend will reject the save",
	perMissingTitle: "Profile file not found",
	perMissing: "The configured file does not exist ({path}), so the profile is treated as empty and nothing is injected. Check the path (~/… is supported), or save once to create the file.",
	perTruncatedTitle: "File too large; only the first part was loaded",
	perTruncated: "The profile file exceeds the {n}-char limit, so only the first {n} chars are loaded. Saving is disabled to avoid overwriting the rest of the file — back up or trim it manually first.",
	perUnconfigured: "No profile file configured",
	perGoConfig: "Open profile file settings",
	perEditorPlaceholder: "Facts, preferences and boundaries about the user…",
	soulPreviewTitle: "Current version",
	soulEmptyTitle: "No SOUL yet",
	soulNoVersions: "No versions yet; the first save starts the history.",
	soulEditorPlaceholder: "Write the character sheet: temperament, convictions, voice…",
	soulOverLimit: "Over the {n}-char limit; trim it before saving",
	profileTitle: "User profile",
	profileHint: "Pinned into every turn; the md file is the single source of truth — editing here writes it back.",
	profileSave: "Save",
	profileReload: "Reload",
	profileUndo: "Discard changes",
	profileReloadBlocked: "Unsaved changes; save or discard before reloading",
	profileSaved: "Saved",
	profileDirty: "Unsaved",
	profileEmpty: "No profile content yet.",
	profileNoFile: "profileFile is not configured (set it under Config → L1 profile first).",
	profileChars: "chars",
	soulTitle: "SOUL (self-setting)",
	soulMaster: "SOUL layer",
	soulMasterHint: "Off stops the whole layer: nothing injected, the proposal channel off, and the soul_propose tool is not registered at all",
	soulSelfEdit: "allow proposals",
	soulSelfEditDisabled: "proposals are off while the master switch is off",
	soulNoFile: "file missing",
	soulCharsUnit: "chars",
	soulTodayEdit: "proposals today",
	soulLastVersion: "last version",
	soulPreviewHint: "first 3 lines",
	soulEdit: "Edit →",
	soulRecentVersions: "Recent 3 versions",
	soulAllHistory: "All history / Edit →",
	soulDiff: "diff",
	soulRollback: "Roll back",
	soulEmptyBody: "No SOUL yet. It is your own character sheet (temperament, convictions, voice), identical across sessions and roles; the agent can only **propose** a rewrite, and it takes effect when you adopt it — every version is kept. Write the first version now, or let the agent propose one.",
	soulCreate: "Write the first version",
	soulFootHint: "SOUL is a character sheet, not memory: it is never retrieved and never expires. Where it conflicts with the system persona, AGENTS.md, or the user's in-conversation request, those always win.",
	soulEditorTitle: "Edit SOUL",
	soulEditorSub: "Saving creates a new version; history is never deleted",
	soulCancel: "Cancel",
	soulSave: "Save",
	soulClose: "Close",
	soulSaved: "Saved",
	soulProposals: "Persona proposals",
	soulProposalHint: "Candidates for self-correction; **full-text** ones come from the agent (you see a diff before adopting), single-sentence ones from extraction",
	soulProposalReplace: "full",
	soulProposalAppend: "append",
	soulProposalView: "View",
	soulProposalDiffTitle: "Proposal diff",
	soulProposalDiffHint: "Adopting replaces the whole SOUL with this text (the old content stays in history and can be rolled back); ignore to skip.",
	soulProposalAdoptHere: "Adopt this",
	soulAdopt: "Adopt",
	soulIgnore: "Ignore",
	soulAdopted: "Adopted",
	soulIgnored: "Ignored",
	soulUnsaved: "unsaved",
	soulConfirm: "Roll back to before this version? The current content is rewritten to the older one and a new version is added; nothing is deleted.",
	soulConfirmOk: "Confirm rollback",
	soulDiffTitle: "Against the current version",
	soulDiffHint: "A rollback writes the older content back and adds a new version; older versions stay, so you can roll forward again.",
	soulUnpersisted: "Storage is not persisted; history unavailable",
	soulVersionCount: "Versions",
	soulAuthorAgent: "agent",
	soulAuthorUser: "user",
	soulAuthorExternal: "external",
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/locale.js
	var mod_locale_js = (function () {
		var exps = {};
		var zhBase = mod_i18n_base_js["zh"];
		var enBase = mod_i18n_base_js["en"];
		var zhOverview = mod_i18n_overview_js["zh"];
		var enOverview = mod_i18n_overview_js["en"];
		var zhMemories = mod_i18n_memories_js["zh"];
		var enMemories = mod_i18n_memories_js["en"];
		var zhRecall = mod_i18n_recall_js["zh"];
		var enRecall = mod_i18n_recall_js["en"];
		var zhConfig = mod_i18n_config_js["zh"];
		var enConfig = mod_i18n_config_js["en"];
		var zhPersona = mod_i18n_persona_js["zh"];
		var enPersona = mod_i18n_persona_js["en"];
/**
 * 词典聚合入口:面板各自维护 `i18n/<panel>.js`,这里合并成宿主 `locale.register` 要的
 * `{ zh, en }`。合并顺序(后者覆盖前者):base(共享词)→ 各面板。
 *
 * 同名 key 由 `test/client-locale.test.mjs` 守着(base 与面板、面板与面板之间不允许无声覆盖)。
 * (v1.15 集成阶段已删除过渡期的 `i18n/legacy.js`:画像/SOUL 仍用的旧键已原样迁入 persona 片段。)
 */

const zh = {
	...zhBase,
	...zhOverview,
	...zhMemories,
	...zhRecall,
	...zhConfig,
	...zhPersona,
};

const en = {
	...enBase,
	...enOverview,
	...enMemories,
	...enRecall,
	...enConfig,
	...enPersona,
};
		exps["zh"] = zh;
		exps["en"] = en;
		return exps;
	})();
		//#endregion
		//#region lib/client/runtime.js
	var mod_runtime_js = (function () {
		var exps = {};
/**
 * 共享运行时与共享小组件。React 由模块加载器的 require 注入(浏览器半没有可按 ESM
 * 引的 react)。
 *
 * ## 为什么是 `react` 这一个稳定对象,而不是 `export let h`
 *
 * 曾用过 `export let h` + `initRuntime(React)` 的写法——在 ESM 下靠 live binding 成立,
 * 但本插件的浏览器半要经 `tools/build-client.mjs` 打成单文件 bundle(宿主
 * `dsh-client-modules` 直接 `readFileSync` 那个文件,不做编译),打包器若把导入做成
 * **求值期快照**,`h` 就会是 `undefined`,渲染时炸成 `h is not a function`(实测踩过)。
 *
 * 与其让打包器去复刻跨模块 live binding,不如把可变状态收进**一个对象**:
 * 对象引用是常量,属性读取天然是"当下"的值——打包器只需保证导入绑定是常量即可。
 */
const react = {
	h: undefined,
	useState: undefined,
	useEffect: undefined,
	useCallback: undefined,
	useSyncExternalStore: undefined,
};

function initRuntime(React) {
	react.h = React.createElement;
	react.useState = React.useState;
	react.useEffect = React.useEffect;
	react.useCallback = React.useCallback;
	react.useSyncExternalStore = React.useSyncExternalStore;
}

/**
 * 设置 namespace。0.2.0 里它不再由插件登记,而是**本插件的 profile entry id**
 * ——设置服务按 entry id 寻址(`ctx.configForms.get(entryId)`),`cordis.patch.yml`
 * 里插入的就是 `id: neural-mind`,两边必须是同一个字符串。
 */
const NS = "neural-mind";
const API_PATH = "/neural-mind/api";

// ── /neural-mind/api ─────────────────────────────────────────────────────────

async function api(action, payload) {
	const res = await fetch(API_PATH, {
		method: "POST",
		headers: { "content-type": "application/json", "x-neural-mind-client": "1" },
		body: JSON.stringify({ action, ...(payload ?? {}) }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok || body.ok !== true) throw new Error(body.error || ("HTTP " + res.status));
	return body;
}

const pathOf = (key) => key.split(".");
const getPath = (obj, path) => path.reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

/** 字段当前值 ↔ 编辑文本 的双向换算。 */
function toText(kind, value) {
	if (kind === "lines") return Array.isArray(value) ? value.join("\n") : "";
	if (kind === "dict") {
		return value && typeof value === "object"
			? Object.entries(value).map(([k, v]) => k + "=" + v).join("\n")
			: "";
	}
	return value === undefined || value === null ? "" : String(value);
}
function fromText(kind, text) {
	if (kind === "lines") return text.split("\n").map((s) => s.trim()).filter((s) => s !== "");
	if (kind === "dict") {
		const out = {};
		for (const line of text.split("\n")) {
			const at = line.indexOf("=");
			if (at <= 0) continue;
			const k = line.slice(0, at).trim();
			const v = line.slice(at + 1).trim();
			if (k !== "" && (v === "summary" || v === "head")) out[k] = v;
		}
		return out;
	}
	return text;
}

/** 草稿态输入:本地编辑,失焦/回车提交;外部值变化时回写。 */
function DraftInput({ value, onCommit, textarea, type, placeholder }) {
	const { h, useState, useEffect } = react;
	const [draft, setDraft] = useState(value);
	const [dirty, setDirty] = useState(false);
	useEffect(() => { if (!dirty) setDraft(value); }, [value, dirty]);
	const commit = () => {
		if (draft !== value) onCommit(draft);
		setDirty(false);
	};
	const props = {
		className: "mem-input",
		value: draft,
		placeholder,
		onChange: (e) => { setDraft(e.target.value); setDirty(true); },
		onBlur: commit,
		onKeyDown: (e) => { if (!textarea && e.key === "Enter") commit(); },
	};
	return textarea ? h("textarea", props) : h("input", { ...props, type: type ?? "text" });
}

/**
 * 带反馈的设置写入。
 *
 * 0.1.6 走 `ctx.settingsScope(ns).mutate(ops)`;0.2.0 换成 `ctx.configForms.get(entryId)`,
 * 拿到的是官方 ConfigFormController:`getSnapshot()` / `subscribe()` 读快照,
 * `set/unset/mutate(ops, expectedRevision)` 写。
 *
 * 写入判据**只认 `mutate` 的 boolean**(旧版那条"revision 没动也算失败"的栅栏本轮删掉了):
 *  (1) 官方控制器的 false 已覆盖所有真失败——`!response.ok` 时它自己 `recover()` 后返回 false,
 *      `persistence === "memory"`(非 loopback 页面)与 disposed 时直接 false;
 *  (2) revision 由**内容**决定(宿主 describe 的 `raw = JSON.stringify([fiber.uid, schema.toJSON(),
 *      entry.options.config])`,只有 raw 变了才 +1),所以**幂等写入会被宿主接受而 revision 不动**——
 *      数字框敲 `05`(当前值 5)、lines 域加个空行,旧判据都会假弹"写入失败"而值其实是对的。
 *      文本层那道 `draft !== value` 挡不住:归一化后相等、原文不等。
 *
 * 不传 `expectedRevision`:官方缺省取"队列执行那一刻的快照 revision",我们是失焦即提交
 * (不是暂存式编辑器),取最新才对;传编辑前读到的旧值反而会假冲突。
 *
 * ops 形状不变:仍是 `[{ op: "set" | "unset", path: string[], value? }]`——官方
 * `set(field, value)` 内部就是 `mutate([{ op:'set', path:[field], value }])`,
 * 而本插件的语义检索字段是嵌套路径(`semanticSearch.baseUrl`),所以直接走
 * `mutate` 的通用路径,和官方单个 set 是同一根线。
 */
function useSettingsWriter(form, t) {
	const { useState, useCallback } = react;
	const [error, setError] = useState("");
	const mutate = useCallback((ops) => {
		if (form == null) {
			setError(t("configUnavailable"));
			return Promise.resolve(false);
		}
		return Promise.resolve()
			.then(() => form.mutate(ops))
			.then((accepted) => setError(accepted === false ? t("configWriteFailed") : ""))
			.catch((e) => setError(String(e.message ?? e)));
	}, [form, t]);
	return { error, mutate };
}

// ── v1.15 记忆控制台的共享小工具 ──────────────────────────────────────────

/** class 名拼接:过滤 falsy。 */
function cx(...names) {
	return names.filter((name) => name !== undefined && name !== null && name !== false && name !== "").join(" ");
}

/** ISO 时间 → "YYYY-MM-DD HH:mm";无效值原样返回。 */
function fmtDateTime(value) {
	const at = parseIso(value);
	return at === null ? (value === undefined || value === null ? "—" : String(value)) : `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

/** ISO 时间 → "MM-DD HH:mm"(列表行用)。 */
function fmtShortTime(value) {
	const at = parseIso(value);
	return at === null ? "—" : `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

/** ISO 时间 → "HH:mm:ss"(注入日志用)。 */
function fmtClock(value) {
	const at = parseIso(value);
	return at === null ? "—" : `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`;
}

/** 相对时间(中文口语;词典未覆盖的语言仍按中文,面板需本地化时用 t("time*") 自行拼)。 */
function fmtAgo(value, nowMs = Date.now()) {
	const at = parseIso(value);
	if (at === null) return "—";
	const diff = Math.max(0, nowMs - at.getTime());
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} 天前`;
	return fmtShortTime(value);
}

/** 计数显示:≥1 万用 "1.2万"。 */
function fmtCount(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
	return String(n);
}

function pad2(n) {
	return String(n).padStart(2, "0");
}

function parseIso(value) {
	if (typeof value !== "string" || value === "") return null;
	const at = new Date(value);
	return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * 读一个 `/neural-mind/api` action 的状态容器:`{ data, error, loading, reload }`。
 *
 * 面板的常规姿势(与旧卡片手写 requestSeq 等价,但收敛到一处):
 *   const ov = useApi("overview", null, [refreshKey]);
 * `payload` 用 JSON 序列化参与依赖比较(对象字面量每次渲染都是新引用,不能直接进 deps)。
 * 卸载时自增内部序号,晚到的响应被丢弃(不 setState)。
 */
function useApi(action, payload, deps = []) {
	const { useState, useEffect, useCallback } = react;
	const [state, setState] = useState({ data: null, error: "", loading: true });
	const [seq] = useState(() => ({ n: 0 }));
	const payloadKey = JSON.stringify(payload ?? null);
	const run = useCallback(() => {
		const mine = ++seq.n;
		setState((prev) => ({ data: prev.data, error: "", loading: true }));
		api(action, payload ?? undefined)
			.then((data) => {
				if (mine !== seq.n) return;
				setState({ data, error: "", loading: false });
			})
			.catch((error) => {
				if (mine !== seq.n) return;
				setState({ data: null, error: String(error?.message ?? error), loading: false });
			});
	}, [action, payloadKey, ...deps]);
	useEffect(() => {
		run();
		return () => { seq.n += 1; };
	}, [run]);
	return { data: state.data, error: state.error, loading: state.loading, reload: run };
}

/** 复制到剪贴板;不可用时抛错,由调用方给失败提示。 */
async function copyText(text) {
	const value = String(text ?? "");
	if (typeof navigator === "undefined" || navigator.clipboard?.writeText === undefined) {
		throw new Error("clipboard unavailable");
	}
	await navigator.clipboard.writeText(value);
}
		exps["react"] = react;
		exps["initRuntime"] = initRuntime;
		exps["NS"] = NS;
		exps["API_PATH"] = API_PATH;
		exps["api"] = api;
		exps["pathOf"] = pathOf;
		exps["getPath"] = getPath;
		exps["toText"] = toText;
		exps["fromText"] = fromText;
		exps["DraftInput"] = DraftInput;
		exps["useSettingsWriter"] = useSettingsWriter;
		exps["cx"] = cx;
		exps["fmtDateTime"] = fmtDateTime;
		exps["fmtShortTime"] = fmtShortTime;
		exps["fmtClock"] = fmtClock;
		exps["fmtAgo"] = fmtAgo;
		exps["fmtCount"] = fmtCount;
		exps["useApi"] = useApi;
		exps["copyText"] = copyText;
		return exps;
	})();
		//#endregion
		//#region lib/client/components.js
	var mod_components_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var cx = mod_runtime_js["cx"];
/**
 * v1.15 记忆控制台共享原子组件。
 *
 * **用法约定(重要)**:本插件的迷你 hooks 渲染器(测试/预览)不会把 JSX 的"第三参数
 * children"挂到 props 上,所以**组合组件的内容必须显式放进 props**:
 *
 *   h(Card, { title: t("ovTitle"), children: [ ... ] })
 *
 * 而不是 `h(Card, { title }, [ ... ])`。DOM 元素(`div`/`span` 等)仍可正常用第三参数。
 * 所有组件都是纯函数,不调用 hooks(状态由面板自己管)。
 *
 * 图标一律内联 SVG + currentColor:不 require 宿主 `dsh-client-ui-primitives`
 * (官方纪律:插件自带控件,只共享主题令牌),也不引入图标库。
 */

// ── 图标 ─────────────────────────────────────────────────────────────────

const ICON_PATHS = {
	overview: [
		["rect", { x: "2.5", y: "2.5", width: "4.6", height: "4.6", rx: "1.1" }],
		["rect", { x: "8.9", y: "2.5", width: "4.6", height: "4.6", rx: "1.1" }],
		["rect", { x: "2.5", y: "8.9", width: "4.6", height: "4.6", rx: "1.1" }],
		["rect", { x: "8.9", y: "8.9", width: "4.6", height: "4.6", rx: "1.1" }],
	],
	memories: [
		["path", { d: "M2.5 5.4 8 2.6l5.5 2.8L8 8.2 2.5 5.4Z" }],
		["path", { d: "M2.5 8.4 8 11.2l5.5-2.8" }],
		["path", { d: "M2.5 11.2 8 14l5.5-2.8" }],
	],
	recall: [
		["circle", { cx: "7", cy: "7", r: "4.3" }],
		["path", { d: "m10.4 10.4 3.1 3.1" }],
		["path", { d: "M5.1 7.2h3.8M7 5.3v3.8" }],
	],
	config: [
		["path", { d: "M2.5 4.2h11M2.5 8h11M2.5 11.8h11" }],
		["circle", { cx: "6", cy: "4.2", r: "1.4", fill: "currentColor", stroke: "none" }],
		["circle", { cx: "10.4", cy: "8", r: "1.4", fill: "currentColor", stroke: "none" }],
		["circle", { cx: "5.4", cy: "11.8", r: "1.4", fill: "currentColor", stroke: "none" }],
	],
	profile: [
		["circle", { cx: "8", cy: "5.4", r: "2.7" }],
		["path", { d: "M2.8 13.4c.7-2.5 2.8-3.9 5.2-3.9s4.5 1.4 5.2 3.9" }],
	],
	soul: [
		["path", { d: "M8 13.4 3.3 8.8a2.9 2.9 0 0 1 4.1-4.1L8 5.2l.6-.5a2.9 2.9 0 0 1 4.1 4.1L8 13.4Z" }],
	],
	audit: [
		["rect", { x: "3.2", y: "2.6", width: "9.6", height: "10.8", rx: "1.4" }],
		["path", { d: "M5.8 5.8h4.4M5.8 8.2h4.4M5.8 10.6h2.8" }],
	],
	refresh: [
		["path", { d: "M13.2 8a5.2 5.2 0 1 1-1.6-3.8" }],
		["path", { d: "M13.4 2.8v3.2h-3.2" }],
	],
	search: [
		["circle", { cx: "7", cy: "7", r: "4.2" }],
		["path", { d: "m10.2 10.2 3.3 3.3" }],
	],
	close: [["path", { d: "m4 4 8 8M12 4l-8 8" }]],
	check: [["path", { d: "m3.2 8.4 3.1 3.1 6.5-7" }]],
	warn: [
		["path", { d: "M8 2.8 14 13H2L8 2.8Z" }],
		["path", { d: "M8 6.4v3.1" }],
		["circle", { cx: "8", cy: "11.5", r: ".7", fill: "currentColor", stroke: "none" }],
	],
	info: [
		["circle", { cx: "8", cy: "8", r: "5.6" }],
		["path", { d: "M8 7.2v4" }],
		["circle", { cx: "8", cy: "4.9", r: ".7", fill: "currentColor", stroke: "none" }],
	],
	chevron: [["path", { d: "m6 3.5 4.5 4.5L6 12.5" }]],
	copy: [
		["rect", { x: "5.2", y: "5.2", width: "8", height: "8", rx: "1.2" }],
		["path", { d: "M10.8 5.2V3.8a1.2 1.2 0 0 0-1.2-1.2H3.8a1.2 1.2 0 0 0-1.2 1.2v5.8a1.2 1.2 0 0 0 1.2 1.2h1.4" }],
	],
	database: [
		["ellipse", { cx: "8", cy: "4.1", rx: "5.2", ry: "1.9" }],
		["path", { d: "M2.8 4.1v7.8c0 1 2.3 1.9 5.2 1.9s5.2-.9 5.2-1.9V4.1" }],
		["path", { d: "M2.8 8c0 1 2.3 1.9 5.2 1.9s5.2-.9 5.2-1.9" }],
	],
	vector: [
		["circle", { cx: "4", cy: "11.6", r: "1.5" }],
		["circle", { cx: "8", cy: "4.4", r: "1.5" }],
		["circle", { cx: "12.4", cy: "10.6", r: "1.5" }],
		["path", { d: "m5.1 10.5 2.3-4.4M9.1 5.1l2.6 4.2M5.4 11.4l5.8-.6" }],
	],
	clock: [
		["circle", { cx: "8", cy: "8", r: "5.6" }],
		["path", { d: "M8 4.8V8l2.3 1.5" }],
	],
	spark: [["path", { d: "M8 2.4 9.3 6l3.6 1.3-3.6 1.3L8 12.2 6.7 8.6 3.1 7.3 6.7 6 8 2.4Z" }]],
	plus: [["path", { d: "M8 3.2v9.6M3.2 8h9.6" }]],
};

function Icon({ name, size = 16, className }) {
	const { h } = react;
	const parts = ICON_PATHS[name] ?? ICON_PATHS.info;
	const px = typeof size === "number" ? size : 16;
	return h("svg", {
		width: px,
		height: px,
		viewBox: "0 0 16 16",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.35,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		focusable: "false",
		className: cx("mem-icon", className),
	}, parts.map(([tag, attrs], index) => h(tag, { key: index, ...attrs })));
}

// ── 容器与版式 ────────────────────────────────────────────────────────────

function Card({ title, sub, actions, children, className }) {
	const { h } = react;
	const body = Array.isArray(children) ? children : (children === undefined ? [] : [children]);
	const head = title === undefined && actions === undefined
		? null
		: h("div", { className: "mem-card-head", key: "head" }, [
			h("div", { className: "mem-card-heading", key: "heading" }, [
				title === undefined ? null : h("h2", { className: "mem-card-title", key: "title" }, title),
				sub === undefined || sub === null || sub === "" ? null : h("div", { className: "mem-card-sub", key: "sub" }, sub),
			]),
			actions === undefined || actions === null ? null
				: h("div", { className: "mem-card-actions", key: "actions" }, Array.isArray(actions) ? actions : [actions]),
		]);
	return h("section", { className: cx("mem-card", className) }, head === null ? body : [head, ...body]);
}

function StatGrid({ children }) {
	const { h } = react;
	return h("div", { className: "mem-stat-grid" }, Array.isArray(children) ? children : [children]);
}

function Stat({ label, value, sub, tone, hint }) {
	const { h } = react;
	return h("div", { className: cx("mem-stat", tone === undefined ? null : "mem-stat-" + tone), title: hint ?? undefined }, [
		h("div", { className: "mem-stat-label", key: "label" }, label),
		h("div", { className: "mem-stat-value", key: "value" }, value === undefined || value === null ? "—" : value),
		sub === undefined || sub === null || sub === "" ? null : h("div", { className: "mem-stat-sub", key: "sub" }, sub),
	]);
}

function Toolbar({ children }) {
	const { h } = react;
	return h("div", { className: "mem-toolbar" }, Array.isArray(children) ? children : [children]);
}

function Section({ title, hint, count, actions, open = true, onToggle, children }) {
	const { h } = react;
	const body = Array.isArray(children) ? children : (children === undefined ? [] : [children]);
	const toggle = onToggle ?? (() => {});
	const head = h("div", { className: "mem-section-head", key: "head" }, [
		h("span", {
			key: "title",
			role: "button",
			tabIndex: 0,
			"aria-expanded": open,
			className: "mem-section-title",
			onClick: toggle,
			onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } },
		}, [
			h(Icon, { key: "chev", name: "chevron", size: 12, className: "mem-section-chev" }),
			h("span", { key: "text" }, title),
			count === undefined ? null : h("span", { className: "mem-section-count", key: "count" }, count),
		]),
		hint === undefined ? null : h("span", { className: "mem-section-hint", key: "hint" }, hint),
		actions === undefined || actions === null ? null
			: h("span", { className: "mem-section-actions", key: "actions" }, Array.isArray(actions) ? actions : [actions]),
	]);
	return h("div", { className: cx("mem-section", open ? "mem-section-open" : null) }, [
		head,
		open ? h("div", { className: "mem-section-body", key: "body" }, body) : null,
	]);
}

function Bar({ value, max = 1, tone }) {
	const { h } = react;
	const total = Number(max) > 0 ? Number(max) : 1;
	const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / total));
	return h("div", { className: cx("mem-bar", tone === undefined ? null : "mem-bar-" + tone) }, [
		h("div", { className: "mem-bar-fill", key: "fill", style: { width: Math.round(ratio * 1000) / 10 + "%" } }),
	]);
}

// ── 徽章 / 横幅 / 空态 / 骨架 ─────────────────────────────────────────────

function Chip({ tone = "muted", dot = true, children, title }) {
	const { h } = react;
	return h("span", {
		className: cx("mem-chip", "mem-chip-" + tone),
		title: title ?? undefined,
		"data-tone": tone,
	}, [
		dot ? h("span", { className: "mem-chip-dot", key: "dot", "aria-hidden": "true" }) : null,
		children === undefined || children === null ? null : h("span", { className: "mem-chip-text", key: "text" }, children),
	]);
}

function Badge({ tone = "muted", children, title }) {
	const { h } = react;
	return h("span", { className: cx("mem-badge", "mem-badge-" + tone), title: title ?? undefined }, children);
}

function Banner({ tone = "info", title, children, action }) {
	const { h } = react;
	const icon = tone === "ok" ? "check" : tone === "error" ? "warn" : tone === "warn" ? "warn" : "info";
	return h("div", { className: cx("mem-banner", "mem-banner-" + tone), role: tone === "error" ? "alert" : "status" }, [
		h(Icon, { key: "icon", name: icon, size: 15 }),
		h("div", { className: "mem-banner-main", key: "main" }, [
			title === undefined ? null : h("div", { className: "mem-banner-title", key: "title" }, title),
			children === undefined || children === null ? null : h("div", { className: "mem-banner-text", key: "text" }, children),
		]),
		action === undefined || action === null ? null : h("div", { className: "mem-banner-action", key: "action" }, action),
	]);
}

function Empty({ title, hint, action }) {
	const { h } = react;
	return h("div", { className: "mem-empty" }, [
		h(Icon, { key: "icon", name: "memories", size: 28, className: "mem-empty-icon" }),
		h("div", { className: "mem-empty-title", key: "title" }, title),
		hint === undefined || hint === null || hint === "" ? null : h("div", { className: "mem-empty-hint", key: "hint" }, hint),
		action === undefined || action === null ? null : h("div", { className: "mem-empty-action", key: "action" }, action),
	]);
}

function Skeleton({ lines = 3 }) {
	const { h } = react;
	const rows = [];
	for (let i = 0; i < Math.max(1, lines); i += 1) {
		rows.push(h("div", { className: "mem-skeleton-line", key: i, style: { width: 92 - (i % 3) * 16 + "%" } }));
	}
	return h("div", { className: "mem-skeleton", "aria-hidden": "true" }, rows);
}

function SearchBox({ value, onChange, onClear, placeholder, label }) {
	const { h } = react;
	return h("div", { className: "mem-search" }, [
		h(Icon, { key: "icon", name: "search", size: 14, className: "mem-search-icon" }),
		h("input", {
			key: "input",
			className: "mem-search-input",
			value,
			placeholder,
			"aria-label": label ?? placeholder,
			onChange: (e) => onChange(e.target.value),
		}),
		value === "" || value === undefined || value === null ? null : h("button", {
			key: "clear",
			type: "button",
			className: "mem-search-clear",
			"aria-label": "clear",
			onClick: () => (onClear ?? onChange)(""),
		}, "×"),
	]);
}
		exps["Icon"] = Icon;
		exps["Card"] = Card;
		exps["StatGrid"] = StatGrid;
		exps["Stat"] = Stat;
		exps["Toolbar"] = Toolbar;
		exps["Section"] = Section;
		exps["Bar"] = Bar;
		exps["Chip"] = Chip;
		exps["Badge"] = Badge;
		exps["Banner"] = Banner;
		exps["Empty"] = Empty;
		exps["Skeleton"] = Skeleton;
		exps["SearchBox"] = SearchBox;
		return exps;
	})();
		//#endregion
		//#region lib/client/overview-card.js
	var mod_overview_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var fmtCount = mod_runtime_js["fmtCount"];
		var fmtClock = mod_runtime_js["fmtClock"];
		var fmtShortTime = mod_runtime_js["fmtShortTime"];
		var Card = mod_components_js["Card"];
		var Stat = mod_components_js["Stat"];
		var StatGrid = mod_components_js["StatGrid"];
		var Chip = mod_components_js["Chip"];
		var Badge = mod_components_js["Badge"];
		var Banner = mod_components_js["Banner"];
		var Empty = mod_components_js["Empty"];
		var Skeleton = mod_components_js["Skeleton"];
		var Bar = mod_components_js["Bar"];
		var Icon = mod_components_js["Icon"];
/**
 * 总览面板(v1.15 记忆控制台首屏)。
 *
 * 一屏回答四个问题:记忆在工作吗(状态条 + 状态自检)、存了多少(KPI)、
 * 最近注入了什么 / 为什么没注入(最近注入 + 原因人话映射)、留下过什么痕迹
 * (记忆构成 + 最近审计)。
 *
 * 数据全部来自外壳统一下发的 `overview`({ data, error, loading, reload }),
 * 本面板不自己发请求;页头「刷新」由外壳自增 refreshKey 并重新拉取,新数据经
 * props 进来后自然重渲染。渲染是纯函数(不调 hooks),测试可直接灌数据。
 *
 * 文案原则:诚实(内存态要明说重启失忆)、不吓人(降级不是错误)、口语化。
 */

// SPEC §6.1:mode ∈ inject|resident|digest|skip;reason 仅 skip 有值。
const MODE_META = {
	inject: { key: "ovModeInject", tone: "info" },
	resident: { key: "ovModeResident", tone: "muted" },
	digest: { key: "ovModeDigest", tone: "info" },
	skip: { key: "ovModeSkip", tone: "warn" },
};

// SPEC §6.2 的 8 种 skip 原因 → 人话。未知原因原样显示,不猜测。
const REASON_KEY = {
	"workspace-disabled": "ovReasonWorkspaceDisabled",
	"auto-recall-off": "ovReasonAutoRecallOff",
	"no-query": "ovReasonNoQuery",
	pressure: "ovReasonPressure",
	"inline-timeout": "ovReasonInlineTimeout",
	"search-unavailable": "ovReasonSearchUnavailable",
	"no-hits": "ovReasonNoHits",
	subagent: "ovReasonSubagent",
};

const INJECT_LIMIT = 8;
const AUDIT_LIMIT = 6;

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** 会话 id 只留前 10 个字符:同一轮对话够区分,又不撑破一行。 */
function shortId(value) {
	const text = String(value ?? "");
	return text.length > 12 ? text.slice(0, 10) + "…" : text;
}

/** 质量分量展示:两位小数;缺失/脏值显示占位,不编造 0。 */
function fmtScore(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n.toFixed(2) : "—";
}

/** 工作区标签取路径末段(完整路径放 title 悬停)。 */
function shortWorkspace(value) {
	const text = String(value ?? "").trim();
	if (text === "") return "—";
	const parts = text.split(/[\\/]+/).filter((part) => part !== "");
	const base = parts.length > 0 ? parts[parts.length - 1] : text;
	return base.length > 18 ? base.slice(0, 17) + "…" : base;
}

function reasonText(t, reason) {
	const key = REASON_KEY[reason];
	return key === undefined ? String(reason) : t(key);
}

/**
 * 提炼开关兼容读法:overview 响应已带 `extract.enabled`(v1.15 数据面契约),正常走数据;
 * 这里只在旧响应/宿主未接线时退回配置表单快照。读不到就返回 undefined,不显示结论。
 */
function extractEnabledOf(form) {
	try {
		const snapshot = form?.getSnapshot?.();
		const value = snapshot?.value;
		return typeof value?.extractEnabled === "boolean" ? value.extractEnabled : undefined;
	} catch {
		// 表单服务不可用时按"未知"处理:总览只做提示,不能因为读配置失败让整张卡崩掉。
		return undefined;
	}
}

/**
 * 顶部单行健康摘要:shell 页头已有全局状态条(存储/向量路/自动召回/工作区),
 * 总览这里不再重复罗列,只回答"打开看板第一眼有没有要注意的"。
 */
function HealthSummaryLine({ t, items }) {
	const { h } = react;
	const warnings = items.filter((item) => item.tone === "warn").length;
	const infos = items.filter((item) => item.tone === "info").length;
	const tone = warnings > 0 ? "warn" : infos > 0 ? "info" : "ok";
	const text = warnings > 0
		? t("ovHealthTopWarn", { n: warnings })
		: infos > 0 ? t("ovHealthTopInfo", { n: infos }) : t("ovHealthTopOk");
	return h("div", { className: "ov-summary" }, h(Chip, { key: "chip", tone, dot: true, children: text }));
}

/** KPI 网格:长期记忆 / 热缓冲 / 提炼队列 / 向量覆盖 / 本次运行注入 / 工作区。 */
function Kpis({ t, data }) {
	const { h } = react;
	const stats = data.stats ?? {};
	const embedded = data.embedded ?? {};
	const embedding = data.embedding ?? {};
	const injection = data.injection ?? {};
	const counts = injection.counts ?? {};
	const workspaces = data.workspaces ?? {};

	const memoryTotal = num(stats.active) + num(stats.staged) + num(stats.archived);
	const hotUndigested = num(stats.hotUndigested);
	const dead = num(stats.outboxDead);

	// 向量覆盖:关掉时显示「未启用」而不是 0/0,避免看起来像故障。
	let embeddedValue;
	let embeddedSub;
	let embeddedTone;
	if (embedding.enabled !== true) {
		embeddedValue = t("ovKpiEmbeddedOff");
		embeddedSub = t("ovKpiEmbeddedHint");
		embeddedTone = "muted";
	} else {
		const records = num(embedded.records);
		const total = num(embedded.total);
		embeddedValue = total > 0 ? records + "/" + total : "—";
		embeddedSub = total > 0
			? [embedded.model, embedded.dimension ? embedded.dimension + "d" : ""]
				.filter((value) => value !== undefined && value !== null && value !== "").join(" · ")
			: t("ovKpiEmbeddedEmpty");
		embeddedTone = embedding.available === true ? undefined : "warn";
	}

	const cells = [
		h(Stat, {
			key: "memory",
			label: t("ovKpiLongTerm"),
			value: fmtCount(memoryTotal),
			sub: t("ovKpiLongTermSub", { active: num(stats.active), staged: num(stats.staged), archived: num(stats.archived) }),
		}),
		h(Stat, {
			key: "hot",
			label: t("ovKpiHot"),
			value: fmtCount(stats.hotTotal),
			sub: hotUndigested > 0 ? t("ovKpiHotSub", { n: hotUndigested }) : t("ovKpiHotClean"),
		}),
		h(Stat, {
			key: "outbox",
			label: t("ovKpiOutbox"),
			value: fmtCount(stats.outboxPending),
			sub: t("ovKpiOutboxSub", { pending: num(stats.outboxPending), dead: num(stats.outboxDead) }),
			tone: dead > 0 ? "warn" : undefined,
		}),
		h(Stat, {
			key: "vector",
			label: t("ovKpiEmbedded"),
			value: embeddedValue,
			sub: embeddedSub,
			tone: embeddedTone,
		}),
		h(Stat, {
			key: "injection",
			label: t("ovKpiInjection"),
			value: fmtCount(counts.inject),
			sub: t("ovKpiInjectionSub", { chars: fmtCount(counts.chars), records: fmtCount(counts.records) }),
		}),
		h(Stat, {
			key: "workspaces",
			label: t("ovKpiWorkspaces"),
			value: fmtCount(workspaces.total),
			sub: t("ovKpiWorkspacesSub", { enabled: num(workspaces.enabled), disabled: num(workspaces.disabled) }),
		}),
	];

	return h("div", { className: "ov-kpi" }, h(StatGrid, { children: cells }));
}

/** 状态自检清单:每项一行「状态点 + 标题 + 一句话说明」。 */
function healthItems({ t, data, form }) {
	const stats = data.stats ?? {};
	const embedding = data.embedding ?? {};
	const injection = data.injection ?? {};
	const workspaces = data.workspaces ?? {};
	const profile = data.profile ?? {};
	const soul = data.soul ?? {};
	const items = [];

	// 1) 存储是否落盘——内存态不是错误,但要明说重启会失忆。
	const persisted = stats.persisted === true;
	items.push({
		key: "storage",
		tone: persisted ? "ok" : "warn",
		title: t("ovCheckStorage"),
		desc: persisted ? t("ovCheckStorageOk") : t("ovCheckStorageWarn"),
	});

	// 2) 向量路:关闭 → 提示(降级不是错误);开着但不可用 → 注意,有 lastFailure 就带原因。
	if (embedding.enabled !== true) {
		items.push({
			key: "vector",
			tone: "info",
			title: t("ovCheckVector"),
			desc: t("ovCheckVectorOff"),
		});
	} else if (embedding.available === true) {
		items.push({
			key: "vector",
			tone: "ok",
			title: t("ovCheckVector"),
			desc: t("ovCheckVectorOk", { model: embedding.model ?? "—", dim: embedding.dimension ?? "—" }),
		});
	} else if (embedding.lastFailure !== undefined && embedding.lastFailure !== null && embedding.lastFailure !== "") {
		items.push({
			key: "vector",
			tone: "warn",
			title: t("ovCheckVector"),
			desc: t("ovCheckVectorFailure", { reason: String(embedding.lastFailure) }),
		});
	} else if (embedding.configured !== true) {
		items.push({
			key: "vector",
			tone: "warn",
			title: t("ovCheckVector"),
			desc: t("ovCheckVectorUnconfigured"),
		});
	} else {
		items.push({
			key: "vector",
			tone: "warn",
			title: t("ovCheckVector"),
			desc: t("ovCheckVectorNoKey"),
		});
	}

	// 3) 提炼:优先读 overview.extract.enabled(数据面),旧响应才退回配置快照兼容。
	const extract = data.extract ?? {};
	const extractEnabled = typeof extract.enabled === "boolean" ? extract.enabled : extractEnabledOf(form);
	const hotUndigested = num(stats.hotUndigested);
	const dead = num(stats.outboxDead);
	// R15a:上次整理的结果(什么时候/成功没/为什么失败)与本次运行的丢弃计数——
	// "没记住"从此是一个能解释的状态,而不是只能翻日志的玄学。
	const lastExtract = stats.lastExtract !== null && typeof stats.lastExtract === "object" ? stats.lastExtract : null;
	const lastFailed = lastExtract !== null && lastExtract.ok === false;
	if (extractEnabled === false) {
		items.push({
			key: "extract",
			tone: "warn",
			title: t("ovCheckExtract"),
			desc: t("ovCheckExtractOff"),
		});
	} else if (lastFailed) {
		items.push({
			key: "extract",
			tone: "warn",
			title: t("ovCheckExtract"),
			desc: t("ovCheckExtractFailed", {
				time: fmtShortTime(lastExtract.at),
				reason: typeof lastExtract.reason === "string" && lastExtract.reason !== "" ? lastExtract.reason : "—",
			}),
		});
	} else if (hotUndigested > 0) {
		items.push({
			key: "extract",
			tone: "warn",
			title: t("ovCheckExtract"),
			desc: t("ovCheckExtractBacklog", { n: hotUndigested }),
		});
	} else if (dead > 0) {
		items.push({
			key: "extract",
			tone: "warn",
			title: t("ovCheckExtract"),
			desc: t("ovCheckExtractDead", { n: dead }),
		});
	} else if (lastExtract !== null && lastExtract.ok === true) {
		items.push({
			key: "extract",
			tone: "ok",
			title: t("ovCheckExtract"),
			desc: t("ovCheckExtractLastOk", {
				time: fmtShortTime(lastExtract.at),
				turns: num(lastExtract.batchTurns),
				chars: fmtCount(lastExtract.chars),
			}),
		});
	} else {
		items.push({
			key: "extract",
			tone: "ok",
			title: t("ovCheckExtract"),
			desc: t("ovCheckExtractOk"),
		});
	}

	// 3b) 丢弃计数只在非零时多一行:是提示,不是故障;按原因分开说,不打包成"出错了"。
	const drops = stats.drops !== null && typeof stats.drops === "object" ? stats.drops : {};
	const dropTotal = num(drops.lowConfidence) + num(drops.injection) + num(drops.secret) + num(drops.oversized);
	if (dropTotal > 0) {
		items.push({
			key: "extractDrops",
			tone: "info",
			title: t("ovCheckExtractDrops"),
			desc: t("ovCheckExtractDropsDesc", {
				n: dropTotal,
				low: num(drops.lowConfidence),
				injection: num(drops.injection),
				secret: num(drops.secret),
				oversized: num(drops.oversized),
			}),
		});
	}

	// 4) 自动召回关闭 → 记忆照写,但对话里不会自动想起。
	const autoRecall = injection.autoRecall === true;
	items.push({
		key: "recall",
		tone: autoRecall ? "ok" : "warn",
		title: t("ovCheckRecall"),
		desc: autoRecall ? t("ovCheckRecallOk") : t("ovCheckRecallWarn"),
	});

	// 5) 停用工作区 → 只是提示(这是用户自己的选择)。
	const disabled = num(workspaces.disabled);
	items.push({
		key: "workspace",
		tone: disabled > 0 ? "info" : "ok",
		title: t("ovCheckWorkspace"),
		desc: disabled > 0 ? t("ovCheckWorkspaceInfo", { n: disabled }) : t("ovCheckWorkspaceOk"),
	});

	// 6) 画像未配置 → 提示(少一层用户偏好,不影响召回)。
	const profileConfigured = profile.configured === true;
	items.push({
		key: "profile",
		tone: profileConfigured ? "ok" : "info",
		title: t("ovCheckProfile"),
		desc: profileConfigured ? t("ovCheckProfileOk") : t("ovCheckProfileInfo"),
	});

	// 7) SOUL 关闭 → 提示(自改层停用,不影响主流程)。
	const soulEnabled = soul.enabled === true;
	items.push({
		key: "soul",
		tone: soulEnabled ? "ok" : "info",
		title: t("ovCheckSoul"),
		desc: soulEnabled
			? t("ovCheckSoulOk", { chars: num(soul.chars), versions: num(soul.versions) })
			: t("ovCheckSoulInfo"),
	});

	return items;
}

/** 自检明细卡:条目由顶部摘要统一算好传进来,避免同一份判定算两遍、说两遍。 */
function HealthCard({ t, items }) {
	const { h } = react;
	return h(Card, {
		title: t("ovHealthTitle"),
		sub: t("ovHealthSub"),
		children: [
			h("ul", { key: "list", className: "ov-health" }, items.map((item) => h("li", {
				key: item.key,
				className: "ov-health-row",
				"data-tone": item.tone,
			}, [
				h("span", {
					key: "dot",
					className: "ov-health-dot ov-health-dot-" + item.tone,
					"aria-hidden": "true",
				}),
				h("div", { key: "main", className: "ov-health-main" }, [
					h("span", { key: "title", className: "ov-health-title" }, item.title),
					h("span", { key: "desc", className: "ov-health-desc" }, item.desc),
				]),
			]))),
		],
	});
}

/** 一条注入记录:时间 + 模式徽章 + (跳过原因) + 条数/字符 + 工作区 + 会话短 id。 */
function InjectionRow({ t, entry }) {
	const { h } = react;
	const meta = MODE_META[entry.mode];
	const modeLabel = meta === undefined ? String(entry.mode ?? "—") : t(meta.key);
	const parts = [
		h("span", { key: "time", className: "ov-inj-time mem-mono" }, fmtClock(entry.ts)),
		h(Badge, { key: "mode", tone: meta === undefined ? "muted" : meta.tone, children: modeLabel }),
	];

	// reason 只在有值时展示(契约上仅 skip 有;这里防御性地兼容脏数据)。
	if (entry.reason !== undefined && entry.reason !== null && entry.reason !== "") {
		parts.push(h("span", {
			key: "reason",
			className: "ov-inj-reason",
		}, reasonText(t, entry.reason)));
	}

	parts.push(h("span", { key: "meta", className: "ov-inj-meta mem-num" }, [
		t("ovInjectRecords", { n: num(entry.records) }),
		" · ",
		t("ovInjectChars", { n: num(entry.chars) }),
	]));

	// §14 注入质量元数据(只记录):有则展示聚合相关度/可信度,没有不硬造。
	const quality = entry.quality;
	if (quality !== undefined && quality !== null) {
		parts.push(h("span", {
			key: "quality",
			className: "ov-inj-meta mem-num",
			title: t("ovInjectQualityHint"),
		}, t("ovInjectQuality", { r: fmtScore(quality.rAvg), c: fmtScore(quality.cAvg) })));
		if (num(quality.lowTrust) > 0) {
			parts.push(h("span", { key: "lowtrust", className: "ov-inj-reason mem-num" }, t("ovInjectLowTrust", { n: num(quality.lowTrust) })));
		}
	}

	if (entry.workspaceLabel !== undefined && entry.workspaceLabel !== null && entry.workspaceLabel !== "") {
		parts.push(h("span", {
			key: "workspace",
			className: "ov-inj-scope",
			title: String(entry.workspaceLabel),
		}, shortWorkspace(entry.workspaceLabel)));
	}
	if (entry.sessionId !== undefined && entry.sessionId !== null && entry.sessionId !== "") {
		parts.push(h("span", {
			key: "session",
			className: "ov-inj-session mem-mono",
			title: String(entry.sessionId),
		}, shortId(entry.sessionId)));
	}

	return h("div", {
		className: "ov-inj-row",
		"data-mode": entry.mode === undefined || entry.mode === null ? "unknown" : String(entry.mode),
	}, parts);
}

function InjectionCard({ t, data }) {
	const { h } = react;
	const injection = data.injection ?? {};
	const usage = data.usage ?? {};
	// §14:优先用落盘明细(跨重启可读);不可用/为空时退回进程内注入日志(本次运行)。
	const persisted = Array.isArray(usage.recent) && usage.available === true ? usage.recent : [];
	const sourceRows = persisted.length > 0 ? persisted : (Array.isArray(injection.recent) ? injection.recent : []);
	const recent = sourceRows.slice(0, INJECT_LIMIT);
	const counts = injection.counts ?? {};
	const injectCount = num(counts.inject);
	const residentCount = num(counts.resident);
	const skipCount = num(counts.skip);
	const total = injectCount + residentCount + skipCount;

	const actions = total === 0 ? undefined : [
		h(Badge, { key: "inject", tone: "info", children: t("ovModeInject") + " " + fmtCount(injectCount) }),
		h(Badge, { key: "resident", tone: "muted", children: t("ovModeResident") + " " + fmtCount(residentCount) }),
		h(Badge, { key: "skip", tone: "warn", children: t("ovModeSkip") + " " + fmtCount(skipCount) }),
		h(Badge, { key: "chars", tone: "muted", children: t("ovInjectChars", { n: fmtCount(counts.chars) }) }),
	];

	const body = recent.length === 0
		? h(Empty, { key: "empty", title: t("ovInjectEmpty"), hint: t("ovInjectEmptyHint") })
		: h("div", { key: "list", className: "ov-inj" }, recent.map((entry, index) => h(InjectionRow, {
			key: entry.id ?? index,
			t,
			entry,
		})));

	return h(Card, {
		title: t("ovInjectTitle"),
		sub: t("ovInjectSub"),
		actions,
		children: [body],
	});
}

/**
 * §14 用量卡:今日计数 + 质量均值 + 保留策略。只读、纯展示;
 * 观测不可用时如实说明"未落盘",不伪造趋势。
 */
function UsageCard({ t, data }) {
	const { h } = react;
	const usage = data.usage ?? {};
	const available = usage.available === true;
	const counters = usage.today !== null && typeof usage.today === "object" ? usage.today : {};
	const sumPrefix = (prefix) => Object.entries(counters)
		.filter(([key]) => key.startsWith(prefix))
		.reduce((total, [, value]) => total + num(value), 0);
	const inject = sumPrefix("inject.inject") + sumPrefix("inject.resident") + sumPrefix("inject.digest");
	const skip = sumPrefix("skip.");
	const extractOk = num(counters["extract.ok"]);
	const recall = num(counters["recall.calls"]);
	const rN = num(counters["inject.relevanceCount"]);
	const cN = num(counters["inject.confCount"]);
	const rAvg = rN > 0 ? num(counters["inject.relevanceSum"]) / rN : null;
	const cAvg = cN > 0 ? num(counters["inject.confSum"]) / cN : null;
	const retention = usage.retention ?? {};
	const meta = [
		rAvg === null ? "" : t("ovUsageRelevance", { v: fmtScore(rAvg) }),
		cAvg === null ? "" : t("ovUsageConfidence", { v: fmtScore(cAvg) }),
		t("ovUsageRetention", { d: num(retention.days) || 30, detail: num(retention.recentDays) || 7 }),
	].filter((part) => part !== "").join(" · ");
	const row = (key, label, value) => h("li", { key, className: "ov-audit-row" }, [
		h("span", { key: "label", className: "ov-audit-kind" }, label),
		h("span", { key: "value", className: "ov-audit-detail mem-num" }, fmtCount(value)),
	]);
	const body = available === false
		? h(Empty, { key: "empty", title: t("ovUsageUnavailable"), hint: t("ovUsageUnavailableHint") })
		: h("ul", { key: "list", className: "ov-audit-list" }, [
			row("inject", t("ovUsageInject"), inject),
			row("skip", t("ovUsageSkip"), skip),
			row("extract", t("ovUsageExtract"), extractOk),
			row("recall", t("ovUsageRecall"), recall),
			h("li", { key: "meta", className: "ov-audit-row" }, [
				h("span", { key: "label", className: "ov-audit-kind" }, t("ovUsageAvg")),
				h("span", { key: "value", className: "ov-audit-detail mem-num" }, meta),
			]),
		]);
	return h(Card, {
		title: t("ovUsageTitle"),
		sub: t("ovUsageSub"),
		children: [body],
	});
}

/** 一组「标签 + 计数 + 占比条」的横向分布。 */
function Dist({ t, title, rows }) {
	const { h } = react;
	const total = rows.reduce((sum, row) => sum + num(row.value), 0);
	return h("div", { className: "ov-comp" }, [
		h("div", { key: "title", className: "ov-comp-title" }, [
			h("span", { key: "label" }, title),
			h("span", { key: "total", className: "ov-comp-total mem-num" }, t("commonCount", { n: total })),
		]),
		h("div", { key: "rows", className: "ov-comp-list" }, rows.map((row) => h("div", {
			key: row.key,
			className: "ov-comp-row",
		}, [
			h("div", { key: "line", className: "ov-comp-line" }, [
				h("span", { key: "label", className: "ov-comp-label" }, row.label),
				h("span", { key: "count", className: "ov-comp-count mem-num" }, fmtCount(row.value)),
			]),
			h(Bar, { key: "bar", value: num(row.value), max: total > 0 ? total : 1, tone: row.tone }),
		]))),
	]);
}

/** 记忆构成:按 kind 与按 status 两个分布。 */
function CompositionCard({ t, data }) {
	const { h } = react;
	const kinds = data.kinds ?? {};
	const stats = data.stats ?? {};
	const kindRows = [
		{ key: "fact", label: t("ovKindFact"), value: num(kinds.fact), tone: undefined },
		{ key: "lesson", label: t("ovKindLesson"), value: num(kinds.lesson), tone: undefined },
		{ key: "episode", label: t("ovKindEpisode"), value: num(kinds.episode), tone: undefined },
	];
	const statusRows = [
		{ key: "active", label: t("ovStatusActive"), value: num(stats.active), tone: undefined },
		{ key: "staged", label: t("ovStatusStaged"), value: num(stats.staged), tone: "warn" },
		{ key: "archived", label: t("ovStatusArchived"), value: num(stats.archived), tone: "muted" },
	];

	return h(Card, {
		title: t("ovCompTitle"),
		sub: t("ovCompSub"),
		children: [
			h("div", { key: "grid", className: "ov-comp-grid" }, [
				h(Dist, { key: "kinds", t, title: t("ovCompKinds"), rows: kindRows }),
				h(Dist, { key: "status", t, title: t("ovCompStatus"), rows: statusRows }),
			]),
		],
	});
}

/** 最近审计:前 6 条;有 onNavigate 时底部按钮跳「审计」页签,否则给静态提示。 */
function AuditCard({ t, data, onNavigate }) {
	const { h } = react;
	const audit = data.audit ?? {};
	const recent = Array.isArray(audit.recent) ? audit.recent.slice(0, AUDIT_LIMIT) : [];

	const body = recent.length === 0
		? h(Empty, { key: "empty", title: t("ovAuditEmpty"), hint: t("ovAuditEmptyHint") })
		: h("ul", { key: "list", className: "ov-audit-list" }, recent.map((row, index) => h("li", {
			key: row.id ?? index,
			className: "ov-audit-row",
		}, [
			h("span", { key: "time", className: "ov-audit-time mem-mono" }, fmtShortTime(row.ts)),
			h("span", {
				key: "kind",
				className: "ov-audit-kind mem-mono",
				title: row.kind === undefined ? "" : String(row.kind),
			}, row.kind === undefined || row.kind === null ? "—" : String(row.kind)),
			h("span", { key: "detail", className: "ov-audit-detail" }, row.detail === undefined || row.detail === null ? "" : String(row.detail)),
		])));

	const footer = typeof onNavigate === "function"
		? h("div", { key: "foot", className: "ov-foot" }, h("button", {
			key: "jump",
			type: "button",
			className: "mem-btn",
			"data-action": "jump-audit",
			onClick: () => onNavigate("audit"),
		}, [
			h(Icon, { key: "icon", name: "audit", size: 14 }),
			h("span", { key: "label" }, t("ovJumpAudit")),
		]))
		: h("div", { key: "foot", className: "ov-foot ov-foot-hint mem-hint" }, t("ovJumpHint"));

	return h(Card, {
		title: t("ovAuditTitle"),
		sub: t("ovAuditSub"),
		children: [body, footer],
	});
}

/**
 * 总览卡入口。props 冻结(SPEC §3):`{ t, form, overview, refreshKey, onNavigate }`。
 * `refreshKey` 由外壳持有:刷新时外壳自增它并重新拉 overview,新 data 经 props 进来后
 * 自然重渲染——所以本组件不需要自己发请求,也不需要用 refreshKey 做副作用。
 * `form` 只作为旧响应的兼容兜底:提炼开关优先读 `overview.data.extract.enabled`(数据面),
 * 宿主还没下发该字段时才退回配置快照。
 */
function OverviewCard({ t, form, overview, refreshKey, onNavigate }) {
	const { h } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const state = overview ?? {};
	const data = state.data === undefined ? null : state.data;
	const error = typeof state.error === "string" ? state.error : "";

	// ① 错误:错误横幅 + 重试(重试调 overview.reload,不自己发请求)。
	if (error !== "") {
		const retry = typeof state.reload === "function"
			? h("button", {
				key: "retry",
				type: "button",
				className: "mem-btn",
				"data-action": "retry",
				onClick: () => state.reload(),
			}, tt("commonRetry"))
			: null;
		return h("div", { className: "ov" }, [
			h(Card, {
				key: "error",
				title: tt("navOverview"),
				children: [h(Banner, {
					key: "banner",
					tone: "error",
					title: tt("commonError"),
					children: error,
					action: retry,
				})],
			}),
		]);
	}

	// ② 数据未到(首屏/刷新中):骨架屏,不假装"一切正常"。
	if (data === null) {
		return h("div", { className: "ov" }, [
			h(Card, {
				key: "loading",
				title: tt("navOverview"),
				sub: tt("commonLoading"),
				children: [h(Skeleton, { key: "skeleton", lines: 6 })],
			}),
		]);
	}

	const stats = data.stats ?? {};
	const memoryTotal = num(stats.active) + num(stats.staged) + num(stats.archived);
	const hotTotal = num(stats.hotTotal);
	// 自检条目只算一次:顶部单行摘要与下方明细卡共用同一份判定。
	const health = healthItems({ t: tt, data, form });

	// ③ 长期池为空:不摆一堆 0,给一条"聊几轮就会进来"的引导(健康摘要仍然在)。
	if (memoryTotal === 0) {
		const hint = hotTotal > 0 ? tt("ovEmptyHotHint", { n: hotTotal }) : tt("ovEmptyHint");
		return h("div", { className: "ov" }, [
			h(HealthSummaryLine, { key: "summary", t: tt, items: health }),
			h(Card, {
				key: "empty",
				title: tt("navOverview"),
				children: [h(Empty, { key: "empty", title: tt("ovEmptyTitle"), hint })],
			}),
		]);
	}

	// ④ 正常看板:健康摘要 → KPI → 自检 → 最近注入 → 记忆构成 → 最近审计。
	return h("div", { className: "ov" }, [
		h(HealthSummaryLine, { key: "summary", t: tt, items: health }),
		h(Card, {
			key: "kpi",
			title: tt("ovKpiTitle"),
			sub: tt("ovKpiSub"),
			children: [h(Kpis, { key: "grid", t: tt, data })],
		}),
		h(HealthCard, { key: "health", t: tt, items: health }),
		h(InjectionCard, { key: "injection", t: tt, data }),
		h(UsageCard, { key: "usage", t: tt, data }),
		h(CompositionCard, { key: "composition", t: tt, data }),
		h(AuditCard, { key: "audit", t: tt, data, onNavigate }),
	]);
}
		exps.default = OverviewCard;
		exps["OverviewCard"] = OverviewCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/browse-card.js
	var mod_browse_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var api = mod_runtime_js["api"];
		var copyText = mod_runtime_js["copyText"];
		var fmtShortTime = mod_runtime_js["fmtShortTime"];
		var cx = mod_runtime_js["cx"];
		var Card = mod_components_js["Card"];
		var Banner = mod_components_js["Banner"];
		var Empty = mod_components_js["Empty"];
		var Skeleton = mod_components_js["Skeleton"];
		var Icon = mod_components_js["Icon"];
		var Chip = mod_components_js["Chip"];
		var Badge = mod_components_js["Badge"];
		var Toolbar = mod_components_js["Toolbar"];
		var SearchBox = mod_components_js["SearchBox"];
/**
 * 记忆管理台(v1.15):工具栏 → 状态/类型/工作区筛选 → 可扫读列表 → 独立详情。
 *
 * 与旧版(五卡页签时期)的区别:
 *  - 筛选维度从"只有状态"扩到 **状态 / 类型 / 工作区**;计数来自宿主 `list` 的 `facets`
 *    (关键词收窄之后、自身筛选之前统计,所以点进"暂存"不会把其它状态计数清零);
 *  - 排序(最新/最早/重要度)由宿主做,前端只管参数;
 *  - 详情按需 `api("detail",{id})` 拉全(证据时间线/文件锚/向量段数),列表行不再携带大字段;
 *  - 空态区分"池空 / 搜索无结果 / 筛选无记忆";暂存确认/拒绝在列表与详情都可操作。
 *
 * 纯展示 + 一个请求序号(切筛选/搜索时丢弃过期响应),不使用共享 `useApi`:本页要自己
 * 控制"追加加载"与防抖,手写 effect 更直白。
 */

const PAGE = 50;
const STATUS_TABS = [
	["all", "memAll"],
	["active", "memActive"],
	["staged", "memStaged"],
	["archived", "memArchived"],
];
const KIND_TABS = [
	["", "memKindAll"],
	["fact", "memKindFact"],
	["lesson", "memKindLesson"],
	["episode", "memKindEpisode"],
];
const SORTS = [
	["new", "memSortNew"],
	["old", "memSortOld"],
	["importance", "memSortImportance"],
];
const TEMPORAL_KEY = { pattern: "memTemporalPattern", state: "memTemporalState", episode: "memTemporalEpisode" };
const SOURCE_KEY = { user: "memSourceUser", assistant: "memSourceAssistant", code: "memSourceCode", tool: "memSourceTool", quote: "memSourceQuote", unknown: "memSourceUnknown", confirmed: "memSourceConfirmed" };
/** R13b:来源档位优先(界面确认"你确认过" / 旧数据"来源查不清"),没给档位时回退原始 source。 */
const sourceTextKey = (row) => SOURCE_KEY[row?.sourceTier ?? row?.source] ?? "memSourceAssistant";

/** 状态/隐私徽章:与旧版同语义,颜色走 base 的 tone 类。 */
function MemoryBadges({ row, t }) {
	const { h } = react;
	return [
		row.status === "hot" ? h(Badge, { key: "ho", tone: "info", children: t("memBadgeHot") }) : null,
		row.status === "staged" ? h(Badge, { key: "st", tone: "warn", title: t("memBadgeStagedHint"), children: t("memBadgeStaged") }) : null,
		row.status === "archived" ? h(Badge, { key: "ar", tone: "muted", children: t("memBadgeArchived") }) : null,
		row.sensitive === true ? h(Badge, { key: "se", tone: "warn", children: "sensitive" }) : null,
		row.private === true ? h(Badge, { key: "pr", tone: "info", title: t("memBadgePrivateHint"), children: t("memBadgePrivate") }) : null,
		row.hidden === true ? h(Badge, { key: "hi", tone: "error", title: t("memBadgeHiddenHint"), children: t("memBadgeHidden") }) : null,
		row.entity === "soul" ? h(Badge, { key: "so", tone: "info", title: t("memBadgeSoulHint"), children: t("memBadgeSoul") }) : null,
	];
}

/** 暂存行的「确认 / 拒绝」;点击不能冒泡成"打开详情"。 */
function StagedActions({ row, t, busy, act }) {
	const { h } = react;
	if (row.status !== "staged" || row.entity === "soul") return [];
	return [
		h("button", {
			key: "ok",
			type: "button",
			className: "mem-btn mem-btn-primary mem-btn-sm",
			disabled: busy === true,
			onClick: (event) => { event.stopPropagation(); act("confirm", row); },
		}, t("memConfirm")),
		h("button", {
			key: "no",
			type: "button",
			className: "mem-btn mem-btn-sm",
			disabled: busy === true,
			onClick: (event) => { event.stopPropagation(); act("reject", row); },
		}, t("memReject")),
	];
}

/**
 * R1a:详情页的手动操作——停用/恢复、标敏感/不敏感、彻底隐藏、展开来源轮次。
 *  - 彻底隐藏不可逆,所以要**二次确认**(第一次点击只把按钮换成"再点一次确认…");
 *  - `hb_…` 热缓冲条目只读:只给"展开来源轮次";
 *  - 已彻底隐藏的条目不提供任何操作。
 */
function MemoryActions({ data, t, busy, act, hideConfirm, onConfirmHide, onExpand }) {
	const { h } = react;
	const actions = [];
	const readOnly = data.readOnly === true || data.status === "hot";
	if (data.hidden !== true && data.sourceExpandable === true) {
		actions.push(h("button", {
			key: "expand",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-action": "memory-expand",
			disabled: busy === true,
			onClick: () => onExpand(data),
		}, t("memExpandSource")));
	}
	if (!readOnly && data.hidden !== true) {
		if (data.status === "archived") {
			actions.push(h("button", {
				key: "restore",
				type: "button",
				className: "mem-btn mem-btn-sm",
				"data-action": "memory-restore",
				disabled: busy === true,
				onClick: () => act("restore", data),
			}, t("memRestore")));
		} else {
			actions.push(h("button", {
				key: "archive",
				type: "button",
				className: "mem-btn mem-btn-sm",
				"data-action": "memory-archive",
				disabled: busy === true,
				onClick: () => act("archive", data),
			}, t("memArchive")));
		}
		actions.push(h("button", {
			key: "sensitive",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-action": "memory-sensitive",
			disabled: busy === true,
			onClick: () => act("sensitive", data, { sensitive: data.sensitive !== true }),
		}, data.sensitive === true ? t("memUnmarkSensitive") : t("memMarkSensitive")));
		const confirming = hideConfirm === data.id;
		actions.push(h("button", {
			key: "hide",
			type: "button",
			className: cx("mem-btn mem-btn-sm", confirming ? "mem-btn-danger" : null),
			"data-action": "memory-hide",
			disabled: busy === true,
			title: t("memHideHint"),
			onClick: () => (confirming ? act("hide", data) : onConfirmHide(data.id)),
		}, confirming ? t("memHideConfirm") : t("memHide")));
	}
	return actions;
}

function MemoryRow({ row, t, busy, act, onOpen }) {
	const { h } = react;
	const open = () => onOpen(row);
	return h("div", {
		className: "mem-item",
		role: "button",
		tabIndex: 0,
		"data-memory": row.id,
		onClick: open,
		onKeyDown: (event) => {
			// 行内按钮的 Enter 不能顺带打开详情:只认行本身获得焦点时的键
			if (event.target !== event.currentTarget) return;
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			open();
		},
	}, [
		h("div", { className: "mem-item-main", key: "main" }, [
			h("div", { className: "mem-item-content", key: "content" }, row.content),
			h("div", { className: "mem-item-meta", key: "meta" }, [
				h("span", { className: "mem-item-badges", key: "badges" }, MemoryBadges({ row, t })),
				h("span", { key: "domain", className: "mem-item-workspace" }, row.workspaceLabel ?? row.workspaceId ?? "—"),
				h("span", { key: "kind" }, t(KIND_TABS.find((pair) => pair[0] === row.kind)?.[1] ?? "memKindAll")),
				row.source === undefined ? null : h("span", { key: "source" }, t(sourceTextKey(row))),
				row.importance === undefined ? null : h("span", { key: "imp", className: "mem-item-num" }, "★" + row.importance),
				h("span", { key: "time", className: "mem-item-time" }, fmtShortTime(row.eventTime ?? row.createdAt)),
				row.score === undefined ? null : h("span", { key: "score", className: "mem-item-num" }, t("memScore") + " " + row.score),
			]),
		]),
		h("div", { className: "mem-item-end", key: "end" }, [
			h("div", { className: "mem-item-actions", key: "actions" }, StagedActions({ row, t, busy, act })),
			h(Icon, { key: "chev", name: "chevron", size: 14, className: "mem-item-chevron" }),
		]),
	]);
}

/** 详情里一行"标签:值"。 */
function Fact({ label, value, mono }) {
	const { h } = react;
	return h("div", { className: "mem-fact" }, [
		h("dt", { key: "l" }, label),
		h("dd", { key: "v", className: cx("mem-fact-value", mono ? "mem-mono" : null) }, value),
	]);
}

function MemoryDetail({ row, t, busy, act, onBack, detail, onRetry, copied, onCopy, hideConfirm, onConfirmHide, onExpand, expand }) {
	const { h } = react;
	const data = detail.row ?? row;
	const evidence = Array.isArray(detail.data?.row?.evidence) ? detail.data.row.evidence : [];
	const statusText = data.status === "hot"
		? t("memBadgeHot")
		: data.status === "staged" ? t("memBadgeStaged") : data.status === "archived" ? t("memBadgeArchived") : t("memActive");
	const factRows = [
		[h(Fact, { key: "status", label: t("memFieldStatus"), value: statusText + (data.hidden === true ? " · " + t("memBadgeHidden") : "") })],
		[h(Fact, { key: "kind", label: t("memFieldKind"), value: t(KIND_TABS.find((pair) => pair[0] === data.kind)?.[1] ?? "memKindAll") })],
		[h(Fact, { key: "source", label: t("memFieldSource"), value: data.source === undefined ? "—" : t(sourceTextKey(data)) })],
		[h(Fact, { key: "entity", label: t("memFieldEntity"), value: data.entity ?? "—", mono: true })],
		[h(Fact, { key: "workspace", label: t("memFieldWorkspace"), value: data.workspaceLabel ?? data.workspaceId ?? "—" })],
		[h(Fact, { key: "temporal", label: t("memFieldTemporal"), value: data.temporal === undefined ? "—" : t(TEMPORAL_KEY[data.temporal] ?? "memTemporalPattern") })],
		[h(Fact, { key: "importance", label: t("memFieldImportance"), value: data.importance === undefined ? "—" : String(data.importance) })],
		[h(Fact, { key: "created", label: t("memFieldCreated"), value: fmtShortTime(data.createdAt) })],
		[h(Fact, { key: "event", label: t("memFieldEventTime"), value: fmtShortTime(data.eventTime) })],
		[h(Fact, { key: "valid", label: t("memFieldValidUntil"), value: data.validUntil ?? data.expiresAt ?? "—" })],
		[h(Fact, { key: "confidence", label: t("memFieldConfidence"), value: typeof data.confidence === "number" ? data.confidence.toFixed(2) : "—" })],
		[h(Fact, { key: "embed", label: t("memFieldEmbedding"), value: detail.loading ? "…" : (detail.data?.row?.chunkCount === undefined ? "—" : String(detail.data.row.chunkCount) + " " + t("memChunks")) })],
		[h(Fact, { key: "id", label: t("memFieldId"), value: data.id, mono: true })],
	];
	if (data.supersededBy !== undefined) factRows.push([h(Fact, { key: "superseded", label: t("memFieldSupersededBy"), value: data.supersededBy, mono: true })]);
	// R1a:来源追溯——会话与原文区间(旧数据没有来源时不摆空行)
	if (typeof data.sessionId === "string" && data.sessionId !== "") {
		factRows.push([h(Fact, { key: "session", label: t("memFieldSession"), value: data.sessionId, mono: true })]);
	}
	if (data.sourceRange !== undefined && data.sourceRange !== null) {
		factRows.push([h(Fact, {
			key: "range",
			label: t("memFieldSourceRange"),
			value: String(data.sourceRange.startSeq) + "–" + String(data.sourceRange.endSeq),
			mono: true,
		})]);
	}
	if (data.turn !== undefined) factRows.push([h(Fact, { key: "turn", label: t("memFieldTurn"), value: String(data.turn) })]);
	if (Array.isArray(detail.data?.row?.filePaths) && detail.data.row.filePaths.length > 0) {
		factRows.push([h(Fact, { key: "files", label: t("memFieldFiles"), value: detail.data.row.filePaths.join("\n"), mono: true })]);
	}

	const evidenceBlock = detail.loading
		? h(Skeleton, { key: "ev-loading", lines: 2 })
		: detail.error !== ""
			? h(Banner, {
				key: "ev-error",
				tone: "error",
				title: t("memDetailError"),
				children: detail.error,
				action: h("button", { type: "button", className: "mem-btn", onClick: onRetry }, t("memRetry")),
			})
			: evidence.length === 0
				? h("div", { className: "mem-hint", key: "ev-empty" }, t("memEvidenceEmpty"))
				: h("ol", { className: "mem-evidence", key: "ev" }, evidence.map((event, index) => h("li", { key: index, className: "mem-evidence-row" }, [
					h("span", { key: "ts", className: "mem-evidence-ts" }, fmtShortTime(event.ts)),
					h("span", {
						key: "kind",
						className: cx("mem-evidence-kind", event.kind === "challenge" ? "mem-evidence-challenge" : null),
					}, event.kind === "challenge" ? t("memEvidenceChallenge") : t("memEvidenceReinforce")),
					h("span", { key: "w", className: "mem-evidence-w" }, t("memEvidenceWeight") + " " + event.weight),
				])));

	return h("div", { className: "mem-detail" }, [
		h("div", { className: "mem-detail-head", key: "head" }, [
			h("button", { type: "button", className: "mem-back", key: "back", onClick: onBack }, "← " + t("memBack")),
			h("span", { className: "mem-detail-title", key: "title" }, t("memDetailTitle")),
			h("div", { className: "mem-detail-actions", key: "actions" }, [
				h("button", {
					type: "button",
					className: "mem-btn mem-btn-sm",
					key: "copy-id",
					onClick: () => onCopy(data.id),
				}, copied === data.id ? t("memCopied") : t("memCopyId")),
				h("button", {
					type: "button",
					className: "mem-btn mem-btn-sm",
					key: "copy-content",
					onClick: () => onCopy(data.content, true),
				}, copied === "content" ? t("memCopied") : t("memCopyContent")),
				...StagedActions({ row: data, t, busy, act }),
				...MemoryActions({ data, t, busy, act, hideConfirm, onConfirmHide, onExpand }),
			]),
		]),
		detail.error === "" ? null : h(Banner, {
			key: "detail-error",
			tone: "error",
			title: t("memDetailError"),
			children: detail.error,
			action: h("button", { type: "button", className: "mem-btn", onClick: onRetry }, t("memRetry")),
		}),
		h("div", { className: "mem-detail-card", key: "body" }, [
			h("div", { className: "mem-detail-badges", key: "badges" }, MemoryBadges({ row: data, t })),
			h("div", { className: "mem-detail-content", key: "content" }, data.content),
			data.status === "staged"
				? h("div", { className: "mem-hint", key: "hint" }, data.entity === "soul" ? t("memBadgeSoulHint") : t("memStagedHint"))
				: null,
			data.readOnly === true ? h("div", { className: "mem-hint", key: "readonly" }, t("memReadOnlyHint")) : null,
		]),
		h("div", { className: "mem-detail-card", key: "facts" }, [
			h("div", { className: "mem-detail-section", key: "title" }, t("memFieldFacts")),
			h("dl", { className: "mem-facts", key: "dl" }, factRows.map(([node]) => node)),
		]),
		h("div", { className: "mem-detail-card", key: "evidence" }, [
			h("div", { className: "mem-detail-section", key: "title" }, t("memEvidenceTitle")),
			evidenceBlock,
		]),
		// R1a:展开来源轮次(只读;hard forget 的区间已由宿主过滤)
		expand !== undefined && expand.open === true
			? h("div", { className: "mem-detail-card", key: "expand" }, [
				h("div", { className: "mem-detail-section", key: "title" }, t("memExpandedTitle")),
				h("div", { className: "mem-hint", key: "hint" }, t("memExpandedHint")),
				expand.loading === true
					? h(Skeleton, { key: "loading", lines: 3 })
					: expand.error !== ""
						? h(Banner, { key: "error", tone: "error", title: t("memExpandedError"), children: expand.error })
						: h("pre", { key: "text", className: "mem-expand-body" }, expand.text),
			])
			: null,
	]);
}

function BrowseCard({ t, refreshKey }) {
	const { h, useState, useEffect, useCallback } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const [rows, setRows] = useState([]);
	const [total, setTotal] = useState(0);
	const [facets, setFacets] = useState(null);
	const [status, setStatus] = useState("all");
	const [kind, setKind] = useState("");
	const [workspaceId, setWorkspaceId] = useState("");
	const [sort, setSort] = useState("new");
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selected, setSelected] = useState(null);
	const [detail, setDetail] = useState({ loading: false, error: "", row: null, data: null });
	const [busyId, setBusyId] = useState("");
	const [copied, setCopied] = useState("");
	// R1a:彻底隐藏的二次确认(只对当前这条详情生效)与"展开来源轮次"的展开态
	const [hideConfirm, setHideConfirm] = useState("");
	const [expand, setExpand] = useState({ open: false, loading: false, error: "", text: "" });
	const [seq] = useState(() => ({ n: 0 }));

	const reload = useCallback((offset = 0) => {
		const mine = ++seq.n;
		setLoading(true);
		setError("");
		api("list", {
			status: status === "all" ? undefined : status,
			kind: kind === "" ? undefined : kind,
			workspaceId: workspaceId === "" ? undefined : workspaceId,
			query: query.trim() === "" ? undefined : query.trim(),
			sort,
			offset,
			limit: PAGE,
		})
			.then((body) => {
				if (mine !== seq.n) return;
				setRows((prev) => (offset === 0 ? body.rows : prev.concat(body.rows)));
				setTotal(body.total);
				if (body.facets !== undefined) setFacets(body.facets);
				setLoading(false);
			})
			.catch((reason) => {
				if (mine !== seq.n) return;
				setError(String(reason?.message ?? reason));
				setLoading(false);
			});
	}, [status, kind, workspaceId, sort, query, seq]);

	// 搜索防抖 250ms;筛选/排序/页头刷新立即拉取。
	useEffect(() => {
		if (query.trim() === "") {
			reload(0);
			return undefined;
		}
		const timer = setTimeout(() => reload(0), 250);
		return () => clearTimeout(timer);
	}, [reload, refreshKey]);

	const applyDetail = (data) => {
		// 旧响应/异常响应没有 row 时保留当前行,不能把 selected 打成 undefined(否则详情页头部崩)
		const row = data !== null && typeof data === "object" && data.row !== null && typeof data.row === "object"
			? data.row
			: selected;
		setSelected(row);
		setDetail({ loading: false, error: "", row, data });
	};
	const openDetail = (row) => {
		setSelected(row);
		setHideConfirm("");
		setExpand({ open: false, loading: false, error: "", text: "" });
		setDetail({ loading: true, error: "", row, data: null });
		api("detail", { id: row.id })
			.then((data) => {
				if (data.ok !== true) throw new Error(data.error ?? tt("memDetailError"));
				applyDetail(data);
			})
			.catch((reason) => setDetail({ loading: false, error: String(reason?.message ?? reason), row, data: null }));
	};
	const retryDetail = () => {
		if (selected !== null) openDetail(selected);
	};
	const back = () => {
		setSelected(null);
		setHideConfirm("");
		setExpand({ open: false, loading: false, error: "", text: "" });
		setDetail({ loading: false, error: "", row: null, data: null });
	};

	/** 操作成功后重拉详情(状态/标记变了,按钮和徽章要跟着变,别退回列表)。 */
	const refreshSelected = (id) => {
		api("detail", { id })
			.then((data) => {
				if (data.ok !== true) throw new Error(data.error ?? tt("memDetailError"));
				applyDetail(data);
			})
			.catch((reason) => setDetail({ loading: false, error: String(reason?.message ?? reason), row: selected, data: null }));
	};

	const act = (action, row, extra) => {
		setBusyId(row.id);
		setHideConfirm("");
		api(action, { id: row.id, ...(extra ?? {}) })
			.then(() => {
				setBusyId("");
				// 暂存确认/拒绝沿用旧行为(关闭详情);停用/恢复/改标记/隐藏留在详情里刷新
				if (selected !== null && selected.id === row.id) {
					if (action === "confirm" || action === "reject") back();
					else refreshSelected(row.id);
				}
				reload(0);
			})
			.catch((reason) => {
				setBusyId("");
				setError(tt("memActionFailed") + ": " + String(reason?.message ?? reason));
			});
	};

	/** 展开来源轮次:用户显式查看才发请求;失败如实提示(不假装没有来源)。 */
	const onExpand = (data) => {
		setExpand({ open: true, loading: true, error: "", text: "" });
		api("expandSource", { id: data.id })
			.then((body) => setExpand({ open: true, loading: false, error: "", text: body.text ?? "" }))
			.catch((reason) => setExpand({ open: true, loading: false, error: String(reason?.message ?? reason), text: "" }));
	};

	const onCopy = (text, asContent) => {
		copyText(text)
			.then(() => setCopied(asContent === true ? "content" : text))
			.catch(() => setError(tt("memCopyFailed")));
	};

	if (selected !== null) {
		return h(MemoryDetail, {
			row: selected,
			t: tt,
			busy: busyId === selected.id,
			act,
			onBack: back,
			detail,
			onRetry: retryDetail,
			copied,
			onCopy,
			hideConfirm,
			onConfirmHide: setHideConfirm,
			onExpand,
			expand,
		});
	}

	const filtersActive = status !== "all" || kind !== "" || workspaceId !== "" || query.trim() !== "";
	const statusCounts = facets?.status ?? { active: 0, staged: 0, archived: 0 };
	const allCount = (Number(statusCounts.active) || 0) + (Number(statusCounts.staged) || 0) + (Number(statusCounts.archived) || 0);
	const counts = { all: allCount, active: statusCounts.active, staged: statusCounts.staged, archived: statusCounts.archived };
	const kindCounts = facets?.kinds ?? {};
	const workspaceRows = Array.isArray(facets?.workspaces) ? facets.workspaces : [];

	let empty = null;
	if (!loading && rows.length === 0) {
		if (query.trim() !== "") empty = h(Empty, { key: "empty-search", title: tt("memNoSearchTitle"), hint: tt("memNoSearchHint") });
		else if (filtersActive) empty = h(Empty, { key: "empty-filter", title: tt("memNoFilterTitle"), hint: tt("memNoFilterHint") });
		else empty = h(Empty, { key: "empty-pool", title: tt("memPoolEmptyTitle"), hint: tt("memPoolEmptyHint") });
	}

	return h(Card, {
		title: tt("memTitle"),
		sub: tt("memHint"),
		actions: h("button", {
			key: "refresh",
			type: "button",
			className: "mem-btn",
			disabled: loading,
			onClick: () => reload(0),
		}, loading ? tt("commonLoading") : tt("commonRefresh")),
		children: [
			h(Toolbar, {
				key: "toolbar",
				children: [
					h(SearchBox, {
						key: "search",
						value: query,
						onChange: setQuery,
						onClear: () => setQuery(""),
						placeholder: tt("memSearchPlaceholder"),
					}),
					h("select", {
						key: "sort",
						className: "mem-select",
						value: sort,
						"aria-label": tt("memSortLabel"),
						onChange: (event) => setSort(event.target.value),
					}, SORTS.map(([value, label]) => h("option", { key: value, value }, tt(label)))),
				],
			}),
			h("div", { className: "mem-filters", key: "filters", role: "group", "aria-label": tt("memFiltersLabel") }, [
				h("div", { className: "mem-filter-group", key: "status" }, STATUS_TABS.map(([value, label]) => h("button", {
					key: value,
					type: "button",
					className: cx("mem-filter", status === value ? "mem-filter-active" : null),
					"aria-pressed": status === value,
					"data-filter-status": value,
					onClick: () => setStatus(value),
				}, [tt(label), facets === null ? null : h("span", { key: "n", className: "mem-filter-count" }, String(counts[value] ?? 0))]))),
				h("div", { className: "mem-filter-group", key: "kind" }, KIND_TABS.map(([value, label]) => h("button", {
					key: value === "" ? "any" : value,
					type: "button",
					className: cx("mem-filter", kind === value ? "mem-filter-active" : null),
					"aria-pressed": kind === value,
					"data-filter-kind": value === "" ? "all" : value,
					onClick: () => setKind(value),
				}, [tt(label), value === "" || facets === null ? null : h("span", { key: "n", className: "mem-filter-count" }, String(kindCounts[value] ?? 0))]))),
				h("select", {
					key: "workspace",
					className: "mem-select",
					value: workspaceId,
					"aria-label": tt("memWorkspaceLabel"),
					"data-filter-workspace": "select",
					onChange: (event) => setWorkspaceId(event.target.value),
				}, [
					h("option", { key: "all", value: "" }, tt("memWorkspaceAll")),
					...workspaceRows.map((row) => h("option", { key: row.id, value: row.id }, `${row.label ?? row.id} (${row.count})`)),
				]),
			]),
			error === "" ? null : h(Banner, {
				key: "error",
				tone: "error",
				title: tt("commonError"),
				children: error,
				action: h("button", { type: "button", className: "mem-btn", onClick: () => reload(0) }, tt("commonRetry")),
			}),
			loading && rows.length === 0 ? h(Skeleton, { key: "loading", lines: 5 }) : null,
			empty,
			rows.length === 0 ? null : h("div", { className: "mem-list", key: "list" }, [
				h("div", { className: "mem-list-head", key: "count" }, [
					h("span", { key: "total" }, tt("memCount", { n: total })),
					h("span", { key: "shown", className: "mem-hint" }, tt("memShown", { shown: rows.length, total })),
				]),
				...rows.map((row) => h(MemoryRow, {
					key: row.id,
					row,
					t: tt,
					busy: busyId === row.id,
					act,
					onOpen: openDetail,
				})),
				rows.length < total
					? h("button", {
						key: "more",
						type: "button",
						className: "mem-btn mem-load-more",
						disabled: loading,
						onClick: () => reload(rows.length),
					}, tt("memLoadMore") + " (" + rows.length + "/" + total + ")")
					: null,
			]),
		],
	});
}
		exps.default = BrowseCard;
		exps["BrowseCard"] = BrowseCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/recall-card.js
	var mod_recall_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var api = mod_runtime_js["api"];
		var fmtShortTime = mod_runtime_js["fmtShortTime"];
		var Card = mod_components_js["Card"];
		var Banner = mod_components_js["Banner"];
		var Chip = mod_components_js["Chip"];
		var Badge = mod_components_js["Badge"];
		var Empty = mod_components_js["Empty"];
		var Skeleton = mod_components_js["Skeleton"];
		var Icon = mod_components_js["Icon"];
/**
 * 召回试验台(v1.15,SPEC §7.3 / §6.5)。
 *
 * 一次试验只做三件事:把查询交给宿主侧 `recallPreview`、把两路候选/闸门/注入预览摊开
 * 给人看、结论保持只读。这里刻意不提供任何"写记忆/改状态"的入口——想改记忆去「记忆」页。
 *
 * 几个容易读错的点(实现时踩过的口径):
 *  - `ok:false`(检索内部失败)与 `hits: []`(检索正常但没命中)是两种状态:前者是错误,
 *    后者是空结果。runtime.api 对 `ok:false` 直接抛错,所以这里用 catch 区分;
 *  - 闸门参数来自响应(`gate`);本试验的 `purpose:'inject'` 口径才套闸门,所以注入预览
 *    近似"下一轮真的会注入什么";
 *  - 预览是按预算拼出来的,理论上不会超预算;超了要标红提示口径不一致(防御性展示)。
 */

// ── 格式化小工具 ─────────────────────────────────────────────────────────

/** 固定小数位;非数值一律 "—"(缺字段时不显示 NaN)。 */
function fmtFixed(value, digits) {
	const n = Number(value);
	return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

/** 排序系数:最多 3 位小数并去掉尾零(1.100 → 1.1)。 */
function fmtCoef(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	return String(Math.round(n * 1000) / 1000);
}

/** parts 的七项系数:顺序与 lib/rank.js 的 computeFinalScore 一致。 */
const PART_KEYS = [
	["relevance", "rcPartRelevance"],
	["time", "rcPartTime"],
	["evidence", "rcPartEvidence"],
	["workspace", "rcPartWorkspace"],
	["entity", "rcPartEntity"],
	["status", "rcPartStatus"],
	["E", "rcPartE"],
];

// ── 局部组件(纯函数、不调 hooks;children 走 props,见 components.js 约定)──

/** 摘要条里的一项:标签 + 值。 */
function SummaryItem({ id, label, value }) {
	const { h } = react;
	return h("span", { className: "rc-summary-item", "data-summary": id }, [
		h("span", { className: "rc-summary-label", key: "label" }, label),
		h("span", { className: "rc-summary-value", key: "value" }, value),
	]);
}

/** 闸门参数 chip(外面包一层 span,方便测试/样式定位到具体参数)。 */
function GateChip({ id, tone, dot, title, children }) {
	const { h } = react;
	return h("span", { className: "rc-gate", "data-gate": id },
		h(Chip, { key: "chip", tone, dot, title, children }));
}

/** 两路徽章:命中用各自颜色,没命中保持灰色并在 title 说明"这条是另一路带进来的"。 */
function LaneBadge({ id, t, on }) {
	const { h } = react;
	const tone = on ? (id === "vector" ? "ok" : "info") : "muted";
	const title = on
		? t(id === "vector" ? "rcLaneVectorHint" : "rcLaneBm25Hint")
		: t("rcLaneMissHint");
	return h("span", { className: "rc-lane", "data-lane-badge": id },
		h(Badge, {
			key: "badge",
			tone,
			title,
			children: t(id === "vector" ? "rcBadgeVector" : "rcBadgeBm25"),
		}));
}

/** 命中行的一个小指标(综合分/相关性/原始分)。 */
function Metric({ id, label, value }) {
	const { h } = react;
	return h("span", { className: "rc-metric", "data-metric": id }, [
		h("span", { className: "rc-metric-label", key: "label" }, label),
		h("span", { className: "rc-metric-value", key: "value" }, value),
	]);
}

/** 七个排序系数一排(标题 attr 用中文解释,数值按 3 位小数修剪)。 */
function PartsGrid({ t, parts }) {
	const { h } = react;
	return h("div", { className: "rc-parts-wrap" }, [
		h("div", { className: "rc-parts-title", key: "title" }, t("rcPartsTitle")),
		h("div", { className: "rc-parts", key: "grid" }, PART_KEYS.map(([key, labelKey]) => h("div", {
			className: "rc-part",
			key,
			"data-part": key,
			title: t(labelKey),
		}, [
			h("span", { className: "rc-part-name", key: "name" }, key),
			h("span", { className: "rc-part-value", key: "value" }, fmtCoef(parts[key])),
		]))),
	]);
}

/** 一条命中:折叠态显示正文摘要/元数据/指标,展开后显示系数明细与命中 chunk。 */
function HitRow({ hit, rank, t, open, onToggle }) {
	const { h } = react;
	const lanes = hit.lanes ?? {};
	const parts = hit.parts !== null && typeof hit.parts === "object" ? hit.parts : null;
	const chunk = typeof hit.chunk === "string" ? hit.chunk : "";
	return h("div", {
		className: "rc-hit" + (open ? " rc-hit-open" : ""),
		"data-hit-id": hit.id ?? String(rank),
		role: "button",
		tabIndex: 0,
		"aria-expanded": open,
		onClick: onToggle,
		onKeyDown: (e) => {
			// 只处理行本身获得焦点时的键;行内没有可交互子元素,但保持与浏览器页一致的防御。
			if (e.target !== e.currentTarget) return;
			if (e.key !== "Enter" && e.key !== " ") return;
			e.preventDefault();
			onToggle();
		},
	}, [
		h("div", { className: "rc-hit-head", key: "head" }, [
			h("span", { className: "rc-rank", key: "rank" }, String(rank)),
			h("div", { className: "rc-hit-main", key: "main" }, [
				h("div", { className: "rc-hit-content", key: "content" }, hit.content ?? t("commonEmpty")),
				h("div", { className: "rc-hit-meta", key: "meta" }, [
					hit.kind === undefined ? null : h("span", { className: "rc-hit-kind", key: "kind" }, hit.kind),
					hit.status === undefined ? null : h("span", { key: "status" }, hit.status),
					hit.workspaceLabel === undefined ? null : h("span", { key: "ws" }, hit.workspaceLabel),
					h("span", { className: "rc-hit-time", key: "time" }, fmtShortTime(hit.eventTime ?? hit.createdAt)),
					h("span", { className: "rc-lanes", key: "lanes" }, [
						h(LaneBadge, { key: "bm25", id: "bm25", t, on: lanes.bm25 === true }),
						h(LaneBadge, { key: "vector", id: "vector", t, on: lanes.vector === true }),
					]),
				]),
				h("div", { className: "rc-hit-metrics", key: "metrics" }, [
					h(Metric, { key: "score", id: "score", label: t("rcMetricScore"), value: fmtFixed(hit.score, 2) }),
					h(Metric, { key: "relevance", id: "relevance", label: t("rcMetricRelevance"), value: fmtFixed(hit.relevance, 3) }),
					h(Metric, { key: "bm25Raw", id: "bm25Raw", label: t("rcMetricBm25Raw"), value: fmtFixed(hit.bm25Raw, 2) }),
					h(Metric, { key: "cos", id: "cos", label: t("rcMetricCos"), value: fmtFixed(hit.cos, 3) }),
				]),
			]),
			h("span", { className: "rc-chevron", key: "chev", "aria-hidden": "true" }, h(Icon, { name: "chevron", size: 12 })),
		]),
		open
			? h("div", { className: "rc-hit-body", key: "body" }, [
				parts === null
					? h("div", { className: "rc-chunk-empty", key: "noparts" }, t("rcPartsEmpty"))
					: h(PartsGrid, { key: "parts", t, parts }),
				h("div", { className: "rc-chunk", key: "chunk" }, [
					h("span", { className: "rc-chunk-label", key: "label" }, t("rcChunkTitle")),
					chunk === ""
						? h("span", { className: "rc-chunk-empty", key: "empty" }, t("rcChunkEmpty"))
						: h("pre", { className: "rc-chunk-text", key: "text" }, chunk),
				]),
			])
			: null,
	]);
}

/**
 * 注入预览卡:等宽显示 `preview.lines`,脚注是字符预算。
 * 超预算时脚注标红(防御性:预览本该按预算裁剪,超了说明口径不一致)。
 */
function PreviewCard({ t, preview, budgets }) {
	const { h } = react;
	// header 是注入正文的固定前缀(宿主拼的"以下是历史记忆"提示),属于预览的一部分。
	const header = typeof preview.header === "string" ? preview.header : "";
	const lines = Array.isArray(preview.lines) ? preview.lines : [];
	const charsRaw = Number(preview.chars);
	const chars = Number.isFinite(charsRaw) ? charsRaw : lines.join("").length;
	const maxChars = Number(budgets?.injectMaxChars);
	const hasMaxChars = Number.isFinite(maxChars) && maxChars > 0;
	const over = hasMaxChars && chars > maxChars;
	const maxItems = Number(budgets?.injectMaxItems);
	const hasMaxItems = Number.isFinite(maxItems) && maxItems > 0;
	return h(Card, {
		title: t("rcPreviewTitle"),
		sub: t("rcPreviewSub"),
		children: [
			header === "" && lines.length === 0
				? h("div", { className: "rc-preview-empty", key: "empty" }, t("rcPreviewEmpty"))
				: h("div", { className: "rc-preview-lines", key: "lines" }, [
					header === "" ? null : h("div", { className: "rc-preview-header", key: "header" }, header),
					...lines.map((line, index) => h("div", {
						className: "rc-preview-line",
						key: index,
						"data-preview-line": String(index),
					}, String(line))),
				]),
			h("div", {
				className: "rc-preview-foot" + (over ? " rc-preview-over" : ""),
				key: "foot",
				"data-preview-foot": true,
			}, [
				h("span", { className: "rc-preview-budget", key: "budget", "data-preview-budget": "chars" }, hasMaxChars
					? t("rcPreviewBudget", { chars, max: maxChars })
					: String(chars) + " " + t("commonChars")),
				over ? h("span", { className: "rc-preview-over-tag", key: "over" }, t("rcPreviewOver", { over: chars - maxChars })) : null,
				hasMaxItems ? h("span", { key: "items" }, t("rcPreviewItemBudget", { n: lines.length, max: maxItems })) : null,
			]),
		],
	});
}

// ── 面板本体 ─────────────────────────────────────────────────────────────

function RecallCard({ t, overview, refreshKey }) {
	const { h, useState, useEffect } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const [query, setQuery] = useState("");
	const [workspaceId, setWorkspaceId] = useState("");
	const [limitText, setLimitText] = useState("8");
	const [workspaces, setWorkspaces] = useState([]);
	const [workspacesError, setWorkspacesError] = useState("");
	const [formError, setFormError] = useState("");
	const [running, setRunning] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState(null);
	const [expanded, setExpanded] = useState({});
	// 用稳定对象做请求序号(不引入 useRef,保持打包器/测试替身的 Hook 面不变)。
	const [wsSeq] = useState(() => ({ current: 0 }));
	const [runSeq] = useState(() => ({ current: 0 }));

	// 工作区下拉:随页头「刷新」(refreshKey 自增)重新拉取;失败只在控件旁提示,不挡试验。
	useEffect(() => {
		const mine = ++wsSeq.current;
		setWorkspacesError("");
		api("workspaces")
			.then((resp) => {
				if (mine !== wsSeq.current) return;
				setWorkspaces(Array.isArray(resp.workspaces) ? resp.workspaces : []);
			})
			.catch((err) => {
				if (mine !== wsSeq.current) return;
				setWorkspaces([]);
				setWorkspacesError(String(err?.message ?? err));
			});
		return () => { wsSeq.current += 1; };
	}, [refreshKey, wsSeq]);

	const run = () => {
		const text = query.trim();
		const limit = Number(limitText);
		if (text === "") {
			setFormError(tt("rcQueryRequired"));
			return;
		}
		if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
			setFormError(tt("rcLimitInvalid"));
			return;
		}
		setFormError("");
		setError("");
		setRunning(true);
		// 换一次试验就收掉旧展开,避免命中 id 相同/不同的错位展开。
		setExpanded({});
		const mine = ++runSeq.current;
		api("recallPreview", {
			query: text,
			...(workspaceId === "" ? {} : { workspaceId }),
			limit,
		})
			.then((data) => {
				if (mine !== runSeq.current) return;
				setResult(data);
				setRunning(false);
			})
			.catch((err) => {
				if (mine !== runSeq.current) return;
				setResult(null);
				setRunning(false);
				setError(String(err?.message ?? err));
			});
	};

	const clear = () => {
		// 作废还在路上的请求,免得清空后旧响应把结果又填回来。
		runSeq.current += 1;
		setQuery("");
		setWorkspaceId("");
		setLimitText("8");
		setFormError("");
		setError("");
		setResult(null);
		setRunning(false);
		setExpanded({});
	};

	const toggleHit = (id) => setExpanded((prev) => {
		const next = { ...prev };
		if (next[id] === true) delete next[id];
		else next[id] = true;
		return next;
	});

	// 闸门/预算是"注入口径"的参数:优先用本次响应,没跑过就退回总览数据(只读展示)。
	const gate = result?.gate ?? overview?.data?.gate ?? null;
	const budgets = result?.budgets ?? overview?.data?.injection?.budgets ?? null;
	const hits = Array.isArray(result?.hits) ? result.hits : [];
	const lanes = result?.lanes ?? {};
	const vectorRan = result?.vectorRan === true;
	const showResults = running || error !== "" || result !== null;

	const form = h("div", { className: "rc-form", key: "form" }, [
		h("label", { className: "rc-field", key: "query" }, [
			h("span", { className: "rc-label", key: "label" }, tt("rcQueryLabel")),
			h("textarea", {
				key: "input",
				className: "mem-input rc-query",
				rows: 2,
				value: query,
				placeholder: tt("rcQueryPlaceholder"),
				"data-recall-query": true,
				onChange: (e) => {
					setQuery(e.target.value);
					if (formError !== "") setFormError("");
				},
			}),
		]),
		h("div", { className: "rc-form-row", key: "row" }, [
			h("label", { className: "rc-field rc-field-workspace", key: "workspace" }, [
				h("span", { className: "rc-label", key: "label" }, tt("rcWorkspaceLabel")),
				h("select", {
					key: "select",
					className: "mem-select rc-select",
					value: workspaceId,
					"data-recall-workspace": true,
					"aria-label": tt("rcWorkspaceLabel"),
					onChange: (e) => setWorkspaceId(e.target.value),
				}, [
					h("option", { key: "any", value: "" }, tt("rcWorkspaceAny")),
					...workspaces.map((ws) => h("option", {
						key: ws.id,
						value: ws.id,
					}, ws.label ?? ws.id)),
				]),
			]),
			h("label", { className: "rc-field rc-field-limit", key: "limit" }, [
				h("span", { className: "rc-label", key: "label" }, tt("rcLimitLabel")),
				h("input", {
					key: "input",
					className: "mem-input rc-limit",
					type: "number",
					min: 1,
					max: 20,
					step: 1,
					value: limitText,
					"data-recall-limit": true,
					"aria-label": tt("rcLimitLabel"),
					onChange: (e) => {
						setLimitText(e.target.value);
						if (formError !== "") setFormError("");
					},
				}),
			]),
			h("div", { className: "rc-actions", key: "actions" }, [
				h("button", {
					key: "run",
					type: "button",
					className: "mem-btn mem-btn-primary",
					"data-action": "recall-run",
					disabled: running,
					onClick: run,
				}, [
					h(Icon, { key: "icon", name: "spark", size: 14 }),
					tt("rcRun"),
				]),
				h("button", {
					key: "clear",
					type: "button",
					className: "mem-btn",
					"data-action": "recall-clear",
					onClick: clear,
				}, tt("rcClear")),
			]),
		]),
		h("div", { className: "mem-hint", key: "ws-hint" }, tt("rcWorkspaceHint")),
		workspacesError === ""
			? null
			: h("div", { className: "mem-msg mem-msg-error", key: "ws-error" }, tt("rcWorkspacesFailed") + ": " + workspacesError),
		formError === "" ? null : h("div", { className: "mem-msg mem-msg-error", key: "form-error" }, formError),
		showResults ? null : h("div", { className: "mem-hint", key: "idle" }, tt("rcIdleHint")),
	]);

	// 结果主体:加载/错误/空/列表四种状态互斥,别把"检索不可用"渲染成"没有命中"。
	const resultsBody = [];
	if (running) {
		resultsBody.push(h(Skeleton, { key: "loading", lines: 4 }));
	} else if (error !== "") {
		resultsBody.push(h(Banner, {
			key: "error",
			tone: "error",
			title: tt("rcUnavailable"),
			children: error,
			action: h("button", {
				key: "retry",
				type: "button",
				className: "mem-btn",
				"data-action": "recall-retry",
				onClick: run,
			}, tt("commonRetry")),
		}));
	} else if (result !== null) {
		resultsBody.push(h("div", { className: "rc-summary", key: "summary" }, [
			h(SummaryItem, { key: "pool", id: "pool", label: tt("rcSummaryPool"), value: String(lanes.pool ?? 0) }),
			h(SummaryItem, { key: "bm25", id: "bm25", label: tt("rcSummaryBm25"), value: String(lanes.bm25 ?? 0) }),
			h(SummaryItem, { key: "vector", id: "vector", label: tt("rcSummaryVector"), value: String(lanes.vector ?? 0) }),
			h("span", { className: "rc-summary-item", key: "lane", "data-summary": "lane" }, h(Chip, {
				tone: vectorRan ? "ok" : "muted",
				dot: true,
				title: vectorRan ? tt("rcVectorRanHint") : tt("rcVectorOffHint"),
				children: tt("rcSummaryVectorLane") + " · " + (vectorRan ? tt("rcVectorOn") : tt("rcVectorOff")),
			})),
			result.coldStart === true
				? h("span", { className: "rc-summary-item", key: "cold", "data-summary": "cold" }, h(Chip, {
					tone: "warn",
					dot: true,
					title: tt("rcColdStartHint"),
					children: tt("rcColdStart"),
				}))
				: null,
		]));
		if (gate !== null) {
			const gateOn = gate.enabled === true;
			const gateChips = [
				h(GateChip, {
					key: "gate",
					id: "gate",
					tone: gateOn ? "ok" : "muted",
					dot: true,
					title: gateOn ? tt("rcGateOnHint") : tt("rcGateOffHint"),
					children: tt("rcGate") + " · " + (gateOn ? tt("commonOn") : tt("commonOff")),
				}),
			];
			// 闸门关闭时阈值不参与判定:只留开关 chip,避免展示一串"未配置"的线。
			if (gateOn) {
				gateChips.push(
					h(GateChip, {
						key: "consensus",
						id: "consensus",
						tone: "muted",
						dot: false,
						title: tt("rcGateConsensusHint"),
						children: tt("rcGateConsensus") + " · " + tt("rcRuleConsensus", {
							bm25: fmtCoef(gate.consensusBm25),
							cos: fmtCoef(gate.consensusCos),
						}),
					}),
					h(GateChip, {
						key: "solo",
						id: "solo",
						tone: "muted",
						dot: false,
						title: tt("rcGateSoloHint"),
						children: tt("rcGateSolo") + " · " + tt("rcRuleSolo", {
							bm25: fmtCoef(gate.soloBm25),
							cos: fmtCoef(gate.soloCos),
						}),
					}),
					h(GateChip, {
						key: "bm25Only",
						id: "bm25Only",
						tone: "muted",
						dot: false,
						title: tt("rcGateBm25OnlyHint"),
						children: tt("rcGateBm25Only") + " · " + tt("rcRuleBm25Only", {
							min: fmtCoef(gate.bm25OnlyMin),
							pool: fmtCoef(gate.bm25OnlyMinPoolSize),
						}),
					}),
				);
			}
			resultsBody.push(h("div", { className: "rc-gates", key: "gates", "data-gates": true }, gateChips));
		}
		resultsBody.push(hits.length === 0
			? h(Empty, { key: "empty", title: tt("rcEmptyTitle"), hint: tt("rcEmptyHint") })
			: h("div", { className: "rc-hits", key: "hits" }, hits.map((hit, index) => h(HitRow, {
				key: hit.id ?? String(index),
				hit,
				rank: index + 1,
				t: tt,
				open: expanded[hit.id] === true,
				onToggle: () => toggleHit(hit.id),
			}))));
	}

	return h("div", { className: "rc-stack" }, [
		h(Card, {
			key: "experiment",
			title: tt("rcTitle"),
			sub: tt("rcSub"),
			children: [
				h(Banner, { key: "note", tone: "info", title: tt("rcReadOnly"), children: tt("rcNote") }),
				form,
			],
		}),
		showResults
			? h("div", { key: "results", "data-recall-result": true }, h(Card, {
				title: tt("rcResultTitle"),
				sub: tt("rcResultSub"),
				children: resultsBody,
			}))
			: null,
		!running && error === "" && result !== null
			? h(PreviewCard, {
				key: "preview",
				t: tt,
				preview: result.preview ?? { chars: 0, lines: [] },
				budgets,
			})
			: null,
	]);
}
		exps.default = RecallCard;
		exps["RecallCard"] = RecallCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/config-card.js
	var mod_config_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var api = mod_runtime_js["api"];
		var pathOf = mod_runtime_js["pathOf"];
		var getPath = mod_runtime_js["getPath"];
		var toText = mod_runtime_js["toText"];
		var fromText = mod_runtime_js["fromText"];
		var DraftInput = mod_runtime_js["DraftInput"];
		var useSettingsWriter = mod_runtime_js["useSettingsWriter"];
		var cx = mod_runtime_js["cx"];
		var fmtDateTime = mod_runtime_js["fmtDateTime"];
		var Card = mod_components_js["Card"];
		var Chip = mod_components_js["Chip"];
		var Banner = mod_components_js["Banner"];
		var SearchBox = mod_components_js["SearchBox"];
		var Toolbar = mod_components_js["Toolbar"];
		var Icon = mod_components_js["Icon"];
		var Skeleton = mod_components_js["Skeleton"];
		var Empty = mod_components_js["Empty"];
/**
 * 配置面板(v1.15 重设计,SPEC §7.4)。
 *
 * 目标:让 26 个参数「不挡路」——默认只看到默认展开的两组,其余折叠;顶部状态条一眼看清
 * 设置服务状态 / 是否立即保存 / 被覆盖了几项;「需要关注」诊断卡把**能直接看出来的配置问题**
 * 说成人话并给出跳转;搜索可按中文标签、说明、键名过滤;每项都有「已覆盖」徽章和「重置」。
 *
 * 硬约束(别动):
 *  - `GROUPS` 必须继续导出,且**恰好覆盖** SPEC §8 的 26 个配置键
 *    (`tools/check-seams.mjs` 会拿它和宿主 `lib/config.js` 的 volatile 字段双向对账);
 *  - 写入只能走 `form.getSnapshot()/subscribe/mutate`,ops 形状 `[{ op:"set"|"unset", path, value? }]`
 *    (`useSettingsWriter` 的成败判据只认 mutate 的 boolean 结果)。
 *
 * 组件用法提醒:本插件迷你渲染器不展开 JSX 第三参数,组合组件的 children 必须放进
 * `props.children`(数组),见 components.js 文件头。
 */

/**
 * 读一个 `/neural-mind/api` action 的轻量状态容器(工作区列表 / 密钥状态各一份)。
 *
 * 为什么不用 runtime.js 的 `useApi`:它在 effect 里**同步** setState(loading),
 * 而测试 / 预览的迷你渲染器把 effect 放在渲染过程中执行,同步 setState 会递归重入渲染,
 * 打乱 per-fiber 的 hooks 槽位(实测症状:组件里后一个 useState 读到前一个组件的值)。
 * 这里只在 promise 落地的微任务里 setState,effect 本身没有同步副作用。
 * 真实 React 下两者等价(effect 本来就在渲染之后跑)。
 */
function useConfigApi(action, deps = []) {
	const { useState, useEffect, useCallback } = react;
	const [state, setState] = useState(() => ({ data: null, error: "", loading: true }));
	const [seq] = useState(() => ({ n: 0 }));
	const run = useCallback(() => {
		const mine = ++seq.n;
		api(action)
			.then((data) => {
				if (mine !== seq.n) return;
				setState({ data, error: "", loading: false });
			})
			.catch((error) => {
				if (mine !== seq.n) return;
				setState({ data: null, error: String(error?.message ?? error), loading: false });
			});
	}, [action, ...deps]);
	useEffect(() => { run(); }, [run]);
	return { data: state.data, error: state.error, loading: state.loading, reload: run };
}

// ── 字段清单(SPEC §8:26 个键,不可增删改键名)─────────────────────────────

/**
 * 记忆页可编辑的配置面。`kind` 必须与宿主 schema 类型对齐
 * (boolean→toggle / number→number / string→text / array→lines|workspaces / dict→dict / union→select),
 * 否则 `check-seams` ⑨ 会当场红——写错 kind 会把字符串写进 boolean 字段。
 *
 * `advanced: true` 的字段默认收在分组内的「高级选项」里(向量检索组),搜索时强制展开,
 * 避免"搜到了却看不见"。
 */
const GROUPS = [
	{
		id: "privacy", title: "groupPrivacy", icon: "memories", defaultOpen: false,
		fields: [
			{ key: "privateWorkspaces", kind: "lines" },
			{ key: "disabledWorkspaces", kind: "workspaces" },
			{ key: "sensitiveNoCross", kind: "toggle" },
			{ key: "sensitiveKeywords", kind: "lines" },
		],
	},
	{
		id: "embedding", title: "groupEmbedding", icon: "vector", defaultOpen: true,
		fields: [
			{ key: "semanticSearch.enabled", kind: "toggle" },
			{ key: "semanticSearch.baseUrl", kind: "text" },
			{ key: "semanticSearch.modelId", kind: "text" },
			{ key: "semanticSearch.apiKeyEnv", kind: "text" },
			{ key: "semanticSearch.apiKeyOptional", kind: "toggle" },
			{ key: "semanticSearch.timeoutMs", kind: "number", advanced: true },
			{ key: "semanticSearch.autoStartCommand", kind: "text", advanced: true },
			{ key: "semanticSearch.autoStartWaitMs", kind: "number", advanced: true },
			{ key: "semanticSearch.autoStartWarmup", kind: "toggle", advanced: true },
		],
	},
	{
		id: "write", title: "groupWrite", icon: "spark", defaultOpen: true,
		fields: [
			{ key: "extractEnabled", kind: "toggle" },
			{ key: "extractBatchTurns", kind: "number" },
			{ key: "extractIdleMinutes", kind: "number" },
			{ key: "toolOutputStorage", kind: "select", options: ["summary", "head"] },
			{ key: "toolOutputOverrides", kind: "dict" },
			{ key: "failedToolOutputChars", kind: "number" },
		],
	},
	{
		id: "inject", title: "groupInject", icon: "recall", defaultOpen: false,
		fields: [
			{ key: "autoRecall", kind: "toggle" },
			{ key: "injectMaxItems", kind: "number" },
			{ key: "injectMaxChars", kind: "number" },
			{ key: "sessionInjectMaxChars", kind: "number" },
			{ key: "excerptChars", kind: "number" },
		],
	},
	{
		id: "profile", title: "groupProfile", icon: "profile", defaultOpen: false,
		fields: [
			{ key: "profileFile", kind: "text" },
			{ key: "profilePollSeconds", kind: "number" },
		],
	},
];

/** 26 个字段的扁平清单(计数 / 已覆盖统计用)。 */
const CONFIG_FIELDS = GROUPS.reduce((all, group) => all.concat(group.fields), []);

/** 全部展开 / 全部收起 / 初始折叠态:模块级常量,state 里只做不可变替换。 */
const ALL_OPEN = Object.freeze(Object.fromEntries(GROUPS.map((group) => [group.id, true])));
const ALL_CLOSED = Object.freeze(Object.fromEntries(GROUPS.map((group) => [group.id, false])));
const INITIAL_OPEN = Object.freeze(Object.fromEntries(GROUPS.map((group) => [group.id, group.defaultOpen !== false])));

/** 设置服务缺席时的兜底快照:配置卡据此显示「不可用」而不是假装可编辑。 */
const UNAVAILABLE_SNAPSHOT = Object.freeze({
	status: "unavailable", value: {}, user: {}, revision: 0, writable: false,
});

// ── 字段 / 搜索 / 诊断的纯函数 ─────────────────────────────────────────────

/** 字段标签 key:`f_` + 路径最后一段(嵌套字段如 semanticSearch.baseUrl → f_baseUrl)。 */
const labelKeyOf = (def) => "f_" + def.key.split(".").pop();
const descKeyOf = (def) => labelKeyOf(def) + "_desc";

/** 该字段是否被用户显式覆盖(user 层有值即覆盖)。 */
function fieldOverridden(user, key) {
	return getPath(user ?? {}, pathOf(key)) !== undefined;
}

/** 搜索命中:中文标签 / 说明 / 完整键名 / 末段键名,大小写不敏感。 */
function matchesField(t, def, query) {
	const q = String(query ?? "").trim().toLowerCase();
	if (q === "") return true;
	const label = String(t(labelKeyOf(def)) ?? "").toLowerCase();
	const desc = String(t(descKeyOf(def)) ?? "").toLowerCase();
	const key = def.key.toLowerCase();
	const leaf = def.key.split(".").pop().toLowerCase();
	return label.includes(q) || desc.includes(q) || key.includes(q) || leaf.includes(q);
}

/**
 * 工作区 id 比较口径(仅展示 / 勾选用):统一分隔符、去尾斜杠、大小写不敏感。
 * 宿主侧 `disabledWorkspaces` 支持 workspaceId 或其前缀;浏览器半不能 import
 * `lib/workspace.js`(node 内置依赖会进 bundle),所以这里只复刻「比较」这一小块,
 * 写进配置的永远是列表行给出的原值。
 */
const normalizeWorkspace = (workspaceId) =>
	String(workspaceId ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** workspaceId 是否被 entries 里某条「workspaceId 或其前缀」覆盖。 */
function coversWorkspace(workspaceId, entries) {
	const target = normalizeWorkspace(workspaceId);
	if (target === "") return false;
	return (Array.isArray(entries) ? entries : []).some((entry) => {
		const prefix = normalizeWorkspace(entry);
		return prefix !== "" && (target === prefix || target.startsWith(prefix + "/"));
	});
}

const DIAG_TONE_RANK = { error: 0, warn: 1, info: 2 };

/**
 * 「需要关注」诊断:完全由**当前配置值**(+ 外壳下发的 overview)本地计算,不发请求。
 *
 * 设计口径:只报「看了就知道怎么办」的问题;warn 排前面,info 排后面;每条带 group 的
 * 可以一键跳到对应分组,避免用户在 26 项里找。
 *
 * @returns {{ id: string, tone: "warn"|"info", title: string, hint: string, group?: string }[]}
 */
function diagnoseConfig(t, rawValue, overviewData) {
	const value = rawValue !== null && typeof rawValue === "object" ? rawValue : {};
	const semantic = value.semanticSearch !== null && typeof value.semanticSearch === "object" ? value.semanticSearch : {};
	const enabled = semantic.enabled === true;
	const baseUrl = typeof semantic.baseUrl === "string" ? semantic.baseUrl.trim() : "";
	const modelId = typeof semantic.modelId === "string" ? semantic.modelId.trim() : "";
	const apiKeyEnv = typeof semantic.apiKeyEnv === "string" ? semantic.apiKeyEnv.trim() : "";
	const keyless = semantic.apiKeyOptional === true;
	const items = [];

	if (enabled) {
		if (baseUrl === "" || modelId === "") {
			const missing = [baseUrl === "" ? "baseUrl" : "", modelId === "" ? "modelId" : ""].filter((part) => part !== "").join(" / ");
			items.push({
				id: "vector-incomplete", tone: "warn", group: "embedding",
				title: t("cfgDiagVectorIncomplete"), hint: t("cfgDiagVectorIncompleteHint", { missing }),
			});
		} else if (!keyless && apiKeyEnv === "") {
			items.push({
				id: "vector-key", tone: "warn", group: "embedding",
				title: t("cfgDiagVectorKey"), hint: t("cfgDiagVectorKeyHint"),
			});
		}
	} else {
		items.push({
			id: "vector-off", tone: "info", group: "embedding",
			title: t("cfgDiagVectorOff"), hint: t("cfgDiagVectorOffHint"),
		});
	}

	// overview 里带了上次向量失败原因时才提示(拿不到 overview 时静默,不假装知道)。
	const lastFailure = overviewData !== null && typeof overviewData === "object" && overviewData.embedding !== null
		&& typeof overviewData.embedding === "object" && typeof overviewData.embedding.lastFailure === "string"
		? overviewData.embedding.lastFailure.trim()
		: "";
	if (enabled && lastFailure !== "") {
		items.push({
			id: "vector-failed", tone: "warn", group: "embedding",
			title: t("cfgDiagVectorFailed", { error: lastFailure }), hint: t("cfgDiagVectorFailedHint"),
		});
	}

	if (value.autoRecall === false) {
		items.push({
			id: "recall-off", tone: "warn", group: "inject",
			title: t("cfgDiagRecallOff"), hint: t("cfgDiagRecallOffHint"),
		});
	}
	if (value.extractEnabled === false) {
		items.push({
			id: "extract-off", tone: "warn", group: "write",
			title: t("cfgDiagExtractOff"), hint: t("cfgDiagExtractOffHint"),
		});
	}

	const disabledWorkspaces = (Array.isArray(value.disabledWorkspaces) ? value.disabledWorkspaces : [])
		.filter((entry) => String(entry ?? "").trim() !== "");
	if (disabledWorkspaces.length > 0) {
		items.push({
			id: "disabled-ws", tone: "info", group: "privacy",
			title: t("cfgDiagDisabledWs", { n: disabledWorkspaces.length }), hint: t("cfgDiagDisabledWsHint"),
		});
	}
	const privateWorkspaces = (Array.isArray(value.privateWorkspaces) ? value.privateWorkspaces : [])
		.filter((entry) => String(entry ?? "").trim() !== "");
	if (privateWorkspaces.length > 0) {
		items.push({
			id: "private-ws", tone: "info", group: "privacy",
			title: t("cfgDiagPrivate", { n: privateWorkspaces.length }), hint: t("cfgDiagPrivateHint"),
		});
	}
	const profileFile = typeof value.profileFile === "string" ? value.profileFile.trim() : "";
	if (profileFile === "") {
		items.push({
			id: "profile-empty", tone: "info", group: "profile",
			title: t("cfgDiagProfileEmpty"), hint: t("cfgDiagProfileEmptyHint"),
		});
	}

	// 下面几条依赖 overview(外壳统一拉的那份);拿不到就不检查,避免误报。
	if (overviewData !== null && typeof overviewData === "object") {
		// 回合管道健康(v1.16):boot 失败时页面照样能开、API 照样在,但一回合都不会被记录。
		// 这是最坏的一种静默失效(0 工作区 / 0 记忆),必须显式报出来,别让用户以为"只是没数据"。
		const health = overviewData.stats !== null && typeof overviewData.stats === "object"
			? overviewData.stats.health
			: null;
		if (health !== null && typeof health === "object" && health.state === "failed") {
			const reason = typeof health.error === "string" && health.error !== "" ? health.error : "unknown";
			items.push({
				id: "boot-failed", tone: "warn",
				title: t("cfgDiagBootFailed", { error: reason }), hint: t("cfgDiagBootFailedHint"),
			});
		}
		if (overviewData.stats !== null && typeof overviewData.stats === "object" && overviewData.stats.persisted === false) {
			items.push({
				id: "memory-only", tone: "warn",
				title: t("cfgDiagMemoryOnly"), hint: t("cfgDiagMemoryOnlyHint"),
			});
		}
		if (overviewData.workspaces !== null && typeof overviewData.workspaces === "object"
			&& Number(overviewData.workspaces.total) === 0) {
			items.push({
				id: "no-workspace", tone: "info", group: "privacy",
				title: t("cfgDiagNoWorkspace"), hint: t("cfgDiagNoWorkspaceHint"),
			});
		}
	}

	// Array.prototype.sort 是稳定排序:warn 前 info 后,同档保持声明顺序。
	return items.sort((a, b) => (DIAG_TONE_RANK[a.tone] ?? 9) - (DIAG_TONE_RANK[b.tone] ?? 9));
}

// ── 局部小组件 ────────────────────────────────────────────────────────────

/** 可折叠分组:标题 + 图标 + 「已改 n 项」计数;内容由调用方放进 children 数组。 */
function CfgGroup({ t, group, open, changed, onToggle, children }) {
	const { h } = react;
	const count = changed > 0 ? t("cfgGroupChanged", { n: changed }) : t("cfgGroupCount", { n: group.fields.length });
	return h("section", {
		className: cx("cfg-group", open === true ? "cfg-group-open" : null),
		"data-group-wrap": group.id,
		"data-group-open": open === true ? "true" : "false",
	}, [
		h("div", { className: "cfg-group-head", key: "head" }, [
			h("button", {
				key: "toggle",
				type: "button",
				className: "cfg-group-toggle",
				"data-group": group.id,
				"aria-expanded": open === true,
				onClick: onToggle,
			}, [
				h("span", { className: "cfg-chev", key: "chev" }, h(Icon, { name: "chevron", size: 11 })),
				h(Icon, { key: "icon", name: group.icon, size: 15 }),
				h("span", { className: "cfg-group-title", key: "title" }, t(group.title)),
			]),
			h("span", {
				key: "count",
				className: cx("cfg-group-count", changed > 0 ? "cfg-group-count-changed" : null),
				"data-changed": changed,
			}, count),
		]),
		open === true ? h("div", { className: "cfg-group-body", key: "body" }, children) : null,
	]);
}

/** 「需要关注」诊断卡:逐条 chip + 一句解释 + 可选「去设置」跳转。 */
function DiagnosticCard({ t, items, onJump }) {
	const { h } = react;
	if (items.length === 0) {
		return h(Card, {
			className: "cfg-diag-card",
			title: t("cfgDiagTitle"),
			sub: t("cfgDiagSub"),
			children: [h(Banner, { key: "ok", tone: "ok", title: t("cfgDiagOk"), children: t("cfgDiagOkHint") })],
		});
	}
	return h(Card, {
		className: "cfg-diag-card",
		title: t("cfgDiagTitle"),
		sub: t("cfgDiagCount", { n: items.length }),
		children: [h("div", { className: "cfg-diag-list", key: "list" }, items.map((item) => h("div", {
			className: "cfg-diag-row",
			key: item.id,
			"data-diag": item.id,
			"data-tone": item.tone,
		}, [
			h(Chip, { key: "title", tone: item.tone, dot: true, children: item.title }),
			h("span", { className: "cfg-diag-hint", key: "hint" }, item.hint),
			item.group === undefined ? null : h("button", {
				key: "jump",
				type: "button",
				className: "mem-btn mem-btn-sm mem-btn-ghost",
				"data-diag-jump": item.group,
				onClick: () => onJump(item.group),
			}, t("cfgDiagGo")),
		])))],
	});
}

/** 单个配置字段行:左侧标签 / 说明 / 键名,右侧控件 + 已覆盖徽章 + 重置。 */
function FieldRow({ def, snapshot, t, mutate, disabled, refreshKey }) {
	const { h, useState } = react;
	const [invalid, setInvalid] = useState("");
	const path = pathOf(def.key);
	const value = getPath(snapshot.value ?? {}, path);
	const overridden = getPath(snapshot.user ?? {}, path) !== undefined;
	const labelKey = labelKeyOf(def);
	const descKey = descKeyOf(def);
	const descText = t(descKey);
	const hasDesc = typeof descText === "string" && descText !== descKey && descText.trim() !== "";
	const write = (next) => {
		if (disabled === true) return;
		mutate([{ op: "set", path, value: next }]);
	};
	const reset = () => {
		if (disabled === true) return;
		mutate([{ op: "unset", path }]);
	};

	let control;
	if (def.kind === "toggle") {
		control = h("label", { className: "cfg-toggle", key: "ctl" }, [
			h("input", {
				key: "box",
				type: "checkbox",
				"data-toggle": def.key,
				checked: value === true,
				disabled: disabled === true,
				onChange: (e) => write(e.target.checked),
			}),
			h("span", { className: "cfg-toggle-text", key: "text" }, value === true ? t("commonOn") : t("commonOff")),
		]);
	} else if (def.kind === "select") {
		const options = Array.isArray(def.options) ? def.options : [];
		const current = value === undefined || value === null ? options[0] ?? "" : String(value);
		control = h("select", {
			key: "ctl",
			className: "mem-select",
			"data-select": def.key,
			value: current,
			disabled: disabled === true,
			onChange: (e) => write(e.target.value),
		}, options.map((option) => h("option", { key: option, value: option }, option)));
	} else if (def.kind === "number") {
		control = h(DraftInput, {
			key: "ctl",
			value: toText("text", value),
			type: "number",
			onCommit: (text) => {
				const raw = String(text ?? "").trim();
				if (raw === "") {
					setInvalid(t("cfgNumberRequired"));
					return;
				}
				const next = Number(raw);
				if (!Number.isFinite(next)) {
					setInvalid(t("cfgNumberInvalid"));
					return;
				}
				setInvalid("");
				write(next);
			},
		});
	} else if (def.kind === "workspaces") {
		control = h(WorkspacePicker, {
			key: "ctl",
			value,
			write,
			t,
			disabled,
			refreshKey,
		});
	} else if (def.kind === "lines" || def.kind === "dict") {
		control = h(DraftInput, {
			key: "ctl",
			value: toText(def.kind, value),
			textarea: true,
			placeholder: t(def.kind === "dict" ? "cfgDictPlaceholder" : "cfgLinesPlaceholder"),
			onCommit: (text) => write(fromText(def.kind, text)),
		});
	} else {
		control = h(DraftInput, {
			key: "ctl",
			value: toText("text", value),
			onCommit: (text) => write(text),
		});
	}

	const ctlChildren = [control];
	if (overridden) {
		ctlChildren.push(h("span", {
			key: "override",
			className: "mem-badge mem-badge-warn",
			"data-override": def.key,
			title: t("cfgOverrideHint"),
		}, t("overridden")));
		ctlChildren.push(h("button", {
			key: "reset",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-reset": def.key,
			title: t("cfgResetHint"),
			disabled: disabled === true,
			onClick: reset,
		}, t("reset")));
	}
	if (invalid !== "") {
		ctlChildren.push(h("span", {
			key: "invalid",
			className: "cfg-invalid",
			"data-invalid": def.key,
			role: "alert",
		}, invalid));
	}

	return h("div", {
		className: cx("mem-field", "cfg-field", disabled === true ? "cfg-field-readonly" : null),
		"data-field": def.key,
		"data-kind": def.kind,
	}, [
		h("div", { className: "mem-field-label cfg-field-label", key: "label" }, [
			h("span", { className: "mem-field-name", key: "name" }, t(labelKey)),
			hasDesc ? h("span", { className: "mem-field-desc", key: "desc" }, descText) : null,
			h("code", { className: "cfg-key", key: "key", title: t("cfgKeyHint") }, def.key),
		]),
		h("div", { className: "mem-field-ctl cfg-ctl", key: "ctl" }, ctlChildren),
	]);
}

/**
 * `disabledWorkspaces` 的自定义编辑器(v1.15 升级版):
 *  - 已知工作区列表(勾选 = 启用)+ 搜索过滤 + 全部启用 / 全部停用;
 *  - 每行显示记忆条数与最近出现时间;
 *  - 底部「手动添加路径」折叠区(每行一个,支持前缀),与勾选写**同一字段**。
 *
 * 两个入口基于同一个当前值读写:勾选在 `value` 上增删一条,手动区整段覆盖
 * `toText/fromText("lines")`;`DraftInput` 在外部值变化时回写草稿,不存在两份副本。
 */
function WorkspacePicker({ value, write, t, disabled, refreshKey }) {
	const { h, useState } = react;
	const workspaceState = useConfigApi("workspaces", [refreshKey]);
	const [filter, setFilter] = useState("");
	const [manualOpen, setManualOpen] = useState(false);
	const entries = Array.isArray(value) ? value.map((entry) => String(entry)) : [];
	const rows = workspaceState.data !== null && Array.isArray(workspaceState.data.workspaces)
		? workspaceState.data.workspaces
		: [];
	const query = filter.trim().toLowerCase();
	const visible = query === ""
		? rows
		: rows.filter((row) => {
			const id = String(row.id ?? "").toLowerCase();
			const label = String(row.label ?? "").toLowerCase();
			return id.includes(query) || label.includes(query);
		});
	const disabledCount = rows.filter((row) => coversWorkspace(row.id, entries)).length;

	const setEnabled = (workspaceId, enabled) => {
		if (disabled === true) return;
		if (enabled === true) write(entries.filter((entry) => !coversWorkspace(workspaceId, [entry])));
		else if (!coversWorkspace(workspaceId, entries)) write(entries.concat(String(workspaceId)));
	};
	const enableAll = () => {
		if (disabled === true || rows.length === 0) return;
		write([]);
	};
	const disableAll = () => {
		if (disabled === true || rows.length === 0) return;
		const next = entries.slice();
		for (const row of rows) {
			const id = String(row.id ?? "");
			if (id !== "" && !coversWorkspace(id, next)) next.push(id);
		}
		write(next);
	};
	const lastSeenOf = (row) => {
		const ms = Number(row.lastSeenMs);
		if (Number.isFinite(ms) && ms > 0) return fmtDateTime(new Date(ms).toISOString());
		const at = typeof row.lastSeenAt === "string" ? row.lastSeenAt : "";
		return at === "" ? t("cfgWsNeverSeen") : fmtDateTime(at);
	};

	const nodes = [];
	if (workspaceState.error !== "") {
		nodes.push(h("div", {
			className: "cfg-ws-error mem-msg mem-msg-error",
			key: "error",
			role: "status",
		}, t("cfgWsError") + ": " + workspaceState.error));
	}
	nodes.push(h("div", { className: "cfg-ws-tools", key: "tools" }, [
		h(SearchBox, {
			key: "search",
			value: filter,
			onChange: setFilter,
			placeholder: t("cfgWsSearch"),
		}),
		h("span", { className: "cfg-ws-summary", key: "summary" },
			t("cfgWsSummary", { total: rows.length, disabled: disabledCount })),
	]));
	nodes.push(h("div", { className: "cfg-ws-actions", key: "actions" }, [
		h("button", {
			key: "enable-all",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-ws-action": "enable-all",
			disabled: disabled === true || rows.length === 0,
			onClick: enableAll,
		}, t("cfgWsEnableAll")),
		h("button", {
			key: "disable-all",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-ws-action": "disable-all",
			disabled: disabled === true || rows.length === 0,
			onClick: disableAll,
		}, t("cfgWsDisableAll")),
		h("span", { className: "cfg-ws-prefix mem-hint", key: "prefix" }, t("cfgWsPrefixHint")),
	]));
	if (workspaceState.loading === true && workspaceState.data === null) {
		nodes.push(h("div", { className: "mem-hint", key: "loading" }, t("cfgWsLoading")));
	} else if (rows.length === 0 && workspaceState.error === "") {
		nodes.push(h("div", { className: "mem-hint", key: "empty" }, t("cfgWsEmpty")));
	} else if (rows.length > 0 && visible.length === 0) {
		nodes.push(h("div", { className: "mem-hint", key: "no-match" }, t("cfgWsNoMatch")));
	}
	if (visible.length > 0) {
		nodes.push(h("ul", { className: "cfg-ws-list", key: "list" }, visible.map((row) => {
			const id = String(row.id ?? "");
			const rawLabel = row.label === undefined || row.label === null ? "" : String(row.label);
			const label = rawLabel === "" ? id : rawLabel;
			const count = Number(row.count) || 0;
			return h("li", { className: "cfg-ws-row", key: id, "data-workspace-row": id }, [
				h("label", { className: "cfg-ws-check", key: "check" }, [
					h("input", {
						key: "box",
						type: "checkbox",
						"data-workspace": id,
						checked: !coversWorkspace(id, entries),
						disabled: disabled === true,
						onChange: (e) => setEnabled(id, e.target.checked),
					}),
					h("span", { className: "cfg-ws-label", key: "label", title: id }, label),
				]),
				h("span", { className: "cfg-ws-count mem-num", key: "count" }, t("cfgWsCount", { n: count })),
				h("span", { className: "cfg-ws-time", key: "time" }, t("cfgWsLastSeen", { time: lastSeenOf(row) })),
			]);
		})));
	}
	nodes.push(h("div", { className: "cfg-ws-manual", key: "manual" }, [
		h("button", {
			key: "toggle",
			type: "button",
			className: "mem-btn mem-btn-ghost mem-btn-sm",
			"data-ws-manual": "toggle",
			"aria-expanded": manualOpen === true,
			onClick: () => setManualOpen((prev) => !prev),
		}, t("cfgWsManual")),
		manualOpen === true ? h("div", { className: "cfg-ws-manual-body", key: "body" }, [
			h("div", { className: "mem-hint", key: "count" }, t("cfgWsManualCount", { n: entries.length })),
			h("div", { className: "mem-hint", key: "hint" }, t("cfgWsManualHint")),
			h(DraftInput, {
				key: "input",
				value: toText("lines", value),
				textarea: true,
				placeholder: t("cfgWsManualHint"),
				onCommit: (text) => {
					if (disabled === true) return;
					write(fromText("lines", text));
				},
			}),
		]) : null,
	]));

	return h("div", { className: "cfg-ws" }, nodes);
}

/** 向量检索的密钥管理(只写不显示):读写 DSH credentials,不碰插件配置。 */
function EmbeddingKey({ t, revision, refreshKey, disabled }) {
	const { h, useState } = react;
	const status = useConfigApi("embedKeyStatus", [revision, refreshKey]);
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState("");
	const [failure, setFailure] = useState("");
	const data = status.data;
	const name = typeof data?.name === "string" ? data.name : "";
	const credentials = data === null ? true : data.credentials !== false;
	const statusWritable = data === null ? true : data.writable !== false;
	const optional = data?.optional === true;
	const configured = data?.configured === true;
	const source = typeof data?.source === "string" && data.source !== "" ? data.source : "";

	let stateHint = "";
	if (name === "") stateHint = optional ? t("embedKeyOptionalNoName") : t("embedKeyNeedName");
	else if (!credentials) stateHint = t("embedKeyUnavailable");
	else if (configured) stateHint = t("embedKeyConfigured") + (source === "" ? "" : " · " + t("cfgEmbedKeySource", { source }));
	else stateHint = optional ? t("embedKeyOptionalHint") : t("embedKeyMissing");

	const save = () => {
		if (disabled === true || busy || key.trim() === "") return;
		setBusy(true);
		setNote("");
		setFailure("");
		api("embedKeySave", { key: key.trim() })
			.then(() => {
				setKey("");
				setNote(t("embedKeySaved"));
				status.reload();
			})
			.catch((e) => setFailure(String(e?.message ?? e)))
			.finally(() => setBusy(false));
	};
	const clear = () => {
		if (disabled === true || busy) return;
		setBusy(true);
		setNote("");
		setFailure("");
		api("embedKeyClear")
			.then(() => {
				setNote(t("embedKeyCleared"));
				status.reload();
			})
			.catch((e) => setFailure(String(e?.message ?? e)))
			.finally(() => setBusy(false));
	};

	const controls = [];
	if (status.loading === true && data === null) {
		controls.push(h("span", { className: "mem-hint", key: "loading" }, t("commonLoading")));
	} else if (status.error !== "" && data === null) {
		controls.push(h("span", { className: "cfg-invalid", key: "error", role: "alert" },
			t("commonError") + ": " + status.error));
	} else if (credentials === false || name === "") {
		controls.push(h("span", { className: "mem-hint", key: "hint" }, stateHint));
	} else {
		controls.push(h("input", {
			key: "key",
			className: "mem-input",
			type: "password",
			autoComplete: "new-password",
			"data-embed-key": "input",
			value: key,
			disabled: disabled === true || busy === true,
			placeholder: configured ? t("embedKeyPlaceholderUpdate") : "sk-…",
			onChange: (e) => setKey(e.target.value),
		}));
		controls.push(h("button", {
			key: "save",
			type: "button",
			className: "mem-btn mem-btn-primary",
			"data-embed-action": "save",
			disabled: disabled === true || busy === true || key.trim() === "",
			onClick: save,
		}, t("embedKeySave")));
		controls.push(h("button", {
			key: "clear",
			type: "button",
			className: "mem-btn",
			"data-embed-action": "clear",
			disabled: disabled === true || busy === true || configured !== true || statusWritable !== true,
			onClick: clear,
		}, t("embedKeyClear")));
		controls.push(h("span", { className: "mem-hint", key: "state" }, stateHint));
	}
	if (note !== "") controls.push(h("span", { className: "mem-msg mem-msg-ok", key: "note" }, note));
	if (failure !== "") controls.push(h("span", { className: "cfg-invalid", key: "failure", role: "alert" }, failure));

	return h("div", { className: "mem-field cfg-field cfg-field-embed", "data-embed": "key" }, [
		h("div", { className: "mem-field-label cfg-field-label", key: "label" }, [
			h("span", { className: "mem-field-name", key: "name" }, t("embedKeyLabel")),
			h("span", { className: "mem-field-desc", key: "desc" }, t("embedKeyHint")),
		]),
		h("div", { className: "mem-field-ctl cfg-ctl", key: "ctl" }, controls),
	]);
}

/** 连接测试:发一条固定短文本验证 baseUrl / modelId / 凭据,不读写记忆。 */
function EmbeddingProbe({ t, disabled }) {
	const { h, useState } = react;
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState(null);
	const run = () => {
		if (disabled === true || busy === true) return;
		setBusy(true);
		setResult(null);
		api("embedTest")
			.then((response) => setResult({ ok: true, ...response }))
			.catch((e) => setResult({ ok: false, error: String(e?.message ?? e) }))
			.finally(() => setBusy(false));
	};
	const controls = [h("button", {
		key: "run",
		type: "button",
		className: "mem-btn",
		"data-embed-action": "test",
		disabled: disabled === true || busy === true,
		onClick: run,
	}, busy === true ? t("embedTesting") : t("embedTest"))];
	if (result !== null && result.ok === true) {
		const meta = [
			String(result.model ?? "—"),
			String(result.dimensions ?? "—") + " " + t("embedTestDims"),
			String(result.latencyMs ?? "—") + "ms",
		].join(" · ");
		controls.push(h("span", { className: "mem-msg mem-msg-ok", key: "ok", "data-embed-result": "ok" }, "✓ " + meta));
	} else if (result !== null) {
		controls.push(h("span", { className: "cfg-invalid", key: "error", role: "alert", "data-embed-result": "error" },
			"✗ " + t("cfgEmbedFailed") + ": " + String(result.error ?? "")));
	}
	return h("div", { className: "mem-field cfg-field cfg-field-embed", "data-embed": "probe" }, [
		h("div", { className: "mem-field-label cfg-field-label", key: "label" }, [
			h("span", { className: "mem-field-name", key: "name" }, t("embedTest")),
			h("span", { className: "mem-field-desc", key: "desc" }, t("embedTestHint")),
		]),
		h("div", { className: "mem-field-ctl cfg-ctl", key: "ctl" }, controls),
	]);
}

// ── 面板本体 ──────────────────────────────────────────────────────────────

function ConfigCard({ t, form, overview, refreshKey = 0 }) {
	const { h, useState, useCallback, useSyncExternalStore } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const activeForm = form ?? null;

	// 读快照:form 缺席时退化为「设置服务不可用」的静态快照,而不是抛错整页白屏。
	const subscribe = useCallback((callback) => (
		typeof activeForm?.subscribe === "function" ? activeForm.subscribe(callback) : () => {}
	), [activeForm]);
	const getSnapshot = useCallback(() => (
		typeof activeForm?.getSnapshot === "function" ? activeForm.getSnapshot() : UNAVAILABLE_SNAPSHOT
	), [activeForm]);
	const snapshot = useSyncExternalStore(subscribe, getSnapshot) ?? UNAVAILABLE_SNAPSHOT;
	const writer = useSettingsWriter(activeForm, tt);

	const [query, setQuery] = useState("");
	const [openGroups, setOpenGroups] = useState(INITIAL_OPEN);
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const setGroupOpen = (id, open) => setOpenGroups((prev) => ({ ...prev, [id]: open === true }));
	const expandAll = () => {
		setOpenGroups(ALL_OPEN);
		setAdvancedOpen(true);
	};
	const collapseAll = () => {
		setOpenGroups(ALL_CLOSED);
		setAdvancedOpen(false);
	};
	const jumpToGroup = (id) => {
		setQuery("");
		setGroupOpen(id, true);
	};

	// ── 三态:加载中 / 设置服务不可用 / 正常可编辑 ─────────────────────────
	if (snapshot.status === "loading") {
		return h(Card, {
			className: "cfg-card",
			title: tt("configTitle"),
			sub: tt("configHint"),
			children: [
				h(Toolbar, {
					key: "chips",
					children: [h(Chip, {
						key: "service",
						tone: "muted",
						children: tt("cfgService") + " · " + tt("cfgServiceLoading"),
					})],
				}),
				h(Skeleton, { key: "skeleton", lines: 5 }),
			],
		});
	}
	if (snapshot.status !== "ready") {
		return h(Card, {
			className: "cfg-card",
			title: tt("configTitle"),
			children: [h(Banner, {
				key: "unavailable",
				tone: "warn",
				title: tt("cfgServiceUnavailable"),
				children: [tt("configUnavailable"), " ", tt("configUnavailableHint")],
			})],
		});
	}

	const value = snapshot.value ?? {};
	const user = snapshot.user ?? {};
	const readonly = snapshot.writable === false;
	const overviewData = overview !== null && typeof overview === "object" ? (overview.data ?? null) : null;
	const items = diagnoseConfig(tt, value, overviewData);
	const changedTotal = CONFIG_FIELDS.filter((def) => fieldOverridden(user, def.key)).length;

	const queryNorm = query.trim().toLowerCase();
	const searching = queryNorm !== "";
	const matchesByGroup = new Map();
	let matchCount = 0;
	for (const group of GROUPS) {
		const defs = group.fields.filter((def) => !searching || matchesField(tt, def, queryNorm));
		if (!searching || defs.length > 0) matchesByGroup.set(group.id, defs);
		if (searching) matchCount += defs.length;
	}

	/** 生成一组的字段行;向量组额外插入密钥管理 / 连接测试 / 高级选项。 */
	const buildGroupRows = (group, defs) => {
		const core = [];
		const advanced = [];
		for (const def of defs) {
			const row = h(FieldRow, {
				key: def.key, def, snapshot, t: tt, mutate: writer.mutate, disabled: readonly, refreshKey,
			});
			if (def.advanced === true) {
				advanced.push(row);
				continue;
			}
			core.push(row);
			if (group.id === "embedding" && def.key === "semanticSearch.apiKeyEnv") {
				core.push(h(EmbeddingKey, {
					key: "embed-key", t: tt, revision: snapshot.revision, refreshKey, disabled: readonly,
				}));
			}
			if (group.id === "embedding" && def.key === "semanticSearch.apiKeyOptional") {
				core.push(h(EmbeddingProbe, { key: "embed-probe", t: tt, disabled: readonly }));
			}
		}
		if (advanced.length > 0) {
			const showAdvanced = advancedOpen === true || searching;
			core.push(h("div", { className: "cfg-advanced-toggle", key: "advanced-toggle" }, [
				h("button", {
					key: "toggle",
					type: "button",
					className: "mem-btn mem-btn-ghost mem-btn-sm",
					"data-advanced": group.id,
					"aria-expanded": showAdvanced,
					onClick: () => setAdvancedOpen((prev) => !prev),
				}, tt(showAdvanced ? "hideAdvanced" : "showAdvanced")),
				h("span", { className: "mem-hint", key: "hint" }, tt("cfgAdvancedHint")),
			]));
			if (showAdvanced) {
				core.push(h("div", { className: "cfg-advanced", key: "advanced" }, advanced));
			}
		}
		return core;
	};

	const groupNodes = [];
	for (const group of GROUPS) {
		const defs = matchesByGroup.get(group.id);
		if (defs === undefined) continue;
		const changed = group.fields.filter((def) => fieldOverridden(user, def.key)).length;
		groupNodes.push(h(CfgGroup, {
			key: group.id,
			t: tt,
			group,
			open: searching ? true : openGroups[group.id] === true,
			changed,
			onToggle: () => setGroupOpen(group.id, !(searching ? true : openGroups[group.id] === true)),
			children: buildGroupRows(group, defs),
		}));
	}

	const statusChips = [
		h(Chip, {
			key: "service",
			tone: readonly ? "warn" : "ok",
			title: tt("cfgServiceHint"),
			children: tt("cfgService") + " · " + tt(readonly ? "cfgServiceReadonly" : "cfgServiceReady"),
		}),
		h(Chip, {
			key: "autosave",
			tone: "muted",
			dot: false,
			title: tt("cfgAutoSaveHint"),
			children: tt("cfgAutoSave"),
		}),
		h(Chip, {
			key: "overridden",
			tone: changedTotal > 0 ? "warn" : "muted",
			dot: changedTotal > 0,
			title: tt("cfgOverriddenHint"),
			children: tt("cfgOverriddenCount", { n: changedTotal }),
		}),
		h(Chip, {
			key: "fields",
			tone: "muted",
			dot: false,
			children: tt("cfgFieldCount", { n: CONFIG_FIELDS.length }),
		}),
	];

	const statusChildren = [h(Toolbar, { key: "chips", children: statusChips })];
	if (readonly) {
		statusChildren.push(h(Banner, {
			key: "readonly",
			tone: "warn",
			title: tt("cfgServiceReadonly"),
			children: tt("configReadonly"),
		}));
	}
	if (writer.error !== "") {
		statusChildren.push(h(Banner, {
			key: "write-error",
			tone: "error",
			title: tt("cfgWriteError"),
			children: writer.error,
		}));
	}

	const searchChildren = [
		h(SearchBox, {
			key: "search",
			value: query,
			onChange: setQuery,
			onClear: () => setQuery(""),
			placeholder: tt("cfgSearchPlaceholder"),
		}),
	];
	if (searching) {
		searchChildren.push(h("span", { className: "cfg-match", key: "match" }, tt("cfgSearchMatches", { n: matchCount })));
	}
	searchChildren.push(h("button", {
		key: "expand",
		type: "button",
		className: "mem-btn mem-btn-toolbar",
		"data-action": "expand",
		onClick: expandAll,
	}, tt("cfgExpandAll")));
	searchChildren.push(h("button", {
		key: "collapse",
		type: "button",
		className: "mem-btn mem-btn-toolbar",
		"data-action": "collapse",
		onClick: collapseAll,
	}, tt("cfgCollapseAll")));

	return h("div", { className: "cfg" }, [
		h(Card, {
			key: "status",
			className: "cfg-status-card",
			title: tt("configTitle"),
			sub: tt("configHint"),
			children: statusChildren,
		}),
		h(DiagnosticCard, { key: "diag", t: tt, items, onJump: jumpToGroup }),
		h(Toolbar, { key: "tools", children: searchChildren }),
		searching && matchCount === 0
			? h(Empty, { key: "no-match", title: tt("cfgSearchEmpty") })
			: null,
		...groupNodes,
	]);
}
		exps.default = ConfigCard;
		exps["GROUPS"] = GROUPS;
		exps["diagnoseConfig"] = diagnoseConfig;
		exps["ConfigCard"] = ConfigCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/profile-card.js
	var mod_profile_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var api = mod_runtime_js["api"];
		var Card = mod_components_js["Card"];
		var Banner = mod_components_js["Banner"];
		var Empty = mod_components_js["Empty"];
		var Skeleton = mod_components_js["Skeleton"];
		var Toolbar = mod_components_js["Toolbar"];

// ── L1 用户画像(§4.1):记忆页直接编辑那个 md 文件 ──────────────────────
// 一个真相源 = 文件;这里不引入"配置内文本"(那正是画像被写两遍的来源)。
//
// v1.15 重排信息层级(**行为与 API 调用序列不变**):
//   头部:路径 / 文件字符数 / 轮询间隔 / 当前注入字符数 / 未保存徽章;
//   工具栏:保存 / 放弃修改 / 重新加载;
//   编辑区:等宽、随内容撑高(textarea 自适应),底部给草稿字符数与上限提示。
// 调用序列照旧:挂载 → profile;保存 → profileSave;重新加载 → profile;「放弃修改」只改本地草稿。
// 「未配置画像文件」空态用 form 快照里的 profileFile 判断(只读,不写配置),并引导去配置页。

/** 后端 lib/api.js 的 PROFILE_MAX_CHARS:画像每轮注入,超限后端拒绝写入。这里只用于展示提示,不做客户端拦截。 */
const PROFILE_MAX_CHARS = 20_000;

function ProfileCard({ t, form, onNavigate }) {
	const { h, useState, useEffect, useCallback } = react;
	const [data, setData] = useState(null);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);

	const reload = useCallback(() => {
		api("profile")
			.then((r) => {
				if (r.ok !== true) { setError(r.error); setData(null); return; }
				// content 兜底成空串:数据形状异常时也别把 textarea 的受控值弄成 undefined。
				const content = typeof r.content === "string" ? r.content : "";
				setData({ ...r, content }); setDraft(content); setError("");
			})
			.catch((e) => setError(String(e.message ?? e)));
	}, []);
	useEffect(() => { reload(); }, [reload]);

	const save = () => {
		setBusy(true); setMsg("");
		api("profileSave", { content: draft })
			.then((r) => {
				if (r.ok !== true) { setError(r.error); return; }
				setData((cur) => (cur === null ? cur : { ...cur, content: draft, chars: r.chars, exists: true }));
				setError(""); setMsg(t("profileSaved"));
			})
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setBusy(false));
	};

	const dirty = data !== null && draft !== data.content;
	const undo = () => {
		if (data === null) return;
		setDraft(data.content);
		setError("");
		setMsg("");
	};

	// 只读 form 快照判断「画像文件是否配置」:仅用于把"未配置"空态引到配置页。
	// 不订阅快照(在配置页改完路径后点一次「重新加载」即可重新判断),也不写配置。
	const snapshotValue = form === undefined || form === null ? null : form.getSnapshot()?.value;
	const profileFile = snapshotValue === undefined || snapshotValue === null ? undefined : snapshotValue.profileFile;
	const fileConfigured = profileFile === undefined ? true : String(profileFile) !== "";
	const unconfigured = !fileConfigured && data === null && error !== "";
	const overLimit = draft.length > PROFILE_MAX_CHARS;

	const meta = data === null ? null : h("div", { className: "per-meta", key: "meta" }, [
		h("code", { className: "per-meta-path", key: "p" }, data.path),
		h("span", { key: "c" }, String(data.chars ?? "?") + " " + t("profileChars")),
		data.pollSeconds === undefined || data.pollSeconds === null ? null
			: h("span", { key: "poll" }, t("perPoll", { n: data.pollSeconds })),
		data.injectionChars === undefined ? null
			: h("span", { key: "inj" }, t("perInjected", { n: data.injectionChars })),
		dirty ? h("span", { className: "mem-badge mem-badge-over", key: "d" }, t("profileDirty")) : null,
	]);

	const truncatedFlag = data !== null && data.truncated === true;

	// R26:配了路径但文件不存在(常见于路径写错,如旧的 ~ 写法)→ 明确提示,不装作"空画像"。
	const missing = data !== null && data.exists === false && data.path !== "";
	const missingBanner = missing
		? h(Banner, {
			key: "missing", tone: "warn", title: t("perMissingTitle"),
			children: t("perMissing", { path: data.path }),
		})
		: null;

	const truncated = truncatedFlag
		? h(Banner, {
			key: "truncated", tone: "warn", title: t("perTruncatedTitle"),
			children: t("perTruncated", { n: PROFILE_MAX_CHARS }),
		})
		: null;

	const toolbar = data === null ? null : h(Toolbar, { key: "tb", children: [
		h("button", {
			className: "mem-btn mem-btn-primary", key: "save",
			disabled: busy || !dirty || truncatedFlag, onClick: save,
		}, t("profileSave")),
		dirty ? h("button", { className: "mem-btn", key: "undo", disabled: busy, onClick: undo }, t("profileUndo")) : null,
		h("button", {
			className: "mem-btn", key: "reload",
			disabled: busy || dirty,
			title: dirty ? t("profileReloadBlocked") : "",
			onClick: reload,
		}, t("profileReload")),
		overLimit ? h("span", { className: "per-over", key: "over" }, t("perOverLimit", { n: PROFILE_MAX_CHARS })) : null,
		msg !== "" ? h("span", { className: "mem-msg mem-msg-ok", key: "msg" }, msg) : null,
	]});

	const editor = data === null ? null : h("div", { className: "per-editor-wrap", key: "ed" }, [
		h("textarea", {
			className: "mem-input mem-profile-text per-editor", key: "ta", spellCheck: false,
			value: draft,
			placeholder: t("perEditorPlaceholder"),
			onChange: (e) => { setDraft(e.target.value); setMsg(""); },
		}),
		h("div", { className: "per-editor-foot", key: "foot" }, [
			h("span", {
				className: "per-charcount", key: "count",
				"data-over": String(overLimit),
			}, draft.length + " / " + PROFILE_MAX_CHARS + " " + t("profileChars")),
			h("span", { className: "mem-hint", key: "limit" }, t("perLimit", { n: PROFILE_MAX_CHARS })),
			draft.trim() === "" ? h("span", { className: "mem-hint", key: "empty" }, t("profileEmpty")) : null,
		]),
	]);

	return h(Card, {
		title: t("profileTitle"),
		sub: t("profileHint"),
		children: [
			meta,
			missingBanner,
			truncated,
			error !== "" && !unconfigured
				? h(Banner, { key: "error", tone: "error", title: t("commonError"), children: error })
				: null,
			unconfigured
				? h(Empty, {
					key: "unconfigured",
					title: t("perUnconfigured"),
					hint: t("profileNoFile"),
					action: onNavigate === undefined || onNavigate === null ? null
						: h("button", {
							className: "mem-btn mem-btn-primary", onClick: () => onNavigate("config"),
						}, t("perGoConfig")),
				})
				: null,
			data === null && error === "" ? h(Skeleton, { key: "loading", lines: 5 }) : null,
			toolbar,
			editor,
		],
	});
}
		exps["ProfileCard"] = ProfileCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/soul-card.js
	var mod_soul_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var api = mod_runtime_js["api"];
		var pathOf = mod_runtime_js["pathOf"];
		var getPath = mod_runtime_js["getPath"];
		var useSettingsWriter = mod_runtime_js["useSettingsWriter"];
		var Card = mod_components_js["Card"];
		var Banner = mod_components_js["Banner"];
		var Empty = mod_components_js["Empty"];
		var Skeleton = mod_components_js["Skeleton"];

// ── SOUL(§4.4)──────────────────────────────────────────────────────────
//
// v1.15 重排视觉与信息层级(**行为与 API 调用序列不变**):
//   头部:总开关 + 允许自改;元信息行:路径 / 字符数上限 / 今日自改预算 / 版本数 / 最后一版;
//   正文:当前版本预览 → 人格提议 → 版本历史(最近 3 版 + 「全部历史」覆盖层);
//   覆盖层:编辑器 / diff / 覆盖层内回滚确认条(类名保持旧值,测试与旧样式依赖它们)。
// 调用序列照旧:挂载 → soul;保存 → soulSave 后 soul;回滚 → soulRollback 后 soul;
// diff → soulVersion;提议 → soulAdoptProposal / soulIgnoreProposal 后 soul。

/** SOUL 卡读写的两个设置字段。本页是它们唯一确定的编辑面,清单要和 volatile 全集对齐(见 check-seams ⑦)。 */
const SOUL_MASTER = "soulEnabled";
const SOUL_SELF_EDIT = "soulSelfEditEnabled";
const SOUL_FIELDS = [SOUL_MASTER, SOUL_SELF_EDIT];

const SOUL_AUTHOR_LABEL = { agent: "soulAuthorAgent", user: "soulAuthorUser", external: "soulAuthorExternal" };
const SOUL_AUTHOR_CLASS = { agent: "mem-badge-agent", user: "mem-badge-user", external: "mem-badge-ext" };
const shortTime = (ts) => String(ts ?? "").replace("T", " ").slice(5, 16);
const authorLabel = (t, author) => t(SOUL_AUTHOR_LABEL[author] ?? "soulAuthorExternal");
const authorClass = (author) => SOUL_AUTHOR_CLASS[author] ?? "mem-badge-ext";

/** diff 的行数上限:超过就不做逐行对比(LCS 是 O(n×m),上万行会卡死主线程)。 */
const DIFF_MAX_LINES = 2000;

/** 逐行 LCS diff(只用于展示;有行数上限,DP 用 Uint32 防环绕)。 */
function lineDiff(prev, next) {
	const a = prev === "" ? [] : String(prev).split("\n");
	const b = next === "" ? [] : String(next).split("\n");
	if (a.length > DIFF_MAX_LINES || b.length > DIFF_MAX_LINES) {
		return [{ t: " ", line: "…(版本过长:" + a.length + " → " + b.length + " 行,超过 " + DIFF_MAX_LINES + " 行上限,不做逐行对比)" }];
	}
	const n = a.length, m = b.length;
	const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const out = [];
	let i = 0, j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) { out.push({ t: " ", line: a[i] }); i += 1; j += 1; }
		else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "-", line: a[i] }); i += 1; }
		else { out.push({ t: "+", line: b[j] }); j += 1; }
	}
	while (i < n) { out.push({ t: "-", line: a[i] }); i += 1; }
	while (j < m) { out.push({ t: "+", line: b[j] }); j += 1; }
	return out;
}

/** 版本历史行:最近 3 版(卡片)与全部历史(覆盖层侧栏)共用;limit 省略 = 全量。 */
function SoulVersionRows({ rows, t, onDiff, onRollback, limit }) {
	const { h } = react;
	const list = limit === undefined ? rows : rows.slice(0, limit);
	return list.map((row) => h("div", { className: "mem-soul-v", key: row.id }, [
		h("span", { className: "when", key: "w" }, shortTime(row.ts)),
		h("span", { className: "mem-badge " + authorClass(row.author), key: "a" }, authorLabel(t, row.author)),
		h("span", { className: "why", key: "y", title: row.reason }, row.reason === "" ? "—" : row.reason),
		h("span", { className: "delta", key: "d" }, row.before + " → " + row.after),
		h("span", { className: "acts", key: "acts" }, [
			h("button", { className: "mem-btn", key: "diff", onClick: () => onDiff(row.id) }, t("soulDiff")),
			h("button", { className: "mem-btn", key: "rb", onClick: () => onRollback(row.id) }, t("soulRollback")),
		]),
	]));
}

/** diff 视图:版本回看与提议预览共用一个渲染器(别让两处样式/结构漂移)。 */
function DiffBlock({ prev, next, hint, t }) {
	const { h } = react;
	return h("div", { className: "mem-overlay-main", key: "main" }, [
		h("div", { className: "mem-diff", key: "d" },
			h("pre", null, lineDiff(prev, next).map((row, index) =>
				h("span", {
					className: "ln" + (row.t === "+" ? " add" : row.t === "-" ? " del" : ""),
					key: String(index),
				}, row.t + " " + row.line)))),
		h("div", { className: "mem-hint", key: "hint" }, hint),
	]);
}

function SoulCard({ form, t }) {
	const { h, useState, useEffect, useCallback, useSyncExternalStore } = react;
	const snapshot = useSyncExternalStore((cb) => form.subscribe(cb), () => form.getSnapshot());
	const [data, setData] = useState(null);
	const [error, setError] = useState("");
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);
	const [overlay, setOverlay] = useState(null); // null | { mode: "edit" | "diff", draft?, entry? }
	const [confirmId, setConfirmId] = useState("");

	const reload = useCallback(() => {
		api("soul")
			.then((r) => {
				// content/history 兜底:形状异常时别让预览与历史区把整页渲染炸掉(不改调用序列)。
				const content = typeof r.content === "string" ? r.content : "";
				const history = Array.isArray(r.history) ? r.history : [];
				setData({ ...r, content, history }); setError("");
			})
			.catch((e) => setError(String(e.message ?? e)));
	}, []);
	useEffect(() => { reload(); }, [reload]);

	const ready = snapshot.status === "ready";
	const writer = useSettingsWriter(form, t);
	const flag = (key) => getPath(snapshot.value, pathOf(key)) === true;
	const writeFlag = (key, v) => writer.mutate([{ op: "set", path: pathOf(key), value: v }]);

	const openEdit = () => setOverlay({ mode: "edit", draft: data === null ? "" : data.content });
	const openDiff = (id) => {
		api("soulVersion", { id })
			.then((r) => setOverlay({ mode: "diff", entry: r.entry }))
			.catch((e) => setError(String(e.message ?? e)));
	};
	const save = () => {
		if (overlay === null || overlay.mode !== "edit") return;
		setBusy(true);
		setMsg("");
		setError("");
		api("soulSave", { content: overlay.draft })
			.then((r) => { setOverlay(null); setMsg(t("soulSaved") + " · " + r.id); reload(); })
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setBusy(false));
	};
	const rollback = (id) => {
		setBusy(true);
		setMsg("");
		setError("");
		api("soulRollback", { id })
			.then((r) => { setConfirmId(""); setMsg(t("soulSaved") + " · " + r.id); reload(); })
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setBusy(false));
	};
	// 提议通道(§9-17):采纳 = 用户通道写入 SOUL(整篇 replace / 追加 append);忽略 = 归档。
	// 0.7.0 起 agent 只能提"整篇",采纳前必须先看 diff —— 所以 replace 的"采纳"先开对比覆盖层。
	const actProposal = (id, action) => {
		setBusy(true);
		setMsg("");
		setError("");
		api(action, { id })
			.then(() => { setOverlay(null); setMsg(t(action === "soulAdoptProposal" ? "soulAdopted" : "soulIgnored")); reload(); })
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setBusy(false));
	};
	const askProposal = (p) => {
		if (p.mode === "replace") { setOverlay({ mode: "proposal", proposal: p }); return; }
		actProposal(p.id, "soulAdoptProposal");
	};

	// 确认条既出现在卡片内,也出现在覆盖层顶部;否则在覆盖层里点"回滚"会看不到确认入口。
	const confirmBar = () => h("div", { className: "mem-soul-confirm", key: "cf" }, [
		h("span", { key: "q" }, t("soulConfirm")),
		h("span", { key: "sp", style: { marginLeft: "auto" } }),
		h("button", { className: "mem-btn", key: "c", onClick: () => setConfirmId("") }, t("soulCancel")),
		h("button", {
			className: "mem-btn mem-btn-primary", key: "ok", disabled: busy,
			onClick: () => rollback(confirmId),
		}, t("soulConfirmOk")),
	]);

	const masterOn = flag(SOUL_MASTER);
	const selfEditOn = flag(SOUL_SELF_EDIT);
	const history = data === null ? [] : data.history;
	const empty = data !== null && data.content === "";
	const proposals = data === null || !Array.isArray(data.proposals) ? [] : data.proposals;

	// ── 头部开关:总开关关掉时自改一并停用(§4.4):置灰 + 点击无效,不留"它还在偷偷改"的半开状态 ──
	const toggles = h("span", { className: "mem-soul-toggles", key: "sw" }, [
		h("span", {
			className: "mem-switch", key: "master",
			role: "switch", tabIndex: 0,
			"aria-checked": String(masterOn),
			"aria-label": t("soulMaster"),
			title: t("soulMasterHint"),
			"data-on": String(masterOn),
			onClick: () => { if (ready) writeFlag(SOUL_MASTER, !masterOn); },
			onKeyDown: (e) => {
				if (e.key !== " " && e.key !== "Enter") return;
				e.preventDefault();
				if (ready) writeFlag(SOUL_MASTER, !masterOn);
			},
		}, [h("i", { className: "dot", key: "d" }), t("soulMaster")]),
		h("span", {
			className: "mem-switch", key: "self",
			role: "switch",
			tabIndex: masterOn ? 0 : -1,
			"aria-checked": String(selfEditOn),
			"aria-disabled": String(!masterOn),
			"data-on": String(selfEditOn),
			"data-disabled": String(!masterOn),
			title: masterOn ? "" : t("soulSelfEditDisabled"),
			onClick: () => {
				if (!ready || !masterOn) return;
				writeFlag(SOUL_SELF_EDIT, !selfEditOn);
			},
			onKeyDown: (e) => {
				if (e.key !== " " && e.key !== "Enter") return;
				e.preventDefault();
				if (!ready || !masterOn) return;
				writeFlag(SOUL_SELF_EDIT, !selfEditOn);
			},
		}, [h("i", { className: "dot", key: "d" }), t("soulSelfEdit")]),
	]);

	const meta = data === null ? null : h("div", { className: "mem-soul-meta soul-meta", key: "meta" }, [
		h("code", { key: "p" }, data.path),
		h("span", { key: "c" }, empty
			? t("soulNoFile")
			: (data.chars ?? "?") + " / " + (data.maxChars ?? "?") + " " + t("soulCharsUnit")),
		h("span", { key: "d" }, t("soulTodayEdit") + " " + (data.dailyUsed ?? "?") + "/" + (data.dailyBudget ?? "?")),
		h("span", { key: "v" }, t("soulVersionCount") + " " + history.length),
		data.lastVersion === null || data.lastVersion === undefined ? null
			: h("span", { key: "l" },
				t("soulLastVersion") + " " + shortTime(data.lastVersion.ts) + "(" + authorLabel(t, data.lastVersion.author) + ")"),
	]);

	const preview = data === null || empty ? null : h("div", { className: "mem-soul-preview soul-preview", key: "pv" }, [
		h("div", { className: "soul-preview-head", key: "head" }, [
			h("span", { className: "soul-preview-title", key: "t" }, t("soulPreviewTitle")),
			h("button", { className: "mem-btn", key: "edit", onClick: openEdit }, t("soulEdit")),
		]),
		h("pre", { key: "p" }, data.content),
		h("div", { className: "mem-soul-preview-foot", key: "f" }, [
			h("span", { className: "mem-hint", key: "h" }, t("soulPreviewHint")),
		]),
	]);

	const proposalList = proposals.length === 0 ? null : h("div", { className: "soul-proposals", key: "pr" }, [
		h("div", { className: "mem-soul-hist-head", key: "h" }, [
			h("span", { key: "n" }, t("soulProposals")),
			h("span", { className: "mem-hint", key: "hint" }, t("soulProposalHint")),
		]),
		proposals.map((p) => h("div", { className: "mem-soul-v", key: p.id }, [
			h("span", { className: "mem-badge mem-badge-user", key: "m" },
				p.mode === "replace" ? t("soulProposalReplace") : t("soulProposalAppend")),
			h("span", { className: "why", key: "c", title: p.reason === "" ? p.content : p.reason },
				p.mode === "replace" ? (p.reason === "" ? t("soulProposalView") : p.reason) : p.content),
			h("span", { className: "delta", key: "d" }, p.mode === "replace"
				? (data === null ? "?" : data.content.length) + " → " + p.chars
				: "+" + p.chars),
			h("span", { className: "acts", key: "acts" }, [
				p.mode !== "replace" ? null
					: h("button", {
						className: "mem-btn", key: "v",
						onClick: () => setOverlay({ mode: "proposal", proposal: p }),
					}, t("soulProposalView")),
				h("button", { className: "mem-btn mem-btn-primary", key: "a", disabled: busy, onClick: () => askProposal(p) }, t("soulAdopt")),
				h("button", { className: "mem-btn", key: "i", disabled: busy, onClick: () => actProposal(p.id, "soulIgnoreProposal") }, t("soulIgnore")),
			]),
		])),
	]);

	const historyBlock = data === null || empty ? null : h("div", { className: "soul-history", key: "hist" }, [
		h("div", { className: "mem-soul-hist-head", key: "hh" }, [
			h("span", { key: "n" }, data.persisted ? t("soulRecentVersions") : t("soulUnpersisted")),
			h("button", { className: "mem-btn", key: "all", onClick: openEdit }, t("soulAllHistory")),
		]),
		data.persisted && history.length === 0
			? h("div", { className: "mem-hint", key: "nv" }, t("soulNoVersions"))
			: null,
		h("div", { className: "mem-soul-hist", key: "rows" },
			h(SoulVersionRows, { rows: history, t, onDiff: openDiff, onRollback: (id) => setConfirmId(id), limit: 3 })),
	]);

	const card = h(Card, {
		title: t("soulTitle"),
		actions: toggles,
		children: [
			meta,
			error !== ""
				? h(Banner, { key: "error", tone: "error", title: t("commonError"), children: error })
				: null,
			writer.error !== ""
				? h(Banner, { key: "write-error", tone: "error", title: t("commonError"), children: writer.error })
				: null,
			msg !== "" ? h("div", { className: "mem-msg mem-msg-ok", key: "ok" }, msg) : null,
			data === null ? h(Skeleton, { key: "loading", lines: 5 }) : null,
			data === null || empty ? null : preview,
			data !== null && empty
				? h(Empty, {
					key: "empty",
					title: t("soulEmptyTitle"),
					hint: t("soulEmptyBody"),
					action: h("button", { className: "mem-btn mem-btn-primary", onClick: openEdit }, t("soulCreate")),
				})
				: null,
			proposalList,
			historyBlock,
			confirmId === "" ? null : confirmBar(),
			h("div", { className: "mem-hint soul-foot", key: "foot" }, t("soulFootHint")),
		],
	});

	if (overlay === null) return card;

	const proposalEntry = overlay.mode === "proposal" ? overlay.proposal : null;
	const chars = overlay.mode === "edit" ? overlay.draft.length : 0;
	const over = data !== null && chars > data.maxChars;
	const overlayTitle = overlay.mode === "edit"
		? t("soulEditorTitle")
		: (proposalEntry === null ? t("soulDiffTitle") : t("soulProposalDiffTitle"));
	const overlaySub = overlay.mode === "edit"
		? t("soulEditorSub")
		: proposalEntry !== null
			? (proposalEntry.reason === "" ? "" : proposalEntry.reason + " · ")
				+ (data === null ? "?" : data.content.length) + " → " + proposalEntry.chars + " " + t("soulCharsUnit")
			: shortTime(overlay.entry.ts) + " · " + authorLabel(t, overlay.entry.author)
				+ (overlay.entry.reason === "" ? "" : " · " + overlay.entry.reason);
	const body = overlay.mode === "edit"
		? h("div", { className: "mem-overlay-main", key: "main" }, [
			h("textarea", {
				className: "mem-editor", key: "ed", value: overlay.draft, spellCheck: false,
				"aria-label": t("soulEditorTitle"),
				placeholder: t("soulEditorPlaceholder"),
				onChange: (e) => setOverlay({ mode: "edit", draft: e.target.value }),
			}),
			over
				? h("div", { className: "mem-hint soul-over-hint", key: "over" }, t("soulOverLimit", { n: data.maxChars }))
				: null,
		])
		: proposalEntry !== null
			? h(DiffBlock, {
				prev: data === null ? "" : data.content, next: proposalEntry.content,
				hint: t("soulProposalDiffHint"), t,
			})
			: h(DiffBlock, {
				prev: overlay.entry.prevContent, next: overlay.entry.nextContent,
				hint: t("soulDiffHint"), t,
			});

	return h("div", null, [
		card,
		h("div", {
			className: "mem-overlay", key: "ov",
			onClick: () => setOverlay(null),
		}, h("div", {
			className: "mem-overlay-panel",
			onClick: (e) => e.stopPropagation(),
		}, [
			h("div", { className: "mem-overlay-head", key: "head" }, [
				h("div", { key: "l" }, [
					h("h3", { key: "t" }, overlayTitle),
					h("div", { className: "mem-overlay-sub", key: "s" }, overlaySub),
				]),
				h("div", { key: "r", style: { display: "flex", gap: "6px" } }, [
					h("button", { className: "mem-btn", key: "c", onClick: () => setOverlay(null) },
						overlay.mode === "edit" ? t("soulCancel") : t("soulClose")),
					overlay.mode === "edit"
						? h("button", { className: "mem-btn mem-btn-primary", key: "s", disabled: busy || over, onClick: save }, t("soulSave"))
						: proposalEntry !== null
							? h("button", {
								className: "mem-btn mem-btn-primary", key: "s", disabled: busy,
								onClick: () => actProposal(proposalEntry.id, "soulAdoptProposal"),
							}, t("soulProposalAdoptHere"))
							: null,
				]),
			]),
			confirmId === "" ? null : h("div", { className: "mem-overlay-confirm", key: "cfw" }, [confirmBar()]),
			h("div", { className: "mem-overlay-body", key: "body" }, [
				body,
				h("div", { className: "mem-overlay-side", key: "side" }, [
					h("div", { className: "mem-soul-hist-head", key: "sh" }, [
						h("span", { key: "n" }, t("soulVersionCount") + "(" + history.length + ")"),
						h("button", { className: "mem-btn", key: "r", onClick: reload }, t("commonRefresh")),
					]),
					data !== null && data.persisted
						? h("div", { className: "mem-soul-hist", key: "list" },
							h(SoulVersionRows, { rows: history, t, onDiff: openDiff, onRollback: (id) => setConfirmId(id) }))
						: h("div", { className: "mem-hint", key: "np" }, t("soulUnpersisted")),
				]),
			]),
			h("div", { className: "mem-overlay-foot", key: "foot" }, [
				overlay.mode === "edit"
					? h("span", { className: "mem-charcount", key: "c", "data-over": String(over) },
						chars + " / " + (data === null ? "?" : data.maxChars) + " " + t("soulCharsUnit"))
					: h("span", { key: "c" }),
				h("span", { className: "mem-hint", key: "h" },
					overlay.mode === "edit" ? t("soulUnsaved") : ""),
			]),
		])),
	]);
}
		exps["SOUL_FIELDS"] = SOUL_FIELDS;
		exps["SoulCard"] = SoulCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/audit-card.js
	var mod_audit_card_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var api = mod_runtime_js["api"];
		var Card = mod_components_js["Card"];
		var Banner = mod_components_js["Banner"];
		var Empty = mod_components_js["Empty"];
		var Skeleton = mod_components_js["Skeleton"];
		var SearchBox = mod_components_js["SearchBox"];
		var Icon = mod_components_js["Icon"];
/**
 * 审计面板(v1.15,SPEC §7.6)。
 *
 * 审计是"只读台账":宿主把拦截/降级/死信/归档等动作记在自有存储里(`POST /neural-mind/api
 * {action:"audit"}`),这里负责按类型/关键词收窄、按时间倒序列出来。
 *
 * 设计取舍:
 *  - 类型下拉**从返回数据动态收集**,不在客户端写死 kind 枚举——宿主新增审计类型时
 *    面板自动跟上,不会出现"有记录却筛不出来";
 *  - 筛选/搜索都在客户端做(一次拉 200 条上限),不给宿主加参数,避免和宿主半的改动耦合;
 *  - 刷新按钮与页头「刷新」(refreshKey 自增)共用同一条加载路径。
 */

/** 审计时间:ISO → "MM-DD HH:mm:ss"(最近记录同年足够;完整值放 title)。 */
function fmtAuditTime(value) {
	const text = typeof value === "string" ? value : "";
	if (text === "") return "—";
	const at = text.indexOf("T");
	if (at > 0) return text.slice(5, at) + " " + text.slice(at + 1, at + 9);
	return text;
}

function AuditCard({ t, refreshKey }) {
	const { h, useState, useEffect } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [kind, setKind] = useState("all");
	const [query, setQuery] = useState("");
	// 用稳定对象做请求序号:快速点刷新时只接受最后一次响应。
	const [seq] = useState(() => ({ current: 0 }));

	const load = () => {
		const mine = ++seq.current;
		setLoading(true);
		setError("");
		api("audit", { limit: 200 })
			.then((resp) => {
				if (mine !== seq.current) return;
				const next = Array.isArray(resp.rows) ? resp.rows : [];
				setRows(next);
				// 选中的类型在新数据里没了(例如审计被裁剪)→ 自动回到「全部」。
				setKind((prev) => (prev === "all" || next.some((row) => row.kind === prev) ? prev : "all"));
				setLoading(false);
			})
			.catch((err) => {
				if (mine !== seq.current) return;
				setError(String(err?.message ?? err));
				setLoading(false);
			});
	};

	// 首次挂载拉一次;页头「刷新」自增 refreshKey 时再拉(不重建组件、不丢筛选)。
	useEffect(() => {
		load();
		return () => { seq.current += 1; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refreshKey]);

	// 类型选项从当前数据动态收集:次数多的排前面,同次数按名字排。
	const kindCounts = new Map();
	for (const row of rows) {
		const name = String(row.kind ?? "");
		if (name === "") continue;
		kindCounts.set(name, (kindCounts.get(name) ?? 0) + 1);
	}
	const kinds = [...kindCounts.keys()].sort((a, b) => (kindCounts.get(b) - kindCounts.get(a)) || a.localeCompare(b));

	const term = query.trim().toLowerCase();
	const visible = rows.filter((row) => {
		if (kind !== "all" && row.kind !== kind) return false;
		if (term === "") return true;
		return String(row.kind ?? "").toLowerCase().includes(term)
			|| String(row.detail ?? "").toLowerCase().includes(term);
	});

	const clearFilters = () => {
		setKind("all");
		setQuery("");
	};

	const toolbar = h("div", { className: "au-toolbar", key: "toolbar" }, [
		h("select", {
			key: "kind",
			className: "mem-select au-select",
			value: kind,
			"data-audit-kind": true,
			"aria-label": tt("auFilterKind"),
			onChange: (e) => setKind(e.target.value),
		}, [
			h("option", { key: "all", value: "all" }, tt("auFilterAll")),
			...kinds.map((name) => h("option", { key: name, value: name }, name)),
		]),
		h(SearchBox, {
			key: "search",
			value: query,
			onChange: setQuery,
			onClear: () => setQuery(""),
			placeholder: tt("auSearchPlaceholder"),
			label: tt("auSearchPlaceholder"),
		}),
		h("span", { className: "au-count", key: "count", "data-audit-count": true },
			tt("auCount", { shown: visible.length, total: rows.length })),
		h("button", {
			key: "refresh",
			type: "button",
			className: "mem-btn mem-btn-toolbar",
			"data-action": "audit-refresh",
			disabled: loading,
			onClick: load,
		}, [
			h(Icon, { key: "icon", name: "refresh", size: 14 }),
			h("span", { key: "label" }, loading ? tt("commonLoading") : tt("commonRefresh")),
		]),
	]);

	const body = [];
	if (loading && rows.length === 0) {
		body.push(h(Skeleton, { key: "loading", lines: 5 }));
	} else {
		if (error !== "") {
			body.push(h(Banner, {
				key: "error",
				tone: "error",
				title: tt("commonError"),
				children: error,
				action: h("button", {
					key: "retry",
					type: "button",
					className: "mem-btn",
					"data-action": "audit-retry",
					onClick: load,
				}, tt("commonRetry")),
			}));
		}
		if (rows.length === 0) {
			// 加载失败时只给错误横幅:这时候还不知道"到底有没有记录",不能顺手报"空"。
			if (error === "") {
				body.push(h(Empty, { key: "empty", title: tt("auEmptyTitle"), hint: tt("auEmptyHint") }));
			}
		} else if (visible.length === 0) {
			body.push(h(Empty, {
				key: "no-match",
				title: tt("auNoMatchTitle"),
				hint: tt("auNoMatchHint"),
				action: h("button", {
					key: "reset",
					type: "button",
					className: "mem-btn",
					"data-action": "audit-reset",
					onClick: clearFilters,
				}, tt("auResetFilters")),
			}));
		} else {
			body.push(h("div", { className: "au-list", key: "list" }, visible.map((row, index) => h("div", {
				className: "au-row",
				key: row.id ?? String(index),
				"data-audit-row": true,
				"data-kind": String(row.kind ?? ""),
			}, [
				h("span", { className: "au-ts", key: "ts", title: row.ts }, fmtAuditTime(row.ts)),
				h("span", { className: "au-kind", key: "kind", title: String(row.kind ?? "") }, String(row.kind ?? "—")),
				h("span", { className: "au-detail", key: "detail" }, row.detail === undefined || row.detail === "" ? tt("commonNone") : row.detail),
			]))));
		}
	}

	return h(Card, {
		title: tt("auTitle"),
		sub: tt("auSub"),
		children: [toolbar, ...body],
	});
}
		exps.default = AuditCard;
		exps["AuditCard"] = AuditCard;
		return exps;
	})();
		//#endregion
		//#region lib/client/shell.js
	var mod_shell_js = (function () {
		var exps = {};
		var react = mod_runtime_js["react"];
		var useApi = mod_runtime_js["useApi"];
		var Icon = mod_components_js["Icon"];
		var Chip = mod_components_js["Chip"];
		var Banner = mod_components_js["Banner"];
		var OverviewCard = mod_overview_card_js["OverviewCard"];
		var BrowseCard = mod_browse_card_js["BrowseCard"];
		var RecallCard = mod_recall_card_js["RecallCard"];
		var ConfigCard = mod_config_card_js["ConfigCard"];
		var ProfileCard = mod_profile_card_js["ProfileCard"];
		var SoulCard = mod_soul_card_js["SoulCard"];
		var AuditCard = mod_audit_card_js["AuditCard"];
/**
 * v1.15 记忆控制台外壳:页头 + 状态条 + 7 个页签 + 懒挂载面板。
 *
 * 数据职责:
 *  - `overview`(POST /neural-mind/api {action:"overview"})由外壳统一获取,通过 props 下发给总览卡;
 *    页头的状态条也用它,避免每个面板各拉一份。
 *  - 页头「刷新」自增 `refreshKey`;各面板把它放进自己 effect 的依赖里跟随刷新。
 *  - 页签**首次切到才挂载**,之后保持挂载(切回不重新拉数据,状态不丢)。
 *
 * 视图状态全部收在本组件:页签切换不重建数据层(与旧版"进页面即拉全量"相比,
 * 现在首屏只发一个 overview 请求,其余面板按需加载)。
 */

/** 页签登记表:id 同时是 `data-tab`/`data-panel` 与测试选择器。 */
const TABS = [
	{ id: "overview", label: "navOverview", icon: "overview", Card: OverviewCard },
	{ id: "memories", label: "navMemories", icon: "memories", Card: BrowseCard },
	{ id: "recall", label: "navRecall", icon: "recall", Card: RecallCard },
	{ id: "config", label: "navConfig", icon: "config", Card: ConfigCard },
	{ id: "profile", label: "navProfile", icon: "profile", Card: ProfileCard },
	{ id: "soul", label: "navSoul", icon: "soul", Card: SoulCard },
	{ id: "audit", label: "navAudit", icon: "audit", Card: AuditCard },
];

/**
 * 页头状态条:存储 / 向量路 / 自动召回 / 工作区范围。
 * 数据没到时给一个中性占位,不假装"一切正常"。
 */
function StatusStrip({ t, overview }) {
	const { h } = react;
	const data = overview.data;
	if (data === null) {
		return h("div", { className: "mem-status", key: "status" }, [
			h(Chip, {
				key: "loading",
				tone: overview.error === "" ? "muted" : "error",
				dot: overview.error !== "",
				title: overview.error === "" ? undefined : overview.error,
				children: overview.error === "" ? t("commonLoading") : t("commonError"),
			}),
		]);
	}
	const stats = data.stats ?? {};
	const embedding = data.embedding ?? {};
	const workspaces = data.workspaces ?? {};
	const injection = data.injection ?? {};
	const chips = [];

	chips.push(h(Chip, {
		key: "storage",
		tone: stats.persisted ? "ok" : "warn",
		title: stats.persisted ? t("stStoragePersisted") : t("stStorageMemoryHint"),
		children: t("stStorage") + " · " + (stats.persisted ? t("stStoragePersisted") : t("stStorageMemory")),
	}));

	if (embedding.enabled !== true) {
		chips.push(h(Chip, {
			key: "vector",
			tone: "muted",
			title: t("stVectorDisabledHint"),
			children: t("stVector") + " · " + t("stVectorOff"),
		}));
	} else if (embedding.available === true) {
		const meta = [embedding.model, embedding.dimension ? embedding.dimension + "d" : ""].filter((v) => v !== undefined && v !== "" && v !== null).join(" · ");
		chips.push(h(Chip, {
			key: "vector",
			tone: "ok",
			title: t("stVectorOnHint"),
			children: t("stVector") + " · " + (meta === "" ? t("stVectorOn") : meta),
		}));
	} else {
		chips.push(h(Chip, {
			key: "vector",
			tone: "warn",
			title: embedding.configured === false ? t("stVectorDisabledHint") : t("stVectorNoKeyHint"),
			children: t("stVector") + " · " + (embedding.configured === false ? t("stVectorOff") : t("stVectorNoKey")),
		}));
	}

	chips.push(h(Chip, {
		key: "recall",
		tone: injection.autoRecall === true ? "ok" : "warn",
		title: injection.autoRecall === true ? t("stRecallHint") : t("stRecallOffHint"),
		children: t("stRecall") + " · " + (injection.autoRecall === true ? t("stRecallOn") : t("stRecallOff")),
	}));

	const disabled = Number(workspaces.disabled) || 0;
	chips.push(h(Chip, {
		key: "scope",
		tone: disabled > 0 ? "warn" : "muted",
		title: t("stScopeHint"),
		children: t("stScope") + " · " + (disabled > 0 ? t("stScopeSome", { n: disabled }) : t("stScopeAll")),
	}));

	return h("div", { className: "mem-status", key: "status" }, chips);
}

function MemoryPage({ form, t }) {
	const { h, useState } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const [view, setView] = useState("overview");
	const [visited, setVisited] = useState(() => new Set(["overview"]));
	const [refreshKey, setRefreshKey] = useState(0);
	const overview = useApi("overview", null, [refreshKey]);

	const go = (id) => {
		setView(id);
		setVisited((prev) => {
			if (prev.has(id)) return prev;
			const next = new Set(prev);
			next.add(id);
			return next;
		});
	};
	const refresh = () => setRefreshKey((n) => n + 1);
	const staged = overview.data?.stats?.staged ?? 0;

	return h("section", { className: "mem-page", "aria-label": tt("tab") }, [
		h("div", { className: "mem-scroll", key: "scroll" }, [
			h("div", { className: "mem-content", key: "content" }, [
				h("header", { className: "mem-head", key: "head" }, [
					h("div", { className: "mem-head-main", key: "main" }, [
						h("h1", { className: "mem-title", key: "title" }, tt("tab")),
						h("p", { className: "mem-intro", key: "intro" }, tt("pageIntro")),
					]),
					h("div", { className: "mem-head-actions", key: "actions" }, [
						h("button", {
							key: "refresh",
							type: "button",
							className: "mem-btn",
							title: tt("headerRefreshHint"),
							disabled: overview.loading,
							onClick: refresh,
						}, [
							h(Icon, { key: "icon", name: "refresh", size: 14 }),
							h("span", { key: "label" }, overview.loading ? tt("headerRefreshing") : tt("headerRefresh")),
						]),
					]),
				]),
				h(StatusStrip, { t: tt, overview }),
				overview.error !== ""
					? h(Banner, {
						key: "error",
						tone: "error",
						title: tt("commonError"),
						children: overview.error,
						action: h("button", { type: "button", className: "mem-btn", onClick: refresh }, tt("commonRetry")),
					})
					: null,
				h("div", {
					key: "tabs",
					className: "mem-tabs",
					role: "tablist",
					"aria-label": tt("tab"),
				}, TABS.map((tab) => {
					const active = view === tab.id;
					return h("button", {
						key: tab.id,
						type: "button",
						role: "tab",
						"aria-selected": active,
						"data-tab": tab.id,
						className: "mem-tab" + (active ? " mem-tab-active" : ""),
						onClick: () => go(tab.id),
					}, [
						h(Icon, { key: "icon", name: tab.icon, size: 15 }),
						h("span", { key: "label" }, tt(tab.label)),
						tab.id === "memories" && staged > 0
							? h("span", { key: "count", className: "mem-tab-count", title: tt("statsStaged") }, String(staged))
							: null,
					]);
				})),
				h("div", { className: "mem-body", key: "body" }, TABS.map((tab) => h("div", {
					key: tab.id,
					role: "tabpanel",
					"aria-label": tt(tab.label),
					className: "mem-panel",
					"data-panel": tab.id,
					hidden: view !== tab.id,
				}, visited.has(tab.id)
					? [h(tab.Card, { key: "card", t: tt, form, overview, refreshKey, onNavigate: go })]
					: null))),
			]),
		]),
	]);
}
		exps.default = MemoryPage;
		exps["TABS"] = TABS;
		exps["MemoryPage"] = MemoryPage;
		return exps;
	})();
		//#endregion
		//#region lib/client/index.js
	var mod_index_js = (function () {
		var exps = {};
		var injectCss = mod_css_js["injectCss"];
		var zh = mod_locale_js["zh"];
		var en = mod_locale_js["en"];
		var initRuntime = mod_runtime_js["initRuntime"];
		var react = mod_runtime_js["react"];
		var NS = mod_runtime_js["NS"];
		var MemoryPage = mod_shell_js["MemoryPage"];
/**
 * 记忆插件浏览器半入口:主侧栏「记忆」入口 + 右侧主区域「记忆控制台」(v1.15)。
 *
 * 切片:loader.js 登记入口 / css.js 样式聚合 / locale.js 词典聚合 / runtime.js 共享运行时 /
 * components.js 共享原子组件 / shell.js 页面外壳与页签;一卡一文件
 * (overview/browse/recall/config/profile/soul/audit)。本文件只做装配:模块定义 + 槽位注册。
 *
 * 两个槽位成对注册(宿主 0.2.1 的"全局面板"契约,与「插件」「自动化任务」同一姿势):
 *  - `main`(keyed):key = 面板 id,内容渲染在右侧主区域;
 *  - `sidebar.panellist`(list):id 与 main 的 key 同源,点击走 `layout.selectPanel(id)`。
 * 两者分开登记是因为侧栏行只渲染图标(`{ size, active }`),页面体由 main 槽按当前
 * `activePanelId` 选择。id 必须是宿主 `layout.selectPanel` 能查到的 main 注册项,
 * 否则点侧栏会抛 `main panel "…" is not registered`。
 *
 * 配置仍走 `ctx.configForms.get('neural-mind')`(0.2.0 官方设置传输;namespace 就是本插件
 * 的 profile entry id,由宿主半的 volatile 字段决定它是否被服务);
 * 记忆数据走宿主半的 /neural-mind/api 同源 JSON 路由。
 */

const inject = ["slots", "locale", "configForms"];

/**
 * 侧栏入口 id 与 main 槽的 key 必须同源:侧栏点击把它交给 `layout.selectPanel(id)`,
 * 宿主再用同一个 id 去 main 槽挑页面。这里直接复用 NS(`memory` = 插件的 profile
 * entry id),不另起一个字符串——两处各写一份就迟早对不上。
 */
const PANEL_ID = NS;

/**
 * 侧栏图标。宿主把 `sidebar.panellist` 的内容渲染成侧栏行的图标单元格
 * (`.panelGlyph`),传进来的 props 是 `{ size, active }`;这里只认 `size`。
 * 用内联 SVG 而不是宿主 `@deepseek-ai/dsh-client-ui-primitives`:客户端插件
 * 不该 require 其它 Client 包(引用会随宿主版本漂移,抛错时整格面板会消失),
 * 官方的做法是自带一份同样用 `currentColor` / `--dsw-alias-*` 的图标。
 */
function MemoryPanelIcon({ size }) {
	const { h } = react;
	const px = typeof size === "number" ? size : 18;
	return h("svg", {
		width: px,
		height: px,
		viewBox: "0 0 20 20",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.4,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		focusable: "false",
	}, [
		h("rect", { key: "chip", x: "4.6", y: "4.6", width: "10.8", height: "10.8", rx: "2.6" }),
		h("circle", { key: "core", cx: "10", cy: "10", r: "2.2" }),
		h("path", { key: "pins", d: "M10 4.6V2.6M10 15.4v2M4.6 10H2.6M15.4 10h2" }),
	]);
}

/**
 * Cordis 客户端插件装配点。**必须是模块级具名导出**:打包器
 * (`tools/build-client.mjs`)按具名导出给宿主组装 `module.exports`,
 * 与官方包 `exports.apply = apply` 是同一个落点。
 *
 * 注意 `require("react")` 与 `initRuntime`/`injectCss` 必须在 apply **之前**执行完,
 * 因为各组件的渲染期读的是 runtime.js 的 live binding。
 */
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "memory: dictionaries");
	const t = ctx.locale.bind(NS);
	// 官方设置传输:`get(entryId)` 返回本 entry 所有编辑器共享的已接受值与写入队列。
	// 命名空间未被服务时(例如宿主半一个 volatile 字段都没标),快照是
	// `status: 'unavailable'`,配置卡如实显示"不可用"而不是假装可编辑。
	const form = ctx.configForms.get(NS);

	function MemoryPageRoot(props = {}) {
		const { h } = react;
		// `t` 优先用槽位渲染器按 `locale: NS` 递进来的那一个(切换语言时它随 revision
		// 换新引用);闭包 t 只作为直接调用时的兜底(测试/宿主异常路径)。
		return h(MemoryPage, { ...props, form, t: props.t ?? t });
	}

	// 右侧主区域页:keyed 槽按 `activePanelId` 选人,所以 key 就是面板 id。
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: PANEL_ID,
		locale: NS,
		inject: () => ({ form }),
	}, MemoryPageRoot));

	// 主侧栏行:order 20 = 排在「自动化任务」(10)之后;label 走词典,
	// 侧栏折叠态下由宿主的 tooltip / aria-label 显示。
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: PANEL_ID,
		order: 20,
		locale: NS,
		label: () => t("tab"),
	}, MemoryPanelIcon));
}

const definition = {
	id: "neural-mind",
	/**
	 * 运行时初始化钩子,**由打包器调用**(见 `tools/build-client.mjs`):它把
	 * `require("react")` 注入进来、装上样式,然后把**本模块的具名导出**
	 * (`apply` / `inject`)组装成宿主读的 `module.exports`。
	 *
	 * 所以这里只做初始化,不要把 `apply`/`inject` 塞进返回值——返回的东西会被
	 * 打包器丢掉,而且 `definition` 自己的属性会被污染(实测踩过)。
	 */
	factory: (require) => {
		initRuntime(require("react"));
		injectCss();
	},
};
		exps.default = definition;
		exps["inject"] = inject;
		exps["apply"] = apply;
		exps["definition"] = definition;
		return exps;
	})();
		//#endregion
		var __definition = mod_index_js.default;
		if (__definition === undefined || typeof __definition.factory !== "function") {
			throw new Error("neural-mind: 入口 definition.factory 缺失(重新跑 npm run build:client)")
		}
		__definition.factory(require);
		var __entry = {};
		for (const __name of ["apply", "inject", "definition"]) {
			if (mod_index_js[__name] !== undefined) __entry[__name] = mod_index_js[__name];
		}
		__entry.id = __definition.id;
		return __entry;
	},
});
