import { describe, expect, test } from "@rbxts/jest-globals";
import { createConstantPluginCoordinator } from "../../../packages/plugin/src/coordinator";

describe("plugin coordinator", () => {
	test("receives transport payloads and flushes immediately when delay is zero", () => {
		const writes = new Array<{ path: string; contents: unknown }>();
		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			{
				write(path, contents) {
					writes.push({ path, contents });
				},
			},
			{ event, flushDelaySeconds: 0 },
		);

		event.Fire({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
		});

		const snapshot = coordinator.service.getSnapshot("client");
		expect(snapshot.WALK_SPEED).toBe(24);
		expect(writes.size()).toBe(1);
		expect(writes[0]!.path).toBe("src/client/constants.json");
		coordinator.disconnect();
	});

	test("can accumulate updates without auto flush", () => {
		const writes = new Array<{ path: string; contents: unknown }>();
		const event = new Instance("BindableEvent");
		const coordinator = createConstantPluginCoordinator(
			{
				write(path, contents) {
					writes.push({ path, contents });
				},
			},
			{ event, autoFlush: false },
		);

		event.Fire({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
		});

		expect(coordinator.service.getSnapshot("server").DEBUG).toBe(true);
		expect(writes.size()).toBe(0);

		coordinator.flushAll();
		expect(writes.size()).toBe(2);
		coordinator.disconnect();
	});
});
