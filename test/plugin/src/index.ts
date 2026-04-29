import { startConstantPluginBootstrap } from "../../../packages/plugin/src";

export const pluginBootstrap = startConstantPluginBootstrap({
	flushDelaySeconds: 0.25,
	autoFlush: true,
});
