import { react, api } from "./runtime.js";
import { Card, Banner, Empty, Skeleton, Toolbar } from "./components.js";

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

export function ProfileCard({ t, form, onNavigate }) {
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
