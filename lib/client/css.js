/**
 * 样式聚合入口:各面板只往自己的 `css/<panel>.js` 里加样式,这里统一拼成一份字符串注入。
 *
 * 顺序 = 层叠优先级(后者覆盖同名的前者):
 *   base(共享原子组件 + 通用版式)→ shell(页面外壳)→ 各面板。
 *
 * 只允许 DSH 主题令牌;`TAG_ID` 的 querySelector 栅栏保证重复调用也只插一份。
 * (v1.15 集成阶段已删除过渡期的 `css/legacy.js`,所有类都由下面这些模块自洽提供。)
 */
import { css as base } from "./css/base.js";
import { css as shell } from "./css/shell.js";
import { css as overview } from "./css/overview.js";
import { css as memories } from "./css/memories.js";
import { css as recall } from "./css/recall.js";
import { css as config } from "./css/config.js";
import { css as persona } from "./css/persona.js";

const CSS = [base, shell, overview, memories, recall, config, persona].join("");

const TAG_ID = "neural-mind/page.css";

/** 样式注入:工厂每次被调都试一次,querySelector 栅栏保证重复登记/调用也只插一份。 */
export function injectCss() {
	if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(TAG_ID) + "]") === null) {
		const tag = document.createElement("style");
		tag.dataset.plugin = "neural-mind";
		tag.dataset.pluginCss = TAG_ID;
		tag.textContent = CSS;
		document.head.appendChild(tag);
	}
}
