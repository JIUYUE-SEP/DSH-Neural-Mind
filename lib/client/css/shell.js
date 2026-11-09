/**
 * v1.15 页面外壳样式:页头、状态条、页签、面板容器。
 * 版式沿用宿主管理页(高度 100% + 页内滚动),内容区放宽到 1120px 以容纳看板。
 */
export const css = [
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
