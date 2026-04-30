import { serializeConstant } from "./serialize";
import type { ConstantScope, ConstantUpdatePayload, SupportedPrimitive } from "./types";

export interface ConstantUpdateSink {
	publish(payload: ConstantUpdatePayload): void;
}

export function createConstantUpdatePayload(
	scope: ConstantScope,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
): ConstantUpdatePayload {
	return {
		scope,
		name,
		serializedValue: serializeConstant(value),
		serializedDefault: serializeConstant(defaultValue),
	};
}

export function publishConstantUpdate(
	sink: ConstantUpdateSink | undefined,
	scope: ConstantScope,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
): void {
	sink?.publish(createConstantUpdatePayload(scope, name, value, defaultValue));
}

export function createMemoryUpdateSink(onPublish: (payload: ConstantUpdatePayload) => void): ConstantUpdateSink {
	return {
		publish(payload) {
			return onPublish(payload)
		},
	};
}
