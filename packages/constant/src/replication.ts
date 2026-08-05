import { isConstantUpdatePayload as isReplicationPayload } from "@lisachandra/constant-protocol";
import { Players, RunService } from "@rbxts/services";

import { type ConstantUpdateSink, createConstantUpdatePayload } from "./bridge";
import { createEditorId, createStoreFromRegistration } from "./registration";
import {
	deserializeConstant,
	inferKind,
	serializeConstant,
	serializedEquals,
	tryReadSerializedValue,
} from "./serialize";
import type { ConstantStore } from "./store";
import {
	createBindableEventSink,
	getOrCreateReplicatedEditorEvent,
	getOrCreateReplicationEvent,
	isReplicatedEditorRegistrationPayload,
	type ReplicatedEditorDefinitionPayload,
	type ReplicatedEditorRegistrationPayload,
} from "./transport";
import type {
	ConstantDefinition,
	ConstantUpdatePayload,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

export interface ConstantReplicatedEditorOptions {
	keyCode?: Enum.KeyCode;
	title?: string;
}

export interface AutomaticConstantReplicationOptions {
	canEdit?: (
		player: Player,
		request: ConstantReplicationRequest,
		constant?: ConstantStore,
	) => boolean;
	editor?: ConstantReplicatedEditorOptions;
}

let automaticConstantReplicationOptions: AutomaticConstantReplicationOptions = {};
let automaticClientReplicationConnection: undefined | RBXScriptConnection;
const automaticClientStores = new Map<string, ConstantStore>();

export type ConstantReplicationRequest = ConstantUpdatePayload;
export type ConstantReplicationUpdate = ConstantUpdatePayload;

export interface ConstantReplicationServerOptions<T extends object = object> {
	canEdit?: (
		player: Player,
		request: ConstantReplicationRequest,
		constant: ConstantStore<T>,
	) => boolean;
	editor?: ConstantReplicatedEditorOptions;
	onApprovedUpdate?: (
		player: Player,
		update: ConstantReplicationUpdate,
		constant: ConstantStore<T>,
	) => void;
	syncOnPlayerAdded?: boolean;
}

export function configureAutomaticConstantReplication(
	options: AutomaticConstantReplicationOptions = {},
): void {
	automaticConstantReplicationOptions = options;
	ensureAutomaticClientReplicationRelay();
}

function getAutomaticCanEdit(
	player: Player,
	request: ConstantReplicationRequest,
	constant?: ConstantStore,
): boolean {
	return automaticConstantReplicationOptions.canEdit?.(player, request, constant) ?? true;
}

function isReplicationBootstrapPayload(
	value: unknown,
): value is ReplicatedEditorRegistrationPayload {
	if (!isReplicatedEditorRegistrationPayload(value)) {
		return false;
	}

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
				constant.getSourcePath(),
				constant.getPersistPath(),
			),
		);
	}
}

function getStoreKey(sourcePath: string, persistPath?: string): string {
	return `${persistPath ?? ""}:${sourcePath}`;
}

function ensureAutomaticClientReplicationRelay(): void {
	if (!RunService.IsServer()) {
		return;
	}

	if (automaticClientReplicationConnection) {
		automaticClientReplicationConnection.Disconnect();
		automaticClientReplicationConnection = undefined;
	}

	const requestEvent = getOrCreateReplicationEvent();
	const updateEvent = getOrCreateReplicationEvent();
	const editorEvent = getOrCreateReplicatedEditorEvent();
	const persistSink = createBindableEventSink();
	automaticClientReplicationConnection = requestEvent.OnServerEvent.Connect((player, payload) => {
		if (isReplicationBootstrapPayload(payload)) {
			const mirroredStore = createStoreFromRegistration(payload);
			automaticClientStores.set(
				getStoreKey(payload.sourcePath, payload.persistPath),
				mirroredStore,
			);
			editorEvent.FireAllClients(payload);
			publishConstantSnapshot(mirroredStore);
			for (const [name, definition] of mirroredStore.getDefinitions()) {
				updateEvent.FireAllClients(
					createConstantUpdatePayload(
						mirroredStore.getScope(),
						name,
						definition.currentValue,
						definition.defaultValue,
						mirroredStore.getSourcePath(),
						mirroredStore.getPersistPath(),
					),
				);
			}

			return;
		}

		if (!isReplicationPayload(payload)) {
			return;
		}

		if (payload.scope !== "client") {
			return;
		}

		if (!getAutomaticCanEdit(player, payload)) {
			return;
		}

		const mirroredStore = automaticClientStores.get(
			getStoreKey(payload.sourcePath, payload.persistPath),
		);
		if (!mirroredStore) {
			return;
		}

		if (!getAutomaticCanEdit(player, payload, mirroredStore)) {
			return;
		}

		applyReplicationUpdate(mirroredStore, payload);
		persistSink.publish(payload);
		updateEvent.FireAllClients(payload);
	});
}

