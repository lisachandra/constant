import { RunService } from "@rbxts/services";

import { createConstantUpdatePayload } from "./bridge";
import { bindConstantEditorHotkey, mountConstantEditor } from "./editor";
import {
	type ConstantReplicatedEditorOptions,
	type ConstantReplicationClientHandle,
	type ConstantReplicationServerHandle,
	createConstantReplicationClient,
	createConstantReplicationServer,
} from "./replication";
import { ConstantStore } from "./store";
import { createBindableEventSink } from "./transport";
import type {
	AddConstant,
	ConfiguredConstantModule,
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
	SupportedPrimitive,
} from "./types";

export {
	createConstantUpdatePayload,
	createMemoryUpdateSink,
	publishConstantUpdate,
} from "./bridge";

export {
	applyReplicationUpdate,
	type AutomaticConstantReplicationOptions,
	configureAutomaticConstantReplication,
	type ConstantReplicationClientHandle,
	type ConstantReplicationServerHandle,
	type ConstantReplicationServerOptions,
	createConstantReplicationClient,
	createConstantReplicationServer,
} from "./replication";

export {
	type EditorSearchInput,
	type EditorSearchResult,
	getEditorSourceLabel,
	normalizeSearchQuery,
	rankEditorGroups,
} from "./search";
export {
	deserializeConstant,
	formatValue,
	inferKind,
	serializeConstant,
	serializedEquals,
	tryReadSerializedValue,
} from "./serialize";
export { ConstantStore } from "./store";
export {
	connectBindableTransport,
	CONSTANT_REPLICATION_EVENT_NAME,
	CONSTANT_TRANSPORT_EVENT_NAME,
	createBindableEventSink,
	getOrCreateReplicatedEditorEvent,
	getOrCreateReplicationEvent,
	getOrCreateTransportEvent,
	publishBindableTransport,
} from "./transport";
export type {
	AddConstant,
	ConfiguredConstantModule,
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantPersistMode,
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	PersistedConstantGroup,
	PrimitiveKind,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

export { isConstantUpdatePayload } from "@lisachandra/constant-protocol";

interface ConstantRuntimeConfiguration {
	editorSetup?: ConstantReplicatedEditorOptions;
	persistedBySource: PersistedConstantFile;
	persistPath: string;
}

const configuredConstants = new Map<ConstantScope, ConstantRuntimeConfiguration>();

function getCurrentScope(): ConstantScope {
	return RunService.IsClient() ? "client" : "server";
}

function getCallerSourcePath(): string {
	return debug.info(3, "s")[0];
}

function normalizeConfiguredModule(persistModule: ConfiguredConstantModule): PersistedConstantFile {
	return persistModule;
}

/**
 * Configures the shared persisted constant entrypoint for the current runtime environment.
 *
 * @param persistPath - The JSON path used by Studio persistence and replication metadata.
 * @param persistModule - The imported persisted JSON module for this environment.
 * @throws If called more than once for the same environment scope.
 */
export function configureConstant(
	persistPath: string,
	persistModule: ConfiguredConstantModule,
	editorSetup?: { keyCode?: Enum.KeyCode; title?: string },
): void {
	const scope = getCurrentScope();
	if (configuredConstants.has(scope)) {
		error(`configureConstant() has already been called for ${scope} scope.`);
	}

	configuredConstants.set(scope, {
		editorSetup,
		persistedBySource: normalizeConfiguredModule(persistModule),
		persistPath,
	});
}

function getConfiguredConstantRuntime(scope: ConstantScope): ConstantRuntimeConfiguration {
	const configured = configuredConstants.get(scope);
	if (!configured) {
		error(
			`Constant for ${scope} scope was created before configureConstant(). Call configureConstant(persistPath, persistModule) first.`,
		);
	}

	return configured;
}

export class Constant<T extends object = object> {
	private clientSnapshotQueued = false;
	private clientSnapshotSeeded = false;
	private readonly editorSetup: undefined | ConstantReplicatedEditorOptions;
	private replicationClientHandle: undefined | ConstantReplicationClientHandle;
	private replicationServerHandle: undefined | ConstantReplicationServerHandle;
	private readonly store: ConstantStore<T>;

	constructor() {
		const scope = getCurrentScope();
		const sourcePath = getCallerSourcePath();
		const configured = getConfiguredConstantRuntime(scope);
		const persisted = configured.persistedBySource[sourcePath] ?? {};
		this.editorSetup = configured.editorSetup;
		this.store = new ConstantStore(scope, persisted, configured.persistPath, sourcePath);

		if (scope === "client" && configured.editorSetup) {
			const { keyCode = Enum.KeyCode.F8, title } = configured.editorSetup;
			task.defer(() => {
				this.bindEditorHotkey(keyCode, { title });
			});
		}
	}

	private ensureAutomaticServerReplication(): void {
		if (!RunService.IsServer()) {
			return;
		}

		if (this.store.getScope() !== "server") {
			return;
		}

		if (!this.replicationServerHandle) {
			this.replicationServerHandle = createConstantReplicationServer(this.store, {
				editor: this.editorSetup,
			});
			return;
		}

		this.replicationServerHandle.broadcastAll();
	}

	private getOrCreateClientReplicationHandle(): undefined | ConstantReplicationClientHandle {
		if (!RunService.IsClient()) {
			return undefined;
		}

		if (this.store.getScope() !== "client") {
			return undefined;
		}

		this.replicationClientHandle ??= createConstantReplicationClient(this.store);
		return this.replicationClientHandle;
	}

	private seedClientReplicationSnapshot(): void {
		if (this.clientSnapshotSeeded) {
			return;
		}

		const replication = this.getOrCreateClientReplicationHandle();
		if (!replication) {
			return;
		}

		for (const [name, definition] of this.store.getDefinitions()) {
			replication.requestUpdate(
				createConstantUpdatePayload(
					this.store.getScope(),
					name,
					definition.currentValue,
					definition.defaultValue,
					this.store.getSourcePath(),
					this.store.getPersistPath(),
				),
			);
		}

		this.clientSnapshotSeeded = true;
	}

	private scheduleClientSnapshotSeed(): void {
		if (!RunService.IsClient()) {
			return;
		}

		if (this.store.getScope() !== "client") {
			return;
		}

		if (this.clientSnapshotSeeded || this.clientSnapshotQueued) {
			return;
		}

		this.clientSnapshotQueued = true;
		task.defer(() => {
			this.clientSnapshotQueued = false;
			this.seedClientReplicationSnapshot();
		});
	}

	private resolvePersistHandler(
		options: ConstantEditorOptions,
	): undefined | ((payload: ConstantUpdatePayload) => void) {
		if (options.onPersist) {
			return options.onPersist;
		}

		if (RunService.IsClient()) {
			const replication = this.getOrCreateClientReplicationHandle();
			if (replication) {
				this.seedClientReplicationSnapshot();
				return (payload) => {
					replication.requestUpdate(payload);
				};
			}
		}

		if (RunService.IsServer()) {
			const sink = createBindableEventSink();
			return (payload) => {
				sink.publish(payload);
			};
		}

		return undefined;
	}

	public add<K extends string, V extends SupportedPrimitive>(
		name: K,
		defaultValue: V,
	): Constant<AddConstant<T, K, V>> {
		this.store.add(name, defaultValue);
		this.ensureAutomaticServerReplication();
		this.scheduleClientSnapshotSeed();
		return this as unknown as Constant<AddConstant<T, K, V>>;
	}

	public build(): Readonly<T> {
		return this.store.build();
	}

	public getDefinitions(): ReadonlyMap<string, ConstantDefinition> {
		return this.store.getDefinitions();
	}

	public subscribe(listener: (values: Readonly<T>) => void): () => void {
		return this.store.subscribe(() => {
			listener(this.store.build());
		});
	}

	public getScope(): ConstantScope {
		return this.store.getScope();
	}

	public updateValue<K extends keyof T & string>(
		name: K,
		value: SupportedPrimitive & T[K],
	): void {
		this.store.updateValue(name, value);
	}

	public resetValue(name: keyof T & string): void {
		this.store.resetValue(name);
	}

	/**
	 * Reapplies the current script default for a single constant as a live override.
	 *
	 * @param name - Constant name to reapply.
	 */
	public reapplyDefault(name: keyof T & string): void {
		this.store.reapplyDefault(name);
	}

	/**
	 * Reapplies the current script defaults for all drifted constants as live overrides.
	 *
	 * @returns Names of constants that were reapplied.
	 */
	public reapplyDriftedDefaults(): ReadonlyArray<string> {
		return this.store.reapplyDriftedDefaults();
	}

	public getPersistedSnapshot(): PersistedConstantGroup {
		return this.store.getPersistedSnapshot();
	}

	public getPersistPath(): string | undefined {
		return this.store.getPersistPath();
	}

	public mountEditor(options: ConstantEditorOptions = {}): () => void {
		return mountConstantEditor(this.store, {
			...options,
			onPersist: this.resolvePersistHandler(options),
		});
	}

	/**
	 * Binds a hotkey that toggles this constant editor open and closed.
	 *
	 * @example
	 * 	```ts
	 * 	const cleanup = constants.bindEditorHotkey(Enum.KeyCode.F8, {
	 * 		title: "Client Constants",
	 * 	});
	 * 	const disconnect = constants.subscribe((values) => print(values));
	 * 	```;
	 *
	 * @param keyCode - Keyboard key that toggles the editor.
	 * @param options - Editor options passed through when mounting.
	 * @returns Cleanup function that disconnects the hotkey and closes the editor.
	 */
	public bindEditorHotkey(
		keyCode: Enum.KeyCode,
		options: ConstantEditorOptions = {},
	): () => void {
		return bindConstantEditorHotkey(this.store, keyCode, {
			...options,
			onPersist: this.resolvePersistHandler(options),
		});
	}
}
