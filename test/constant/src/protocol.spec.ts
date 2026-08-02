import { describe, expect, test } from "@rbxts/jest-globals";
import {
	CONSTANT_TRANSPORT_EVENT_NAME,
	getOrCreateTransportEvent,
	isConstantUpdatePayload,
	type ConstantUpdatePayload,
} from "@lisachandra/constant";

describe("constant protocol", () => {
	test("event name matches the runtime bridge contract", () => {
		expect(CONSTANT_TRANSPORT_EVENT_NAME).toBe("Constant");
	});

	test("get-or-create returns the same BindableEvent on repeat calls", () => {
		const parent = new Instance("Folder");
		expect(getOrCreateTransportEvent(parent)).toBe(getOrCreateTransportEvent(parent));
		expect(parent.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME)?.IsA("BindableEvent")).toBe(true);
	});

	test("guard accepts valid payloads and rejects malformed ones", () => {
		const valid: ConstantUpdatePayload = {
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 16,
			serializedDefault: 16,
			sourcePath: "game.TestScript",
			persistPath: "src/client/constants.json",
		};
		expect(isConstantUpdatePayload(valid)).toBe(true);
		expect(
			isConstantUpdatePayload({
				scope: "client",
				name: "WALK_SPEED",
				sourcePath: "game.TestScript",
			}),
		).toBe(false);
		expect(isConstantUpdatePayload(undefined)).toBe(false);
		expect(isConstantUpdatePayload("nope")).toBe(false);
	});
});
