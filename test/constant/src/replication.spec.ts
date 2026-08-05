import type { ConstantUpdatePayload } from "@lisachandra/constant";
import {
	applyReplicationUpdate,
	configureAutomaticConstantReplication,
	ConstantStore,
	createConstantReplicationClient,
	createConstantReplicationServer,
	createConstantUpdatePayload,
} from "@lisachandra/constant";
import type { ReplicatedEditorRegistrationPayload } from "@lisachandra/constant/transport";
import { typeAssertIs } from "@lisachandra/core/utils/type";
import { createMockInstance, getModuleByTree, mockOnRuntime } from "@lisachandra/test/utils";
import { describe, expect, it, jest } from "@rbxts/jest-globals";

import { MockRemoteEvent } from "./mockRemoteEvent";

const servicesModule = getModuleByTree(...$getModuleTree("@rbxts/services"));
let mockServices: ReturnType<typeof mockOnRuntime<typeof import("@rbxts/services")>>;

jest.mock<typeof import("@rbxts/services")>(servicesModule, () => {
	const originalServices: typeof import("@rbxts/services") = jest.requireActual(servicesModule);

	mockServices = mockOnRuntime(jest, createMockInstance(originalServices));
	return mockServices as never;
});

const transportModule = getModuleByTree(...$getModuleTree("@lisachandra/constant/transport"));
let constantRemote = new MockRemoteEvent();
let editorRemote = new MockRemoteEvent();

jest.mock<typeof import("@lisachandra/constant/transport")>(transportModule, () => {
	const originalTransport: typeof import("@lisachandra/constant/transport") =
		jest.requireActual(transportModule);

	originalTransport.getOrCreateReplicationEvent = () => constantRemote as unknown as RemoteEvent;
	originalTransport.getOrCreateReplicatedEditorEvent = () =>
		editorRemote as unknown as RemoteEvent;

	return originalTransport;
});

describe("replication server", () => {
	it("should broadcastAll sends current state to all clients", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16)
			.add("DEBUG", false);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
		});

		const received: Array<{ name: string; serializedValue: unknown }> = [];
		const connection = constantRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ConstantUpdatePayload>(payload);
			received.push({
				name: payload.name,
				serializedValue: payload.serializedValue,
			});
		});

		server.broadcastAll();

		expect(received.size()).toBe(2);

		const walkSpeed = received.find((r) => r.name === "WALK_SPEED");
		const debug = received.find((r) => r.name === "DEBUG");

		expect(walkSpeed?.serializedValue).toBe(16);
		expect(debug?.serializedValue).toBe(false);

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	it("should server editor registration includes default hotkey", () => {
		expect.hasAssertions();

		const store = new ConstantStore(
			"server",
			{},
			"src/server/constants.json",
			"game.ServerA",
		).add("PART_SIZE", 6);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
		});

		let receivedRegistration: undefined | { action: string; keyCodeName?: string };
		const connection = editorRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ReplicatedEditorRegistrationPayload>(payload);
			receivedRegistration = { action: payload.action, keyCodeName: payload.keyCodeName };
		});

		server.broadcastAll();

		expect(receivedRegistration?.action).toBe("register");
		expect(receivedRegistration?.keyCodeName).toBe("F8");

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	it("should does not broadcast updates for a different scope", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const server = createConstantReplicationServer(store, {
			canEdit: () => true,
			syncOnPlayerAdded: false,
		});

		let receivedCount = 0;
		const connection = constantRemote.OnClientEvent.Connect(() => {
			receivedCount++;
		});

		// Fire an update for server scope — should be ignored by this client-scoped server
		const payload = createConstantUpdatePayload(
			"server",
			"WALK_SPEED",
			24,
			16,
			"game.A",
			"src/server/constants.json",
		);
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(16);
		expect(receivedCount).toBe(0);

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	it("should rejects updates when canEdit returns false", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const server = createConstantReplicationServer(store, {
			canEdit: () => false,
			syncOnPlayerAdded: false,
		});

		let receivedCount = 0;
		const connection = constantRemote.OnClientEvent.Connect(() => {
			receivedCount++;
		});

		const payload = createConstantUpdatePayload(
			"client",
			"WALK_SPEED",
			24,
			16,
			"game.A",
			"src/client/constants.json",
		);
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(16);
		expect(receivedCount).toBe(0);

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	it("should approves updates when canEdit returns true", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const server = createConstantReplicationServer(store, {
			canEdit: () => true,
			syncOnPlayerAdded: false,
		});

		let receivedPayload: undefined | { name: string; serializedValue: unknown };
		const connection = constantRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ConstantUpdatePayload>(payload);
			receivedPayload = {
				name: payload.name,
				serializedValue: payload.serializedValue,
			};
		});

		const payload = createConstantUpdatePayload(
			"client",
			"WALK_SPEED",
			24,
			16,
			"game.A",
			"src/client/constants.json",
		);
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(24);
		expect(receivedPayload?.name).toBe("WALK_SPEED");
		expect(receivedPayload?.serializedValue).toBe(24);

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	it("should disconnect prevents further updates", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const server = createConstantReplicationServer(store, {
			canEdit: () => true,
			syncOnPlayerAdded: false,
		});

		server.disconnect();

		const payload = createConstantUpdatePayload(
			"client",
			"WALK_SPEED",
			24,
			16,
			"game.A",
			"src/client/constants.json",
		);
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(16);

		constantRemote.Destroy();
		editorRemote.Destroy();
	});
});

