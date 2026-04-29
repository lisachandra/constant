import { HttpService } from "@rbxts/services";
import type { PrimitiveKind, SerializedConstant, SupportedPrimitive } from "./types";

export function inferKind(value: SupportedPrimitive): PrimitiveKind {
	if (value === undefined) return "undefined";
	if (typeIs(value, "number")) return "number";
	if (typeIs(value, "string")) return "string";
	if (typeIs(value, "boolean")) return "boolean";
	if (typeIs(value, "Color3")) return "Color3";
	if (typeIs(value, "Vector3")) return "Vector3";
	if (typeIs(value, "CFrame")) return "CFrame";
	if (typeIs(value, "EnumItem")) return "EnumItem";
	error(`Unsupported constant type: ${typeOf(value)}`);
}

export function serializeConstant(value: SupportedPrimitive): SerializedConstant {
	if (value === undefined) return undefined;
	if (typeIs(value, "number") || typeIs(value, "string") || typeIs(value, "boolean")) return value;
	if (typeIs(value, "Color3")) return { type: "Color3", value: [value.R, value.G, value.B] };
	if (typeIs(value, "Vector3")) return { type: "Vector3", value: [value.X, value.Y, value.Z] };
	if (typeIs(value, "CFrame")) {
		const [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] = value.GetComponents();
		return { type: "CFrame", value: [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] };
	}
	if (typeIs(value, "EnumItem")) {
		return { type: "EnumItem", enum: tostring(value.EnumType), item: value.Name };
	}
	error(`Unable to serialize constant value of type ${typeOf(value)}`);
}

export function tryReadSerializedValue(value: SerializedConstant | Record<string, SerializedConstant> | undefined): SerializedConstant | undefined {
	if (value === undefined) return undefined;
	if (typeIs(value, "number") || typeIs(value, "string") || typeIs(value, "boolean")) return value;
	if (typeIs(value, "table") && "type" in value) return value as SerializedConstant;
	return undefined;
}

function findEnumByName(name: string): Enum | undefined {
	return Enum.GetEnums().find((enumType) => tostring(enumType) === name);
}

export function deserializeConstant(serialized: SerializedConstant | undefined, fallback: SupportedPrimitive): SupportedPrimitive {
	if (serialized === undefined) return fallback;
	if (typeIs(serialized, "number") || typeIs(serialized, "string") || typeIs(serialized, "boolean")) return serialized;
	if (!typeIs(serialized, "table")) return fallback;
	if (serialized.type === "Color3") {
		const [r, g, b] = serialized.value;
		return new Color3(r, g, b);
	}
	if (serialized.type === "Vector3") {
		const [x, y, z] = serialized.value;
		return new Vector3(x, y, z);
	}
	if (serialized.type === "CFrame") {
		const [x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22] = serialized.value;
		return new CFrame(x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22);
	}
	if (serialized.type === "EnumItem") {
		const enumType = findEnumByName(serialized.enum);
		const item = enumType?.GetEnumItems().find((candidate) => candidate.Name === serialized.item);
		return item ?? fallback;
	}
	return fallback;
}

export function formatValue(value: SupportedPrimitive): string {
	if (value === undefined) return "undefined";
	return tostring(value);
}

export function serializedEquals(left: SerializedConstant, right: SerializedConstant): boolean {
	return HttpService.JSONEncode(left) === HttpService.JSONEncode(right);
}
