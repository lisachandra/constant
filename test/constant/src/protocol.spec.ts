import {
	CONSTANT_TRANSPORT_EVENT_NAME,
	type ConstantUpdatePayload,
	getOrCreateTransportEvent,
	isConstantUpdatePayload,
} from "@lisachandra/constant";
import { describe, expect, it } from "@rbxts/jest-globals";

describe("constant protocol", () => {
	it("should event name matches the runtime bridge contract", () => {
		expect.hasAssertions();
		expect(CONSTANT_TRANSPORT_EVENT_NAME).toBe("Constant");
	});

	it("should get-or-create returns the same BindableEvent on repeat calls", () => {
		expect.hasAssertions();

		const parent = new Instance("Folder");

		expect(getOrCreateTransportEvent(parent)).toBe(getOrCreateTransportEvent(parent));
		expect(parent.FindFirstChild(CONSTANT_TRANSPORT_EVENT_NAME)?.IsA("BindableEvent")).toBe(
			true,
		);
	});

	it("should guard accepts valid payloads and rejects malformed ones", () => {
		expect.hasAssertions();

		const valid: ConstantUpdatePayload = {
			name: "WALK_SPEED",
			persistPath: "src/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 16,
			sourcePath: "game.TestScript",
		};

		expect(isConstantUpdatePayload(valid)).toBe(true);
		expect(
			isConstantUpdatePayload({
				name: "WALK_SPEED",
				scope: "client",
				sourcePath: "game.TestScript",
			}),
		).toBe(false);
		expect(isConstantUpdatePayload(undefined)).toBe(false);
		expect(isConstantUpdatePayload("nope")).toBe(false);
	});
});
