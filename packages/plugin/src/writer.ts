import { HttpService } from "@rbxts/services";
import type { PersistedConstantFile } from "./persistence";
import type { ConstantPersistenceWriter } from "./service";

export interface ConstantIoServeWriteRequest {
	path: string;
	body: string;
}

export function encodePersistedConstantFile(contents: PersistedConstantFile): string {
	return HttpService.JSONEncode(contents);
}

export function createIoServeWriter(
	send: (request: ConstantIoServeWriteRequest) => void,
): ConstantPersistenceWriter {
	return {
		write(path, contents) {
			send({
				path,
				body: encodePersistedConstantFile(contents),
			});
		},
	};
}

export function createHttpIoServeWriter(baseUrl = "http://127.0.0.1:3000"): ConstantPersistenceWriter {
	return createIoServeWriter((request) => {
		HttpService.PostAsync(`${baseUrl}/${request.path}`, request.body, Enum.HttpContentType.ApplicationJson);
	});
}
