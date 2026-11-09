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
import { react, api, fmtShortTime } from "./runtime.js";
import { Card, Banner, Chip, Badge, Empty, Skeleton, Icon } from "./components.js";

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

export function RecallCard({ t, overview, refreshKey }) {
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

export default RecallCard;
