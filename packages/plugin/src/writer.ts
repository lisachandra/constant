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

export function buildIoServeWriteUrl(baseUrl: string, path: string): string {
	const normalizedBaseUrl = baseUrl.gsub("/+$", "")[0];
	const normalizedPath = path.gsub("^/+", "")[0];
	return `${normalizedBaseUrl}/${normalizedPath}`;
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

export function createHttpIoServeWriter(baseUrl = "http://localhost:33333"): ConstantPersistenceWriter {
	return createIoServeWriter((request) => {
		const url = buildIoServeWriteUrl(baseUrl, request.path);
		const [success, responseOrError] = pcall(() =>
			HttpService.RequestAsync({
				Url: url,
				Method: "PUT",
				Headers: {
					["Content-Type"]: "application/json",
				},
				Body: request.body,
			}),
		);

		if (!success) {
			error(`Failed to write constants through io-serve at ${url}: ${tostring(responseOrError)}`);
		}

		const response = responseOrError as {
			Success: boolean;
			StatusCode: number;
			StatusMessage: string;
		};
		if (!response.Success) {
			error(`io-serve rejected constant write to ${url} with status ${response.StatusCode}: ${response.StatusMessage}`);
		}
	});
}
