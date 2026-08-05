import { formatConstantStudioPluginStatus } from "@lisachandra/plugin/studio-state";
import { describe, expect, it } from "@rbxts/jest-globals";

describe("plugin studio status", () => {
	it("should reports listening in edit mode when connected", () => {
		expect.hasAssertions();
		expect(formatConstantStudioPluginStatus({ connected: true, playMode: false })).toBe(
			"Listening (Edit mode)",
		);
	});

	it("should reports listening in play mode when connected", () => {
		expect.hasAssertions();

		expect(formatConstantStudioPluginStatus({ connected: true, playMode: true })).toBe(
			"Listening (Play mode)",
		);
	});

	it("should reports disconnected state for edit and play mode", () => {
		expect.hasAssertions();

		expect(formatConstantStudioPluginStatus({ connected: false, playMode: false })).toBe(
			"Disconnected (Edit mode)",
		);
		expect(formatConstantStudioPluginStatus({ connected: false, playMode: true })).toBe(
			"Disconnected (Play mode)",
		);
	});
});
