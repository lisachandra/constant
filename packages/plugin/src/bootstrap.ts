import {
	type ConstantPluginCoordinator,
	type ConstantPluginCoordinatorOptions,
	createConstantPluginCoordinator,
} from "./coordinator";
import type { ConstantScope, PersistedConstantFile } from "./persistence";
import { createHttpIoServeWriter } from "./writer";

export interface ConstantPluginBootstrapOptions extends ConstantPluginCoordinatorOptions {
	baseUrl?: string;
	initialSnapshots?: Partial<Record<ConstantScope, PersistedConstantFile>>;
}

export interface ConstantPluginBootstrapHandle {
	readonly coordinator: ConstantPluginCoordinator;
	stop(): void;
}

export function startConstantPluginBootstrap(
	options: ConstantPluginBootstrapOptions = {},
): ConstantPluginBootstrapHandle {
	const writer = createHttpIoServeWriter(options.baseUrl);
	const coordinator = createConstantPluginCoordinator(writer, options);

	return {
		coordinator,
		stop() {
			coordinator.disconnect();
		},
	};
}
