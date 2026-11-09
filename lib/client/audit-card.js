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
import { react, api } from "./runtime.js";
import { Card, Banner, Empty, Skeleton, SearchBox, Icon } from "./components.js";

/** 审计时间:ISO → "MM-DD HH:mm:ss"(最近记录同年足够;完整值放 title)。 */
function fmtAuditTime(value) {
	const text = typeof value === "string" ? value : "";
	if (text === "") return "—";
	const at = text.indexOf("T");
	if (at > 0) return text.slice(5, at) + " " + text.slice(at + 1, at + 9);
	return text;
}

export function AuditCard({ t, refreshKey }) {
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

export default AuditCard;