export interface ConstantReplicationServerHandle {
	broadcastAll(player?: Player): void;
	disconnect(): void;
}

export interface ConstantReplicationClientHandle {
	createRequestSink(): ConstantUpdateSink;
	disconnect(): void;
	requestUpdate(request: ConstantReplicationRequest): void;
}

function canApplySerializedValue(
	definition: ConstantDefinition,
	serializedValue: unknown,
): serializedValue is SerializedConstant {
	if (serializedValue === undefined) {
		return definition.kind === "undefined";
	}

	const normalized = tryReadSerializedValue(
		serializedValue as undefined | SerializedConstant | Record<string, SerializedConstant>,
	);
	if (normalized === undefined) {
		return false;
	}

	const nextValue = deserializeConstant(normalized, definition.defaultValue);
	return (
		inferKind(nextValue) === definition.kind &&
		serializedEquals(serializeConstant(nextValue), normalized)
	);
}

export function applyReplicationUpdate<T extends object>(
	constant: ConstantStore<T>,
	payload: ConstantReplicationUpdate,
): boolean {
	if (payload.scope !== constant.getScope()) {
		return false;
	}

	if (payload.sourcePath !== constant.getSourcePath()) {
		return false;
	}

	if (payload.persistPath !== constant.getPersistPath()) {
		return false;
	}

	const definition = constant.getDefinitions().get(payload.name);
	if (!definition || !canApplySerializedValue(definition, payload.serializedValue)) {
		return false;
	}

	const nextValue = deserializeConstant(
		payload.serializedValue,
		definition.defaultValue,
	) as SupportedPrimitive & T[keyof T & string];
	constant.updateValue(payload.name as keyof T & string, nextValue);
	return true;
}

function createReplicatedEditorRegistrationPayload<T extends object>(
	constant: ConstantStore<T>,
	editor?: ConstantReplicatedEditorOptions,
): ReplicatedEditorRegistrationPayload {
	const definitions = new Array<ReplicatedEditorDefinitionPayload>();
	for (const [name, definition] of constant.getDefinitions()) {
		definitions.push({
			name,
			serializedCurrent: serializeConstant(definition.currentValue),
			serializedDefault: serializeConstant(definition.defaultValue),
		});
	}

	const keyCode =
		editor?.keyCode ?? (constant.getScope() === "server" ? Enum.KeyCode.F8 : undefined);
	return {
		action: "register",
		definitions,
		id: createEditorId(
			constant.getScope(),
			constant.getPersistPath(),
			constant.getSourcePath(),
		),
		keyCodeName: keyCode?.Name,
		persistMode: constant.getScope() === "server" ? "auto" : "manual",
		persistPath: constant.getPersistPath(),
		scope: constant.getScope(),
		sourcePath: constant.getSourcePath(),
		title: editor?.title ?? "Constants",
	};
}

