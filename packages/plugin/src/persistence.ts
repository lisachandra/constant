import type {
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
} from "@lisachandra/constant-protocol";

export type {
	ConstantScope,
	PersistedConstantFile,
	PersistedConstantGroup,
	SerializedConstant,
} from "@lisachandra/constant-protocol";

export type ConstantPluginUpdateRequest = ConstantUpdatePayload;

export function resolveConstantsFilePath(request: ConstantPluginUpdateRequest): string {
	return request.persistPath ?? getConstantsFilePath(request.scope);
}

export function getConstantsFilePath(scope: ConstantScope): string {
	return scope === "client" ? "src/client/constants.json" : "src/server/constants.json";
}

export function applyConstantUpdate(
	current: PersistedConstantFile,
	request: ConstantPluginUpdateRequest,
): PersistedConstantFile {
	const currentGroup = current[request.sourcePath] ?? {};
	const defaults = { ...(currentGroup._defaults ?? {}) };
	const nextGroup: PersistedConstantGroup = { ...currentGroup, _defaults: defaults };
	nextGroup[request.name] = request.serializedValue;
	defaults[request.name] = request.serializedDefault;
	return {
		...current,
		[request.sourcePath]: nextGroup,
	};
}
