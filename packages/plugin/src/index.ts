import {
	isConstantUpdatePayload as isConstantPluginUpdateRequest,
	type ConstantUpdatePayload,
} from "@lisachandra/constant-protocol";

export { applyConstantUpdate, getConstantsFilePath, resolveConstantsFilePath } from "./persistence";
export { startConstantPluginBootstrap, type ConstantPluginBootstrapHandle, type ConstantPluginBootstrapOptions } from "./bootstrap";
export { createConstantPluginCoordinator, type ConstantPluginCoordinator, type ConstantPluginCoordinatorOptions } from "./coordinator";
export {
	buildIoServeWriteUrl,
	createHttpIoServeWriter,
	createIoServeWriter,
	encodePersistedConstantFile,
	type ConstantIoServeWriteRequest,
} from "./writer";
export { createConstantPluginPersistenceService, type ConstantPersistenceWriter, type ConstantPluginPersistenceService } from "./service";
export {
	connectPluginTransport,
	CONSTANT_TRANSPORT_EVENT_NAME,
	getPluginTransportEvent as getOrCreatePluginTransportEvent,
} from "./transport";
export { isConstantPluginUpdateRequest };

export type ConstantPluginUpdateRequest = ConstantUpdatePayload;

export interface ConstantPluginBridge {
	forwardUpdate(request: ConstantPluginUpdateRequest): void;
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
