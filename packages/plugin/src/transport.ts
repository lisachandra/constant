import { ReplicatedStorage } from "@rbxts/services";
import {
	CONSTANT_TRANSPORT_EVENT_NAME,
	getOrCreateBindableTransportEvent,
	isConstantUpdatePayload,
	type ConstantUpdatePayload,
} from "@lisachandra/constant-protocol";

export { CONSTANT_TRANSPORT_EVENT_NAME };

export function getPluginTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	return getOrCreateBindableTransportEvent(parent);
}

export function connectPluginTransport(
	callback: (request: ConstantUpdatePayload) => void,
	event: BindableEvent = getPluginTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => {
		if (!isConstantUpdatePayload(payload)) return;
		callback(payload);
	});
}