describe("replication client", () => {
	it("should client requestUpdate sends update to server", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const client = createConstantReplicationClient(store);

		let serverReceived: undefined | { name: string; serializedValue: number };
		const serverConnection = constantRemote.OnServerEvent.Connect(
			(_player, payload: unknown) => {
				const p = payload as { name: string; serializedValue: number };
				serverReceived = { name: p.name, serializedValue: p.serializedValue };
			},
		);

		client.requestUpdate({
			name: "WALK_SPEED",
			persistPath: "src/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 30,
			sourcePath: "game.A",
		});

		task.wait(0.1);

		expect(serverReceived?.name).toBe("WALK_SPEED");
		expect(serverReceived?.serializedValue).toBe(30);

		client.disconnect();
		serverConnection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	it("should client requestSink publishes payloads", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const client = createConstantReplicationClient(store);

		const sink = client.createRequestSink();

		let receivedPayload: undefined | { name: string; serializedValue: number };
		const connection = constantRemote.OnServerEvent.Connect((_player, payload: unknown) => {
			const p = payload as { name: string; serializedValue: number };
			receivedPayload = { name: p.name, serializedValue: p.serializedValue };
		});

		sink.publish(
			createConstantUpdatePayload(
				"client",
				"WALK_SPEED",
				40,
				16,
				"game.A",
				"src/client/constants.json",
			),
		);

		task.wait(0.1);

		expect(receivedPayload?.name).toBe("WALK_SPEED");
		expect(receivedPayload?.serializedValue).toBe(40);

		client.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});
});

describe("applyReplicationUpdate", () => {
	it("should applies valid typed updates to the store", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const result = applyReplicationUpdate(store, {
			name: "WALK_SPEED",
			persistPath: "src/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "game.A",
		});

		expect(result).toBe(true);
		expect(store.build().WALK_SPEED).toBe(24);
	});

	it("should rejects updates for mismatched scope", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const result = applyReplicationUpdate(store, {
			name: "WALK_SPEED",
			persistPath: "src/client/constants.json",
			scope: "server",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "game.A",
		});

		expect(result).toBe(false);
		expect(store.build().WALK_SPEED).toBe(16);
	});

	it("should rejects updates for mismatched sourcePath", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const result = applyReplicationUpdate(store, {
			name: "WALK_SPEED",
			persistPath: "src/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "game.B",
		});

		expect(result).toBe(false);
	});

	it("should rejects updates for unknown constant name", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const result = applyReplicationUpdate(store, {
			name: "UNKNOWN",
			persistPath: "src/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: 24,
			sourcePath: "game.A",
		});

		expect(result).toBe(false);
	});

	it("should rejects updates where serialized value does not match the constrains kind", () => {
		expect.hasAssertions();

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const result = applyReplicationUpdate(store, {
			name: "WALK_SPEED",
			persistPath: "src/client/constants.json",
			scope: "client",
			serializedDefault: 16,
			serializedValue: "not-a-number",
			sourcePath: "game.A",
		});

		expect(result).toBe(false);
		expect(store.build().WALK_SPEED).toBe(16);
	});
});

describe("replication relay", () => {
	it("should relay receives client bootstrap and broadcasts editor registration", () => {
		expect.hasAssertions();

		mockServices.RunService.IsServer.mockReturnValue(true);

		let receivedRegistration: undefined | { action: string; keyCodeName?: string };
		const connection = editorRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ReplicatedEditorRegistrationPayload>(payload);
			receivedRegistration = { action: payload.action, keyCodeName: payload.keyCodeName };
		});

		configureAutomaticConstantReplication({ canEdit: () => true });

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A").add(
			"WALK_SPEED",
			16,
		);

		const client = createConstantReplicationClient(store);

		task.wait(1);

		expect(receivedRegistration?.action).toBe("register");
		expect(receivedRegistration?.keyCodeName).toBeUndefined();

		client.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();

		mockServices.RunService.IsServer.mockRestore();
	});
});
