import { ReplicatedStorage } from "@rbxts/services";

/**
 * Name of the BindableEvent that carries persist-intent payloads from the
 * constant runtime to the Studio plugin bridge.
 */
export const CONSTANT_TRANSPORT_EVENT_NAME = "Constant";

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

export interface PersistedConstantGroup {
	_defaults?: Record<string, SerializedConstant>;
	[name: string]: SerializedConstant | Record<string, SerializedConstant> | undefined;
}

export interface PersistedConstantFile {
	[sourcePath: string]: PersistedConstantGroup | undefined;
}

export interface ConstantUpdatePayload {
	scope: ConstantScope;
	name: string;
	serializedValue: SerializedConstant;
	serializedDefault: SerializedConstant;
	sourcePath: string;
	persistPath?: string;
}

/**
 * Type guard for {@link ConstantUpdatePayload} received over the transport.
 * @param value - Value received from a BindableEvent or RemoteEvent.
 * @returns `true` when the value has the payload shape.
 */
export function isConstantUpdatePayload(value: unknown): value is ConstantUpdatePayload {
	if (!typeIs(value, "table")) return false;
	const payload = value as Partial<ConstantUpdatePayload>;
	return (
		(payload.scope === "client" || payload.scope === "server") &&
		typeIs(payload.name, "string") &&
		typeIs(payload.sourcePath, "string") &&
		"serializedValue" in payload &&
		"serializedDefault" in payload &&
		(payload.persistPath === undefined || typeIs(payload.persistPath, "string"))
	);
}

/**
 * Returns the shared transport BindableEvent, creating it when missing.
 * @param parent - Instance that hosts the event; defaults to ReplicatedStorage.
 * @returns The existing or newly created BindableEvent.
 */
export function getOrCreateBindableTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	const existing = parent.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME);
	if (existing?.IsA("BindableEvent")) return existing;

	const event = new Instance("BindableEvent");
	event.Name = CONSTANT_TRANSPORT_EVENT_NAME;
	event.Parent = parent;
	return event;
}
