import { ReplicatedStorage } from "@rbxts/services";
import { createConstantUpdatePayload, type ConstantUpdateSink } from "./bridge";
import type { ConstantScope, ConstantUpdatePayload, SupportedPrimitive } from "./types";

export const CONSTANT_TRANSPORT_FOLDER_NAME = "constant";
export const CONSTANT_TRANSPORT_EVENT_NAME = "PersistRequested";

function getOrCreateTransportFolder(parent: Instance = ReplicatedStorage): Folder {
	const existing = parent.FindFirstChild(CONSTANT_TRANSPORT_FOLDER_NAME);
	if (existing?.IsA("Folder")) return existing;

	const folder = new Instance("Folder");
	folder.Name = CONSTANT_TRANSPORT_FOLDER_NAME;
	folder.Parent = parent;
	return folder;
}

export function getOrCreateTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	const folder = getOrCreateTransportFolder(parent);
	const existing = folder.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME);
	if (existing?.IsA("BindableEvent")) return existing;

	const event = new Instance("BindableEvent");
	event.Name = CONSTANT_TRANSPORT_EVENT_NAME;
	event.Parent = folder;
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
	event: BindableEvent = getOrCreateTransportEvent(),
): void {
	event.Fire(createConstantUpdatePayload(scope, name, value, defaultValue));
}

export function connectBindableTransport(
	callback: (payload: ConstantUpdatePayload) => void,
	event: BindableEvent = getOrCreateTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => callback(payload as ConstantUpdatePayload));
}
