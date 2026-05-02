import { Players, ReplicatedStorage } from "@rbxts/services";
import { createConstantUpdatePayload, type ConstantUpdateSink } from "./bridge";
import {
	getOrCreateReplicatedEditorEvent,
	isReplicatedEditorRegistrationPayload,
	type ReplicatedEditorDefinitionPayload,
	type ReplicatedEditorRegistrationPayload,
} from "./editor-transport";
import { deserializeConstant, inferKind, serializeConstant, serializedEquals, tryReadSerializedValue } from "./serialize";
import { createBindableEventSink } from "./transport";
import { ConstantStore } from "./store";
import type {
	ConstantDefinition,
	ConstantScope,
	ConstantUpdatePayload,
	PersistedConstantFile,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

export interface AutomaticConstantReplicationOptions {
	canEdit?: (player: Player, request: ConstantReplicationRequest, constant?: ConstantStore<object>) => boolean;
}

let automaticConstantReplicationOptions: AutomaticConstantReplicationOptions = {};
let automaticClientReplicationConnection: RBXScriptConnection | undefined;
const automaticClientStores = new Map<string, ConstantStore<object>>();

export const CONSTANT_REPLICATION_FOLDER_NAME = "constantReplication";
export const CONSTANT_REPLICATION_REQUEST_EVENT_NAME = "constantReplication";
export const CONSTANT_REPLICATION_UPDATE_EVENT_NAME = "constantReplication";

export interface ConstantReplicationRequest extends ConstantUpdatePayload {}
export interface ConstantReplicationUpdate extends ConstantUpdatePayload {}

export interface ConstantReplicationServerOptions<T extends object = object> {
	requestEvent?: RemoteEvent;
	updateEvent?: RemoteEvent;
	syncOnPlayerAdded?: boolean;
	canEdit?: (player: Player, request: ConstantReplicationRequest, constant: ConstantStore<T>) => boolean;
	onApprovedUpdate?: (player: Player, update: ConstantReplicationUpdate, constant: ConstantStore<T>) => void;
}

export interface ConstantReplicationClientOptions {
	requestEvent?: RemoteEvent;
	updateEvent?: RemoteEvent;
}

export function configureAutomaticConstantReplication(options: AutomaticConstantReplicationOptions = {}): void {
	automaticConstantReplicationOptions = options;
}

function getAutomaticCanEdit(
	player: Player,
	request: ConstantReplicationRequest,
	constant?: ConstantStore<object>,
): boolean {
	return automaticConstantReplicationOptions.canEdit?.(player, request, constant) ?? true;
}

function deserializeSerializedValue(serialized: SerializedConstant): SupportedPrimitive {
	if (serialized === undefined) return undefined;
	if (typeIs(serialized, "number") || typeIs(serialized, "string") || typeIs(serialized, "boolean")) return serialized;
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
		const enumType = Enum.GetEnums().find((candidate) => tostring(candidate) === serialized.enum);
		return enumType?.GetEnumItems().find((candidate) => candidate.Name === serialized.item);
	}
	return undefined;
}

function createPersistedFromRegistration(payload: ReplicatedEditorRegistrationPayload): PersistedConstantFile {
	const persisted: PersistedConstantFile = { _defaults: {} };
	for (const definition of payload.definitions) {
		persisted[definition.name] = definition.serializedCurrent;
		persisted._defaults![definition.name] = definition.serializedDefault;
	}
	return persisted;
}

function createStoreFromRegistration(payload: ReplicatedEditorRegistrationPayload): ConstantStore<object> {
	const persistPath = payload.persistPath;
	let store = new ConstantStore<object>(payload.scope, createPersistedFromRegistration(payload), persistPath, payload.sourcePath);
	for (const definition of payload.definitions) {
		const defaultValue = deserializeSerializedValue(definition.serializedDefault);
		store = store.add(definition.name, defaultValue);
	}
	return store;
}

function isReplicationBootstrapPayload(value: unknown): value is ReplicatedEditorRegistrationPayload {
	if (!isReplicatedEditorRegistrationPayload(value)) return false;
	const payload = value as Partial<ReplicatedEditorRegistrationPayload>;
	return payload.persistPath === undefined || typeIs(payload.persistPath, "string");
}


