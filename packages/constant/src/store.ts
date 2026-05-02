import {
	deserializeConstant,
	inferKind,
	serializeConstant,
	serializedEquals,
	tryReadSerializedValue,
} from "./serialize";
import type {
	AddConstant,
	ConstantDefinition,
	ConstantScope,
	PersistedConstantFile,
	SupportedPrimitive,
} from "./types";

export class ConstantStore<T extends object = {}> {
	private readonly definitions = new Map<string, ConstantDefinition>();
	private readonly values = {} as T;
	private readonly liveOverrides = new Map<string, SupportedPrimitive>();
	private readonly listeners = new Set<() => void>();

	public constructor(
		private readonly scope: ConstantScope,
		private readonly persisted: PersistedConstantFile = {},
		private readonly persistPath: string,
		private sourcePath: string,
	) {}

	public add<K extends string, V extends SupportedPrimitive>(name: K, defaultValue: V): ConstantStore<AddConstant<T, K, V>> {
		if (this.definitions.has(name)) {
			error(`Duplicate constant definition: ${name}`);
		}

		const definition = this.createDefinition(name, defaultValue);
		this.definitions.set(name, definition);
		(this.values as Record<string, SupportedPrimitive>)[name] = definition.currentValue;
		return this as unknown as ConstantStore<AddConstant<T, K, V>>;
	}

	public build(): Readonly<T> {
		return this.values;
	}

	public subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}


	public getDefinitions(): ReadonlyMap<string, ConstantDefinition> {
		return this.definitions;
	}

	public getScope(): ConstantScope {
		return this.scope;
	}

	public getPersistPath(): string {
		return this.persistPath;
	}

	public getSourcePath(): string {
		return this.sourcePath;
	}

	public setSourcePath(sourcePath: string): void {
		this.sourcePath = sourcePath;
	}

	private notifyListeners(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}


	public updateValue<K extends keyof T & string>(name: K, value: T[K] & SupportedPrimitive): void {
		const definition = this.definitions.get(name);
		if (!definition) error(`Unknown constant: ${name}`);
		definition.currentValue = value;
		definition.hasLiveOverride = true;
		(this.values as Record<string, SupportedPrimitive>)[name] = value;
		this.liveOverrides.set(name, value);
		this.notifyListeners();
	}

	public resetValue<K extends keyof T & string>(name: K): void {
		const definition = this.definitions.get(name);
		if (!definition) error(`Unknown constant: ${name}`);
		const nextValue = definition.persistedValue !== undefined ? definition.persistedValue : definition.defaultValue;
		definition.currentValue = nextValue;
		definition.hasLiveOverride = false;
		(this.values as Record<string, SupportedPrimitive>)[name] = nextValue;
		this.liveOverrides.delete(name);
		this.notifyListeners();
	}

	public getPersistedSnapshot(): PersistedConstantFile {
		const output: PersistedConstantFile = { _defaults: {} };
		for (const [name, definition] of this.definitions) {
			output[name] = serializeConstant(definition.currentValue);
			output._defaults![name] = serializeConstant(definition.defaultValue);
		}
		return output;
	}

	private createDefinition<V extends SupportedPrimitive>(name: string, defaultValue: V): ConstantDefinition<V> {
		const persistedValue = tryReadSerializedValue(this.persisted[name]);
		const persistedDefault = tryReadSerializedValue(this.persisted._defaults?.[name]);
		const defaultDrifted = persistedDefault !== undefined && !serializedEquals(persistedDefault, serializeConstant(defaultValue));
		const resolvedPersisted = deserializeConstant(persistedValue, defaultValue) as V;
		const liveOverride = this.liveOverrides.get(name) as V | undefined;
		const currentValue = liveOverride ?? (persistedValue !== undefined ? resolvedPersisted : defaultValue);

		return {
			name,
			scope: this.scope,
			kind: inferKind(defaultValue),
			defaultValue,
			persistedValue: persistedValue !== undefined ? resolvedPersisted : undefined,
			hasPersistedValue: persistedValue !== undefined,
			defaultDrifted,
			currentValue,
			hasLiveOverride: liveOverride !== undefined,
		};
	}
}
