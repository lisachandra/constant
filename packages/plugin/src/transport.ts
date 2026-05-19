import { ReplicatedStorage } from "@rbxts/services";
import type { ConstantPluginUpdateRequest } from ".";

export const CONSTANT_TRANSPORT_EVENT_NAME = "Constant"

function isConstantPluginUpdateRequest(value: unknown): value is ConstantPluginUpdateRequest {
	if (!typeIs(value, "table")) return false;
	const request = value as Partial<ConstantPluginUpdateRequest>;
	return (
		(request.scope === "client" || request.scope === "server") &&
		typeIs(request.name, "string") &&
		typeIs(request.sourcePath, "string") &&
		"serializedValue" in request &&
		"serializedDefault" in request
	);
}

export function getPluginTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	return parent.WaitForChild<BindableEvent>(CONSTANT_TRANSPORT_EVENT_NAME);
}

export function connectPluginTransport(
	callback: (request: ConstantPluginUpdateRequest) => void,
	event: BindableEvent = getPluginTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => {
		if (!isConstantPluginUpdateRequest(payload)) return;
		callback(payload);
	});
}
