export type ConstantScope = "client" | "server";

export type SerializedConstant =
	| number
	| string
	| boolean
	| undefined
	| { type: "Color3"; value: [number, number, number] }
	| { type: "Vector3"; value: [number, number, number] }
	| { type: "CFrame"; value: [number, number, number, number, number, number, number, number, number, number, number, number] }
	| { type: "EnumItem"; enum: string; item: string };

export interface ConstantPluginUpdateRequest {
	scope: ConstantScope;
	name: string;
	serializedValue: unknown;
	serializedDefault: unknown;
	sourcePath: string;
	persistPath?: string;
}

export function resolveConstantsFilePath(request: ConstantPluginUpdateRequest): string {
	return request.persistPath ?? getConstantsFilePath(request.scope);
}

export interface PersistedConstantGroup {
	_defaults?: Record<string, SerializedConstant>;
	[name: string]: SerializedConstant | Record<string, SerializedConstant> | undefined;
}

export interface PersistedConstantFile {
	[sourcePath: string]: PersistedConstantGroup | undefined;
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
