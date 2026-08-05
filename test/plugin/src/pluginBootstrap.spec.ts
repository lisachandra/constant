import { createConstantPluginCoordinator } from "@lisachandra/plugin/coordinator";
import { describe, expect, it } from "@rbxts/jest-globals";

describe("plugin bootstrap shape", () => {
	it("should coordinator can be wrapped by a start/stop lifecycle", () => {
		expect.hasAssertions();

		const event = new Instance("BindableEvent");
		const writes = new Array<{ contents: unknown; path: string }>();
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
			serializedDefault: 10,
			serializedValue: 12,
			sourcePath: "src/client/main.client.ts",
		});

		coordinator.disconnect();

		event.Fire({
			name: "WALK_SPEED",
			scope: "client",
			serializedDefault: 10,
			serializedValue: 20,
			sourcePath: "src/client/main.client.ts",
		});

		expect(writes.size()).toBe(1);
		expect(
			(writes[0]!.contents as Record<string, { WALK_SPEED?: number }>)[
				"src/client/main.client.ts"
			]!.WALK_SPEED,
		).toBe(12);
	});
});
