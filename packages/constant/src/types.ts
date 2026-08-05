import type {
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
} from "@lisachandra/constant-protocol";

export type {
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
	SerializedConstant,
} from "@lisachandra/constant-protocol";

export type SupportedPrimitive =
	| number
	| string
	| Color3
	| CFrame
	| boolean
	| Vector3
	| EnumItem
	| undefined;

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

export type AddConstant<T, K extends string, V extends SupportedPrimitive> = Readonly<
	Record<K, Widen<V>>
> &
	T;

export type PrimitiveKind =
	| "number"
	| "string"
	| "Color3"
	| "CFrame"
	| "boolean"
	| "Vector3"
	| "EnumItem"
	| "undefined";

export type ConfiguredConstantModule = PersistedConstantFile;

export type ConstantReplicationRequest = ConstantUpdatePayload;
export type ConstantReplicationUpdate = ConstantUpdatePayload;

export interface ConstantDefinition<V extends SupportedPrimitive = SupportedPrimitive> {
	currentValue: V;
	readonly defaultDrifted: boolean;
	readonly defaultValue: V;
	hasLiveOverride: boolean;
	readonly hasPersistedValue: boolean;
	readonly kind: PrimitiveKind;
	readonly name: string;
	readonly persistedValue?: V;
	readonly scope: ConstantScope;
}

export type ConstantPersistMode = "auto" | "manual";

export interface ConstantEditorOptions {
	allowEditing?: boolean;
	numberMax?: number;
	numberMin?: number;
	numberStep?: number;
	onPersist?: (payload: ConstantUpdatePayload) => void;
	persistMode?: ConstantPersistMode;
	title?: string;
}