export function createConstantReplicationServer<T extends object>(
	constant: ConstantStore<T>,
	options: ConstantReplicationServerOptions<T> = {},
): ConstantReplicationServerHandle {
	const requestEvent = getOrCreateReplicationEvent();
	const updateEvent = getOrCreateReplicationEvent();
	const editorEvent = getOrCreateReplicatedEditorEvent();
	const persistSink = createBindableEventSink();
	ensureAutomaticClientReplicationRelay();

	const broadcastAll = (player?: Player): void => {
		const registrationPayload = createReplicatedEditorRegistrationPayload(
			constant,
			options.editor ?? automaticConstantReplicationOptions.editor,
		);
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
				constant.getSourcePath(),
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
		if (!isReplicationPayload(payload)) {
			return;
		}

		if (payload.scope !== constant.getScope()) {
			return;
		}

		if (payload.sourcePath !== constant.getSourcePath()) {
			return;
		}

		if (payload.persistPath !== constant.getPersistPath()) {
			return;
		}

		if (
			options.canEdit
				? !options.canEdit(player, payload, constant)
				: !getAutomaticCanEdit(player, payload, constant)
		) {
			return;
		}

		if (!applyReplicationUpdate(constant, payload)) {
			return;
		}

		const approvedDefinition = constant.getDefinitions().get(payload.name);
		if (!approvedDefinition) {
			return;
		}

		const approvedPayload = createConstantUpdatePayload(
			constant.getScope(),
			payload.name,
			approvedDefinition.currentValue,
			approvedDefinition.defaultValue,
			constant.getSourcePath(),
			constant.getPersistPath(),
		);
		persistSink.publish(approvedPayload);
		options.onApprovedUpdate?.(player, approvedPayload, constant);
		updateEvent.FireAllClients(approvedPayload);
	});

	publishConstantSnapshot(constant);

	const playerConnection =
		(options.syncOnPlayerAdded ?? true)
			? Players.PlayerAdded.Connect((player) => {
					broadcastAll(player);
				})
			: undefined;

	return {
		broadcastAll(player) {
			broadcastAll(player);
			if (!player) {
				publishConstantSnapshot(constant);
			}
		},
		disconnect() {
			requestConnection.Disconnect();
			playerConnection?.Disconnect();
		},
	};
}

export function createConstantReplicationClient<T extends object>(
	constant: ConstantStore<T>,
): ConstantReplicationClientHandle {
	const requestEvent = getOrCreateReplicationEvent();
	const updateEvent = getOrCreateReplicationEvent();
	const bootstrapPayload = createReplicatedEditorRegistrationPayload(
		constant,
		automaticConstantReplicationOptions.editor,
	);
	const sendBootstrap = (): void => {
		requestEvent.FireServer(bootstrapPayload);
	};

	let disconnected = false;
	let bootstrapSynchronized = false;

	const publishRequest = (request: ConstantReplicationUpdate): void => {
		if (!isReplicationPayload(request)) {
			return;
		}

		if (request.scope !== constant.getScope()) {
			return;
		}

		if (request.sourcePath !== constant.getSourcePath()) {
			return;
		}

		if (request.persistPath !== constant.getPersistPath()) {
			return;
		}

		requestEvent.FireServer(request);
	};

	const updateConnection = updateEvent.OnClientEvent.Connect((payload) => {
		if (!isReplicationPayload(payload)) {
			return;
		}

		if (
			payload.scope === constant.getScope() &&
			payload.persistPath === constant.getPersistPath() &&
			payload.sourcePath === constant.getSourcePath()
		) {
			bootstrapSynchronized = true;
		}

		applyReplicationUpdate(constant, payload);
	});

	task.spawn(() => {
		for (let attempt = 0; attempt < 10; attempt++) {
			if (disconnected || bootstrapSynchronized) {
				return;
			}

			sendBootstrap();
			task.wait(0.5);
		}
	});

	sendBootstrap();

	return {
		createRequestSink() {
			return {
				publish(payload) {
					publishRequest(payload);
				},
			};
		},
		disconnect() {
			disconnected = true;
			updateConnection.Disconnect();
		},
		requestUpdate(request) {
			publishRequest(request);
		},
	};
}
