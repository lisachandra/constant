import { describe, expect, test } from "@rbxts/jest-globals";
import { createConstantPluginCoordinator } from "@lisachandra/plugin/out/coordinator";

describe("plugin bootstrap shape", () => {
	test("coordinator can be wrapped by a start/stop lifecycle", () => {
		const event = new Instance("BindableEvent");
		const writes = new Array<{ path: string; contents: unknown }>();
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
			serializedValue: 12,
			serializedDefault: 10,
            sourcePath: "src/client/main.client.ts",
		});

		coordinator.disconnect();

		event.Fire({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 20,
			serializedDefault: 10,
            sourcePath: "src/client/main.client.ts",
		});

		expect(writes.size()).toBe(1);
		expect((writes[0]!.contents as Record<string, { WALK_SPEED?: number }>)["src/client/main.client.ts"]!.WALK_SPEED).toBe(12);
	});
});
