/**
 * 共享运行时与共享小组件。React 由模块加载器的 require 注入(浏览器半没有可按 ESM
 * 引的 react)。
 *
 * ## 为什么是 `react` 这一个稳定对象,而不是 `export let h`
 *
 * 曾用过 `export let h` + `initRuntime(React)` 的写法——在 ESM 下靠 live binding 成立,
 * 但本插件的浏览器半要经 `tools/build-client.mjs` 打成单文件 bundle(宿主
 * `dsh-client-modules` 直接 `readFileSync` 那个文件,不做编译),打包器若把导入做成
 * **求值期快照**,`h` 就会是 `undefined`,渲染时炸成 `h is not a function`(实测踩过)。
 *
 * 与其让打包器去复刻跨模块 live binding,不如把可变状态收进**一个对象**:
 * 对象引用是常量,属性读取天然是"当下"的值——打包器只需保证导入绑定是常量即可。
 */
export const react = {
	h: undefined,
	useState: undefined,
	useEffect: undefined,
	useCallback: undefined,
	useSyncExternalStore: undefined,
};

export function initRuntime(React) {
	react.h = React.createElement;
	react.useState = React.useState;
	react.useEffect = React.useEffect;
	react.useCallback = React.useCallback;
	react.useSyncExternalStore = React.useSyncExternalStore;
}

/**
 * 设置 namespace。0.2.0 里它不再由插件登记,而是**本插件的 profile entry id**
 * ——设置服务按 entry id 寻址(`ctx.configForms.get(entryId)`),`cordis.patch.yml`
 * 里插入的就是 `id: neural-mind`,两边必须是同一个字符串。
 */
export const NS = "neural-mind";
export const API_PATH = "/neural-mind/api";

// ── /neural-mind/api ─────────────────────────────────────────────────────────

