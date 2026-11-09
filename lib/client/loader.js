/**
 * 手写客户端模块加载器工厂形态(harness 的客户端打包预设未发布,归档架同款):
 * 模块 id 必须等于包名(loader 按包名查工厂)。
 *
 * 登记动作放在入口 lib/client.js:它每次被 import 都会重调这里(契约测试用 ?ts=
 * 绕缓存重引入口拿工厂);definition 本体在 index.js,重复登记同一个对象无副作用。
 */
export function registerClientModule(definition) {
	window.__ModuleLoader__.load(definition);
}
