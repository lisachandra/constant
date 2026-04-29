export { applyConstantUpdate, getConstantsFilePath } from "./persistence";
export { startConstantPluginBootstrap, type ConstantPluginBootstrapHandle, type ConstantPluginBootstrapOptions } from "./bootstrap";
export { createConstantPluginCoordinator, type ConstantPluginCoordinator, type ConstantPluginCoordinatorOptions } from "./coordinator";
export { createHttpIoServeWriter, createIoServeWriter, encodePersistedConstantFile, type ConstantIoServeWriteRequest } from "./writer";
export { createConstantPluginPersistenceService, type ConstantPersistenceWriter, type ConstantPluginPersistenceService } from "./service";
export {
	CONSTANT_TRANSPORT_EVENT_NAME,
	CONSTANT_TRANSPORT_FOLDER_NAME,
	connectPluginTransport,
	getOrCreatePluginTransportEvent,
} from "./transport";

export interface ConstantPluginUpdateRequest {
	scope: "client" | "server";
	name: string;
	serializedValue: unknown;
	serializedDefault: unknown;
}

export interface ConstantPluginBridge {
	forwardUpdate(request: ConstantPluginUpdateRequest): void;
}

export function isConstantPluginUpdateRequest(value: unknown): value is ConstantPluginUpdateRequest {
	if (!typeIs(value, "table")) return false;
	const request = value as Partial<ConstantPluginUpdateRequest>;
	return (
		(request.scope === "client" || request.scope === "server") &&
		typeIs(request.name, "string") &&
		"serializedValue" in request &&
		"serializedDefault" in request
	);
}

export function createPluginBridge(forwardUpdate: (request: ConstantPluginUpdateRequest) => void): ConstantPluginBridge {
	return {
		forwardUpdate(request) {
			if (!isConstantPluginUpdateRequest(request)) {
				error("Invalid constant plugin update request");
			}
			forwardUpdate(request);
		},
	};
}
