/**
 * 配置面板(v1.15 重设计,SPEC §7.4)。
 *
 * 目标:让 26 个参数「不挡路」——默认只看到默认展开的两组,其余折叠;顶部状态条一眼看清
 * 设置服务状态 / 是否立即保存 / 被覆盖了几项;「需要关注」诊断卡把**能直接看出来的配置问题**
 * 说成人话并给出跳转;搜索可按中文标签、说明、键名过滤;每项都有「已覆盖」徽章和「重置」。
 *
 * 硬约束(别动):
 *  - `GROUPS` 必须继续导出,且**恰好覆盖** SPEC §8 的 26 个配置键
 *    (`tools/check-seams.mjs` 会拿它和宿主 `lib/config.js` 的 volatile 字段双向对账);
 *  - 写入只能走 `form.getSnapshot()/subscribe/mutate`,ops 形状 `[{ op:"set"|"unset", path, value? }]`
 *    (`useSettingsWriter` 的成败判据只认 mutate 的 boolean 结果)。
 *
 * 组件用法提醒:本插件迷你渲染器不展开 JSX 第三参数,组合组件的 children 必须放进
 * `props.children`(数组),见 components.js 文件头。
 */
import {
	react, api, pathOf, getPath, toText, fromText, DraftInput, useSettingsWriter, cx, fmtDateTime,
} from "./runtime.js";
import { Card, Chip, Banner, SearchBox, Toolbar, Icon, Skeleton, Empty } from "./components.js";

/**
 * 读一个 `/neural-mind/api` action 的轻量状态容器(工作区列表 / 密钥状态各一份)。
 *
 * 为什么不用 runtime.js 的 `useApi`:它在 effect 里**同步** setState(loading),
 * 而测试 / 预览的迷你渲染器把 effect 放在渲染过程中执行,同步 setState 会递归重入渲染,
 * 打乱 per-fiber 的 hooks 槽位(实测症状:组件里后一个 useState 读到前一个组件的值)。
 * 这里只在 promise 落地的微任务里 setState,effect 本身没有同步副作用。
 * 真实 React 下两者等价(effect 本来就在渲染之后跑)。
 */
function useConfigApi(action, deps = []) {
	const { useState, useEffect, useCallback } = react;
	const [state, setState] = useState(() => ({ data: null, error: "", loading: true }));
	const [seq] = useState(() => ({ n: 0 }));
	const run = useCallback(() => {
		const mine = ++seq.n;
		api(action)
			.then((data) => {
				if (mine !== seq.n) return;
				setState({ data, error: "", loading: false });
			})
			.catch((error) => {
				if (mine !== seq.n) return;
				setState({ data: null, error: String(error?.message ?? error), loading: false });
			});
	}, [action, ...deps]);
	useEffect(() => { run(); }, [run]);
	return { data: state.data, error: state.error, loading: state.loading, reload: run };
}

// ── 字段清单(SPEC §8:26 个键,不可增删改键名)─────────────────────────────

/**
 * 记忆页可编辑的配置面。`kind` 必须与宿主 schema 类型对齐
 * (boolean→toggle / number→number / string→text / array→lines|workspaces / dict→dict / union→select),
 * 否则 `check-seams` ⑨ 会当场红——写错 kind 会把字符串写进 boolean 字段。
 *
 * `advanced: true` 的字段默认收在分组内的「高级选项」里(向量检索组),搜索时强制展开,
 * 避免"搜到了却看不见"。
 */
export const GROUPS = [
	{
		id: "privacy", title: "groupPrivacy", icon: "memories", defaultOpen: false,
		fields: [
			{ key: "privateWorkspaces", kind: "lines" },
			{ key: "disabledWorkspaces", kind: "workspaces" },
			{ key: "sensitiveNoCross", kind: "toggle" },
			{ key: "sensitiveKeywords", kind: "lines" },
		],
	},
	{
		id: "embedding", title: "groupEmbedding", icon: "vector", defaultOpen: true,
		fields: [
			{ key: "semanticSearch.enabled", kind: "toggle" },
			{ key: "semanticSearch.baseUrl", kind: "text" },
			{ key: "semanticSearch.modelId", kind: "text" },
			{ key: "semanticSearch.apiKeyEnv", kind: "text" },
			{ key: "semanticSearch.apiKeyOptional", kind: "toggle" },
			{ key: "semanticSearch.timeoutMs", kind: "number", advanced: true },
			{ key: "semanticSearch.autoStartCommand", kind: "text", advanced: true },
			{ key: "semanticSearch.autoStartWaitMs", kind: "number", advanced: true },
			{ key: "semanticSearch.autoStartWarmup", kind: "toggle", advanced: true },
		],
	},
	{
		id: "write", title: "groupWrite", icon: "spark", defaultOpen: true,
		fields: [
			{ key: "extractEnabled", kind: "toggle" },
			{ key: "extractBatchTurns", kind: "number" },
			{ key: "extractIdleMinutes", kind: "number" },
			{ key: "toolOutputStorage", kind: "select", options: ["summary", "head"] },
			{ key: "toolOutputOverrides", kind: "dict" },
			{ key: "failedToolOutputChars", kind: "number" },
		],
	},
	{
		id: "inject", title: "groupInject", icon: "recall", defaultOpen: false,
		fields: [
			{ key: "autoRecall", kind: "toggle" },
			{ key: "injectMaxItems", kind: "number" },
			{ key: "injectMaxChars", kind: "number" },
			{ key: "sessionInjectMaxChars", kind: "number" },
			{ key: "excerptChars", kind: "number" },
		],
	},
	{
		id: "profile", title: "groupProfile", icon: "profile", defaultOpen: false,
		fields: [
			{ key: "profileFile", kind: "text" },
			{ key: "profilePollSeconds", kind: "number" },
		],
	},
];

