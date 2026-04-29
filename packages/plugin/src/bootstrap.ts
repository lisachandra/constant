import { createConstantPluginCoordinator, type ConstantPluginCoordinator, type ConstantPluginCoordinatorOptions } from "./coordinator";
import { createHttpIoServeWriter } from "./writer";
import type { ConstantScope, PersistedConstantFile } from "./persistence";

export interface ConstantPluginBootstrapOptions extends ConstantPluginCoordinatorOptions {
	baseUrl?: string;
	initialSnapshots?: Partial<Record<ConstantScope, PersistedConstantFile>>;
}

export interface ConstantPluginBootstrapHandle {
	readonly coordinator: ConstantPluginCoordinator;
	stop(): void;
}

export function startConstantPluginBootstrap(options: ConstantPluginBootstrapOptions = {}): ConstantPluginBootstrapHandle {
	const writer = createHttpIoServeWriter(options.baseUrl);
	const coordinator = createConstantPluginCoordinator(writer, options);

	return {
		coordinator,
		stop() {
			coordinator.disconnect();
		},
	};
}
