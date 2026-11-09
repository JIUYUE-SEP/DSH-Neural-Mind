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
export const css = [
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
