import { HttpService } from "@rbxts/services";

import type { PersistedConstantFile } from "./persistence";
import type { ConstantPersistenceWriter } from "./service";

export interface ConstantIoServeWriteRequest {
	body: string;
	path: string;
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
				body: encodePersistedConstantFile(contents),
				path,
			});
		},
	};
}

export function createHttpIoServeWriter(
	baseUrl = "http://localhost:33333",
): ConstantPersistenceWriter {
	return createIoServeWriter((request) => {
		const url = buildIoServeWriteUrl(baseUrl, request.path);
		const [success, responseOrError] = pcall(() =>
			HttpService.RequestAsync({
				Body: request.body,
				Headers: {
					"Content-Type": "application/json",
				},
				Method: "PUT",
				Url: url,
			}),
		);

		if (!success) {
			warn(
				`Failed to write constants through io-serve at ${url}: ${tostring(responseOrError)}`,
			);
			return;
		}

		const response = responseOrError as {
			StatusCode: number;
			StatusMessage: string;
			Success: boolean;
		};
		if (!response.Success) {
			warn(
				`io-serve rejected constant write to ${url} with status ${response.StatusCode}: ${response.StatusMessage}`,
			);
		}
	});
}
