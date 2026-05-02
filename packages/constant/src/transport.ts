import { ReplicatedStorage } from "@rbxts/services";
import { createConstantUpdatePayload, type ConstantUpdateSink } from "./bridge";
import type { ConstantScope, ConstantUpdatePayload, SupportedPrimitive } from "./types";

export const CONSTANT_TRANSPORT_FOLDER_NAME = "constant";
export const CONSTANT_TRANSPORT_EVENT_NAME = "constant";

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
	event: BindableEvent = getOrCreateTransportEvent(),
	persistPath?: string,
): void {
	event.Fire(createConstantUpdatePayload(scope, name, value, defaultValue, persistPath));
}

export function connectBindableTransport(
	callback: (payload: ConstantUpdatePayload) => void,
	event: BindableEvent = getOrCreateTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => callback(payload as ConstantUpdatePayload));
}
