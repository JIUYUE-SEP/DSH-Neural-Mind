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
import { react, useApi } from "./runtime.js";
import { Icon, Chip, Banner } from "./components.js";
import { OverviewCard } from "./overview-card.js";
import { BrowseCard } from "./browse-card.js";
import { RecallCard } from "./recall-card.js";
import { ConfigCard } from "./config-card.js";
import { ProfileCard } from "./profile-card.js";
import { SoulCard } from "./soul-card.js";
import { AuditCard } from "./audit-card.js";

/** 页签登记表:id 同时是 `data-tab`/`data-panel` 与测试选择器。 */
export const TABS = [
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

export function MemoryPage({ form, t }) {
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

export default MemoryPage;
