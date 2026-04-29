import { ReplicatedStorage } from "@rbxts/services";
import type { ConstantPluginUpdateRequest } from "./index";

export const CONSTANT_TRANSPORT_FOLDER_NAME = "constant";
export const CONSTANT_TRANSPORT_EVENT_NAME = "PersistRequested";

function isConstantPluginUpdateRequest(value: unknown): value is ConstantPluginUpdateRequest {
	if (!typeIs(value, "table")) return false;
	const request = value as Partial<ConstantPluginUpdateRequest>;
	return (
		(request.scope === "client" || request.scope === "server") &&
		typeIs(request.name, "string") &&
		"serializedValue" in request &&
		"serializedDefault" in request
	);
}

function getOrCreateTransportFolder(parent: Instance = ReplicatedStorage): Folder {
	const existing = parent.FindFirstChild(CONSTANT_TRANSPORT_FOLDER_NAME);
	if (existing?.IsA("Folder")) return existing;

	const folder = new Instance("Folder");
	folder.Name = CONSTANT_TRANSPORT_FOLDER_NAME;
	folder.Parent = parent;
	return folder;
}

export function getOrCreatePluginTransportEvent(parent: Instance = ReplicatedStorage): BindableEvent {
	const folder = getOrCreateTransportFolder(parent);
	const existing = folder.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME);
	if (existing?.IsA("BindableEvent")) return existing;

	const event = new Instance("BindableEvent");
	event.Name = CONSTANT_TRANSPORT_EVENT_NAME;
	event.Parent = folder;
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
