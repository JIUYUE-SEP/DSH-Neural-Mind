/**
 * 词典聚合入口:面板各自维护 `i18n/<panel>.js`,这里合并成宿主 `locale.register` 要的
 * `{ zh, en }`。合并顺序(后者覆盖前者):base(共享词)→ 各面板。
 *
 * 同名 key 由 `test/client-locale.test.mjs` 守着(base 与面板、面板与面板之间不允许无声覆盖)。
 * (v1.15 集成阶段已删除过渡期的 `i18n/legacy.js`:画像/SOUL 仍用的旧键已原样迁入 persona 片段。)
 */
import { zh as zhBase, en as enBase } from "./i18n/base.js";
import { zh as zhOverview, en as enOverview } from "./i18n/overview.js";
import { zh as zhMemories, en as enMemories } from "./i18n/memories.js";
import { zh as zhRecall, en as enRecall } from "./i18n/recall.js";
import { zh as zhConfig, en as enConfig } from "./i18n/config.js";
import { zh as zhPersona, en as enPersona } from "./i18n/persona.js";

export const zh = {
	...zhBase,
	...zhOverview,
	...zhMemories,
	...zhRecall,
	...zhConfig,
	...zhPersona,
};

export const en = {
	...enBase,
	...enOverview,
	...enMemories,
	...enRecall,
	...enConfig,
	...enPersona,
};
