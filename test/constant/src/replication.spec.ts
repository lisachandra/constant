import { describe, expect, jest, test } from "@rbxts/jest-globals";
import { createMockInstance, getModuleByTree, mockOnRuntime } from "@lisachandra/test/out/utils";
import { MockRemoteEvent } from "./mock-remote-event";

const servicesModule = getModuleByTree(...$getModuleTree("@rbxts/services"));
let mockServices: ReturnType<typeof mockOnRuntime<typeof import("@rbxts/services")>>;

jest.mock<typeof import("@rbxts/services")>(servicesModule, () => {
	const originalServices: typeof import("@rbxts/services") =
		jest.requireActual(servicesModule);

	mockServices ??= mockOnRuntime(jest, createMockInstance(originalServices));
	return mockServices as never;
});

const transportModule = getModuleByTree(...$getModuleTree("@lisachandra/constant/out/transport"))
let constantRemote = new MockRemoteEvent();
let editorRemote = new MockRemoteEvent();

jest.mock<typeof import("@lisachandra/constant/out/transport")>(transportModule, () => {
	const originalTransport: typeof import("@lisachandra/constant/out/transport") =
		jest.requireActual(transportModule);

	originalTransport.getOrCreateReplicationEvent = () => constantRemote as unknown as RemoteEvent;
	originalTransport.getOrCreateReplicatedEditorEvent = () => editorRemote as unknown as RemoteEvent;

	return originalTransport;
})

import { RunService } from "@rbxts/services";
import { ReplicatedStorage } from "@rbxts/services";
import {
	applyReplicationUpdate,
	ConstantStore,
	createConstantReplicationClient,
	createConstantReplicationServer,
	configureAutomaticConstantReplication,
	createConstantUpdatePayload,
	ConstantUpdatePayload,
} from "@lisachandra/constant";
import {
	ReplicatedEditorRegistrationPayload,
	getOrCreateReplicatedEditorEvent,
} from "@lisachandra/constant/out/transport"
import { getMember, typeAssertIs } from "@lisachandra/core/out/utils/type"

describe("replication server", () => {
	test("broadcastAll sends current state to all clients", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16)
			.add("DEBUG", false);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
		});

		const received: Array<{ name: string; serializedValue: unknown }> = [];
		const connection = constantRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ConstantUpdatePayload>(payload)
			received.push({ name: payload.name as string, serializedValue: payload.serializedValue });
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

	test("does not broadcast updates for a different scope", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
			canEdit: () => true,
		});

		let receivedCount = 0;
		const connection = constantRemote.OnClientEvent.Connect(() => {
			receivedCount++;
		});

		// Fire an update for server scope — should be ignored by this client-scoped server
		const payload = createConstantUpdatePayload("server", "WALK_SPEED", 24, 16, "game.A", "src/server/constants.json");
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(16);
		expect(receivedCount).toBe(0);

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	test("rejects updates when canEdit returns false", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
			canEdit: () => false,
		});

		let receivedCount = 0;
		const connection = constantRemote.OnClientEvent.Connect(() => {
			receivedCount++;
		});

		const payload = createConstantUpdatePayload("client", "WALK_SPEED", 24, 16, "game.A", "src/client/constants.json");
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(16);
		expect(receivedCount).toBe(0);

		server.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	test("approves updates when canEdit returns true", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
			canEdit: () => true,
		});

		let receivedPayload: { name: string; serializedValue: unknown } | undefined;
		const connection = constantRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ConstantUpdatePayload>(payload)
			receivedPayload = { name: payload.name as string, serializedValue: payload.serializedValue };
		});

		const payload = createConstantUpdatePayload("client", "WALK_SPEED", 24, 16, "game.A", "src/client/constants.json");
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

	test("disconnect prevents further updates", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const server = createConstantReplicationServer(store, {
			syncOnPlayerAdded: false,
			canEdit: () => true,
		});

		server.disconnect();

		const payload = createConstantUpdatePayload("client", "WALK_SPEED", 24, 16, "game.A", "src/client/constants.json");
		constantRemote.FireServer(payload);

		task.wait(0.1);

		expect(store.build().WALK_SPEED).toBe(16);

		constantRemote.Destroy();
		editorRemote.Destroy();
	});
});

