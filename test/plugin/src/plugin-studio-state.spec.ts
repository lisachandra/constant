import { describe, expect, test } from "@rbxts/jest-globals";
import { formatConstantStudioPluginStatus } from "@lisachandra/plugin/out/studio-state";

describe("plugin studio status", () => {
	test("reports listening in edit mode when connected", () => {
		expect(formatConstantStudioPluginStatus({ connected: true, playMode: false })).toBe("Listening (Edit mode)");
	});

	test("reports listening in play mode when connected", () => {
		expect(formatConstantStudioPluginStatus({ connected: true, playMode: true })).toBe("Listening (Play mode)");
	});

	test("reports disconnected state for edit and play mode", () => {
		expect(formatConstantStudioPluginStatus({ connected: false, playMode: false })).toBe("Disconnected (Edit mode)");
		expect(formatConstantStudioPluginStatus({ connected: false, playMode: true })).toBe("Disconnected (Play mode)");
	});
});
