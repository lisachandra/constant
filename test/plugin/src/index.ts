import { startConstantPluginBootstrap } from "@lisachandra/plugin";

export const pluginBootstrap = startConstantPluginBootstrap({
	autoFlush: true,
	flushDelaySeconds: 0.25,
});
