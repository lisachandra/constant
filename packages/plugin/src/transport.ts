import { ReplicatedStorage } from "@rbxts/services";
import type { ConstantPluginUpdateRequest } from ".";

export const CONSTANT_TRANSPORT_FOLDER_NAME = "constant";
export const CONSTANT_TRANSPORT_EVENT_NAME = "constant";

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

export function getOrCreatePluginTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	const existing = parent.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME);
	if (existing?.IsA("BindableEvent")) return existing;

	const event = new Instance("BindableEvent");
	event.Name = CONSTANT_TRANSPORT_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function connectPluginTransport(
	callback: (request: ConstantPluginUpdateRequest) => void,
	event: BindableEvent = getOrCreatePluginTransportEvent(),
): RBXScriptConnection {
	return event.Event.Connect((payload) => {
		if (!isConstantPluginUpdateRequest(payload)) return;
		callback(payload);
	});
}