function publishConstantSnapshot<T extends object>(constant: ConstantStore<T>): void {
	const sink = createBindableEventSink();
	for (const [name, definition] of constant.getDefinitions()) {
		sink.publish(
			createConstantUpdatePayload(
				constant.getScope(),
				name,
				definition.currentValue,
				definition.defaultValue,
				constant.getPersistPath(),
			),
		);
	}
}

function ensureAutomaticClientReplicationRelay(): void {
	if (!game.GetService("RunService").IsServer()) return;
	if (automaticClientReplicationConnection) return;

	const requestEvent = getOrCreateReplicationRequestEvent();
	const updateEvent = getOrCreateReplicationUpdateEvent();
	const editorEvent = getOrCreateReplicatedEditorEvent();
	const persistSink = createBindableEventSink();
	automaticClientReplicationConnection = requestEvent.OnServerEvent.Connect((player, payload) => {
		if (isReplicationBootstrapPayload(payload)) {
			const mirroredStore = createStoreFromRegistration(payload);
			automaticClientStores.set(payload.id, mirroredStore);
			editorEvent.FireAllClients(payload);
			publishConstantSnapshot(mirroredStore);
			for (const [name, definition] of mirroredStore.getDefinitions()) {
				updateEvent.FireAllClients(
					createConstantUpdatePayload(
						mirroredStore.getScope(),
						name,
						definition.currentValue,
						definition.defaultValue,
						mirroredStore.getPersistPath(),
					),
				);
			}
			return;
		}

		if (!isReplicationPayload(payload)) return;
		if (payload.scope !== "client") return;
		if (!getAutomaticCanEdit(player, payload)) return;

		const persistPath = payload.persistPath;
		let mirroredStore: ConstantStore<object> | undefined;
		if (persistPath !== undefined) {
			for (const [, candidate] of automaticClientStores) {
				if (candidate.getPersistPath() === persistPath) {
					mirroredStore = candidate;
					break;
				}
			}
		}
		if (mirroredStore) {
			applyReplicationUpdate(mirroredStore, payload);
		}

		persistSink.publish(payload);
		updateEvent.FireAllClients(payload);
	});
}


export interface ConstantReplicationServerHandle {
	broadcastAll(player?: Player): void;
	disconnect(): void;
}

export interface ConstantReplicationClientHandle {
	requestUpdate(request: ConstantReplicationRequest): void;
	createRequestSink(): ConstantUpdateSink;
	disconnect(): void;
}

function getOrCreateReplicationEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	const existing = parent.FindFirstChild(CONSTANT_REPLICATION_REQUEST_EVENT_NAME);
	if (existing?.IsA("RemoteEvent")) return existing;

	const event = new Instance("RemoteEvent");
	event.Name = CONSTANT_REPLICATION_REQUEST_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function getOrCreateReplicationRequestEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	return getOrCreateReplicationEvent(parent);
}

export function getOrCreateReplicationUpdateEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	return getOrCreateReplicationEvent(parent);
}

function isReplicationPayload(value: unknown): value is ConstantUpdatePayload {
	if (!typeIs(value, "table")) return false;
	const payload = value as Partial<ConstantUpdatePayload>;
	return (
		(payload.scope === "client" || payload.scope === "server") &&
		typeIs(payload.name, "string") &&
		("serializedValue" in payload) &&
		("serializedDefault" in payload)
	);
}

function canApplySerializedValue(definition: ConstantDefinition, serializedValue: unknown): serializedValue is SerializedConstant {
	if (serializedValue === undefined) {
		return definition.kind === "undefined";
	}

	const normalized = tryReadSerializedValue(serializedValue as SerializedConstant | Record<string, SerializedConstant> | undefined);
	if (normalized === undefined) return false;
	const nextValue = deserializeConstant(normalized, definition.defaultValue);
	return inferKind(nextValue) === definition.kind && serializedEquals(serializeConstant(nextValue), normalized);
}

export function applyReplicationUpdate<T extends object>(
	constant: ConstantStore<T>,
	payload: ConstantReplicationUpdate,
): boolean {
	if (payload.scope !== constant.getScope()) return false;
	const definition = constant.getDefinitions().get(payload.name);
	if (!definition || !canApplySerializedValue(definition, payload.serializedValue)) return false;

	const nextValue = deserializeConstant(payload.serializedValue, definition.defaultValue) as T[keyof T & string] & SupportedPrimitive;
	constant.updateValue(payload.name as keyof T & string, nextValue);
	return true;
}