describe("replication client", () => {
	test("client requestUpdate sends update to server", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const client = createConstantReplicationClient(store);

		let serverReceived: { name: string; serializedValue: number } | undefined;
		const serverConnection = constantRemote.OnServerEvent.Connect((_player, payload: unknown) => {
			const p = payload as { name: string; serializedValue: number };
			serverReceived = { name: p.name, serializedValue: p.serializedValue };
		});

		client.requestUpdate({
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 30,
			serializedDefault: 16,
			sourcePath: "game.A",
			persistPath: "src/client/constants.json",
		});

		task.wait(0.1);

		expect(serverReceived?.name).toBe("WALK_SPEED");
		expect(serverReceived?.serializedValue).toBe(30);

		client.disconnect();
		serverConnection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();
	});

	test("client requestSink publishes payloads", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const client = createConstantReplicationClient(store);

		const sink = client.createRequestSink();

		let receivedPayload: { name: string; serializedValue: number } | undefined;
		const connection = constantRemote.OnServerEvent.Connect((_player, payload: unknown) => {
			const p = payload as { name: string; serializedValue: number };
			receivedPayload = { name: p.name, serializedValue: p.serializedValue };
		});

		sink.publish(createConstantUpdatePayload("client", "WALK_SPEED", 40, 16, "game.A", "src/client/constants.json"));

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
	test("applies valid typed updates to the store", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const result = applyReplicationUpdate(store, {
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "game.A",
			persistPath: "src/client/constants.json",
		});

		expect(result).toBe(true);
		expect(store.build().WALK_SPEED).toBe(24);
	});

	test("rejects updates for mismatched scope", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const result = applyReplicationUpdate(store, {
			scope: "server",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "game.A",
			persistPath: "src/client/constants.json",
		});

		expect(result).toBe(false);
		expect(store.build().WALK_SPEED).toBe(16);
	});

	test("rejects updates for mismatched sourcePath", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const result = applyReplicationUpdate(store, {
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "game.B",
			persistPath: "src/client/constants.json",
		});

		expect(result).toBe(false);
	});

	test("rejects updates for unknown constant name", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const result = applyReplicationUpdate(store, {
			scope: "client",
			name: "UNKNOWN",
			serializedValue: 24,
			serializedDefault: 16,
			sourcePath: "game.A",
			persistPath: "src/client/constants.json",
		});

		expect(result).toBe(false);
	});

	test("rejects updates where serialized value does not match the constrains kind", () => {
		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const result = applyReplicationUpdate(store, {
			scope: "client",
			name: "WALK_SPEED",
			serializedValue: "not-a-number",
			serializedDefault: 16,
			sourcePath: "game.A",
			persistPath: "src/client/constants.json",
		});

		expect(result).toBe(false);
		expect(store.build().WALK_SPEED).toBe(16);
	});
});

describe("replication relay", () => {
	test("relay receives client bootstrap and broadcasts editor registration", () => {
		mockServices.RunService.IsServer.mockReturnValue(true);

		let receivedRegistration: { action: string; keyCodeName?: string } | undefined;
		const connection = editorRemote.OnClientEvent.Connect((payload) => {
			typeAssertIs<ReplicatedEditorRegistrationPayload>(payload)
			receivedRegistration = { action: payload.action, keyCodeName: payload.keyCodeName };
		});

		configureAutomaticConstantReplication({ canEdit: () => true });

		const store = new ConstantStore("client", {}, "src/client/constants.json", "game.A")
			.add("WALK_SPEED", 16);

		const client = createConstantReplicationClient(store);

		task.wait(1)

		expect(receivedRegistration?.action).toBe("register");
		expect(receivedRegistration?.keyCodeName).toBeUndefined();

		client.disconnect();
		connection.Disconnect();
		constantRemote.Destroy();
		editorRemote.Destroy();

		mockServices.RunService.IsServer.mockRestore()
	});
});
