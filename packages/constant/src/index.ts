export type {
	AddConstant,
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantPersistMode,
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PrimitiveKind,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

export {
	deserializeConstant,
	formatValue,
	inferKind,
	serializeConstant,
	serializedEquals,
	tryReadSerializedValue,
} from "./serialize";

export { createConstantUpdatePayload, createMemoryUpdateSink, publishConstantUpdate } from "./bridge";
export {
	CONSTANT_TRANSPORT_EVENT_NAME,
	CONSTANT_TRANSPORT_FOLDER_NAME,
	connectBindableTransport,
	createBindableEventSink,
	getOrCreateTransportEvent,
	publishBindableTransport,
} from "./transport";
export { mountConstantEditor } from "./editor";
export { ConstantStore } from "./store";

import { mountConstantEditor } from "./editor";
import { ConstantStore } from "./store";
import type {
	AddConstant,
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantScope,
	PersistedConstantFile,
	SupportedPrimitive,
} from "./types";

export class Constant<T extends object = {}> {
	private readonly store: ConstantStore<T>;

	public constructor(scope: ConstantScope, persisted: PersistedConstantFile = {}) {
		this.store = new ConstantStore(scope, persisted);
	}

	public add<K extends string, V extends SupportedPrimitive>(name: K, defaultValue: V): Constant<AddConstant<T, K, V>> {
		this.store.add(name, defaultValue);
		return this as unknown as Constant<AddConstant<T, K, V>>;
	}

	public build(): Readonly<T> {
		return this.store.build();
	}

	public getDefinitions(): ReadonlyMap<string, ConstantDefinition> {
		return this.store.getDefinitions();
	}

	public getScope(): ConstantScope {
		return this.store.getScope();
	}

	public updateValue<K extends keyof T & string>(name: K, value: T[K] & SupportedPrimitive): void {
		this.store.updateValue(name, value);
	}

	public resetValue<K extends keyof T & string>(name: K): void {
		this.store.resetValue(name);
	}

	public getPersistedSnapshot(): PersistedConstantFile {
		return this.store.getPersistedSnapshot();
	}

	public mountEditor(options: ConstantEditorOptions = {}): () => void {
		return mountConstantEditor(this.store, options);
	}
}

export function createConstant(scope: ConstantScope, persisted?: PersistedConstantFile): Constant {
	return new Constant(scope, persisted);
}