function createReplicatedEditorRegistrationPayload<T extends object>(constant: ConstantStore<T>): ReplicatedEditorRegistrationPayload {
	const definitions = new Array<ReplicatedEditorDefinitionPayload>();
	for (const [name, definition] of constant.getDefinitions()) {
		definitions.push({
			name,
			serializedDefault: serializeConstant(definition.defaultValue),
			serializedCurrent: serializeConstant(definition.currentValue),
		});
	}

	return {
		action: "register",
		id: `${constant.getScope()}:${constant.getPersistPath()}:${constant.getSourcePath()}`,
		scope: constant.getScope(),
		sourcePath: constant.getSourcePath(),
		persistPath: constant.getPersistPath(),
		title: "Constants",
		persistMode: constant.getScope() === "server" ? "auto" : "manual",
		keyCodeName: "F8",
		definitions,
	};
}

export function createConstantReplicationServer<T extends object>(
	constant: ConstantStore<T>,
	options: ConstantReplicationServerOptions<T> = {},
): ConstantReplicationServerHandle {
	const requestEvent = options.requestEvent ?? getOrCreateReplicationRequestEvent();
	const updateEvent = options.updateEvent ?? getOrCreateReplicationUpdateEvent();
	const editorEvent = getOrCreateReplicatedEditorEvent();
	const persistSink = createBindableEventSink();
	ensureAutomaticClientReplicationRelay();

	const broadcastAll = (player?: Player) => {
		const registrationPayload = createReplicatedEditorRegistrationPayload(constant);
		if (player) {
			editorEvent.FireClient(player, registrationPayload);
		} else {
			editorEvent.FireAllClients(registrationPayload);
		}

		for (const [name, definition] of constant.getDefinitions()) {
			const payload = createConstantUpdatePayload(
				constant.getScope(),
				name,
				definition.currentValue,
				definition.defaultValue,
				constant.getPersistPath(),
			);
			if (player) {
				updateEvent.FireClient(player, payload);
			} else {
				updateEvent.FireAllClients(payload);
			}
		}
	};

	const requestConnection = requestEvent.OnServerEvent.Connect((player, payload) => {
		if (!isReplicationPayload(payload)) return;
		if (payload.scope !== constant.getScope()) return;
		if (
			options.canEdit
				? !options.canEdit(player, payload, constant)
				: !getAutomaticCanEdit(player, payload, constant as ConstantStore<object>)
		) return;
		if (!applyReplicationUpdate(constant, payload)) return;

		const approvedDefinition = constant.getDefinitions().get(payload.name);
		if (!approvedDefinition) return;
		const approvedPayload = createConstantUpdatePayload(
			constant.getScope(),
			payload.name,
			approvedDefinition.currentValue,
			approvedDefinition.defaultValue,
			constant.getPersistPath(),
		);
		persistSink.publish(approvedPayload);
		options.onApprovedUpdate?.(player, approvedPayload, constant);
		updateEvent.FireAllClients(approvedPayload);
	});

	publishConstantSnapshot(constant);

	const playerConnection = (options.syncOnPlayerAdded ?? true)
		? Players.PlayerAdded.Connect((player) => broadcastAll(player))
		: undefined;

	return {
		broadcastAll(player) {
			broadcastAll(player);
			if (!player) publishConstantSnapshot(constant);
		},
		disconnect() {
			requestConnection.Disconnect();
			playerConnection?.Disconnect();
		},
	};
}

export function createConstantReplicationClient<T extends object>(
	constant: ConstantStore<T>,
	options: ConstantReplicationClientOptions = {},
): ConstantReplicationClientHandle {
	const requestEvent = options.requestEvent ?? getOrCreateReplicationRequestEvent();
	const updateEvent = options.updateEvent ?? getOrCreateReplicationUpdateEvent();
	const bootstrapPayload = createReplicatedEditorRegistrationPayload(constant);

	const updateConnection = updateEvent.OnClientEvent.Connect((payload) => {
		if (!isReplicationPayload(payload)) return;
		applyReplicationUpdate(constant, payload);
	});

	requestEvent.FireServer(bootstrapPayload);

	return {
		requestUpdate(request) {
			if (!isReplicationPayload(request)) return;
			if (request.scope !== constant.getScope()) return;
			requestEvent.FireServer(request);
		},
		createRequestSink() {
			const handle = this;
			return {
				publish(payload) {
					return handle.requestUpdate(payload);
				},
			};
		},
		disconnect() {
			updateConnection.Disconnect();
		},
	};
}