export async function api(action, payload) {
	const res = await fetch(API_PATH, {
		method: "POST",
		headers: { "content-type": "application/json", "x-neural-mind-client": "1" },
		body: JSON.stringify({ action, ...(payload ?? {}) }),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok || body.ok !== true) throw new Error(body.error || ("HTTP " + res.status));
	return body;
}

export const pathOf = (key) => key.split(".");
export const getPath = (obj, path) => path.reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

/** 字段当前值 ↔ 编辑文本 的双向换算。 */
export function toText(kind, value) {
	if (kind === "lines") return Array.isArray(value) ? value.join("\n") : "";
	if (kind === "dict") {
		return value && typeof value === "object"
			? Object.entries(value).map(([k, v]) => k + "=" + v).join("\n")
			: "";
	}
	return value === undefined || value === null ? "" : String(value);
}
export function fromText(kind, text) {
	if (kind === "lines") return text.split("\n").map((s) => s.trim()).filter((s) => s !== "");
	if (kind === "dict") {
		const out = {};
		for (const line of text.split("\n")) {
			const at = line.indexOf("=");
			if (at <= 0) continue;
			const k = line.slice(0, at).trim();
			const v = line.slice(at + 1).trim();
			if (k !== "" && (v === "summary" || v === "head")) out[k] = v;
		}
		return out;
	}
	return text;
}

/** 草稿态输入:本地编辑,失焦/回车提交;外部值变化时回写。 */
export function DraftInput({ value, onCommit, textarea, type, placeholder }) {
	const { h, useState, useEffect } = react;
	const [draft, setDraft] = useState(value);
	const [dirty, setDirty] = useState(false);
	useEffect(() => { if (!dirty) setDraft(value); }, [value, dirty]);
	const commit = () => {
		if (draft !== value) onCommit(draft);
		setDirty(false);
	};
	const props = {
		className: "mem-input",
		value: draft,
		placeholder,
		onChange: (e) => { setDraft(e.target.value); setDirty(true); },
		onBlur: commit,
		onKeyDown: (e) => { if (!textarea && e.key === "Enter") commit(); },
	};
	return textarea ? h("textarea", props) : h("input", { ...props, type: type ?? "text" });
}

/**
 * 带反馈的设置写入。
 *
 * 0.1.6 走 `ctx.settingsScope(ns).mutate(ops)`;0.2.0 换成 `ctx.configForms.get(entryId)`,
 * 拿到的是官方 ConfigFormController:`getSnapshot()` / `subscribe()` 读快照,
 * `set/unset/mutate(ops, expectedRevision)` 写。
 *
 * 写入判据**只认 `mutate` 的 boolean**(旧版那条"revision 没动也算失败"的栅栏本轮删掉了):
 *  (1) 官方控制器的 false 已覆盖所有真失败——`!response.ok` 时它自己 `recover()` 后返回 false,
 *      `persistence === "memory"`(非 loopback 页面)与 disposed 时直接 false;
 *  (2) revision 由**内容**决定(宿主 describe 的 `raw = JSON.stringify([fiber.uid, schema.toJSON(),
 *      entry.options.config])`,只有 raw 变了才 +1),所以**幂等写入会被宿主接受而 revision 不动**——
 *      数字框敲 `05`(当前值 5)、lines 域加个空行,旧判据都会假弹"写入失败"而值其实是对的。
 *      文本层那道 `draft !== value` 挡不住:归一化后相等、原文不等。
 *
 * 不传 `expectedRevision`:官方缺省取"队列执行那一刻的快照 revision",我们是失焦即提交
 * (不是暂存式编辑器),取最新才对;传编辑前读到的旧值反而会假冲突。
 *
 * ops 形状不变:仍是 `[{ op: "set" | "unset", path: string[], value? }]`——官方
 * `set(field, value)` 内部就是 `mutate([{ op:'set', path:[field], value }])`,
 * 而本插件的语义检索字段是嵌套路径(`semanticSearch.baseUrl`),所以直接走
 * `mutate` 的通用路径,和官方单个 set 是同一根线。
 */
export function useSettingsWriter(form, t) {
	const { useState, useCallback } = react;
	const [error, setError] = useState("");
	const mutate = useCallback((ops) => {
		if (form == null) {
			setError(t("configUnavailable"));
			return Promise.resolve(false);
		}
		return Promise.resolve()
			.then(() => form.mutate(ops))
			.then((accepted) => setError(accepted === false ? t("configWriteFailed") : ""))
			.catch((e) => setError(String(e.message ?? e)));
	}, [form, t]);
	return { error, mutate };
}

// ── v1.15 记忆控制台的共享小工具 ──────────────────────────────────────────

/** class 名拼接:过滤 falsy。 */
export function cx(...names) {
	return names.filter((name) => name !== undefined && name !== null && name !== false && name !== "").join(" ");
}

/** ISO 时间 → "YYYY-MM-DD HH:mm";无效值原样返回。 */
export function fmtDateTime(value) {
	const at = parseIso(value);
	return at === null ? (value === undefined || value === null ? "—" : String(value)) : `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

/** ISO 时间 → "MM-DD HH:mm"(列表行用)。 */
export function fmtShortTime(value) {
	const at = parseIso(value);
	return at === null ? "—" : `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

/** ISO 时间 → "HH:mm:ss"(注入日志用)。 */
export function fmtClock(value) {
	const at = parseIso(value);
	return at === null ? "—" : `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`;
}

/** 相对时间(中文口语;词典未覆盖的语言仍按中文,面板需本地化时用 t("time*") 自行拼)。 */
export function fmtAgo(value, nowMs = Date.now()) {
	const at = parseIso(value);
	if (at === null) return "—";
	const diff = Math.max(0, nowMs - at.getTime());
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days} 天前`;
	return fmtShortTime(value);
}

/** 计数显示:≥1 万用 "1.2万"。 */
export function fmtCount(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return "—";
	if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
	return String(n);
}

function pad2(n) {
	return String(n).padStart(2, "0");
}

function parseIso(value) {
	if (typeof value !== "string" || value === "") return null;
	const at = new Date(value);
	return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * 读一个 `/neural-mind/api` action 的状态容器:`{ data, error, loading, reload }`。
 *
 * 面板的常规姿势(与旧卡片手写 requestSeq 等价,但收敛到一处):
 *   const ov = useApi("overview", null, [refreshKey]);
 * `payload` 用 JSON 序列化参与依赖比较(对象字面量每次渲染都是新引用,不能直接进 deps)。
 * 卸载时自增内部序号,晚到的响应被丢弃(不 setState)。
 */
export function useApi(action, payload, deps = []) {
	const { useState, useEffect, useCallback } = react;
	const [state, setState] = useState({ data: null, error: "", loading: true });
	const [seq] = useState(() => ({ n: 0 }));
	const payloadKey = JSON.stringify(payload ?? null);
	const run = useCallback(() => {
		const mine = ++seq.n;
		setState((prev) => ({ data: prev.data, error: "", loading: true }));
		api(action, payload ?? undefined)
			.then((data) => {
				if (mine !== seq.n) return;
				setState({ data, error: "", loading: false });
			})
			.catch((error) => {
				if (mine !== seq.n) return;
				setState({ data: null, error: String(error?.message ?? error), loading: false });
			});
	}, [action, payloadKey, ...deps]);
	useEffect(() => {
		run();
		return () => { seq.n += 1; };
	}, [run]);
	return { data: state.data, error: state.error, loading: state.loading, reload: run };
}

/** 复制到剪贴板;不可用时抛错,由调用方给失败提示。 */
export async function copyText(text) {
	const value = String(text ?? "");
	if (typeof navigator === "undefined" || navigator.clipboard?.writeText === undefined) {
		throw new Error("clipboard unavailable");
	}
	await navigator.clipboard.writeText(value);
}
