import { describe, expect, test } from "@rbxts/jest-globals";
import {
	connectBindableTransport,
	Constant,
	createBindableEventSink,
	createConstantUpdatePayload,
	deserializeConstant,
	serializeConstant,
	serializedEquals,
	type ConstantUpdatePayload,
	type PersistedConstantFile,
} from "../../../packages/constant/src";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectType<T extends true> = T;

const builtForTypeTest = new Constant("client").add("WALK_SPEED", 16).add("DEBUG_RAYCASTS", false).build();
type _BuildTypeCheck = ExpectType<Equal<typeof builtForTypeTest.WALK_SPEED, number>>;
type _BuildTypeCheck2 = ExpectType<Equal<typeof builtForTypeTest.DEBUG_RAYCASTS, boolean>>;

describe("Constant", () => {
	test("build returns script defaults when no persisted data exists", () => {
		const constants = new Constant("client").add("WALK_SPEED", 16).add("DEBUG", false).build();

		expect(constants.WALK_SPEED).toBe(16);
		expect(constants.DEBUG).toBe(false);
	});

	test("persisted values override script defaults", () => {
		const persisted: PersistedConstantFile = {
			WALK_SPEED: 24,
			_defaults: { WALK_SPEED: 16 },
		};

		const constant = new Constant("client", persisted).add("WALK_SPEED", 16);
		const built = constant.build();
		const definition = constant.getDefinitions().get("WALK_SPEED");

		expect(built.WALK_SPEED).toBe(24);
		expect(definition?.hasPersistedValue).toBe(true);
		expect(definition?.defaultDrifted).toBe(false);
	});

	test("changed defaults are marked as drifted", () => {
		const persisted: PersistedConstantFile = {
			WALK_SPEED: 24,
			_defaults: { WALK_SPEED: 16 },
		};

		const constant = new Constant("client", persisted).add("WALK_SPEED", 20);
		const definition = constant.getDefinitions().get("WALK_SPEED");

		expect(definition?.currentValue).toBe(24);
		expect(definition?.defaultDrifted).toBe(true);
	});

	test("live updates override persisted values until reset", () => {
		const persisted: PersistedConstantFile = {
			WALK_SPEED: 24,
			_defaults: { WALK_SPEED: 16 },
		};

		const constant = new Constant("client", persisted).add("WALK_SPEED", 16);
		constant.updateValue("WALK_SPEED", 32);
		expect(constant.build().WALK_SPEED).toBe(32);

		constant.resetValue("WALK_SPEED");
		expect(constant.build().WALK_SPEED).toBe(24);
	});

	test("snapshot includes current values and defaults", () => {
		const constant = new Constant("server").add("WALK_SPEED", 16).add("DEBUG", false);
		constant.updateValue("WALK_SPEED", 30);
		const snapshot = constant.getPersistedSnapshot();

		expect(snapshot.WALK_SPEED).toBe(30);
		expect(snapshot._defaults?.WALK_SPEED).toBe(16);
		expect(snapshot.DEBUG).toBe(false);
		expect(snapshot._defaults?.DEBUG).toBe(false);
	});

	test("duplicate constant definitions throw", () => {
		const constant = new Constant("client").add("WALK_SPEED", 16);
		expect(() => constant.add("WALK_SPEED", 20)).toThrow();
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
		const payload = createConstantUpdatePayload("client", "WALK_SPEED", 16, 12);

		expect(payload.scope).toBe("client");
		expect(payload.name).toBe("WALK_SPEED");
		expect(payload.serializedValue).toBe(16);
		expect(payload.serializedDefault).toBe(12);
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
