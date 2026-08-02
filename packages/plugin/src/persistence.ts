import type {
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
	SerializedConstant,
} from "@lisachandra/constant-protocol";

export type {
	ConstantScope,
	SerializedConstant,
	PersistedConstantGroup,
	PersistedConstantFile,
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
	const nextGroup: PersistedConstantGroup = {
		...currentGroup,
		_defaults: { ...(currentGroup._defaults ?? {}) },
	};
	nextGroup[request.name] = request.serializedValue as SerializedConstant;
	nextGroup._defaults![request.name] = request.serializedDefault as SerializedConstant;
	return {
		...current,
		[request.sourcePath]: nextGroup,
	};
}
