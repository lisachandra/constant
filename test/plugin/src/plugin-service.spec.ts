import { describe, expect, test } from "@rbxts/jest-globals";
import { createConstantPluginPersistenceService } from "@lisachandra/plugin";

describe("plugin persistence service", () => {
	test("stores snapshots per scope", () => {
		const writes = new Array<{ path: string; contents: unknown }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ path, contents });
			},
		});

		service.receiveUpdate({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
		});

		service.receiveUpdate({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
			sourcePath: "src/server/main.ts",
		});

		expect(service.getSnapshot("client")["src/client/main.ts"]!.WALK_SPEED).toBe(24);
		expect(service.getSnapshot("server")["src/server/main.ts"]!.DEBUG).toBe(true);
		expect(writes.size()).toBe(0);
	});

	test("flushScope writes the matching constants path", () => {
		const writes = new Array<{ path: string; contents: unknown }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ path, contents });
			},
		});

		service.receiveUpdate({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
		});

		service.flushScope("client");

		expect(writes.size()).toBe(1);
		const firstWrite = writes[0]!;
		expect(firstWrite.path).toBe("src/client/constants.json");
		expect((firstWrite.contents as Record<string, { WALK_SPEED?: number }>)["src/client/main.ts"]!.WALK_SPEED).toBe(24);
	});


	test("writes custom persist paths from update payloads", () => {
		const writes = new Array<{ path: string; contents: unknown }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ path, contents });
			},
		});

		service.receiveUpdate({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
			persistPath: "custom/client/constants.json",
		});

		service.flushAll();

		expect(writes.size()).toBe(3);
		expect(writes[0]!.path).toBe("src/client/constants.json");
		expect(writes[1]!.path).toBe("src/server/constants.json");
		expect(writes[2]!.path).toBe("custom/client/constants.json");
	});

	test("flushAll writes both scopes", () => {
		const writes = new Array<{ path: string; contents: unknown }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ path, contents });
			},
		});

		service.receiveUpdate({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "src/client/main.ts",
		});

		service.receiveUpdate({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
			sourcePath: "src/server/main.ts",
		});

		service.flushAll();

		expect(writes.size()).toBe(2);
		const firstWrite = writes[0]!;
		const secondWrite = writes[1]!;
		expect(firstWrite.path).toBe("src/client/constants.json");
		expect(secondWrite.path).toBe("src/server/constants.json");
	});

	test("initial snapshots are preserved and merged", () => {
		const service = createConstantPluginPersistenceService(
			{
				write() {},
			},
			{
				server: {
					["src/server/init.ts"]: {
						EXISTING: 10,
						_defaults: { EXISTING: 10 },
					},
				},
			},
		);

		service.receiveUpdate({
			scope: "server",
			name: "WALK_SPEED",
			serializedValue: 20,
			serializedDefault: 16,
			sourcePath: "src/server/init.ts",
		});

		const snapshot = service.getSnapshot("server");
		expect(snapshot["src/server/init.ts"]!.EXISTING).toBe(10);
		expect(snapshot["src/server/init.ts"]!.WALK_SPEED).toBe(20);
		expect(snapshot["src/server/init.ts"]!._defaults?.EXISTING).toBe(10);
		expect(snapshot["src/server/init.ts"]!._defaults?.WALK_SPEED).toBe(16);
	});
});
