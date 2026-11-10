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
import { react, fmtCount, fmtClock, fmtShortTime } from "./runtime.js";
import { Card, Stat, StatGrid, Chip, Badge, Banner, Empty, Skeleton, Bar, Icon } from "./components.js";

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
export function OverviewCard({ t, form, overview, refreshKey, onNavigate }) {
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

export default OverviewCard;
