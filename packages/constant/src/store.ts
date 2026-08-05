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
	PersistedConstantGroup,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

export class ConstantStore<T extends object = object> {
	private readonly definitions = new Map<string, ConstantDefinition>();
	private readonly listeners = new Set<() => void>();
	private readonly liveOverrides = new Map<string, SupportedPrimitive>();
	private readonly values = {} as T;

	constructor(
		private readonly scope: ConstantScope,
		private readonly persisted: PersistedConstantGroup,
		private readonly persistPath: string,
		private sourcePath: string,
	) {}

	public add<K extends string, V extends SupportedPrimitive>(
		name: K,
		defaultValue: V,
	): ConstantStore<AddConstant<T, K, V>> {
		if (this.definitions.has(name)) {
			error(`Duplicate constant definition in ${this.sourcePath}: ${name}`);
		}

		const definition = this.createDefinition(name, defaultValue);
		this.definitions.set(name, definition);
		(this.values as Record<string, SupportedPrimitive>)[name] = definition.currentValue;
		return this as unknown as ConstantStore<AddConstant<T, K, V>>;
	}

	public build(): Readonly<T> {
		return table.freeze({ ...this.values });
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

	public updateValue<K extends keyof T & string>(
		name: K,
		value: SupportedPrimitive & T[K],
	): void {
		const definition = this.definitions.get(name);
		if (!definition) {
			error(`Unknown constant: ${name}`);
		}

		definition.currentValue = value;
		definition.hasLiveOverride = true;
		(this.values as Record<string, SupportedPrimitive>)[name] = value;
		this.liveOverrides.set(name, value);
		this.notifyListeners();
	}

	public resetValue(name: keyof T & string): void {
		const definition = this.definitions.get(name);
		if (!definition) {
			error(`Unknown constant: ${name}`);
		}

		const nextValue = definition.persistedValue ?? definition.defaultValue;
		definition.currentValue = nextValue;
		definition.hasLiveOverride = false;
		(this.values as Record<string, SupportedPrimitive>)[name] = nextValue;
		this.liveOverrides.delete(name);
		this.notifyListeners();
	}

	public reapplyDefault(name: keyof T & string): void {
		const definition = this.definitions.get(name);
		if (!definition) {
			error(`Unknown constant: ${name}`);
		}

		definition.currentValue = definition.defaultValue;
		definition.hasLiveOverride = true;
		(this.values as Record<string, SupportedPrimitive>)[name] = definition.defaultValue;
		this.liveOverrides.set(name, definition.defaultValue);
		this.notifyListeners();
	}

	public reapplyDriftedDefaults(): ReadonlyArray<string> {
		const reapplied = new Array<string>();
		for (const [name, definition] of this.definitions) {
			if (!definition.defaultDrifted) {
				continue;
			}

			definition.currentValue = definition.defaultValue;
			definition.hasLiveOverride = true;
			(this.values as Record<string, SupportedPrimitive>)[name] = definition.defaultValue;
			this.liveOverrides.set(name, definition.defaultValue);
			reapplied.push(name);
		}

		if (reapplied.size() > 0) {
			this.notifyListeners();
		}

		return reapplied;
	}

	public getPersistedSnapshot(): PersistedConstantGroup {
		const defaults: Record<string, SerializedConstant> = {};
		const output: PersistedConstantGroup = { _defaults: defaults };
		for (const [name, definition] of this.definitions) {
			output[name] = serializeConstant(definition.currentValue);
			defaults[name] = serializeConstant(definition.defaultValue);
		}

		return output;
	}

	private createDefinition<V extends SupportedPrimitive>(
		name: string,
		defaultValue: V,
	): ConstantDefinition<V> {
		const persistedValue = tryReadSerializedValue(this.persisted[name]);
		const persistedDefault = tryReadSerializedValue(this.persisted._defaults?.[name]);
		const serializedDefault = serializeConstant(defaultValue);
		const defaultDrifted =
			persistedDefault !== undefined &&
			!serializedEquals(persistedDefault, serializedDefault);
		const shouldMigratePersistedDefault =
			persistedValue !== undefined &&
			persistedDefault !== undefined &&
			serializedEquals(persistedValue, persistedDefault) &&
			defaultDrifted;
		const resolvedPersisted = deserializeConstant(persistedValue, defaultValue) as V;
		const effectivePersistedValue = shouldMigratePersistedDefault
			? defaultValue
			: resolvedPersisted;
		const liveOverride = this.liveOverrides.get(name) as V | undefined;
		const currentValue =
			liveOverride ?? (persistedValue !== undefined ? effectivePersistedValue : defaultValue);

		return {
			currentValue,
			defaultDrifted,
			defaultValue,
			hasLiveOverride: liveOverride !== undefined,
			hasPersistedValue: persistedValue !== undefined,
			kind: inferKind(defaultValue),
			name,
			persistedValue: persistedValue !== undefined ? effectivePersistedValue : undefined,
			scope: this.scope,
		};
	}
}
