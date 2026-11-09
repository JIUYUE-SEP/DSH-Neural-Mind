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
import { react, cx } from "./runtime.js";

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

export function Icon({ name, size = 16, className }) {
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

export function Card({ title, sub, actions, children, className }) {
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

export function StatGrid({ children }) {
	const { h } = react;
	return h("div", { className: "mem-stat-grid" }, Array.isArray(children) ? children : [children]);
}

export function Stat({ label, value, sub, tone, hint }) {
	const { h } = react;
	return h("div", { className: cx("mem-stat", tone === undefined ? null : "mem-stat-" + tone), title: hint ?? undefined }, [
		h("div", { className: "mem-stat-label", key: "label" }, label),
		h("div", { className: "mem-stat-value", key: "value" }, value === undefined || value === null ? "—" : value),
		sub === undefined || sub === null || sub === "" ? null : h("div", { className: "mem-stat-sub", key: "sub" }, sub),
	]);
}

export function Toolbar({ children }) {
	const { h } = react;
	return h("div", { className: "mem-toolbar" }, Array.isArray(children) ? children : [children]);
}

export function Section({ title, hint, count, actions, open = true, onToggle, children }) {
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

export function Bar({ value, max = 1, tone }) {
	const { h } = react;
	const total = Number(max) > 0 ? Number(max) : 1;
	const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / total));
	return h("div", { className: cx("mem-bar", tone === undefined ? null : "mem-bar-" + tone) }, [
		h("div", { className: "mem-bar-fill", key: "fill", style: { width: Math.round(ratio * 1000) / 10 + "%" } }),
	]);
}

// ── 徽章 / 横幅 / 空态 / 骨架 ─────────────────────────────────────────────

export function Chip({ tone = "muted", dot = true, children, title }) {
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

export function Badge({ tone = "muted", children, title }) {
	const { h } = react;
	return h("span", { className: cx("mem-badge", "mem-badge-" + tone), title: title ?? undefined }, children);
}

export function Banner({ tone = "info", title, children, action }) {
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

export function Empty({ title, hint, action }) {
	const { h } = react;
	return h("div", { className: "mem-empty" }, [
		h(Icon, { key: "icon", name: "memories", size: 28, className: "mem-empty-icon" }),
		h("div", { className: "mem-empty-title", key: "title" }, title),
		hint === undefined || hint === null || hint === "" ? null : h("div", { className: "mem-empty-hint", key: "hint" }, hint),
		action === undefined || action === null ? null : h("div", { className: "mem-empty-action", key: "action" }, action),
	]);
}

export function Skeleton({ lines = 3 }) {
	const { h } = react;
	const rows = [];
	for (let i = 0; i < Math.max(1, lines); i += 1) {
		rows.push(h("div", { className: "mem-skeleton-line", key: i, style: { width: 92 - (i % 3) * 16 + "%" } }));
	}
	return h("div", { className: "mem-skeleton", "aria-hidden": "true" }, rows);
}

export function SearchBox({ value, onChange, onClear, placeholder, label }) {
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
