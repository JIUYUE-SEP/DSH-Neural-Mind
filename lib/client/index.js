/**
 * 记忆插件浏览器半入口:主侧栏「记忆」入口 + 右侧主区域「记忆控制台」(v1.15)。
 *
 * 切片:loader.js 登记入口 / css.js 样式聚合 / locale.js 词典聚合 / runtime.js 共享运行时 /
 * components.js 共享原子组件 / shell.js 页面外壳与页签;一卡一文件
 * (overview/browse/recall/config/profile/soul/audit)。本文件只做装配:模块定义 + 槽位注册。
 *
 * 两个槽位成对注册(宿主 0.2.1 的"全局面板"契约,与「插件」「自动化任务」同一姿势):
 *  - `main`(keyed):key = 面板 id,内容渲染在右侧主区域;
 *  - `sidebar.panellist`(list):id 与 main 的 key 同源,点击走 `layout.selectPanel(id)`。
 * 两者分开登记是因为侧栏行只渲染图标(`{ size, active }`),页面体由 main 槽按当前
 * `activePanelId` 选择。id 必须是宿主 `layout.selectPanel` 能查到的 main 注册项,
 * 否则点侧栏会抛 `main panel "…" is not registered`。
 *
 * 配置仍走 `ctx.configForms.get('neural-mind')`(0.2.0 官方设置传输;namespace 就是本插件
 * 的 profile entry id,由宿主半的 volatile 字段决定它是否被服务);
 * 记忆数据走宿主半的 /neural-mind/api 同源 JSON 路由。
 */
import { injectCss } from "./css.js";
import { zh, en } from "./locale.js";
import { initRuntime, react, NS } from "./runtime.js";
import { MemoryPage } from "./shell.js";

export const inject = ["slots", "locale", "configForms"];

/**
 * 侧栏入口 id 与 main 槽的 key 必须同源:侧栏点击把它交给 `layout.selectPanel(id)`,
 * 宿主再用同一个 id 去 main 槽挑页面。这里直接复用 NS(`memory` = 插件的 profile
 * entry id),不另起一个字符串——两处各写一份就迟早对不上。
 */
const PANEL_ID = NS;

/**
 * 侧栏图标。宿主把 `sidebar.panellist` 的内容渲染成侧栏行的图标单元格
 * (`.panelGlyph`),传进来的 props 是 `{ size, active }`;这里只认 `size`。
 * 用内联 SVG 而不是宿主 `@deepseek-ai/dsh-client-ui-primitives`:客户端插件
 * 不该 require 其它 Client 包(引用会随宿主版本漂移,抛错时整格面板会消失),
 * 官方的做法是自带一份同样用 `currentColor` / `--dsw-alias-*` 的图标。
 */
function MemoryPanelIcon({ size }) {
	const { h } = react;
	const px = typeof size === "number" ? size : 18;
	return h("svg", {
		width: px,
		height: px,
		viewBox: "0 0 20 20",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.4,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		focusable: "false",
	}, [
		h("rect", { key: "chip", x: "4.6", y: "4.6", width: "10.8", height: "10.8", rx: "2.6" }),
		h("circle", { key: "core", cx: "10", cy: "10", r: "2.2" }),
		h("path", { key: "pins", d: "M10 4.6V2.6M10 15.4v2M4.6 10H2.6M15.4 10h2" }),
	]);
}

/**
 * Cordis 客户端插件装配点。**必须是模块级具名导出**:打包器
 * (`tools/build-client.mjs`)按具名导出给宿主组装 `module.exports`,
 * 与官方包 `exports.apply = apply` 是同一个落点。
 *
 * 注意 `require("react")` 与 `initRuntime`/`injectCss` 必须在 apply **之前**执行完,
 * 因为各组件的渲染期读的是 runtime.js 的 live binding。
 */
export function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "memory: dictionaries");
	const t = ctx.locale.bind(NS);
	// 官方设置传输:`get(entryId)` 返回本 entry 所有编辑器共享的已接受值与写入队列。
	// 命名空间未被服务时(例如宿主半一个 volatile 字段都没标),快照是
	// `status: 'unavailable'`,配置卡如实显示"不可用"而不是假装可编辑。
	const form = ctx.configForms.get(NS);

	function MemoryPageRoot(props = {}) {
		const { h } = react;
		// `t` 优先用槽位渲染器按 `locale: NS` 递进来的那一个(切换语言时它随 revision
		// 换新引用);闭包 t 只作为直接调用时的兜底(测试/宿主异常路径)。
		return h(MemoryPage, { ...props, form, t: props.t ?? t });
	}

	// 右侧主区域页:keyed 槽按 `activePanelId` 选人,所以 key 就是面板 id。
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: PANEL_ID,
		locale: NS,
		inject: () => ({ form }),
	}, MemoryPageRoot));

	// 主侧栏行:order 20 = 排在「自动化任务」(10)之后;label 走词典,
	// 侧栏折叠态下由宿主的 tooltip / aria-label 显示。
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: PANEL_ID,
		order: 20,
		locale: NS,
		label: () => t("tab"),
	}, MemoryPanelIcon));
}

export const definition = {
	id: "neural-mind",
	/**
	 * 运行时初始化钩子,**由打包器调用**(见 `tools/build-client.mjs`):它把
	 * `require("react")` 注入进来、装上样式,然后把**本模块的具名导出**
	 * (`apply` / `inject`)组装成宿主读的 `module.exports`。
	 *
	 * 所以这里只做初始化,不要把 `apply`/`inject` 塞进返回值——返回的东西会被
	 * 打包器丢掉,而且 `definition` 自己的属性会被污染(实测踩过)。
	 */
	factory: (require) => {
		initRuntime(require("react"));
		injectCss();
	},
};

export default definition;
