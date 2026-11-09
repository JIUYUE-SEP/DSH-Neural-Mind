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
import { react, api, copyText, fmtShortTime, cx } from "./runtime.js";
import { Card, Banner, Empty, Skeleton, Icon, Chip, Badge, Toolbar, SearchBox } from "./components.js";

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

export function BrowseCard({ t, refreshKey }) {
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

export default BrowseCard;
