import { applyConstantUpdate, type ConstantPluginUpdateRequest, type ConstantScope, type PersistedConstantFile, getConstantsFilePath } from "./persistence";

export interface ConstantPersistenceWriter {
	write(path: string, contents: PersistedConstantFile): void;
}

export interface ConstantPluginPersistenceService {
	receiveUpdate(request: ConstantPluginUpdateRequest): PersistedConstantFile;
	getSnapshot(scope: ConstantScope): PersistedConstantFile;
	flushScope(scope: ConstantScope): void;
	flushAll(): void;
}

export function createConstantPluginPersistenceService(
	writer: ConstantPersistenceWriter,
	initialSnapshots: Partial<Record<ConstantScope, PersistedConstantFile>> = {},
): ConstantPluginPersistenceService {
	const snapshots = new Map<ConstantScope, PersistedConstantFile>();

	for (const scope of ["client", "server"] as const) {
		snapshots.set(scope, initialSnapshots[scope] ?? {});
	}

	function getSnapshot(scope: ConstantScope): PersistedConstantFile {
		return snapshots.get(scope) ?? {};
	}

	function receiveUpdate(request: ConstantPluginUpdateRequest): PersistedConstantFile {
		const next = applyConstantUpdate(getSnapshot(request.scope), request);
		snapshots.set(request.scope, next);
		return next;
	}

	function flushScope(scope: ConstantScope): void {
		writer.write(getConstantsFilePath(scope), getSnapshot(scope));
	}

	function flushAll(): void {
		flushScope("client");
		flushScope("server");
	}

	return {
		receiveUpdate,
		getSnapshot,
		flushScope,
		flushAll,
	};
}