/** 26 个字段的扁平清单(计数 / 已覆盖统计用)。 */
const CONFIG_FIELDS = GROUPS.reduce((all, group) => all.concat(group.fields), []);

/** 全部展开 / 全部收起 / 初始折叠态:模块级常量,state 里只做不可变替换。 */
const ALL_OPEN = Object.freeze(Object.fromEntries(GROUPS.map((group) => [group.id, true])));
const ALL_CLOSED = Object.freeze(Object.fromEntries(GROUPS.map((group) => [group.id, false])));
const INITIAL_OPEN = Object.freeze(Object.fromEntries(GROUPS.map((group) => [group.id, group.defaultOpen !== false])));

/** 设置服务缺席时的兜底快照:配置卡据此显示「不可用」而不是假装可编辑。 */
const UNAVAILABLE_SNAPSHOT = Object.freeze({
	status: "unavailable", value: {}, user: {}, revision: 0, writable: false,
});

// ── 字段 / 搜索 / 诊断的纯函数 ─────────────────────────────────────────────

/** 字段标签 key:`f_` + 路径最后一段(嵌套字段如 semanticSearch.baseUrl → f_baseUrl)。 */
const labelKeyOf = (def) => "f_" + def.key.split(".").pop();
const descKeyOf = (def) => labelKeyOf(def) + "_desc";

/** 该字段是否被用户显式覆盖(user 层有值即覆盖)。 */
function fieldOverridden(user, key) {
	return getPath(user ?? {}, pathOf(key)) !== undefined;
}

/** 搜索命中:中文标签 / 说明 / 完整键名 / 末段键名,大小写不敏感。 */
function matchesField(t, def, query) {
	const q = String(query ?? "").trim().toLowerCase();
	if (q === "") return true;
	const label = String(t(labelKeyOf(def)) ?? "").toLowerCase();
	const desc = String(t(descKeyOf(def)) ?? "").toLowerCase();
	const key = def.key.toLowerCase();
	const leaf = def.key.split(".").pop().toLowerCase();
	return label.includes(q) || desc.includes(q) || key.includes(q) || leaf.includes(q);
}

/**
 * 工作区 id 比较口径(仅展示 / 勾选用):统一分隔符、去尾斜杠、大小写不敏感。
 * 宿主侧 `disabledWorkspaces` 支持 workspaceId 或其前缀;浏览器半不能 import
 * `lib/workspace.js`(node 内置依赖会进 bundle),所以这里只复刻「比较」这一小块,
 * 写进配置的永远是列表行给出的原值。
 */
