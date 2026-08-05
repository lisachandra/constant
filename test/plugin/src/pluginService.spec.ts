import { createConstantPluginPersistenceService } from "@lisachandra/plugin";
import { describe, expect, it } from "@rbxts/jest-globals";

describe("plugin persistence service", () => {
	it("should stores snapshots per scope", () => {
		expect.hasAssertions();

		const writes = new Array<{ contents: unknown; path: string }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ contents, path });
			},
		});

		service.receiveUpdate({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "src/client/main.ts",
		});

		service.receiveUpdate({
			name: "DEBUG",
			scope: "server",
			serializedDefault: false,
			serializedValue: true,
			sourcePath: "src/server/main.ts",
		});

		expect(service.getSnapshot("client")["src/client/main.ts"]!.WALK_SPEED).toBe(24);
		expect(service.getSnapshot("server")["src/server/main.ts"]!.DEBUG).toBe(true);
		expect(writes.size()).toBe(0);
	});

	it("should flushScope writes the matching constants path", () => {
		expect.hasAssertions();

		const writes = new Array<{ contents: unknown; path: string }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ contents, path });
			},
		});

		service.receiveUpdate({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "src/client/main.ts",
		});

		service.flushScope("client");

		expect(writes.size()).toBe(1);

		const firstWrite = writes[0]!;

		expect(firstWrite.path).toBe("src/client/constants.json");
		expect(
			(firstWrite.contents as Record<string, { WALK_SPEED?: number }>)["src/client/main.ts"]!
				.WALK_SPEED,
		).toBe(24);
	});

	it("should writes custom persist paths from update payloads", () => {
		expect.hasAssertions();

		const writes = new Array<{ contents: unknown; path: string }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ contents, path });
			},
		});

		service.receiveUpdate({
			name: "WALK_SPEED",
			persistPath: "custom/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "src/client/main.ts",
		});

		service.flushAll();

		expect(writes.size()).toBe(3);
		expect(writes[0]!.path).toBe("src/client/constants.json");
		expect(writes[1]!.path).toBe("src/server/constants.json");
		expect(writes[2]!.path).toBe("custom/client/constants.json");
	});

	it("should flushAll writes both scopes", () => {
		expect.hasAssertions();

		const writes = new Array<{ contents: unknown; path: string }>();
		const service = createConstantPluginPersistenceService({
			write(path, contents) {
				writes.push({ contents, path });
			},
		});

		service.receiveUpdate({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "src/client/main.ts",
		});

		service.receiveUpdate({
			name: "DEBUG",
			scope: "server",
			serializedDefault: false,
			serializedValue: true,
			sourcePath: "src/server/main.ts",
		});

		service.flushAll();

		expect(writes.size()).toBe(2);

		const firstWrite = writes[0]!;
		const secondWrite = writes[1]!;

		expect(firstWrite.path).toBe("src/client/constants.json");
		expect(secondWrite.path).toBe("src/server/constants.json");
	});

	it("should initial snapshots are preserved and merged", () => {
		expect.hasAssertions();

		const service = createConstantPluginPersistenceService(
			{
				write() {},
			},
			{
				server: {
					"src/server/init.ts": {
						_defaults: { EXISTING: 10 },
						EXISTING: 10,
					},
				},
			},
		);

		service.receiveUpdate({
			name: "WALK_SPEED",
			scope: "server",
			serializedDefault: 16,
			serializedValue: 20,
			sourcePath: "src/server/init.ts",
		});

		const snapshot = service.getSnapshot("server");

		expect(snapshot["src/server/init.ts"]!.EXISTING).toBe(10);
		expect(snapshot["src/server/init.ts"]!.WALK_SPEED).toBe(20);
		expect(snapshot["src/server/init.ts"]!._defaults?.EXISTING).toBe(10);
		expect(snapshot["src/server/init.ts"]!._defaults?.WALK_SPEED).toBe(16);
	});
});
