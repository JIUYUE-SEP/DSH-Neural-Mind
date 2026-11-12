import {
	react,
	api, pathOf, getPath, useSettingsWriter,
} from "./runtime.js";
import { Card, Banner, Empty, Skeleton } from "./components.js";

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
export const SOUL_FIELDS = [SOUL_MASTER, SOUL_SELF_EDIT];

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

export function SoulCard({ form, t }) {
	const { h, useState, useEffect, useCallback, useSyncExternalStore } = react;
	const snapshot = useSyncExternalStore((cb) => form.subscribe(cb), () => form.getSnapshot());
	const [data, setData] = useState(null);
	const [error, setError] = useState("");
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);
	const [overlay, setOverlay] = useState(null); // null | { mode: "edit" | "diff", draft?, entry? }
	const [confirmId, setConfirmId] = useState("");
	// 忽略提议(0.7.0):先展开一行内联确认 + 可选理由,不再一键直接归档。
	const [ignoreId, setIgnoreId] = useState("");
	const [ignoreReason, setIgnoreReason] = useState("");

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
	const actProposal = (id, action, payload) => {
		setBusy(true);
		setMsg("");
		setError("");
		api(action, { id, ...(payload ?? {}) })
			.then(() => {
				setOverlay(null);
				setIgnoreId("");
				setIgnoreReason("");
				setMsg(t(action === "soulAdoptProposal" ? "soulAdopted" : "soulIgnored"));
				reload();
			})
			.catch((e) => setError(String(e.message ?? e)))
			.finally(() => setBusy(false));
	};
	// 忽略入口:展开内联确认(理由可留空);确认后才调后端。留空 = 不带 reason 字段。
	const startIgnore = (id) => { setIgnoreId(id); setIgnoreReason(""); };
	const cancelIgnore = () => { setIgnoreId(""); setIgnoreReason(""); };
	const confirmIgnore = (id) => {
		const reason = ignoreReason.trim();
		actProposal(id, "soulIgnoreProposal", reason === "" ? undefined : { reason });
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
		proposals.map((p) => [
			h("div", { className: "mem-soul-v", key: p.id }, [
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
					h("button", { className: "mem-btn", key: "i", disabled: busy, onClick: () => startIgnore(p.id) }, t("soulIgnore")),
				]),
			]),
			// 忽略前先摆一行确认:理由可留空(留空 = 不带理由),确认后才归档。
			ignoreId === p.id
				? h("div", { className: "mem-soul-confirm", key: p.id + "-confirm" }, [
					h("span", { key: "q" }, t("soulIgnoreTitle")),
					h("input", {
						className: "mem-input", key: "in", type: "text",
						value: ignoreReason,
						placeholder: t("soulIgnoreHint"),
						"aria-label": t("soulIgnoreHint"),
						onChange: (e) => setIgnoreReason(e.target.value),
						onKeyDown: (e) => { if (e.key === "Enter") confirmIgnore(p.id); },
					}),
					h("span", { key: "sp", style: { marginLeft: "auto" } }),
					h("button", { className: "mem-btn", key: "c", onClick: cancelIgnore }, t("soulIgnoreCancel")),
					h("button", {
						className: "mem-btn mem-btn-primary", key: "ok", disabled: busy,
						onClick: () => confirmIgnore(p.id),
					}, t("soulIgnoreConfirm")),
				])
				: null,
		]),
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
