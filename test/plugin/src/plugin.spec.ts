import { describe, expect, test } from "@rbxts/jest-globals";
import {
	applyConstantUpdate,
	connectPluginTransport,
	buildIoServeWriteUrl,
	createPluginBridge,
	getConstantsFilePath,
	getOrCreatePluginTransportEvent,
	isConstantPluginUpdateRequest,
	resolveConstantsFilePath,
	createIoServeWriter,
	encodePersistedConstantFile,
	CONSTANT_TRANSPORT_EVENT_NAME,
} from "@lisachandra/plugin";

describe("plugin bridge", () => {
	test("validates bridge payload shape", () => {
		expect(
			isConstantPluginUpdateRequest({
				scope: "client",
				name: "WALK_SPEED",
				serializedValue: 16,
				serializedDefault: 12,
				sourcePath: "src/test/config.ts",
			}),
		).toBe(true);

		expect(
			isConstantPluginUpdateRequest({
				scope: "invalid",
				name: "WALK_SPEED",
				serializedValue: 16,
				serializedDefault: 12,
				sourcePath: "src/test/config.ts",
			}),
		).toBe(false);
	});

	test("maps scopes to constants.json paths", () => {
		expect(getConstantsFilePath("client")).toBe("src/client/constants.json");
		expect(getConstantsFilePath("server")).toBe("src/server/constants.json");
	});

	test("builds io-serve write urls with a single slash", () => {
		expect(buildIoServeWriteUrl("http://localhost:33333", "src/client/constants.json")).toBe(
			"http://localhost:33333/src/client/constants.json",
		);
		expect(buildIoServeWriteUrl("http://localhost:33333/", "/src/server/constants.json")).toBe(
			"http://localhost:33333/src/server/constants.json",
		);
	});


	test("prefers explicit persist paths when present", () => {
		expect(resolveConstantsFilePath({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
			persistPath: "custom/client/constants.json",
		})).toBe("custom/client/constants.json");
	});

	test("applies updates into flat persisted files", () => {
		const sourcePath = "src/server/game.ts";
		const nextFile = applyConstantUpdate(
			{
				[sourcePath]: {
					DEBUG: false,
					_defaults: { DEBUG: false },
				},
			},
			{
				scope: "server",
				name: "WALK_SPEED",
				serializedValue: 24,
				serializedDefault: 16,
				sourcePath,
			},
		);

		expect(nextFile[sourcePath]!.DEBUG).toBe(false);
		expect(nextFile[sourcePath]!.WALK_SPEED).toBe(24);
		expect(nextFile[sourcePath]!._defaults?.WALK_SPEED).toBe(16);
	});

	test("forwards valid requests", () => {
		let receivedName = "";
		const bridge = createPluginBridge((request: { name: string }) => {
			receivedName = request.name;
		});

		bridge.forwardUpdate({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
			sourcePath: "src/server/game.ts",
		});

		expect(receivedName).toBe("DEBUG");
	});

	test("bindable transport forwards valid payloads", () => {
		const event = new Instance("BindableEvent");
		let receivedName = "";
		const connection = connectPluginTransport((request: { name: string }) => {
			receivedName = request.name;
		}, event);

		event.Fire({
			scope: "server",
			name: "WALK_SPEED",
			serializedValue: 20,
			serializedDefault: 16,
			sourcePath: "src/server/game.ts",
		});

		expect(receivedName).toBe("WALK_SPEED");
		connection.Disconnect();
	});

	test("creates transport event in a container", () => {
		const folder = new Instance("Folder");
		const event = getOrCreatePluginTransportEvent(folder);

		expect(event.Name).toBe("constant");
		expect(event.Parent).toBe(folder);
	});

	test("throws on invalid requests", () => {
		const bridge = createPluginBridge(() => undefined);
		expect(() => bridge.forwardUpdate({ scope: "broken" } as never)).toThrow();
	});
});


describe("writer", () => {
	test("createIoServeWriter builds correct write request shape", () => {
		const requests = new Array<{ path: string; body: string }>();
		const writer = createIoServeWriter((req) => requests.push(req));
		writer.write("custom/path.json", { "src/test.ts": { FOO: 1, _defaults: { FOO: 0 } } });
		expect(requests.size()).toBe(1);
		expect(requests[0]!.path).toBe("custom/path.json");
		expect(requests[0]!.body).toContain("FOO");
		expect(requests[0]!.body).toContain("_defaults");
		expect(requests[0]!.body).toContain("src/test.ts");
	});

	test("encodePersistedConstantFile produces valid JSON", () => {
		const json = encodePersistedConstantFile({ "src/test.ts": { FOO: 1, _defaults: { FOO: 0 } } });
		expect(json).toContain("FOO");
		expect(json).toContain("_defaults");
		expect(json).toContain("src/test.ts");
	});
});

describe("persistence internals", () => {
	test("applyConstantUpdate merges multiple source paths", () => {
		const file: Record<string, unknown> = {};
		const r1 = { scope: "client" as const, name: "FOO", serializedValue: 10, serializedDefault: 0, sourcePath: "a.ts" };
		const r2 = { scope: "client" as const, name: "BAR", serializedValue: 20, serializedDefault: 5, sourcePath: "b.ts" };
		const updated = applyConstantUpdate(applyConstantUpdate(file as never, r1), r2);
		expect((updated["a.ts"] as Record<string, unknown>).FOO).toBe(10);
		expect((updated["b.ts"] as Record<string, unknown>).BAR).toBe(20);
	});

	test("isConstantPluginUpdateRequest rejects payloads missing sourcePath", () => {
		expect(
			isConstantPluginUpdateRequest({
				scope: "client",
				name: "WALK_SPEED",
				serializedValue: 16,
				serializedDefault: 12,
			}),
		).toBe(false);
	});

	test("CONSTANT_TRANSPORT_EVENT_NAME matches getOrCreatePluginTransportEvent name", () => {
		const folder = new Instance("Folder");
		const event = getOrCreatePluginTransportEvent(folder);
		expect(event.Name).toBe(CONSTANT_TRANSPORT_EVENT_NAME);
	});

	test("getOrCreatePluginTransportEvent reuses existing event", () => {
		const folder = new Instance("Folder");
		const first = getOrCreatePluginTransportEvent(folder);
		const second = getOrCreatePluginTransportEvent(folder);
		expect(first).toBe(second);
	});
});
