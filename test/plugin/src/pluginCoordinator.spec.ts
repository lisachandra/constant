import { createConstantPluginCoordinator } from "@lisachandra/plugin/coordinator";
import { describe, expect, it } from "@rbxts/jest-globals";

describe("plugin coordinator", () => {
	it("should receives transport payloads and flushes immediately when delay is zero", () => {
		expect.hasAssertions();

		const writes = new Array<{ contents: unknown; path: string }>();
		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			{
				write(path, contents) {
					writes.push({ contents, path });
				},
			},
			{ event, flushDelaySeconds: 0 },
		);

		event.Fire({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "src/client/constants.config.ts",
		});

		const snapshot = coordinator.service.getSnapshot("client");

		expect(snapshot["src/client/constants.config.ts"]!.WALK_SPEED).toBe(24);
		expect(writes.size()).toBe(1);
		expect(writes[0]!.path).toBe("src/client/constants.json");

		coordinator.disconnect();
	});

	it("should can accumulate updates without auto flush", () => {
		expect.hasAssertions();

		const writes = new Array<{ contents: unknown; path: string }>();
		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			{
				write(path, contents) {
					writes.push({ contents, path });
				},
			},
			{ autoFlush: false, event },
		);

		event.Fire({
			name: "DEBUG",
			scope: "server",
			serializedDefault: false,
			serializedValue: true,
			sourcePath: "src/server/constants.config.ts",
		});

		expect(
			coordinator.service.getSnapshot("server")["src/server/constants.config.ts"]!.DEBUG,
		).toBe(true);
		expect(writes.size()).toBe(0);

		coordinator.flushAll();

		expect(writes.size()).toBe(2);

		coordinator.disconnect();
	});
});
