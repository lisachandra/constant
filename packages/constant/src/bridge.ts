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
		name,
		persistPath,
		scope,
		serializedDefault: serializeConstant(defaultValue),
		serializedValue: serializeConstant(value),
		sourcePath,
	};
}

export function publishConstantUpdate(
	sink: undefined | ConstantUpdateSink,
	scope: ConstantScope,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
	sourcePath: string,
	persistPath?: string,
): void {
	sink?.publish(
		createConstantUpdatePayload(scope, name, value, defaultValue, sourcePath, persistPath),
	);
}

export function createMemoryUpdateSink(
	onPublish: (payload: ConstantUpdatePayload) => void,
): ConstantUpdateSink {
	return {
		publish(payload) {
			onPublish(payload);
		},
	};
}
