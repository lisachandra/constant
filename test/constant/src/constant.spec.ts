import {
	configureConstant,
	connectBindableTransport,
	Constant,
	ConstantStore,
	type ConstantUpdatePayload,
	createBindableEventSink,
	createConstantUpdatePayload,
	deserializeConstant,
	type PersistedConstantGroup,
	serializeConstant,
	serializedEquals,
} from "@lisachandra/constant";
import { describe, expect, it } from "@rbxts/jest-globals";
import { RunService } from "@rbxts/services";

type Equal<A, B> =
	// oxlint-disable-next-line no-unnecessary-type-parameters -- the equality trick needs the type parameter to appear once in the signature
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectType<T extends true> = T;

const activePersistPath = RunService.IsClient()
	? "src/client/constants.json"
	: "src/server/constants.json";
configureConstant(activePersistPath, {});
const _builtForTypeTest = new Constant().add("WALK_SPEED", 16).add("DEBUG_RAYCASTS", false).build();
type _BuildTypeCheck = ExpectType<Equal<typeof _builtForTypeTest.WALK_SPEED, number>>;
type _BuildTypeCheck2 = ExpectType<Equal<typeof _builtForTypeTest.DEBUG_RAYCASTS, boolean>>;

describe("constant", () => {
	it("should build returns script defaults when no persisted data exists", () => {
		expect.hasAssertions();

		const constants = new Constant().add("WALK_SPEED", 16).add("DEBUG", false).build();

		expect(constants.WALK_SPEED).toBe(16);
		expect(constants.DEBUG).toBe(false);
	});

	it("should constant uses configured scope and persist path", () => {
		expect.hasAssertions();

		const constants = new Constant().add("WALK_SPEED", 16);

		expect(constants.getScope()).toBe(RunService.IsClient() ? "client" : "server");
		expect(constants.getPersistPath()).toBe(activePersistPath);
	});

	it("should store can seed persisted values and defaults", () => {
		expect.hasAssertions();

		const persisted: PersistedConstantGroup = {
			_defaults: { WALK_SPEED: 16 },
			WALK_SPEED: 24,
		};

		const store = new ConstantStore(
			"client",
			persisted,
			"src/client/constants.json",
			"game.TestScript",
		).add("WALK_SPEED", 16);
		const built = store.build();
		const definition = store.getDefinitions().get("WALK_SPEED");

		expect(built.WALK_SPEED).toBe(24);
		expect(definition?.hasPersistedValue).toBe(true);
		expect(definition?.defaultDrifted).toBe(false);
	});

	it("should store marks changed defaults as drifted", () => {
		expect.hasAssertions();

		const persisted: PersistedConstantGroup = {
			_defaults: { WALK_SPEED: 16 },
			WALK_SPEED: 24,
		};

		const store = new ConstantStore(
			"client",
			persisted,
			"src/client/constants.json",
			"game.TestScript",
		).add("WALK_SPEED", 20);
		const definition = store.getDefinitions().get("WALK_SPEED");

		expect(definition?.currentValue).toBe(24);
		expect(definition?.defaultDrifted).toBe(true);
	});

	it("should store adopts new defaults when persisted value still matches the old default", () => {
		expect.hasAssertions();

		const persisted: PersistedConstantGroup = {
			_defaults: { WALK_SPEED: 16 },
			WALK_SPEED: 16,
		};

		const store = new ConstantStore(
			"client",
			persisted,
			"src/client/constants.json",
			"game.TestScript",
		).add("WALK_SPEED", 20);
		const definition = store.getDefinitions().get("WALK_SPEED");

		expect(store.build().WALK_SPEED).toBe(20);
		expect(definition?.persistedValue).toBe(20);
		expect(definition?.defaultDrifted).toBe(true);
	});

	it("should reapplyDefault promotes the current script default as a live override", () => {
		expect.hasAssertions();

		const persisted: PersistedConstantGroup = {
			_defaults: { WALK_SPEED: 16 },
			WALK_SPEED: 24,
		};

		const store = new ConstantStore(
			"client",
			persisted,
			"src/client/constants.json",
			"game.TestScript",
		).add("WALK_SPEED", 20);
		store.reapplyDefault("WALK_SPEED");
		const definition = store.getDefinitions().get("WALK_SPEED");

		expect(store.build().WALK_SPEED).toBe(20);
		expect(definition?.hasLiveOverride).toBe(true);

		store.resetValue("WALK_SPEED");

		expect(store.build().WALK_SPEED).toBe(24);
	});

	it("should reapplyDriftedDefaults updates only drifted constants", () => {
		expect.hasAssertions();

		const persisted: PersistedConstantGroup = {
			_defaults: { DEBUG: false, WALK_SPEED: 16 },
			DEBUG: false,
			WALK_SPEED: 16,
		};

		const store = new ConstantStore(
			"client",
			persisted,
			"src/client/constants.json",
			"game.TestScript",
		)
			.add("WALK_SPEED", 20)
			.add("DEBUG", false);

		expect(store.reapplyDriftedDefaults()).toEqual(["WALK_SPEED"]);
		expect(store.build().WALK_SPEED).toBe(20);
		expect(store.build().DEBUG).toBe(false);
		expect(store.getDefinitions().get("WALK_SPEED")?.hasLiveOverride).toBe(true);
		expect(store.getDefinitions().get("DEBUG")?.hasLiveOverride).toBe(false);
	});

	it("should store live updates override persisted values until reset", () => {
		expect.hasAssertions();

		const persisted: PersistedConstantGroup = {
			_defaults: { WALK_SPEED: 16 },
			WALK_SPEED: 24,
		};

		const store = new ConstantStore(
			"client",
			persisted,
			"src/client/constants.json",
			"game.TestScript",
		).add("WALK_SPEED", 16);
		store.updateValue("WALK_SPEED", 32);

		expect(store.build().WALK_SPEED).toBe(32);

		store.resetValue("WALK_SPEED");

		expect(store.build().WALK_SPEED).toBe(24);
	});

	it("should build returns a fresh frozen snapshot, not the store's live values", () => {
		expect.hasAssertions();

		const store = new ConstantStore(
			"client",
			{},
			"src/client/constants.json",
			"game.TestScript",
		).add("WALK_SPEED", 16);

		expect(store.build()).never.toBe(store.build());
		expect(table.isfrozen(store.build())).toBe(true);
	});

	it("should snapshot includes current values and defaults", () => {
		expect.hasAssertions();

		const serverConstant = new Constant().add("WALK_SPEED", 16).add("DEBUG", false);
		serverConstant.updateValue("WALK_SPEED", 30);
		const snapshot = serverConstant.getPersistedSnapshot();

		expect(snapshot.WALK_SPEED).toBe(30);
		expect(snapshot._defaults?.WALK_SPEED).toBe(16);
		expect(snapshot.DEBUG).toBe(false);
		expect(snapshot._defaults?.DEBUG).toBe(false);
	});

	it("should duplicate constant definitions throw within the same source path", () => {
		expect.hasAssertions();

		const clientConstant = new Constant().add("WALK_SPEED", 16);

		expect(() => clientConstant.add("WALK_SPEED", 20)).toThrow("Duplicate constant definition");
	});
});

