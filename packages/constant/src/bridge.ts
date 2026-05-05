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
	sourcePath: string,
	persistPath?: string,
): ConstantUpdatePayload {
	return {
		scope,
		name,
		serializedValue: serializeConstant(value),
		serializedDefault: serializeConstant(defaultValue),
		sourcePath,
		persistPath,
	};
}

export function publishConstantUpdate(
	sink: ConstantUpdateSink | undefined,
	scope: ConstantScope,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
	sourcePath: string,
	persistPath?: string,
): void {
	sink?.publish(createConstantUpdatePayload(scope, name, value, defaultValue, sourcePath, persistPath));
}

export function createMemoryUpdateSink(onPublish: (payload: ConstantUpdatePayload) => void): ConstantUpdateSink {
	return {
		publish(payload) {
			return onPublish(payload);
		},
	};
}
