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

	return {
		getSnapshot(scope: ConstantScope): PersistedConstantFile {
			return snapshots.get(scope) ?? {};
		},

		receiveUpdate(request: ConstantPluginUpdateRequest): PersistedConstantFile {
			const nextFile = applyConstantUpdate(this.getSnapshot(request.scope), request);
			snapshots.set(request.scope, nextFile);
			return nextFile;
		},

		flushScope(scope: ConstantScope): void {
			writer.write(getConstantsFilePath(scope), this.getSnapshot(scope));
		},

		flushAll(): void {
			this.flushScope("client");
			this.flushScope("server");
		},
	};
}
