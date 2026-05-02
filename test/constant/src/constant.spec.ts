
import { describe, expect, test } from "@rbxts/jest-globals";
import { RunService } from "@rbxts/services";
import {
	connectBindableTransport,
	Constant,
	ConstantStore,
	createBindableEventSink,
	createConstantUpdatePayload,
	deserializeConstant,
	serializeConstant,
	serializedEquals,
	type ConstantUpdatePayload,
	type PersistedConstantFile,
} from "@lisachandra/constant";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectType<T extends true> = T;

const builtForTypeTest = new Constant("src/client/constants.json").add("WALK_SPEED", 16).add("DEBUG_RAYCASTS", false).build();
type _BuildTypeCheck = ExpectType<Equal<typeof builtForTypeTest.WALK_SPEED, number>>;
type _BuildTypeCheck2 = ExpectType<Equal<typeof builtForTypeTest.DEBUG_RAYCASTS, boolean>>;

describe("Constant", () => {
	test("build returns script defaults when no persisted data exists", () => {
		const constants = new Constant("src/client/constants.json").add("WALK_SPEED", 16).add("DEBUG", false).build();

		expect(constants.WALK_SPEED).toBe(16);
		expect(constants.DEBUG).toBe(false);
	});

	test("path-based factory infers scope from persist path", () => {
		const clientConstants = new Constant("src/client/constants.json").add("WALK_SPEED", 16);
		const serverConstants = new Constant("src/server/constants.json").add("DEBUG", false);

		expect(clientConstants.getScope()).toBe("client");
		expect(clientConstants.getPersistPath()).toBe("src/client/constants.json");
		expect(serverConstants.getScope()).toBe("server");
		expect(serverConstants.getPersistPath()).toBe("src/server/constants.json");
	});



	test("store can seed persisted values and defaults", () => {
		const persisted: PersistedConstantFile = {
			WALK_SPEED: 24,
			_defaults: { WALK_SPEED: 16 },
		};

		const store = new ConstantStore("client", persisted, "src/client/constants.json").add("WALK_SPEED", 16);
		const built = store.build();
		const definition = store.getDefinitions().get("WALK_SPEED");

		expect(built.WALK_SPEED).toBe(24);
		expect(definition?.hasPersistedValue).toBe(true);
		expect(definition?.defaultDrifted).toBe(false);
	});

	test("store marks changed defaults as drifted", () => {
		const persisted: PersistedConstantFile = {
			WALK_SPEED: 24,
			_defaults: { WALK_SPEED: 16 },
		};

		const store = new ConstantStore("client", persisted, "src/client/constants.json").add("WALK_SPEED", 20);
		const definition = store.getDefinitions().get("WALK_SPEED");

		expect(definition?.currentValue).toBe(24);
		expect(definition?.defaultDrifted).toBe(true);
	});

	test("store live updates override persisted values until reset", () => {
		const persisted: PersistedConstantFile = {
			WALK_SPEED: 24,
			_defaults: { WALK_SPEED: 16 },
		};

		const store = new ConstantStore("client", persisted, "src/client/constants.json").add("WALK_SPEED", 16);
		store.updateValue("WALK_SPEED", 32);
		expect(store.build().WALK_SPEED).toBe(32);

		store.resetValue("WALK_SPEED");
		expect(store.build().WALK_SPEED).toBe(24);
	});

	test("snapshot includes current values and defaults", () => {
		const serverConstant = new Constant("src/server/constants.json").add("WALK_SPEED", 16).add("DEBUG", false);
		serverConstant.updateValue("WALK_SPEED", 30);
		const snapshot = serverConstant.getPersistedSnapshot();

		expect(snapshot.WALK_SPEED).toBe(30);
		expect(snapshot._defaults?.WALK_SPEED).toBe(16);
		expect(snapshot.DEBUG).toBe(false);
		expect(snapshot._defaults?.DEBUG).toBe(false);
	});

	test("duplicate constant definitions throw", () => {
		const clientConstant = new Constant("src/client/constants.json").add("WALK_SPEED", 16);
		expect(() => clientConstant.add("WALK_SPEED", 20)).toThrow();
	});
});

describe("serialization", () => {
	test("round-trips Color3 values", () => {
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

	test("round-trips Vector3 values", () => {
		const value = new Vector3(1, 2, 3);
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, new Vector3());

		expect(restored).toEqual(value);
	});

	test("round-trips CFrame values", () => {
		const value = new CFrame(1, 2, 3).mul(CFrame.Angles(0.1, 0.2, 0.3));
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, new CFrame());

		expect(typeIs(restored, "CFrame")).toBe(true);
		if (typeIs(restored, "CFrame")) {
			expect(serializedEquals(serializeConstant(restored), serialized)).toBe(true);
		}
	});

	test("round-trips EnumItem values", () => {
		const value = Enum.Material.Neon;
		const serialized = serializeConstant(value);
		const restored = deserializeConstant(serialized, Enum.Material.Plastic);

		expect(restored).toBe(Enum.Material.Neon);
	});

	test("creates bridge payloads from runtime values", () => {
		const payload = createConstantUpdatePayload("client", "WALK_SPEED", 16, 12, "src/client/constants.json");

		expect(payload.scope).toBe("client");
		expect(payload.name).toBe("WALK_SPEED");
		expect(payload.serializedValue).toBe(16);
		expect(payload.serializedDefault).toBe(12);
		expect(payload.persistPath).toBe("src/client/constants.json");
	});

	test("bindable event sinks publish payloads", () => {
		const event = new Instance("BindableEvent");
		let receivedName = "";
		let receivedValue = -1;
		const connection = connectBindableTransport((payload: ConstantUpdatePayload) => {
			receivedName = payload.name;
			receivedValue = payload.serializedValue as number;
		}, event);

		createBindableEventSink(event).publish(createConstantUpdatePayload("client", "WALK_SPEED", 16, 12));

		expect(receivedName).toBe("WALK_SPEED");
		expect(receivedValue).toBe(16);
		connection.Disconnect();
	});
});
