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
}

export interface PersistedConstantFile {
	_defaults?: Record<string, SerializedConstant>;
	[name: string]: SerializedConstant | Record<string, SerializedConstant> | undefined;
}

export function getConstantsFilePath(scope: ConstantScope): string {
	return scope === "client" ? "src/client/constants.json" : "src/server/constants.json";
}

export function applyConstantUpdate(
	current: PersistedConstantFile,
	request: ConstantPluginUpdateRequest,
): PersistedConstantFile {
	const next: PersistedConstantFile = { ...current, _defaults: { ...(current._defaults ?? {}) } };
	next[request.name] = request.serializedValue as SerializedConstant;
	next._defaults![request.name] = request.serializedDefault as SerializedConstant;
	return next;
}
