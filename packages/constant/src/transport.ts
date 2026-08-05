import { getOrCreateBindableTransportEvent } from "@lisachandra/constant-protocol";
import { ReplicatedStorage } from "@rbxts/services";

import { type ConstantUpdateSink, createConstantUpdatePayload } from "./bridge";
import type {
	ConstantPersistMode,
	ConstantScope,
	ConstantUpdatePayload,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

export {
	CONSTANT_TRANSPORT_EVENT_NAME,
	getOrCreateBindableTransportEvent as getOrCreateTransportEvent,
} from "@lisachandra/constant-protocol";
export const CONSTANT_EDITOR_EVENT_NAME = "ConstantEditor";
export const CONSTANT_REPLICATION_EVENT_NAME = "ConstantReplication";

export interface ReplicatedEditorDefinitionPayload {
	readonly name: string;
	readonly serializedCurrent: SerializedConstant;
	readonly serializedDefault: SerializedConstant;
}

export interface ReplicatedEditorRegistrationPayload {
	readonly action: "register";
	readonly definitions: ReadonlyArray<ReplicatedEditorDefinitionPayload>;
	readonly id: string;
	readonly keyCodeName?: string;
	readonly persistMode?: ConstantPersistMode;
	readonly persistPath: string;
	readonly scope: ConstantScope;
	readonly sourcePath: string;
	readonly title?: string;
}

export function getOrCreateReplicatedEditorEvent(
	parent: Instance = ReplicatedStorage,
): RemoteEvent {
	const existingEvent = parent.FindFirstChild(CONSTANT_EDITOR_EVENT_NAME);
	if (existingEvent?.IsA("RemoteEvent") === true) {
		return existingEvent;
	}

	const event = new Instance("RemoteEvent");
	event.Name = CONSTANT_EDITOR_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function getOrCreateReplicationEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	const existing = parent.FindFirstChild(CONSTANT_REPLICATION_EVENT_NAME);
	if (existing?.IsA("RemoteEvent") === true) {
		return existing;
	}

	const event = new Instance("RemoteEvent");
	event.Name = CONSTANT_REPLICATION_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function isReplicatedEditorRegistrationPayload(
	value: unknown,
): value is ReplicatedEditorRegistrationPayload {
	if (!typeIs(value, "table")) {
		return false;
	}

	const payload = value as Partial<ReplicatedEditorRegistrationPayload>;
	return payload.action === "register";
}

export function createBindableEventSink(
	event: BindableEvent = getOrCreateBindableTransportEvent(),
): ConstantUpdateSink {
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
	event: BindableEvent = getOrCreateBindableTransportEvent(),
	persistPath?: string,
): void {
	event.Fire(
		createConstantUpdatePayload(scope, name, value, defaultValue, sourcePath, persistPath),
	);
}

export function connectBindableTransport(
	callback: (payload: ConstantUpdatePayload) => void,
	event: BindableEvent = getOrCreateBindableTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => {
		callback(payload as ConstantUpdatePayload);
	});
}
