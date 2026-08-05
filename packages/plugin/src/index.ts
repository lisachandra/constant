import {
	type ConstantUpdatePayload,
	isConstantUpdatePayload,
} from "@lisachandra/constant-protocol";

export {
	type ConstantPluginBootstrapHandle,
	type ConstantPluginBootstrapOptions,
	startConstantPluginBootstrap,
} from "./bootstrap";
export {
	type ConstantPluginCoordinator,
	type ConstantPluginCoordinatorOptions,
	createConstantPluginCoordinator,
} from "./coordinator";
export { applyConstantUpdate, getConstantsFilePath, resolveConstantsFilePath } from "./persistence";
export {
	type ConstantPersistenceWriter,
	type ConstantPluginPersistenceService,
	createConstantPluginPersistenceService,
} from "./service";
export {
	connectPluginTransport,
	CONSTANT_TRANSPORT_EVENT_NAME,
	getPluginTransportEvent as getOrCreatePluginTransportEvent,
} from "./transport";
export {
	buildIoServeWriteUrl,
	type ConstantIoServeWriteRequest,
	createHttpIoServeWriter,
	createIoServeWriter,
	encodePersistedConstantFile,
} from "./writer";
export { isConstantUpdatePayload as isConstantPluginUpdateRequest } from "@lisachandra/constant-protocol";

export type ConstantPluginUpdateRequest = ConstantUpdatePayload;

export interface ConstantPluginBridge {
	forwardUpdate(request: ConstantPluginUpdateRequest): void;
}

export function createPluginBridge(
	forwardUpdate: (request: ConstantPluginUpdateRequest) => void,
): ConstantPluginBridge {
	return {
		forwardUpdate(request) {
			if (!isConstantUpdatePayload(request)) {
				error("Invalid constant plugin update request");
			}

			forwardUpdate(request);
		},
	};
}
