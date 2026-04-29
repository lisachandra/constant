import { connectPluginTransport } from "./transport";
import {
	createConstantPluginPersistenceService,
	type ConstantPersistenceWriter,
	type ConstantPluginPersistenceService,
} from "./service";
import type { ConstantScope, PersistedConstantFile } from "./persistence";

export interface ConstantPluginCoordinator {
	readonly service: ConstantPluginPersistenceService;
	flushAll(): void;
	disconnect(): void;
}

export interface ConstantPluginCoordinatorOptions {
	event?: BindableEvent;
	flushDelaySeconds?: number;
	initialSnapshots?: Partial<Record<ConstantScope, PersistedConstantFile>>;
	autoFlush?: boolean;
}

export function createConstantPluginCoordinator(
	writer: ConstantPersistenceWriter,
	options: ConstantPluginCoordinatorOptions = {},
): ConstantPluginCoordinator {
	const service = createConstantPluginPersistenceService(writer, options.initialSnapshots);
	const flushDelaySeconds = options.flushDelaySeconds ?? 0.25;
	const autoFlush = options.autoFlush ?? true;
	const versions = new Map<ConstantScope, number>();

	const scheduleFlush = (scope: ConstantScope) => {
		const version = (versions.get(scope) ?? 0) + 1;
		versions.set(scope, version);

		if (flushDelaySeconds <= 0) {
			service.flushScope(scope);
			return;
		}

		task.delay(flushDelaySeconds, () => {
			if (versions.get(scope) !== version) return;
			service.flushScope(scope);
		});
	};

	const connection = connectPluginTransport(
		(request) => {
			service.receiveUpdate(request);
			if (autoFlush) scheduleFlush(request.scope);
		},
		options.event,
	);

	return {
		service,
		flushAll() {
			service.flushAll();
		},
		disconnect() {
			connection.Disconnect();
		},
	};
}