describe("serialization", () => {
	it("should round-trips Color3 values", () => {
		expect.hasAssertions();

		const value = Color3.fromRGB(255, 128, 64);
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, Color3.fromRGB(0, 0, 0));

		expect(typeIs(restored, "Color3")).toBe(true);

		if (typeIs(restored, "Color3")) {
			expect(restored.R).toBe(value.R);
			expect(restored.G).toBe(value.G);
			expect(restored.B).toBe(value.B);
		}
	});

	it("should round-trips Vector3 values", () => {
		expect.hasAssertions();

		const value = new Vector3(1, 2, 3);
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, new Vector3());

		expect(restored).toEqual(value);
	});

	it("should round-trips CFrame values", () => {
		expect.hasAssertions();

		const value = new CFrame(1, 2, 3).mul(CFrame.Angles(0.1, 0.2, 0.3));
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, new CFrame());

		expect(typeIs(restored, "CFrame")).toBe(true);

		if (typeIs(restored, "CFrame")) {
			expect(serializedEquals(serializeConstant(restored), serialized)).toBe(true);
		}
	});

	it("should round-trips EnumItem values", () => {
		expect.hasAssertions();

		const value = Enum.Material.Neon;
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, Enum.Material.Plastic);

		expect(restored).toBe(Enum.Material.Neon);
	});

	it("should creates bridge payloads from runtime values", () => {
		expect.hasAssertions();

		const payload = createConstantUpdatePayload(
			"client",
			"WALK_SPEED",
			16,
			12,
			"game.TestScript",
			"src/client/constants.json",
		);

		expect(payload.scope).toBe("client");
		expect(payload.name).toBe("WALK_SPEED");
		expect(payload.serializedValue).toBe(16);
		expect(payload.serializedDefault).toBe(12);
		expect(payload.sourcePath).toBe("game.TestScript");
		expect(payload.persistPath).toBe("src/client/constants.json");
	});

	it("should bindable event sinks publish payloads", () => {
		expect.hasAssertions();

		const event = new Instance("BindableEvent");
		let receivedName = "";
		let receivedValue = -1;
		const connection = connectBindableTransport((payload: ConstantUpdatePayload) => {
			receivedName = payload.name;
			receivedValue = payload.serializedValue as number;
		}, event);

		createBindableEventSink(event).publish(
			createConstantUpdatePayload("client", "WALK_SPEED", 16, 12, "game.TestScript"),
		);

		expect(receivedName).toBe("WALK_SPEED");
		expect(receivedValue).toBe(16);

		connection.Disconnect();
	});
});
