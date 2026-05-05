import { ReplicatedStorage } from "@rbxts/services";
import { createConstantUpdatePayload, type ConstantUpdateSink } from "./bridge";
import type { ConstantPersistMode, ConstantScope, ConstantUpdatePayload, SerializedConstant, SupportedPrimitive } from "./types";

export const CONSTANT_TRANSPORT_EVENT_NAME = "Constant";
export const CONSTANT_EDITOR_EVENT_NAME = "ConstantEditor";
export const CONSTANT_REPLICATION_EVENT_NAME = "ConstantReplication";

export interface ReplicatedEditorDefinitionPayload {
	readonly name: string;
	readonly serializedDefault: SerializedConstant;
	readonly serializedCurrent: SerializedConstant;
}

export interface ReplicatedEditorRegistrationPayload {
	readonly action: "register";
	readonly id: string;
	readonly scope: ConstantScope;
	readonly persistPath: string;
	readonly sourcePath: string;
	readonly title?: string;
	readonly persistMode?: ConstantPersistMode;
	readonly keyCodeName?: string;
	readonly definitions: ReadonlyArray<ReplicatedEditorDefinitionPayload>;
}

export function getOrCreateReplicatedEditorEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	const existingEvent = parent.FindFirstChild(CONSTANT_EDITOR_EVENT_NAME);
	if (existingEvent?.IsA("RemoteEvent")) return existingEvent;

	const event = new Instance("RemoteEvent");
	event.Name = CONSTANT_EDITOR_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function getOrCreateReplicationEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	const existing = parent.FindFirstChild(CONSTANT_REPLICATION_EVENT_NAME);
	if (existing?.IsA("RemoteEvent")) return existing;

	const event = new Instance("RemoteEvent");
	event.Name = CONSTANT_REPLICATION_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function isReplicatedEditorRegistrationPayload(value: unknown): value is ReplicatedEditorRegistrationPayload {
	if (!typeIs(value, "table")) return false;
	const payload = value as Partial<ReplicatedEditorRegistrationPayload>;
	return payload.action === "register"
}

export function getOrCreateTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	const existing = parent.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME);
	if (existing?.IsA("BindableEvent")) return existing;

	const event = new Instance("BindableEvent");
	event.Name = CONSTANT_TRANSPORT_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function createBindableEventSink(event: BindableEvent = getOrCreateTransportEvent()): ConstantUpdateSink {
	return {
		publish(payload) {
			event.Fire(payload);
		},
	};
}

export function publishBindableTransport(
	scope: ConstantScope,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
	sourcePath: string,
	event: BindableEvent = getOrCreateTransportEvent(),
	persistPath?: string,
): void {
	event.Fire(createConstantUpdatePayload(scope, name, value, defaultValue, sourcePath, persistPath));
}

export function connectBindableTransport(
	callback: (payload: ConstantUpdatePayload) => void,
	event: BindableEvent = getOrCreateTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => callback(payload as ConstantUpdatePayload));
}
