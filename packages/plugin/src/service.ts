import {
	applyConstantUpdate,
	getConstantsFilePath,
	resolveConstantsFilePath,
	type ConstantPluginUpdateRequest,
	type ConstantScope,
	type PersistedConstantFile,
} from "./persistence";

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
	const snapshots = new Map<string, PersistedConstantFile>();

	for (const scope of ["client", "server"] as const) {
		snapshots.set(getConstantsFilePath(scope), initialSnapshots[scope] ?? {});
	}

	return {
		getSnapshot(scope: ConstantScope): PersistedConstantFile {
			return snapshots.get(getConstantsFilePath(scope)) ?? {};
		},

		receiveUpdate(request: ConstantPluginUpdateRequest): PersistedConstantFile {
			const path = resolveConstantsFilePath(request);
			const nextFile = applyConstantUpdate(snapshots.get(path) ?? {}, request);
			snapshots.set(path, nextFile);
			return nextFile;
		},

		flushScope(scope: ConstantScope): void {
			const path = getConstantsFilePath(scope);
			writer.write(path, snapshots.get(path) ?? {});
		},

		flushAll(): void {
			for (const [path, snapshot] of snapshots) {
				writer.write(path, snapshot);
			}
		},
	};
}
