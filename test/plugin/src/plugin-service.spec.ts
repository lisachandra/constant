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
		});

		service.receiveUpdate({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
		});

		expect(service.getSnapshot("client").WALK_SPEED).toBe(24);
		expect(service.getSnapshot("server").DEBUG).toBe(true);
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
		});

		service.flushScope("client");

		expect(writes.size()).toBe(1);
		const firstWrite = writes[0]!;
		expect(firstWrite.path).toBe("src/client/constants.json");
		expect((firstWrite.contents as { WALK_SPEED?: number }).WALK_SPEED).toBe(24);
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
			persistPath: "custom/client/constants.json",
		});

		service.flushAll();

		expect(writes.size()).toBe(1);
		expect(writes[0]!.path).toBe("custom/client/constants.json");
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
		});

		service.receiveUpdate({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
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
					EXISTING: 10,
					_defaults: { EXISTING: 10 },
				},
			},
		);

		service.receiveUpdate({
			scope: "server",
			name: "WALK_SPEED",
			serializedValue: 20,
			serializedDefault: 16,
		});

		const snapshot = service.getSnapshot("server");
		expect(snapshot.EXISTING).toBe(10);
		expect(snapshot.WALK_SPEED).toBe(20);
		expect(snapshot._defaults?.EXISTING).toBe(10);
		expect(snapshot._defaults?.WALK_SPEED).toBe(16);
	});
});
