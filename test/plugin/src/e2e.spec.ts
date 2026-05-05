import { describe, expect, jest, test } from "@rbxts/jest-globals";
import { createMockInstance, getModuleByTree, mockOnRuntime } from "@lisachandra/test/out/utils";

const servicesModule = getModuleByTree(...$getModuleTree("@rbxts/services"));
let mockServices: ReturnType<typeof mockOnRuntime<typeof import("@rbxts/services")>>;

jest.mock<typeof import("@rbxts/services")>(servicesModule, () => {
	const originalServices: typeof import("@rbxts/services") =
		jest.requireActual(servicesModule);

	mockServices ??= mockOnRuntime(jest, createMockInstance(originalServices));
	return mockServices as never;
});

import { HttpService } from "@rbxts/services";
import {
	buildIoServeWriteUrl,
	createConstantPluginCoordinator,
	createHttpIoServeWriter,
	encodePersistedConstantFile,
} from "@lisachandra/plugin";
import { getMember } from "@lisachandra/core/out/utils/type"

describe("end-to-end persistence", () => {
	test("coordinator writes through http writer with mocked request", () => {
		const calls = new Array<{ url: string; method: string; body: string }>();
		const mockRequestAsync = jest.fn((_self: unknown, options: { Url: string; Method: string; Body: string }) => {
			calls.push({ url: options.Url, method: options.Method, body: options.Body });
			return { Success: true, StatusCode: 200, StatusMessage: "OK" };
		});

		let requestAsync = getMember(HttpService, "RequestAsync")
		HttpService.RequestAsync = mockRequestAsync

		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			createHttpIoServeWriter("http://test:33333"),
			{ event, flushDelaySeconds: 0 },
		);

		event.Fire({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
		});

		task.wait(0.1);

		expect(calls.size()).toBe(1);
		expect(calls[0]!.url).toBe("http://test:33333/src/client/constants.json");
		expect(calls[0]!.method).toBe("PUT");
		expect(calls[0]!.body).toContain("src/client/main.ts");
		expect(calls[0]!.body).toContain("WALK_SPEED");
		expect(calls[0]!.body).toContain("24");

		coordinator.disconnect();
		event.Destroy();

		HttpService.RequestAsync = requestAsync
	});

	test("coordinator writes multiple scopes through separate http requests", () => {
		const calls = new Array<{ url: string; method: string; body: string }>();
		const mockRequestAsync = jest.fn((_self: unknown, options: { Url: string; Method: string; Body: string }) => {
			calls.push({ url: options.Url, method: options.Method, body: options.Body });
			return { Success: true, StatusCode: 200, StatusMessage: "OK" };
		});

		let requestAsync = getMember(HttpService, "RequestAsync")
		HttpService.RequestAsync = mockRequestAsync

		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			createHttpIoServeWriter("http://test:33333"),
			{ event, flushDelaySeconds: 0 },
		);

		event.Fire({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 30,
			serializedDefault: 16,
			sourcePath: "src/client/game.ts",
		});

		event.Fire({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
			sourcePath: "src/server/game.ts",
		});

		task.wait(0.1);

		expect(calls.size()).toBe(2);
		const clientCall = calls.find((c) => c.url === "http://test:33333/src/client/constants.json");
		const serverCall = calls.find((c) => c.url === "http://test:33333/src/server/constants.json");
		expect(clientCall).toBeDefined();
		expect(serverCall).toBeDefined();
		expect(clientCall!.body).toContain("30");
		expect(serverCall!.body).toContain("true");

		coordinator.disconnect();
		event.Destroy();

		HttpService.RequestAsync = requestAsync
	});

	test("flushAll writes all scopes through http writer", () => {
		const calls = new Array<{ url: string; body: string }>();
		const mockRequestAsync = jest.fn((_self: unknown, options: { Url: string; Body: string }) => {
			calls.push({ url: options.Url, body: options.Body });
			return { Success: true, StatusCode: 200, StatusMessage: "OK" };
		});

		let requestAsync = getMember(HttpService, "RequestAsync")
		HttpService.RequestAsync = mockRequestAsync

		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			createHttpIoServeWriter("http://test:33333"),
			{ event, autoFlush: false },
		);

		event.Fire({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
		});

		task.wait(0.1);
		expect(calls.size()).toBe(0);

		coordinator.flushAll();
		task.wait(0.1);

		expect(calls.size()).toBe(2);
		const clientCall = calls.find((c) => c.url === "http://test:33333/src/client/constants.json");
		expect(clientCall).toBeDefined();

		coordinator.disconnect();
		event.Destroy();

		HttpService.RequestAsync = requestAsync
	});

	test("encodePersistedConstantFile shapes persistence data", () => {
		const json = encodePersistedConstantFile({
			"src/client/main.ts": {
				WALK_SPEED: 24,
				_defaults: { WALK_SPEED: 16 },
			},
		});

		expect(json).toContain("src/client/main.ts");
		expect(json).toContain("WALK_SPEED");
		expect(json).toContain("24");
		expect(json).toContain("16");
	});

	test("buildIoServeWriteUrl normalises slashes", () => {
		expect(buildIoServeWriteUrl("http://localhost:33333", "src/client/constants.json"))
			.toBe("http://localhost:33333/src/client/constants.json");
		expect(buildIoServeWriteUrl("http://localhost:33333/", "/src/server/constants.json"))
			.toBe("http://localhost:33333/src/server/constants.json");
	});
});
