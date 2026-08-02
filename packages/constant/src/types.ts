import type {
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
	SerializedConstant,
} from "@lisachandra/constant-protocol";

export type {
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
	SerializedConstant,
} from "@lisachandra/constant-protocol";

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

export type ConfiguredConstantModule = PersistedConstantFile;

export interface ConstantReplicationRequest extends ConstantUpdatePayload {}
export interface ConstantReplicationUpdate extends ConstantUpdatePayload {}

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
