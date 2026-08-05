import type { ConstantScope, PersistedConstantFile } from "./persistence";
import {
	type ConstantPersistenceWriter,
	type ConstantPluginPersistenceService,
	createConstantPluginPersistenceService,
} from "./service";
import { connectPluginTransport } from "./transport";

export interface ConstantPluginCoordinator {
	disconnect(): void;
	flushAll(): void;
	readonly service: ConstantPluginPersistenceService;
}

export interface ConstantPluginCoordinatorOptions {
	autoFlush?: boolean;
	event?: BindableEvent;
	flushDelaySeconds?: number;
	initialSnapshots?: Partial<Record<ConstantScope, PersistedConstantFile>>;
}

export function createConstantPluginCoordinator(
	writer: ConstantPersistenceWriter,
	options: ConstantPluginCoordinatorOptions = {},
): ConstantPluginCoordinator {
	const service = createConstantPluginPersistenceService(writer, options.initialSnapshots);
	const flushDelaySeconds = options.flushDelaySeconds ?? 0.25;
	const autoFlush = options.autoFlush ?? true;
	const versions = new Map<ConstantScope, number>();

	const scheduleFlush = (scope: ConstantScope): void => {
		const version = (versions.get(scope) ?? 0) + 1;
		versions.set(scope, version);

		if (flushDelaySeconds <= 0) {
			service.flushScope(scope);
			return;
		}

		task.delay(flushDelaySeconds, () => {
			if (versions.get(scope) !== version) {
				return;
			}

			service.flushScope(scope);
		});
	};

	const connection = connectPluginTransport((request) => {
		service.receiveUpdate(request);
		if (autoFlush) {
			scheduleFlush(request.scope);
		}
	}, options.event);

	return {
		disconnect() {
			connection.Disconnect();
		},
		flushAll() {
			service.flushAll();
		},
		service,
	};
}
