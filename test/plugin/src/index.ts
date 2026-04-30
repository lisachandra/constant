import { startConstantPluginBootstrap } from "@lisachandra/plugin";

export const pluginBootstrap = startConstantPluginBootstrap({
	flushDelaySeconds: 0.25,
	autoFlush: true,
});
