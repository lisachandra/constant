export type ConstantScope = "client" | "server";

export type SupportedPrimitive = number | string | boolean | Color3 | Vector3 | CFrame | EnumItem | undefined;

export type Widen<T> = T extends number
	? number
	: T extends string
		? string
		: T extends boolean
			? boolean
			: T extends Color3
				? Color3
				: T extends Vector3
					? Vector3
					: T extends CFrame
						? CFrame
						: T extends EnumItem
							? EnumItem
							: T extends undefined
								? undefined
								: never;

export type AddConstant<T, K extends string, V extends SupportedPrimitive> = T & { readonly [P in K]: Widen<V> };

export type PrimitiveKind =
	| "number"
	| "string"
	| "boolean"
	| "Color3"
	| "Vector3"
	| "CFrame"
	| "EnumItem"
	| "undefined";

export type SerializedConstant =
	| number
	| string
	| boolean
	| undefined
	| { type: "Color3"; value: [number, number, number] }
	| { type: "Vector3"; value: [number, number, number] }
	| { type: "CFrame"; value: [number, number, number, number, number, number, number, number, number, number, number, number] }
	| { type: "EnumItem"; enum: string; item: string };

export interface PersistedConstantFile {
	_defaults?: Record<string, SerializedConstant>;
	[name: string]: SerializedConstant | Record<string, SerializedConstant> | undefined;
}

export interface ConstantUpdatePayload {
	scope: ConstantScope;
	name: string;
	serializedValue: SerializedConstant;
	serializedDefault: SerializedConstant;
}

export interface ConstantDefinition<V extends SupportedPrimitive = SupportedPrimitive> {
	readonly name: string;
	readonly scope: ConstantScope;
	readonly kind: PrimitiveKind;
	readonly defaultValue: V;
	readonly persistedValue?: V;
	readonly hasPersistedValue: boolean;
	readonly defaultDrifted: boolean;
	currentValue: V;
	hasLiveOverride: boolean;
}

export type ConstantPersistMode = "manual" | "auto";

export interface ConstantEditorOptions {
	title?: string;
	allowEditing?: boolean;
	numberStep?: number;
	numberMin?: number;
	numberMax?: number;
	persistMode?: ConstantPersistMode;
	onPersist?: (payload: ConstantUpdatePayload) => void;
}
