import {
	type ConstantUpdatePayload,
	getOrCreateBindableTransportEvent,
	isConstantUpdatePayload,
} from "@lisachandra/constant-protocol";
import { ReplicatedStorage } from "@rbxts/services";

export { CONSTANT_TRANSPORT_EVENT_NAME } from "@lisachandra/constant-protocol";

export function getPluginTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	return getOrCreateBindableTransportEvent(parent);
}

export function connectPluginTransport(
	callback: (request: ConstantUpdatePayload) => void,
	event: BindableEvent = getPluginTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => {
		if (!isConstantUpdatePayload(payload)) {
			return;
		}

		callback(payload);
	});
}
