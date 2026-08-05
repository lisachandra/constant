import {
	applyConstantUpdate,
	type ConstantPluginUpdateRequest,
	type ConstantScope,
	getConstantsFilePath,
	type PersistedConstantFile,
	resolveConstantsFilePath,
} from "./persistence";

export interface ConstantPersistenceWriter {
	write(path: string, contents: PersistedConstantFile): void;
}

export interface ConstantPluginPersistenceService {
	flushAll(): void;
	flushScope(scope: ConstantScope): void;
	getSnapshot(scope: ConstantScope): PersistedConstantFile;
	receiveUpdate(request: ConstantPluginUpdateRequest): PersistedConstantFile;
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
