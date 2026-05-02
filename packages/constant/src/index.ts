import { RunService } from "@rbxts/services";

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
export {
	CONSTANT_REPLICATION_FOLDER_NAME,
	CONSTANT_REPLICATION_REQUEST_EVENT_NAME,
	CONSTANT_REPLICATION_UPDATE_EVENT_NAME,
	applyReplicationUpdate,
	configureAutomaticConstantReplication,
	createConstantReplicationClient,
	createConstantReplicationServer,
	getOrCreateReplicationRequestEvent,
	getOrCreateReplicationUpdateEvent,
	type AutomaticConstantReplicationOptions,
	type ConstantReplicationClientHandle,
	type ConstantReplicationClientOptions,
	type ConstantReplicationServerHandle,
	type ConstantReplicationServerOptions,
} from "./replication";
import { bindConstantEditorHotkey, mountConstantEditor } from "./editor";
export { ConstantStore } from "./store";
import { ConstantStore } from "./store";
import { createConstantUpdatePayload } from "./bridge";
import { createBindableEventSink } from "./transport";
import { createConstantReplicationClient, createConstantReplicationServer, type ConstantReplicationClientHandle, type ConstantReplicationServerHandle } from "./replication";
import type {
	AddConstant,
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	SupportedPrimitive,
} from "./types";

export class Constant<T extends object = {}> {
	private readonly store: ConstantStore<T>;
	private replicationClientHandle: ConstantReplicationClientHandle | undefined;
	private replicationServerHandle: ConstantReplicationServerHandle | undefined;
	private clientSnapshotSeeded = false;
	private clientSnapshotQueued = false;

	public constructor(persistPath: string);
	public constructor(persistPath: string) {
		const scope = RunService.IsClient() ? "client" : "server";
		const sourcePath = `${debug.info(3, "s")[0]}`

		this.store = new ConstantStore(scope, {}, persistPath, sourcePath);
	}

	private ensureAutomaticServerReplication(): void {
		if (!RunService.IsServer()) return;
		if (this.store.getScope() !== "server") return;
		if (!this.store.getPersistPath()) return;
		if (!this.replicationServerHandle) {
			this.replicationServerHandle = createConstantReplicationServer(this.store);
			return;
		}
		this.replicationServerHandle.broadcastAll();
	}

	private getOrCreateClientReplicationHandle(): ConstantReplicationClientHandle | undefined {
		if (!RunService.IsClient()) return undefined;
		if (this.store.getScope() !== "client") return undefined;
		if (!this.store.getPersistPath()) return undefined;
		this.replicationClientHandle ??= createConstantReplicationClient(this.store);
		return this.replicationClientHandle;
	}

	private seedClientReplicationSnapshot(): void {
		if (this.clientSnapshotSeeded) return;
		const replication = this.getOrCreateClientReplicationHandle();
		if (!replication) return;
		for (const [name, definition] of this.store.getDefinitions()) {
			replication.requestUpdate(
				createConstantUpdatePayload(
					this.store.getScope(),
					name,
					definition.currentValue,
					definition.defaultValue,
					this.store.getPersistPath(),
				),
			);
		}
		this.clientSnapshotSeeded = true;
	}

	private scheduleClientSnapshotSeed(): void {
		if (!RunService.IsClient()) return;
		if (this.store.getScope() !== "client") return;
		if (!this.store.getPersistPath()) return;
		if (this.clientSnapshotSeeded || this.clientSnapshotQueued) return;

		this.clientSnapshotQueued = true;
		task.defer(() => {
			this.clientSnapshotQueued = false;
			this.seedClientReplicationSnapshot();
		});
	}

	private resolvePersistHandler(options: ConstantEditorOptions): ((payload: ConstantUpdatePayload) => void) | undefined {
		if (options.onPersist) return options.onPersist;

		if (RunService.IsClient()) {
			const replication = this.getOrCreateClientReplicationHandle();
			if (replication) {
				this.seedClientReplicationSnapshot();
				return (payload) => replication.requestUpdate(payload);
			}
		}

		if (RunService.IsServer()) {
			const sink = createBindableEventSink();
			return (payload) => sink.publish(payload);
		}

		return undefined;
	}

	public add<K extends string, V extends SupportedPrimitive>(name: K, defaultValue: V): Constant<AddConstant<T, K, V>> {
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
		return this.store.subscribe(() => listener(this.store.build()));
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
	 * @param keyCode - Keyboard key that toggles the editor.
	 * @param options - Editor options passed through when mounting.
	 * @returns Cleanup function that disconnects the hotkey and closes the editor.
	 * @example
	 * ```ts
	 * const cleanup = constants.bindEditorHotkey(Enum.KeyCode.F8, { title: "Client Constants" });
	 * const disconnect = constants.subscribe((values) => print(values));
	 * ```
	 */
	public bindEditorHotkey(keyCode: Enum.KeyCode, options: ConstantEditorOptions = {}): () => void {
		return bindConstantEditorHotkey(this.store, keyCode, {
			...options,
			onPersist: this.resolvePersistHandler(options),
		});
	}
}
