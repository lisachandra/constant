import { getMember } from "@lisachandra/core/utils/type";
import {
	buildIoServeWriteUrl,
	createConstantPluginCoordinator,
	createHttpIoServeWriter,
	encodePersistedConstantFile,
} from "@lisachandra/plugin";
import { createMockInstance, getModuleByTree, mockOnRuntime } from "@lisachandra/test/utils";
import { describe, expect, it, jest } from "@rbxts/jest-globals";
import { HttpService } from "@rbxts/services";

const servicesModule = getModuleByTree(...$getModuleTree("@rbxts/services"));
let mockServices: ReturnType<typeof mockOnRuntime<typeof import("@rbxts/services")>>;

jest.mock<typeof import("@rbxts/services")>(servicesModule, () => {
	const originalServices: typeof import("@rbxts/services") = jest.requireActual(servicesModule);

	mockServices = mockOnRuntime(jest, createMockInstance(originalServices));
	return mockServices as never;
});

describe("end-to-end persistence", () => {
	it("should coordinator writes through http writer with mocked request", () => {
		expect.hasAssertions();

		const calls = new Array<{ body: string; method: string; url: string }>();
		const [mockRequestAsync] = jest.fn(function (
			this: HttpService,
			options: RequestAsyncRequest,
		): RequestAsyncResponse {
			calls.push({
				body: options.Body ?? "",
				method: options.Method ?? "",
				url: tostring(options.Url),
			});
			return { Body: "", Headers: {}, StatusCode: 200, StatusMessage: "OK", Success: true };
		});

		let requestAsync = getMember(HttpService, "RequestAsync");
		HttpService.RequestAsync = mockRequestAsync;

		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			createHttpIoServeWriter("http://test:33333"),
			{ event, flushDelaySeconds: 0 },
		);

		event.Fire({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
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

		HttpService.RequestAsync = requestAsync;
	});

	it("should coordinator writes multiple scopes through separate http requests", () => {
		expect.hasAssertions();

		const calls = new Array<{ body: string; method: string; url: string }>();
		const [mockRequestAsync] = jest.fn(function (
			this: HttpService,
			options: RequestAsyncRequest,
		): RequestAsyncResponse {
			calls.push({
				body: options.Body ?? "",
				method: options.Method ?? "",
				url: tostring(options.Url),
			});
			return { Body: "", Headers: {}, StatusCode: 200, StatusMessage: "OK", Success: true };
		});

		let requestAsync = getMember(HttpService, "RequestAsync");
		HttpService.RequestAsync = mockRequestAsync;

		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			createHttpIoServeWriter("http://test:33333"),
			{ event, flushDelaySeconds: 0 },
		);

		event.Fire({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 30,
			sourcePath: "src/client/game.ts",
		});

		event.Fire({
			name: "DEBUG",
			scope: "server",
			serializedDefault: false,
			serializedValue: true,
			sourcePath: "src/server/game.ts",
		});

		task.wait(0.1);

		expect(calls.size()).toBe(2);

		const clientCall = calls.find(
			(c) => c.url === "http://test:33333/src/client/constants.json",
		);
		const serverCall = calls.find(
			(c) => c.url === "http://test:33333/src/server/constants.json",
		);

		expect(clientCall).toBeDefined();
		expect(serverCall).toBeDefined();
		expect(clientCall!.body).toContain("30");
		expect(serverCall!.body).toContain("true");

		coordinator.disconnect();
		event.Destroy();

		HttpService.RequestAsync = requestAsync;
	});

	it("should flushAll writes all scopes through http writer", () => {
		expect.hasAssertions();

		const calls = new Array<{ body: string; url: string }>();
		const [mockRequestAsync] = jest.fn(function (
			this: HttpService,
			options: RequestAsyncRequest,
		): RequestAsyncResponse {
			calls.push({ body: options.Body ?? "", url: tostring(options.Url) });
			return { Body: "", Headers: {}, StatusCode: 200, StatusMessage: "OK", Success: true };
		});

		let requestAsync = getMember(HttpService, "RequestAsync");
		HttpService.RequestAsync = mockRequestAsync;

		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			createHttpIoServeWriter("http://test:33333"),
			{ autoFlush: false, event },
		);

		event.Fire({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "src/client/main.ts",
		});

		task.wait(0.1);

		expect(calls.size()).toBe(0);

		coordinator.flushAll();
		task.wait(0.1);

		expect(calls.size()).toBe(2);

		const clientCall = calls.find(
			(c) => c.url === "http://test:33333/src/client/constants.json",
		);

		expect(clientCall).toBeDefined();

		coordinator.disconnect();
		event.Destroy();

		HttpService.RequestAsync = requestAsync;
	});

	it("should encodePersistedConstantFile shapes persistence data", () => {
		expect.hasAssertions();

		const json = encodePersistedConstantFile({
			"src/client/main.ts": {
				_defaults: { WALK_SPEED: 16 },
				WALK_SPEED: 24,
			},
		});

		expect(json).toContain("src/client/main.ts");
		expect(json).toContain("WALK_SPEED");
		expect(json).toContain("24");
		expect(json).toContain("16");
	});

	it("should normalize slashes when building io-serve write urls", () => {
		expect.hasAssertions();

		expect(buildIoServeWriteUrl("http://localhost:33333", "src/client/constants.json")).toBe(
			"http://localhost:33333/src/client/constants.json",
		);
		expect(buildIoServeWriteUrl("http://localhost:33333/", "/src/server/constants.json")).toBe(
			"http://localhost:33333/src/server/constants.json",
		);
	});
});
