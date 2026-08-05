import type { PersistedConstantFile } from "@lisachandra/constant";
import {
	applyConstantUpdate,
	buildIoServeWriteUrl,
	connectPluginTransport,
	CONSTANT_TRANSPORT_EVENT_NAME,
	createIoServeWriter,
	createPluginBridge,
	encodePersistedConstantFile,
	getConstantsFilePath,
	getOrCreatePluginTransportEvent,
	isConstantPluginUpdateRequest,
	resolveConstantsFilePath,
} from "@lisachandra/plugin";
import { describe, expect, it } from "@rbxts/jest-globals";

describe("plugin bridge", () => {
	it("should validates bridge payload shape", () => {
		expect.hasAssertions();
		expect(
			isConstantPluginUpdateRequest({
				name: "WALK_SPEED",
				scope: "client",
				serializedDefault: 12,
				serializedValue: 16,
				sourcePath: "src/test/config.ts",
			}),
		).toBe(true);

		expect(
			isConstantPluginUpdateRequest({
				name: "WALK_SPEED",
				scope: "invalid",
				serializedDefault: 12,
				serializedValue: 16,
				sourcePath: "src/test/config.ts",
			}),
		).toBe(false);
	});

	it("should maps scopes to constants.json paths", () => {
		expect.hasAssertions();

		expect(getConstantsFilePath("client")).toBe("src/client/constants.json");
		expect(getConstantsFilePath("server")).toBe("src/server/constants.json");
	});

	it("should builds io-serve write urls with a single slash", () => {
		expect.hasAssertions();

		expect(buildIoServeWriteUrl("http://localhost:33333", "src/client/constants.json")).toBe(
			"http://localhost:33333/src/client/constants.json",
		);
		expect(buildIoServeWriteUrl("http://localhost:33333/", "/src/server/constants.json")).toBe(
			"http://localhost:33333/src/server/constants.json",
		);
	});

	it("should prefers explicit persist paths when present", () => {
		expect.hasAssertions();

		expect(
			resolveConstantsFilePath({
				name: "WALK_SPEED",
				persistPath: "custom/client/constants.json",
				scope: "client",
				serializedDefault: 16,
				serializedValue: 24,
				sourcePath: "src/client/main.ts",
			}),
		).toBe("custom/client/constants.json");
	});

	it("should applies updates into flat persisted files", () => {
		expect.hasAssertions();

		const sourcePath = "src/server/game.ts";
		const nextFile = applyConstantUpdate(
			{
				[sourcePath]: {
					_defaults: { DEBUG: false },
					DEBUG: false,
				},
			},
			{
				name: "WALK_SPEED",
				scope: "server",
				serializedDefault: 16,
				serializedValue: 24,
				sourcePath,
			},
		);

		expect(nextFile[sourcePath]!.DEBUG).toBe(false);
		expect(nextFile[sourcePath]!.WALK_SPEED).toBe(24);
		expect(nextFile[sourcePath]!._defaults?.WALK_SPEED).toBe(16);
	});

	it("should forwards valid requests", () => {
		expect.hasAssertions();

		let receivedName = "";
		const bridge = createPluginBridge((request: { name: string }) => {
			receivedName = request.name;
		});

		bridge.forwardUpdate({
			name: "DEBUG",
			scope: "server",
			serializedDefault: false,
			serializedValue: true,
			sourcePath: "src/server/game.ts",
		});

		expect(receivedName).toBe("DEBUG");
	});

	it("should bindable transport forwards valid payloads", () => {
		expect.hasAssertions();

		const event = new Instance("BindableEvent");
		let receivedName = "";
		const connection = connectPluginTransport((request: { name: string }) => {
			receivedName = request.name;
		}, event);

		event.Fire({
			name: "WALK_SPEED",
			scope: "server",
			serializedDefault: 16,
			serializedValue: 20,
			sourcePath: "src/server/game.ts",
		});

		expect(receivedName).toBe("WALK_SPEED");

		connection.Disconnect();
	});

	it("should creates transport event in a container", () => {
		expect.hasAssertions();

		const folder = new Instance("Folder");
		const event = getOrCreatePluginTransportEvent(folder);

		expect(event.Name).toBe(CONSTANT_TRANSPORT_EVENT_NAME);
		expect(event.Parent).toBe(folder);
	});

	it("should throws on invalid requests", () => {
		expect.hasAssertions();

		const bridge = createPluginBridge(() => undefined);

		expect(() => {
			bridge.forwardUpdate({ scope: "broken" } as never);
		}).toThrow("Invalid constant plugin update request");
	});
});

describe("writer", () => {
	it("should createIoServeWriter builds correct write request shape", () => {
		expect.hasAssertions();

		const requests = new Array<{ body: string; path: string }>();
		const writer = createIoServeWriter((req) => {
			requests.push(req);
		});
		writer.write("custom/path.json", { "src/test.ts": { _defaults: { FOO: 0 }, FOO: 1 } });

		expect(requests.size()).toBe(1);
		expect(requests[0]!.path).toBe("custom/path.json");
		expect(requests[0]!.body).toContain("FOO");
		expect(requests[0]!.body).toContain("_defaults");
		expect(requests[0]!.body).toContain("src/test.ts");
	});

	it("should encodePersistedConstantFile produces valid JSON", () => {
		expect.hasAssertions();

		const json = encodePersistedConstantFile({
			"src/test.ts": { _defaults: { FOO: 0 }, FOO: 1 },
		});

		expect(json).toContain("FOO");
		expect(json).toContain("_defaults");
		expect(json).toContain("src/test.ts");
	});
});

describe("persistence internals", () => {
	it("should applyConstantUpdate merges multiple source paths", () => {
		expect.hasAssertions();

		const file: PersistedConstantFile = {};
		const r1 = {
			name: "FOO",
			scope: "client" as const,
			serializedDefault: 0,
			serializedValue: 10,
			sourcePath: "a.ts",
		};
		const r2 = {
			name: "BAR",
			scope: "client" as const,
			serializedDefault: 5,
			serializedValue: 20,
			sourcePath: "b.ts",
		};
		const updated = applyConstantUpdate(applyConstantUpdate(file, r1), r2);

		expect((updated["a.ts"] as Record<string, unknown>).FOO).toBe(10);
		expect((updated["b.ts"] as Record<string, unknown>).BAR).toBe(20);
	});

	it("should isConstantPluginUpdateRequest rejects payloads missing sourcePath", () => {
		expect.hasAssertions();

		expect(
			isConstantPluginUpdateRequest({
				name: "WALK_SPEED",
				scope: "client",
				serializedDefault: 12,
				serializedValue: 16,
			}),
		).toBe(false);
	});

	it("should cONSTANT_TRANSPORT_EVENT_NAME matches getOrCreatePluginTransportEvent name", () => {
		expect.hasAssertions();

		const folder = new Instance("Folder");
		const event = getOrCreatePluginTransportEvent(folder);

		expect(event.Name).toBe(CONSTANT_TRANSPORT_EVENT_NAME);
	});

	it("should getOrCreatePluginTransportEvent reuses existing event", () => {
		expect.hasAssertions();

		const folder = new Instance("Folder");
		const first = getOrCreatePluginTransportEvent(folder);
		const second = getOrCreatePluginTransportEvent(folder);

		expect(first).toBe(second);
	});
});