const normalizeWorkspace = (workspaceId) =>
	String(workspaceId ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** workspaceId 是否被 entries 里某条「workspaceId 或其前缀」覆盖。 */
function coversWorkspace(workspaceId, entries) {
	const target = normalizeWorkspace(workspaceId);
	if (target === "") return false;
	return (Array.isArray(entries) ? entries : []).some((entry) => {
		const prefix = normalizeWorkspace(entry);
		return prefix !== "" && (target === prefix || target.startsWith(prefix + "/"));
	});
}

const DIAG_TONE_RANK = { error: 0, warn: 1, info: 2 };

/**
 * 「需要关注」诊断:完全由**当前配置值**(+ 外壳下发的 overview)本地计算,不发请求。
 *
 * 设计口径:只报「看了就知道怎么办」的问题;warn 排前面,info 排后面;每条带 group 的
 * 可以一键跳到对应分组,避免用户在 26 项里找。
 *
 * @returns {{ id: string, tone: "warn"|"info", title: string, hint: string, group?: string }[]}
 */
export function diagnoseConfig(t, rawValue, overviewData) {
	const value = rawValue !== null && typeof rawValue === "object" ? rawValue : {};
	const semantic = value.semanticSearch !== null && typeof value.semanticSearch === "object" ? value.semanticSearch : {};
	const enabled = semantic.enabled === true;
	const baseUrl = typeof semantic.baseUrl === "string" ? semantic.baseUrl.trim() : "";
	const modelId = typeof semantic.modelId === "string" ? semantic.modelId.trim() : "";
	const apiKeyEnv = typeof semantic.apiKeyEnv === "string" ? semantic.apiKeyEnv.trim() : "";
	const keyless = semantic.apiKeyOptional === true;
	const items = [];

	if (enabled) {
		if (baseUrl === "" || modelId === "") {
			const missing = [baseUrl === "" ? "baseUrl" : "", modelId === "" ? "modelId" : ""].filter((part) => part !== "").join(" / ");
			items.push({
				id: "vector-incomplete", tone: "warn", group: "embedding",
				title: t("cfgDiagVectorIncomplete"), hint: t("cfgDiagVectorIncompleteHint", { missing }),
			});
		} else if (!keyless && apiKeyEnv === "") {
			items.push({
				id: "vector-key", tone: "warn", group: "embedding",
				title: t("cfgDiagVectorKey"), hint: t("cfgDiagVectorKeyHint"),
			});
		}
	} else {
		items.push({
			id: "vector-off", tone: "info", group: "embedding",
			title: t("cfgDiagVectorOff"), hint: t("cfgDiagVectorOffHint"),
		});
	}

	// overview 里带了上次向量失败原因时才提示(拿不到 overview 时静默,不假装知道)。
	const lastFailure = overviewData !== null && typeof overviewData === "object" && overviewData.embedding !== null
		&& typeof overviewData.embedding === "object" && typeof overviewData.embedding.lastFailure === "string"
		? overviewData.embedding.lastFailure.trim()
		: "";
	if (enabled && lastFailure !== "") {
		items.push({
			id: "vector-failed", tone: "warn", group: "embedding",
			title: t("cfgDiagVectorFailed", { error: lastFailure }), hint: t("cfgDiagVectorFailedHint"),
		});
	}

	if (value.autoRecall === false) {
		items.push({
			id: "recall-off", tone: "warn", group: "inject",
			title: t("cfgDiagRecallOff"), hint: t("cfgDiagRecallOffHint"),
		});
	}
	if (value.extractEnabled === false) {
		items.push({
			id: "extract-off", tone: "warn", group: "write",
			title: t("cfgDiagExtractOff"), hint: t("cfgDiagExtractOffHint"),
		});
	}

	const disabledWorkspaces = (Array.isArray(value.disabledWorkspaces) ? value.disabledWorkspaces : [])
		.filter((entry) => String(entry ?? "").trim() !== "");
	if (disabledWorkspaces.length > 0) {
		items.push({
			id: "disabled-ws", tone: "info", group: "privacy",
			title: t("cfgDiagDisabledWs", { n: disabledWorkspaces.length }), hint: t("cfgDiagDisabledWsHint"),
		});
	}
	const privateWorkspaces = (Array.isArray(value.privateWorkspaces) ? value.privateWorkspaces : [])
		.filter((entry) => String(entry ?? "").trim() !== "");
	if (privateWorkspaces.length > 0) {
		items.push({
			id: "private-ws", tone: "info", group: "privacy",
			title: t("cfgDiagPrivate", { n: privateWorkspaces.length }), hint: t("cfgDiagPrivateHint"),
		});
	}
	const profileFile = typeof value.profileFile === "string" ? value.profileFile.trim() : "";
	if (profileFile === "") {
		items.push({
			id: "profile-empty", tone: "info", group: "profile",
			title: t("cfgDiagProfileEmpty"), hint: t("cfgDiagProfileEmptyHint"),
		});
	}

	// 下面几条依赖 overview(外壳统一拉的那份);拿不到就不检查,避免误报。
	if (overviewData !== null && typeof overviewData === "object") {
		// 回合管道健康(v1.16):boot 失败时页面照样能开、API 照样在,但一回合都不会被记录。
		// 这是最坏的一种静默失效(0 工作区 / 0 记忆),必须显式报出来,别让用户以为"只是没数据"。
		const health = overviewData.stats !== null && typeof overviewData.stats === "object"
			? overviewData.stats.health
			: null;
		if (health !== null && typeof health === "object" && health.state === "failed") {
			const reason = typeof health.error === "string" && health.error !== "" ? health.error : "unknown";
			items.push({
				id: "boot-failed", tone: "warn",
				title: t("cfgDiagBootFailed", { error: reason }), hint: t("cfgDiagBootFailedHint"),
			});
		}
		if (overviewData.stats !== null && typeof overviewData.stats === "object" && overviewData.stats.persisted === false) {
			items.push({
				id: "memory-only", tone: "warn",
				title: t("cfgDiagMemoryOnly"), hint: t("cfgDiagMemoryOnlyHint"),
			});
		}
		if (overviewData.workspaces !== null && typeof overviewData.workspaces === "object"
			&& Number(overviewData.workspaces.total) === 0) {
			items.push({
				id: "no-workspace", tone: "info", group: "privacy",
				title: t("cfgDiagNoWorkspace"), hint: t("cfgDiagNoWorkspaceHint"),
			});
		}
	}

	// Array.prototype.sort 是稳定排序:warn 前 info 后,同档保持声明顺序。
	return items.sort((a, b) => (DIAG_TONE_RANK[a.tone] ?? 9) - (DIAG_TONE_RANK[b.tone] ?? 9));
}

// ── 局部小组件 ────────────────────────────────────────────────────────────

/** 可折叠分组:标题 + 图标 + 「已改 n 项」计数;内容由调用方放进 children 数组。 */
function CfgGroup({ t, group, open, changed, onToggle, children }) {
	const { h } = react;
	const count = changed > 0 ? t("cfgGroupChanged", { n: changed }) : t("cfgGroupCount", { n: group.fields.length });
	return h("section", {
		className: cx("cfg-group", open === true ? "cfg-group-open" : null),
		"data-group-wrap": group.id,
		"data-group-open": open === true ? "true" : "false",
	}, [
		h("div", { className: "cfg-group-head", key: "head" }, [
			h("button", {
				key: "toggle",
				type: "button",
				className: "cfg-group-toggle",
				"data-group": group.id,
				"aria-expanded": open === true,
				onClick: onToggle,
			}, [
				h("span", { className: "cfg-chev", key: "chev" }, h(Icon, { name: "chevron", size: 11 })),
				h(Icon, { key: "icon", name: group.icon, size: 15 }),
				h("span", { className: "cfg-group-title", key: "title" }, t(group.title)),
			]),
			h("span", {
				key: "count",
				className: cx("cfg-group-count", changed > 0 ? "cfg-group-count-changed" : null),
				"data-changed": changed,
			}, count),
		]),
		open === true ? h("div", { className: "cfg-group-body", key: "body" }, children) : null,
	]);
}

/** 「需要关注」诊断卡:逐条 chip + 一句解释 + 可选「去设置」跳转。 */
function DiagnosticCard({ t, items, onJump }) {
	const { h } = react;
	if (items.length === 0) {
		return h(Card, {
			className: "cfg-diag-card",
			title: t("cfgDiagTitle"),
			sub: t("cfgDiagSub"),
			children: [h(Banner, { key: "ok", tone: "ok", title: t("cfgDiagOk"), children: t("cfgDiagOkHint") })],
		});
	}
	return h(Card, {
		className: "cfg-diag-card",
		title: t("cfgDiagTitle"),
		sub: t("cfgDiagCount", { n: items.length }),
		children: [h("div", { className: "cfg-diag-list", key: "list" }, items.map((item) => h("div", {
			className: "cfg-diag-row",
			key: item.id,
			"data-diag": item.id,
			"data-tone": item.tone,
		}, [
			h(Chip, { key: "title", tone: item.tone, dot: true, children: item.title }),
			h("span", { className: "cfg-diag-hint", key: "hint" }, item.hint),
			item.group === undefined ? null : h("button", {
				key: "jump",
				type: "button",
				className: "mem-btn mem-btn-sm mem-btn-ghost",
				"data-diag-jump": item.group,
				onClick: () => onJump(item.group),
			}, t("cfgDiagGo")),
		])))],
	});
}

/** 单个配置字段行:左侧标签 / 说明 / 键名,右侧控件 + 已覆盖徽章 + 重置。 */
function FieldRow({ def, snapshot, t, mutate, disabled, refreshKey }) {
	const { h, useState } = react;
	const [invalid, setInvalid] = useState("");
	const path = pathOf(def.key);
	const value = getPath(snapshot.value ?? {}, path);
	const overridden = getPath(snapshot.user ?? {}, path) !== undefined;
	const labelKey = labelKeyOf(def);
	const descKey = descKeyOf(def);
	const descText = t(descKey);
	const hasDesc = typeof descText === "string" && descText !== descKey && descText.trim() !== "";
	const write = (next) => {
		if (disabled === true) return;
		mutate([{ op: "set", path, value: next }]);
	};
	const reset = () => {
		if (disabled === true) return;
		mutate([{ op: "unset", path }]);
	};

	let control;
	if (def.kind === "toggle") {
		control = h("label", { className: "cfg-toggle", key: "ctl" }, [
			h("input", {
				key: "box",
				type: "checkbox",
				"data-toggle": def.key,
				checked: value === true,
				disabled: disabled === true,
				onChange: (e) => write(e.target.checked),
			}),
			h("span", { className: "cfg-toggle-text", key: "text" }, value === true ? t("commonOn") : t("commonOff")),
		]);
	} else if (def.kind === "select") {
		const options = Array.isArray(def.options) ? def.options : [];
		const current = value === undefined || value === null ? options[0] ?? "" : String(value);
		control = h("select", {
			key: "ctl",
			className: "mem-select",
			"data-select": def.key,
			value: current,
			disabled: disabled === true,
			onChange: (e) => write(e.target.value),
		}, options.map((option) => h("option", { key: option, value: option }, option)));
	} else if (def.kind === "number") {
		control = h(DraftInput, {
			key: "ctl",
			value: toText("text", value),
			type: "number",
			onCommit: (text) => {
				const raw = String(text ?? "").trim();
				if (raw === "") {
					setInvalid(t("cfgNumberRequired"));
					return;
				}
				const next = Number(raw);
				if (!Number.isFinite(next)) {
					setInvalid(t("cfgNumberInvalid"));
					return;
				}
				setInvalid("");
				write(next);
			},
		});
	} else if (def.kind === "workspaces") {
		control = h(WorkspacePicker, {
			key: "ctl",
			value,
			write,
			t,
			disabled,
			refreshKey,
		});
	} else if (def.kind === "lines" || def.kind === "dict") {
		control = h(DraftInput, {
			key: "ctl",
			value: toText(def.kind, value),
			textarea: true,
			placeholder: t(def.kind === "dict" ? "cfgDictPlaceholder" : "cfgLinesPlaceholder"),
			onCommit: (text) => write(fromText(def.kind, text)),
		});
	} else {
		control = h(DraftInput, {
			key: "ctl",
			value: toText("text", value),
			onCommit: (text) => write(text),
		});
	}

	const ctlChildren = [control];
	if (overridden) {
		ctlChildren.push(h("span", {
			key: "override",
			className: "mem-badge mem-badge-warn",
			"data-override": def.key,
			title: t("cfgOverrideHint"),
		}, t("overridden")));
		ctlChildren.push(h("button", {
			key: "reset",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-reset": def.key,
			title: t("cfgResetHint"),
			disabled: disabled === true,
			onClick: reset,
		}, t("reset")));
	}
	if (invalid !== "") {
		ctlChildren.push(h("span", {
			key: "invalid",
			className: "cfg-invalid",
			"data-invalid": def.key,
			role: "alert",
		}, invalid));
	}

	return h("div", {
		className: cx("mem-field", "cfg-field", disabled === true ? "cfg-field-readonly" : null),
		"data-field": def.key,
		"data-kind": def.kind,
	}, [
		h("div", { className: "mem-field-label cfg-field-label", key: "label" }, [
			h("span", { className: "mem-field-name", key: "name" }, t(labelKey)),
			hasDesc ? h("span", { className: "mem-field-desc", key: "desc" }, descText) : null,
			h("code", { className: "cfg-key", key: "key", title: t("cfgKeyHint") }, def.key),
		]),
		h("div", { className: "mem-field-ctl cfg-ctl", key: "ctl" }, ctlChildren),
	]);
}

/**
 * `disabledWorkspaces` 的自定义编辑器(v1.15 升级版):
 *  - 已知工作区列表(勾选 = 启用)+ 搜索过滤 + 全部启用 / 全部停用;
 *  - 每行显示记忆条数与最近出现时间;
 *  - 底部「手动添加路径」折叠区(每行一个,支持前缀),与勾选写**同一字段**。
 *
 * 两个入口基于同一个当前值读写:勾选在 `value` 上增删一条,手动区整段覆盖
 * `toText/fromText("lines")`;`DraftInput` 在外部值变化时回写草稿,不存在两份副本。
 */
function WorkspacePicker({ value, write, t, disabled, refreshKey }) {
	const { h, useState } = react;
	const workspaceState = useConfigApi("workspaces", [refreshKey]);
	const [filter, setFilter] = useState("");
	const [manualOpen, setManualOpen] = useState(false);
	const entries = Array.isArray(value) ? value.map((entry) => String(entry)) : [];
	const rows = workspaceState.data !== null && Array.isArray(workspaceState.data.workspaces)
		? workspaceState.data.workspaces
		: [];
	const query = filter.trim().toLowerCase();
	const visible = query === ""
		? rows
		: rows.filter((row) => {
			const id = String(row.id ?? "").toLowerCase();
			const label = String(row.label ?? "").toLowerCase();
			return id.includes(query) || label.includes(query);
		});
	const disabledCount = rows.filter((row) => coversWorkspace(row.id, entries)).length;

	const setEnabled = (workspaceId, enabled) => {
		if (disabled === true) return;
		if (enabled === true) write(entries.filter((entry) => !coversWorkspace(workspaceId, [entry])));
		else if (!coversWorkspace(workspaceId, entries)) write(entries.concat(String(workspaceId)));
	};
	const enableAll = () => {
		if (disabled === true || rows.length === 0) return;
		write([]);
	};
	const disableAll = () => {
		if (disabled === true || rows.length === 0) return;
		const next = entries.slice();
		for (const row of rows) {
			const id = String(row.id ?? "");
			if (id !== "" && !coversWorkspace(id, next)) next.push(id);
		}
		write(next);
	};
	const lastSeenOf = (row) => {
		const ms = Number(row.lastSeenMs);
		if (Number.isFinite(ms) && ms > 0) return fmtDateTime(new Date(ms).toISOString());
		const at = typeof row.lastSeenAt === "string" ? row.lastSeenAt : "";
		return at === "" ? t("cfgWsNeverSeen") : fmtDateTime(at);
	};

	const nodes = [];
	if (workspaceState.error !== "") {
		nodes.push(h("div", {
			className: "cfg-ws-error mem-msg mem-msg-error",
			key: "error",
			role: "status",
		}, t("cfgWsError") + ": " + workspaceState.error));
	}
	nodes.push(h("div", { className: "cfg-ws-tools", key: "tools" }, [
		h(SearchBox, {
			key: "search",
			value: filter,
			onChange: setFilter,
			placeholder: t("cfgWsSearch"),
		}),
		h("span", { className: "cfg-ws-summary", key: "summary" },
			t("cfgWsSummary", { total: rows.length, disabled: disabledCount })),
	]));
	nodes.push(h("div", { className: "cfg-ws-actions", key: "actions" }, [
		h("button", {
			key: "enable-all",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-ws-action": "enable-all",
			disabled: disabled === true || rows.length === 0,
			onClick: enableAll,
		}, t("cfgWsEnableAll")),
		h("button", {
			key: "disable-all",
			type: "button",
			className: "mem-btn mem-btn-sm",
			"data-ws-action": "disable-all",
			disabled: disabled === true || rows.length === 0,
			onClick: disableAll,
		}, t("cfgWsDisableAll")),
		h("span", { className: "cfg-ws-prefix mem-hint", key: "prefix" }, t("cfgWsPrefixHint")),
	]));
	if (workspaceState.loading === true && workspaceState.data === null) {
		nodes.push(h("div", { className: "mem-hint", key: "loading" }, t("cfgWsLoading")));
	} else if (rows.length === 0 && workspaceState.error === "") {
		nodes.push(h("div", { className: "mem-hint", key: "empty" }, t("cfgWsEmpty")));
	} else if (rows.length > 0 && visible.length === 0) {
		nodes.push(h("div", { className: "mem-hint", key: "no-match" }, t("cfgWsNoMatch")));
	}
	if (visible.length > 0) {
		nodes.push(h("ul", { className: "cfg-ws-list", key: "list" }, visible.map((row) => {
			const id = String(row.id ?? "");
			const rawLabel = row.label === undefined || row.label === null ? "" : String(row.label);
			const label = rawLabel === "" ? id : rawLabel;
			const count = Number(row.count) || 0;
			return h("li", { className: "cfg-ws-row", key: id, "data-workspace-row": id }, [
				h("label", { className: "cfg-ws-check", key: "check" }, [
					h("input", {
						key: "box",
						type: "checkbox",
						"data-workspace": id,
						checked: !coversWorkspace(id, entries),
						disabled: disabled === true,
						onChange: (e) => setEnabled(id, e.target.checked),
					}),
					h("span", { className: "cfg-ws-label", key: "label", title: id }, label),
				]),
				h("span", { className: "cfg-ws-count mem-num", key: "count" }, t("cfgWsCount", { n: count })),
				h("span", { className: "cfg-ws-time", key: "time" }, t("cfgWsLastSeen", { time: lastSeenOf(row) })),
			]);
		})));
	}
	nodes.push(h("div", { className: "cfg-ws-manual", key: "manual" }, [
		h("button", {
			key: "toggle",
			type: "button",
			className: "mem-btn mem-btn-ghost mem-btn-sm",
			"data-ws-manual": "toggle",
			"aria-expanded": manualOpen === true,
			onClick: () => setManualOpen((prev) => !prev),
		}, t("cfgWsManual")),
		manualOpen === true ? h("div", { className: "cfg-ws-manual-body", key: "body" }, [
			h("div", { className: "mem-hint", key: "count" }, t("cfgWsManualCount", { n: entries.length })),
			h("div", { className: "mem-hint", key: "hint" }, t("cfgWsManualHint")),
			h(DraftInput, {
				key: "input",
				value: toText("lines", value),
				textarea: true,
				placeholder: t("cfgWsManualHint"),
				onCommit: (text) => {
					if (disabled === true) return;
					write(fromText("lines", text));
				},
			}),
		]) : null,
	]));

	return h("div", { className: "cfg-ws" }, nodes);
}

/** 向量检索的密钥管理(只写不显示):读写 DSH credentials,不碰插件配置。 */
function EmbeddingKey({ t, revision, refreshKey, disabled }) {
	const { h, useState } = react;
	const status = useConfigApi("embedKeyStatus", [revision, refreshKey]);
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState("");
	const [failure, setFailure] = useState("");
	const data = status.data;
	const name = typeof data?.name === "string" ? data.name : "";
	const credentials = data === null ? true : data.credentials !== false;
	const statusWritable = data === null ? true : data.writable !== false;
	const optional = data?.optional === true;
	const configured = data?.configured === true;
	const source = typeof data?.source === "string" && data.source !== "" ? data.source : "";

	let stateHint = "";
	if (name === "") stateHint = optional ? t("embedKeyOptionalNoName") : t("embedKeyNeedName");
	else if (!credentials) stateHint = t("embedKeyUnavailable");
	else if (configured) stateHint = t("embedKeyConfigured") + (source === "" ? "" : " · " + t("cfgEmbedKeySource", { source }));
	else stateHint = optional ? t("embedKeyOptionalHint") : t("embedKeyMissing");

	const save = () => {
		if (disabled === true || busy || key.trim() === "") return;
		setBusy(true);
		setNote("");
		setFailure("");
		api("embedKeySave", { key: key.trim() })
			.then(() => {
				setKey("");
				setNote(t("embedKeySaved"));
				status.reload();
			})
			.catch((e) => setFailure(String(e?.message ?? e)))
			.finally(() => setBusy(false));
	};
	const clear = () => {
		if (disabled === true || busy) return;
		setBusy(true);
		setNote("");
		setFailure("");
		api("embedKeyClear")
			.then(() => {
				setNote(t("embedKeyCleared"));
				status.reload();
			})
			.catch((e) => setFailure(String(e?.message ?? e)))
			.finally(() => setBusy(false));
	};

	const controls = [];
	if (status.loading === true && data === null) {
		controls.push(h("span", { className: "mem-hint", key: "loading" }, t("commonLoading")));
	} else if (status.error !== "" && data === null) {
		controls.push(h("span", { className: "cfg-invalid", key: "error", role: "alert" },
			t("commonError") + ": " + status.error));
	} else if (credentials === false || name === "") {
		controls.push(h("span", { className: "mem-hint", key: "hint" }, stateHint));
	} else {
		controls.push(h("input", {
			key: "key",
			className: "mem-input",
			type: "password",
			autoComplete: "new-password",
			"data-embed-key": "input",
			value: key,
			disabled: disabled === true || busy === true,
			placeholder: configured ? t("embedKeyPlaceholderUpdate") : "sk-…",
			onChange: (e) => setKey(e.target.value),
		}));
		controls.push(h("button", {
			key: "save",
			type: "button",
			className: "mem-btn mem-btn-primary",
			"data-embed-action": "save",
			disabled: disabled === true || busy === true || key.trim() === "",
			onClick: save,
		}, t("embedKeySave")));
		controls.push(h("button", {
			key: "clear",
			type: "button",
			className: "mem-btn",
			"data-embed-action": "clear",
			disabled: disabled === true || busy === true || configured !== true || statusWritable !== true,
			onClick: clear,
		}, t("embedKeyClear")));
		controls.push(h("span", { className: "mem-hint", key: "state" }, stateHint));
	}
	if (note !== "") controls.push(h("span", { className: "mem-msg mem-msg-ok", key: "note" }, note));
	if (failure !== "") controls.push(h("span", { className: "cfg-invalid", key: "failure", role: "alert" }, failure));

	return h("div", { className: "mem-field cfg-field cfg-field-embed", "data-embed": "key" }, [
		h("div", { className: "mem-field-label cfg-field-label", key: "label" }, [
			h("span", { className: "mem-field-name", key: "name" }, t("embedKeyLabel")),
			h("span", { className: "mem-field-desc", key: "desc" }, t("embedKeyHint")),
		]),
		h("div", { className: "mem-field-ctl cfg-ctl", key: "ctl" }, controls),
	]);
}

/** 连接测试:发一条固定短文本验证 baseUrl / modelId / 凭据,不读写记忆。 */
function EmbeddingProbe({ t, disabled }) {
	const { h, useState } = react;
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState(null);
	const run = () => {
		if (disabled === true || busy === true) return;
		setBusy(true);
		setResult(null);
		api("embedTest")
			.then((response) => setResult({ ok: true, ...response }))
			.catch((e) => setResult({ ok: false, error: String(e?.message ?? e) }))
			.finally(() => setBusy(false));
	};
	const controls = [h("button", {
		key: "run",
		type: "button",
		className: "mem-btn",
		"data-embed-action": "test",
		disabled: disabled === true || busy === true,
		onClick: run,
	}, busy === true ? t("embedTesting") : t("embedTest"))];
	if (result !== null && result.ok === true) {
		const meta = [
			String(result.model ?? "—"),
			String(result.dimensions ?? "—") + " " + t("embedTestDims"),
			String(result.latencyMs ?? "—") + "ms",
		].join(" · ");
		controls.push(h("span", { className: "mem-msg mem-msg-ok", key: "ok", "data-embed-result": "ok" }, "✓ " + meta));
	} else if (result !== null) {
		controls.push(h("span", { className: "cfg-invalid", key: "error", role: "alert", "data-embed-result": "error" },
			"✗ " + t("cfgEmbedFailed") + ": " + String(result.error ?? "")));
	}
	return h("div", { className: "mem-field cfg-field cfg-field-embed", "data-embed": "probe" }, [
		h("div", { className: "mem-field-label cfg-field-label", key: "label" }, [
			h("span", { className: "mem-field-name", key: "name" }, t("embedTest")),
			h("span", { className: "mem-field-desc", key: "desc" }, t("embedTestHint")),
		]),
		h("div", { className: "mem-field-ctl cfg-ctl", key: "ctl" }, controls),
	]);
}

// ── 面板本体 ──────────────────────────────────────────────────────────────

export function ConfigCard({ t, form, overview, refreshKey = 0 }) {
	const { h, useState, useCallback, useSyncExternalStore } = react;
	const tt = typeof t === "function" ? t : (key) => key;
	const activeForm = form ?? null;

	// 读快照:form 缺席时退化为「设置服务不可用」的静态快照,而不是抛错整页白屏。
	const subscribe = useCallback((callback) => (
		typeof activeForm?.subscribe === "function" ? activeForm.subscribe(callback) : () => {}
	), [activeForm]);
	const getSnapshot = useCallback(() => (
		typeof activeForm?.getSnapshot === "function" ? activeForm.getSnapshot() : UNAVAILABLE_SNAPSHOT
	), [activeForm]);
	const snapshot = useSyncExternalStore(subscribe, getSnapshot) ?? UNAVAILABLE_SNAPSHOT;
	const writer = useSettingsWriter(activeForm, tt);

	const [query, setQuery] = useState("");
	const [openGroups, setOpenGroups] = useState(INITIAL_OPEN);
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const setGroupOpen = (id, open) => setOpenGroups((prev) => ({ ...prev, [id]: open === true }));
	const expandAll = () => {
		setOpenGroups(ALL_OPEN);
		setAdvancedOpen(true);
	};
	const collapseAll = () => {
		setOpenGroups(ALL_CLOSED);
		setAdvancedOpen(false);
	};
	const jumpToGroup = (id) => {
		setQuery("");
		setGroupOpen(id, true);
	};

	// ── 三态:加载中 / 设置服务不可用 / 正常可编辑 ─────────────────────────
	if (snapshot.status === "loading") {
		return h(Card, {
			className: "cfg-card",
			title: tt("configTitle"),
			sub: tt("configHint"),
			children: [
				h(Toolbar, {
					key: "chips",
					children: [h(Chip, {
						key: "service",
						tone: "muted",
						children: tt("cfgService") + " · " + tt("cfgServiceLoading"),
					})],
				}),
				h(Skeleton, { key: "skeleton", lines: 5 }),
			],
		});
	}
	if (snapshot.status !== "ready") {
		return h(Card, {
			className: "cfg-card",
			title: tt("configTitle"),
			children: [h(Banner, {
				key: "unavailable",
				tone: "warn",
				title: tt("cfgServiceUnavailable"),
				children: [tt("configUnavailable"), " ", tt("configUnavailableHint")],
			})],
		});
	}

	const value = snapshot.value ?? {};
	const user = snapshot.user ?? {};
	const readonly = snapshot.writable === false;
	const overviewData = overview !== null && typeof overview === "object" ? (overview.data ?? null) : null;
	const items = diagnoseConfig(tt, value, overviewData);
	const changedTotal = CONFIG_FIELDS.filter((def) => fieldOverridden(user, def.key)).length;

	const queryNorm = query.trim().toLowerCase();
	const searching = queryNorm !== "";
	const matchesByGroup = new Map();
	let matchCount = 0;
	for (const group of GROUPS) {
		const defs = group.fields.filter((def) => !searching || matchesField(tt, def, queryNorm));
		if (!searching || defs.length > 0) matchesByGroup.set(group.id, defs);
		if (searching) matchCount += defs.length;
	}

	/** 生成一组的字段行;向量组额外插入密钥管理 / 连接测试 / 高级选项。 */
	const buildGroupRows = (group, defs) => {
		const core = [];
		const advanced = [];
		for (const def of defs) {
			const row = h(FieldRow, {
				key: def.key, def, snapshot, t: tt, mutate: writer.mutate, disabled: readonly, refreshKey,
			});
			if (def.advanced === true) {
				advanced.push(row);
				continue;
			}
			core.push(row);
			if (group.id === "embedding" && def.key === "semanticSearch.apiKeyEnv") {
				core.push(h(EmbeddingKey, {
					key: "embed-key", t: tt, revision: snapshot.revision, refreshKey, disabled: readonly,
				}));
			}
			if (group.id === "embedding" && def.key === "semanticSearch.apiKeyOptional") {
				core.push(h(EmbeddingProbe, { key: "embed-probe", t: tt, disabled: readonly }));
			}
		}
		if (advanced.length > 0) {
			const showAdvanced = advancedOpen === true || searching;
			core.push(h("div", { className: "cfg-advanced-toggle", key: "advanced-toggle" }, [
				h("button", {
					key: "toggle",
					type: "button",
					className: "mem-btn mem-btn-ghost mem-btn-sm",
					"data-advanced": group.id,
					"aria-expanded": showAdvanced,
					onClick: () => setAdvancedOpen((prev) => !prev),
				}, tt(showAdvanced ? "hideAdvanced" : "showAdvanced")),
				h("span", { className: "mem-hint", key: "hint" }, tt("cfgAdvancedHint")),
			]));
			if (showAdvanced) {
				core.push(h("div", { className: "cfg-advanced", key: "advanced" }, advanced));
			}
		}
		return core;
	};

	const groupNodes = [];
	for (const group of GROUPS) {
		const defs = matchesByGroup.get(group.id);
		if (defs === undefined) continue;
		const changed = group.fields.filter((def) => fieldOverridden(user, def.key)).length;
		groupNodes.push(h(CfgGroup, {
			key: group.id,
			t: tt,
			group,
			open: searching ? true : openGroups[group.id] === true,
			changed,
			onToggle: () => setGroupOpen(group.id, !(searching ? true : openGroups[group.id] === true)),
			children: buildGroupRows(group, defs),
		}));
	}

	const statusChips = [
		h(Chip, {
			key: "service",
			tone: readonly ? "warn" : "ok",
			title: tt("cfgServiceHint"),
			children: tt("cfgService") + " · " + tt(readonly ? "cfgServiceReadonly" : "cfgServiceReady"),
		}),
		h(Chip, {
			key: "autosave",
			tone: "muted",
			dot: false,
			title: tt("cfgAutoSaveHint"),
			children: tt("cfgAutoSave"),
		}),
		h(Chip, {
			key: "overridden",
			tone: changedTotal > 0 ? "warn" : "muted",
			dot: changedTotal > 0,
			title: tt("cfgOverriddenHint"),
			children: tt("cfgOverriddenCount", { n: changedTotal }),
		}),
		h(Chip, {
			key: "fields",
			tone: "muted",
			dot: false,
			children: tt("cfgFieldCount", { n: CONFIG_FIELDS.length }),
		}),
	];

	const statusChildren = [h(Toolbar, { key: "chips", children: statusChips })];
	if (readonly) {
		statusChildren.push(h(Banner, {
			key: "readonly",
			tone: "warn",
			title: tt("cfgServiceReadonly"),
			children: tt("configReadonly"),
		}));
	}
	if (writer.error !== "") {
		statusChildren.push(h(Banner, {
			key: "write-error",
			tone: "error",
			title: tt("cfgWriteError"),
			children: writer.error,
		}));
	}

	const searchChildren = [
		h(SearchBox, {
			key: "search",
			value: query,
			onChange: setQuery,
			onClear: () => setQuery(""),
			placeholder: tt("cfgSearchPlaceholder"),
		}),
	];
	if (searching) {
		searchChildren.push(h("span", { className: "cfg-match", key: "match" }, tt("cfgSearchMatches", { n: matchCount })));
	}
	searchChildren.push(h("button", {
		key: "expand",
		type: "button",
		className: "mem-btn mem-btn-toolbar",
		"data-action": "expand",
		onClick: expandAll,
	}, tt("cfgExpandAll")));
	searchChildren.push(h("button", {
		key: "collapse",
		type: "button",
		className: "mem-btn mem-btn-toolbar",
		"data-action": "collapse",
		onClick: collapseAll,
	}, tt("cfgCollapseAll")));

	return h("div", { className: "cfg" }, [
		h(Card, {
			key: "status",
			className: "cfg-status-card",
			title: tt("configTitle"),
			sub: tt("configHint"),
			children: statusChildren,
		}),
		h(DiagnosticCard, { key: "diag", t: tt, items, onJump: jumpToGroup }),
		h(Toolbar, { key: "tools", children: searchChildren }),
		searching && matchCount === 0
			? h(Empty, { key: "no-match", title: tt("cfgSearchEmpty") })
			: null,
		...groupNodes,
	]);
}

export default ConfigCard;
