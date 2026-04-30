import { describe, expect, test } from "@rbxts/jest-globals";
import {
	applyConstantUpdate,
	connectPluginTransport,
	createPluginBridge,
	getConstantsFilePath,
	getOrCreatePluginTransportEvent,
	isConstantPluginUpdateRequest,
} from "@lisachandra/plugin";

describe("plugin bridge", () => {
	test("validates bridge payload shape", () => {
		expect(
			isConstantPluginUpdateRequest({
				scope: "client",
				name: "WALK_SPEED",
				serializedValue: 16,
				serializedDefault: 12,
			}),
		).toBe(true);

		expect(
			isConstantPluginUpdateRequest({
				scope: "invalid",
				name: "WALK_SPEED",
				serializedValue: 16,
				serializedDefault: 12,
			}),
		).toBe(false);
	});

	test("maps scopes to constants.json paths", () => {
		expect(getConstantsFilePath("client")).toBe("src/client/constants.json");
		expect(getConstantsFilePath("server")).toBe("src/server/constants.json");
	});

	test("applies updates into flat persisted files", () => {
		const nextFile = applyConstantUpdate(
			{
				DEBUG: false,
				_defaults: { DEBUG: false },
			},
			{
				scope: "server",
				name: "WALK_SPEED",
				serializedValue: 24,
				serializedDefault: 16,
			},
		);

		expect(nextFile.DEBUG).toBe(false);
		expect(nextFile.WALK_SPEED).toBe(24);
		expect(nextFile._defaults?.WALK_SPEED).toBe(16);
	});

	test("forwards valid requests", () => {
		let receivedName = "";
		const bridge = createPluginBridge((request: { name: string }) => {
			receivedName = request.name;
		});

		bridge.forwardUpdate({
			scope: "server",
			name: "DEBUG",
			serializedValue: true,
			serializedDefault: false,
		});

		expect(receivedName).toBe("DEBUG");
	});

	test("bindable transport forwards valid payloads", () => {
		const event = new Instance("BindableEvent");
		let receivedName = "";
		const connection = connectPluginTransport((request: { name: string }) => {
			receivedName = request.name;
		}, event);

		event.Fire({
			scope: "server",
			name: "WALK_SPEED",
			serializedValue: 20,
			serializedDefault: 16,
		});

		expect(receivedName).toBe("WALK_SPEED");
		connection.Disconnect();
	});

	test("creates transport event in a container", () => {
		const folder = new Instance("Folder");
		const event = getOrCreatePluginTransportEvent(folder);

		expect(event.Name).toBe("PersistRequested");
		expect(event.Parent?.Name).toBe("constant");
	});

	test("throws on invalid requests", () => {
		const bridge = createPluginBridge(() => undefined);
		expect(() => bridge.forwardUpdate({ scope: "broken" } as never)).toThrow();
	});
});
