import Iris = require("@rbxts/iris");
import { RunService, UserInputService } from "@rbxts/services";

import { createConstantUpdatePayload } from "./bridge";
import { createEditorId, createStoreFromRegistration } from "./registration";
import { createConstantReplicationClient } from "./replication";
import {
	type EditorSearchResult,
	getEditorSourceLabel,
	normalizeSearchQuery,
	rankEditorGroups,
} from "./search";
import { formatValue, serializeConstant, serializedEquals } from "./serialize";
import type { ConstantStore } from "./store";
import {
	getOrCreateReplicatedEditorEvent,
	isReplicatedEditorRegistrationPayload,
	type ReplicatedEditorRegistrationPayload,
} from "./transport";
import type {
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantPersistMode,
	ConstantUpdatePayload,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

interface EditorWidgetStates {
	booleans: Map<string, Iris.State<boolean>>;
	cframePositions: Map<string, Iris.State<Vector3>>;
	cframeRotations: Map<string, Iris.State<Vector3>>;
	colors: Map<string, Iris.State<Color3>>;
	colorVectors: Map<string, Iris.State<Vector3>>;
	numbers: Map<string, Iris.State<number>>;
	serializedValues: Map<string, SerializedConstant>;
	strings: Map<string, Iris.State<string>>;
	vectors: Map<string, Iris.State<Vector3>>;
}

interface RegisteredEditor {
	readonly dirtyNames: Set<string>;
	readonly id: string;
	readonly options: ConstantEditorOptions;
	readonly path: string;
	readonly states: EditorWidgetStates;
	readonly store: ConstantStore;
}

interface ReplicatedClientEditor {
	readonly disconnectHotkey: () => void;
	readonly disconnectReplication: () => void;
	readonly options: ConstantEditorOptions;
	readonly store: ConstantStore;
}

let irisInitialized = false;
let sharedDisconnect: undefined | (() => void);
let sharedSearchState: undefined | Iris.State<string>;
let replicatedClientListenerInstalled = false;
const registeredEditors = new Map<string, RegisteredEditor>();
const replicatedClientEditors = new Map<string, ReplicatedClientEditor>();

function ensureIrisInitialized(): void {
	if (irisInitialized) {
		return;
	}

	pcall(() => {
		Iris.Init();
	});
	irisInitialized = true;
}

function createEditorWidgetStates(): EditorWidgetStates {
	return {
		booleans: new Map(),
		cframePositions: new Map(),
		cframeRotations: new Map(),
		colors: new Map(),
		colorVectors: new Map(),
		numbers: new Map(),
		serializedValues: new Map(),
		strings: new Map(),
		vectors: new Map(),
	};
}

function getOrCreateState<T>(
	states: Map<string, Iris.State<T>>,
	key: string,
	initialValue: T,
): Iris.State<T> {
	let state = states.get(key);
	if (!state) {
		state = Iris.State(initialValue);
		states.set(key, state);
	}

	return state;
}

function syncState<T extends SupportedPrimitive>(state: Iris.State<T>, value: T): void {
	if (!serializedEquals(serializeConstant(state.value), serializeConstant(value))) {
		state.set(value);
	}
}

function getEditorTitle(editors: Array<RegisteredEditor>): string {
	const explicitTitle = editors.find((editor) => editor.options.title !== undefined)?.options
		.title;
	return explicitTitle ?? "Constants";
}

function ensureSharedEditorMounted(): void {
	if (sharedDisconnect) {
		return;
	}

	ensureIrisInitialized();
	const windowSize = Iris.State(new Vector2(420, 520));
	sharedDisconnect = Iris.Connect(() => {
		const serverEditors = new Array<RegisteredEditor>();
		const clientEditors = new Array<RegisteredEditor>();
		for (const [, editor] of registeredEditors) {
			if (editor.store.getScope() === "server") {
				serverEditors.push(editor);
			} else {
				clientEditors.push(editor);
			}
		}

		if (serverEditors.size() === 0 && clientEditors.size() === 0) {
			return;
		}

		Iris.Window([getEditorTitle([...serverEditors, ...clientEditors])], { size: windowSize });
		sharedSearchState ??= Iris.State("");
		const searchInput = Iris.InputText(["Search constants/scripts"], {
			text: sharedSearchState,
		});
		const searchQuery = normalizeSearchQuery(searchInput.state.text.value);
		if (serverEditors.size() > 0) {
			renderEditorScope("server", serverEditors, searchQuery);
		}

		if (clientEditors.size() > 0) {
			renderEditorScope("client", clientEditors, searchQuery);
		}

		Iris.End();
	});
}

function teardownSharedEditorIfEmpty(): void {
	if (registeredEditors.size() > 0) {
		return;
	}

	sharedDisconnect?.();
	sharedDisconnect = undefined;
	sharedSearchState = undefined;
}

function renderEditorScope(
	scopeLabel: string,
	editors: Array<RegisteredEditor>,
	searchQuery: string,
): void {
	Iris.Tree([scopeLabel]);
	const groups = rankEditorGroups(editors, searchQuery);
	if (searchQuery !== "" && groups.size() === 0) {
		Iris.Text([`No ${scopeLabel} constants/scripts match "${searchQuery}"`]);
	}

	for (const group of groups) {
		renderEditorGroup(group);
	}

	Iris.End();
}

function renderEditorGroup(group: EditorSearchResult<RegisteredEditor>): void {
	const { editor } = group;

	Iris.PushId(editor.id);
	Iris.Separator();
	Iris.Tree([getEditorSourceLabel(editor.path)]);

	const persistMode = editor.options.persistMode ?? "manual";
	Iris.Text([`Persist mode: ${persistMode}`]);

	if (
		persistMode === "manual" &&
		editor.dirtyNames.size() > 0 &&
		Iris.Button(["Save All Preview Changes"]).clicked()
	) {
		for (const [name, definition] of editor.store.getDefinitions()) {
			if (!editor.dirtyNames.has(name)) {
				continue;
			}

			emitPersist(
				editor.store,
				name,
				definition.currentValue,
				definition.defaultValue,
				editor.options.onPersist,
			);
			editor.dirtyNames.delete(name);
		}
	}

	const driftedDefinitions = new Array<[string, ConstantDefinition]>();
	for (const [name, definition] of editor.store.getDefinitions()) {
		if (!definition.defaultDrifted) {
			continue;
		}

		driftedDefinitions.push([name, definition]);
	}

	if (driftedDefinitions.size() > 0 && Iris.Button(["Reapply All Drifted Defaults"]).clicked()) {
		const reappliedNames = editor.store.reapplyDriftedDefaults();
		for (const name of reappliedNames) {
			const reappliedDefinition = editor.store.getDefinitions().get(name);
			if (!reappliedDefinition) {
				continue;
			}

			finalizeEditorValue(
				editor.store,
				name,
				{ dirtyNames: editor.dirtyNames, persistMode },
				editor.options.onPersist,
			);
			syncWidgetState(`${editor.id}:${name}`, reappliedDefinition, editor.states);
		}
	}

	const renderableDefinitions = group.definitions;

	for (const [name, definition] of renderableDefinitions) {
		renderEditorDefinition(editor, name, definition, persistMode);
	}

	Iris.End();
	Iris.PopId(editor.id);
}

function renderEditorDefinition(
	editor: RegisteredEditor,
	name: string,
	definition: ConstantDefinition,
	persistMode: ConstantPersistMode,
): void {
	Iris.PushId(`${editor.id}:${name}`);
	Iris.Text([`${name} (${definition.kind})`]);
	if (definition.defaultDrifted) {
		Iris.Text(["default changed since last persisted save"]);
	}

	if (persistMode === "manual" && editor.dirtyNames.has(name)) {
		Iris.Text(["preview only"]);
	}

	if (editor.options.allowEditing ?? RunService.IsStudio()) {
		renderWidget(
			editor.store,
			definition,
			{
				numberMax: editor.options.numberMax ?? 1_000_000,
				numberMin: editor.options.numberMin ?? -1_000_000,
				numberStep: editor.options.numberStep ?? 0.1,
			},
			{ dirtyNames: editor.dirtyNames, persistMode },
			editor.states,
			editor.options.onPersist,
			editor.id,
		);
	} else {
		Iris.Text(["editing disabled"]);
	}

	if (definition.defaultDrifted && Iris.Button([`Reapply Default ${name}`]).clicked()) {
		editor.store.reapplyDefault(name as never);
		finalizeEditorValue(
			editor.store,
			name,
			{ dirtyNames: editor.dirtyNames, persistMode },
			editor.options.onPersist,
		);
		const reappliedDefinition =
			editor.store.getDefinitions().get(name) ?? error(`Missing definition: ${name}`);
		syncWidgetState(`${editor.id}:${name}`, reappliedDefinition, editor.states);
	}

	if (
		persistMode === "manual" &&
		editor.dirtyNames.has(name) &&
		Iris.Button([`Save ${name}`]).clicked()
	) {
		emitPersist(
			editor.store,
			name,
			definition.currentValue,
			definition.defaultValue,
			editor.options.onPersist,
		);
		editor.dirtyNames.delete(name);
	}

	if (Iris.Button([`Reset ${name}`]).clicked()) {
		editor.store.resetValue(name as never);
		editor.dirtyNames.delete(name);
		const resetDefinition =
			editor.store.getDefinitions().get(name) ?? error(`Missing definition: ${name}`);
		syncWidgetState(`${editor.id}:${name}`, resetDefinition, editor.states);
		if (persistMode === "auto") {
			emitPersist(
				editor.store,
				name,
				resetDefinition.currentValue,
				resetDefinition.defaultValue,
				editor.options.onPersist,
			);
		}
	}

	Iris.Text([`Current: ${formatValue(definition.currentValue)}`]);
	Iris.Separator();
	Iris.PopId(`${editor.id}:${name}`);
}

function getKeyCodeByName(name: string): undefined | Enum.KeyCode {
	return Enum.KeyCode.GetEnumItems().find((item) => item.Name === name);
}

function createReplicatedEditorOptions(
	payload: ReplicatedEditorRegistrationPayload,
	replication: ReturnType<typeof createConstantReplicationClient>,
): ConstantEditorOptions {
	return {
		onPersist: (update) => {
			replication.requestUpdate(update);
		},
		persistMode: payload.persistMode,
		title: payload.title,
	};
}

function ensureReplicatedClientEditorListenerInstalled(): void {
	if (replicatedClientListenerInstalled || !RunService.IsClient()) {
		return;
	}

	replicatedClientListenerInstalled = true;

	getOrCreateReplicatedEditorEvent().OnClientEvent.Connect((payload) => {
		if (!isReplicatedEditorRegistrationPayload(payload)) {
			return;
		}

		if (replicatedClientEditors.has(payload.id)) {
			return;
		}

		const mirrorStore = createStoreFromRegistration(payload);

		const replication = createConstantReplicationClient(mirrorStore);
		const options = createReplicatedEditorOptions(payload, replication);
		const keyCode = getKeyCodeByName(payload.keyCodeName ?? "");
		const disconnectHotkey = keyCode
			? bindConstantEditorHotkey(mirrorStore, keyCode, options)
			: () => undefined;

		replicatedClientEditors.set(payload.id, {
			disconnectHotkey,
			disconnectReplication: () => {
				replication.disconnect();
			},
			options,
			store: mirrorStore,
		});
	});
}

export function mountConstantEditor<T extends object>(
	store: ConstantStore<T>,
	options: ConstantEditorOptions = {},
): () => void {
	ensureReplicatedClientEditorListenerInstalled();

	const editorId = createEditorId(
		store.getScope(),
		store.getPersistPath(),
		store.getSourcePath(),
	);
	const resolvedStore = replicatedClientEditors.get(editorId)?.store ?? store;
	const mountedEditorIds = new Array<string>();

	registeredEditors.set(editorId, {
		dirtyNames: new Set<string>(),
		id: editorId,
		options,
		path: store.getSourcePath(),
		states: createEditorWidgetStates(),
		store: resolvedStore,
	});
	mountedEditorIds.push(editorId);

	if (store.getScope() === "client") {
		for (const [replicatedEditorId, replicatedEditor] of replicatedClientEditors) {
			if (
				replicatedEditor.store.getScope() !== "server" ||
				registeredEditors.has(replicatedEditorId)
			) {
				continue;
			}

			registeredEditors.set(replicatedEditorId, {
				dirtyNames: new Set<string>(),
				id: replicatedEditorId,
				options: replicatedEditor.options,
				path: replicatedEditor.store.getSourcePath(),
				states: createEditorWidgetStates(),
				store: replicatedEditor.store,
			});
			mountedEditorIds.push(replicatedEditorId);
		}
	}

	ensureSharedEditorMounted();

	return () => {
		for (const mountedEditorId of mountedEditorIds) {
			registeredEditors.delete(mountedEditorId);
		}

		teardownSharedEditorIfEmpty();
	};
}

/**
 * Binds a hotkey that toggles a mounted constant editor connection.
 *
 * @example
 * 	```ts
 * 	const cleanup = bindConstantEditorHotkey(store, Enum.KeyCode.F8, {
 * 		title: "Client Constants",
 * 	});
 * 	```;
 *
 * @param store - Constant store backing the editor.
 * @param keyCode - Keyboard key that toggles the editor.
 * @param options - Editor options passed through when mounting.
 * @returns Cleanup function that disconnects the hotkey and closes the editor.
 */
export function bindConstantEditorHotkey<T extends object>(
	store: ConstantStore<T>,
	keyCode: Enum.KeyCode,
	options: ConstantEditorOptions = {},
): () => void {
	ensureReplicatedClientEditorListenerInstalled();
	let disconnectEditor: undefined | (() => void);
	const inputConnection = UserInputService.InputBegan.Connect((input, processed) => {
		if (processed || input.KeyCode !== keyCode) {
			return;
		}

		if (disconnectEditor) {
			disconnectEditor();
			disconnectEditor = undefined;
			return;
		}

		disconnectEditor = mountConstantEditor(store, options);
	});

	return () => {
		inputConnection.Disconnect();
		disconnectEditor?.();
		disconnectEditor = undefined;
	};
}

function emitPersist(
	store: ConstantStore,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	onPersist?.(
		createConstantUpdatePayload(
			store.getScope(),
			name,
			value,
			defaultValue,
			store.getSourcePath(),
			store.getPersistPath(),
		),
	);
}

function finalizeEditorValue<T extends object>(
	store: ConstantStore<T>,
	name: string,
	state: { dirtyNames: Set<string>; persistMode: ConstantPersistMode },
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	const definition = store.getDefinitions().get(name);
	if (!definition) {
		return;
	}

	if (state.persistMode === "auto") {
		emitPersist(store, name, definition.currentValue, definition.defaultValue, onPersist);
		state.dirtyNames.delete(name);
	} else {
		state.dirtyNames.add(name);
	}
}

function commitEditorValue<T extends object>(
	store: ConstantStore<T>,
	name: string,
	value: SupportedPrimitive,
	state: { dirtyNames: Set<string>; persistMode: ConstantPersistMode },
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	store.updateValue(name as keyof T & string, value as SupportedPrimitive & T[keyof T & string]);
	finalizeEditorValue(store, name, state, onPersist);
}

function syncWidgetState(
	key: string,
	definition: ConstantDefinition,
	states: EditorWidgetStates,
): void {
	const currentSerialized = serializeConstant(definition.currentValue);
	const lastSerialized = states.serializedValues.get(key);
	if (lastSerialized !== undefined && serializedEquals(lastSerialized, currentSerialized)) {
		return;
	}

	states.serializedValues.set(key, currentSerialized);

	if (definition.kind === "number") {
		syncState(
			getOrCreateState(states.numbers, key, definition.currentValue as number),
			definition.currentValue as number,
		);
		return;
	}

	if (definition.kind === "boolean") {
		syncState(
			getOrCreateState(states.booleans, key, definition.currentValue as boolean),
			definition.currentValue as boolean,
		);
		return;
	}

	if (definition.kind === "string") {
		syncState(
			getOrCreateState(states.strings, key, definition.currentValue as string),
			definition.currentValue as string,
		);
		return;
	}

	if (definition.kind === "Color3") {
		syncState(
			getOrCreateState(states.colors, key, definition.currentValue as Color3),
			definition.currentValue as Color3,
		);
		const color = definition.currentValue as Color3;
		syncState(
			getOrCreateState(
				states.colorVectors,
				key,
				new Vector3(color.R * 255, color.G * 255, color.B * 255),
			),
			new Vector3(color.R * 255, color.G * 255, color.B * 255),
		);
		return;
	}

	if (definition.kind === "Vector3") {
		syncState(
			getOrCreateState(states.vectors, key, definition.currentValue as Vector3),
			definition.currentValue as Vector3,
		);
		return;
	}

	if (definition.kind === "CFrame") {
		const cf = definition.currentValue as CFrame;
		const [x, y, z] = [cf.Position.X, cf.Position.Y, cf.Position.Z];
		const rx = math.atan2(cf.LookVector.Y, cf.LookVector.Z);
		const ry = math.atan2(
			-cf.LookVector.X,
			math.sqrt(cf.LookVector.Y * cf.LookVector.Y + cf.LookVector.Z * cf.LookVector.Z),
		);
		const rz = math.atan2(cf.RightVector.Y, cf.UpVector.Y);
		const position = new Vector3(x, y, z);
		const rotation = new Vector3(math.deg(rx), math.deg(ry), math.deg(rz));
		syncState(getOrCreateState(states.cframePositions, key, position), position);
		syncState(getOrCreateState(states.cframeRotations, key, rotation), rotation);
	}
}

function renderWidget<T extends object>(
	store: ConstantStore<T>,
	definition: ConstantDefinition,
	numberOptions: { numberMax: number; numberMin: number; numberStep: number },
	state: { dirtyNames: Set<string>; persistMode: ConstantPersistMode },
	widgetStates: EditorWidgetStates,
	onPersist?: (payload: ConstantUpdatePayload) => void,
	widgetIdPrefix?: string,
): void {
	const widgetKey = `${widgetIdPrefix ?? tostring(store)}:${definition.name}`;
	syncWidgetState(widgetKey, definition, widgetStates);

	if (definition.kind === "number") {
		const sliderState = getOrCreateState(
			widgetStates.numbers,
			widgetKey,
			definition.currentValue as number,
		);
		const drag = Iris.DragNum(
			[
				definition.name,
				numberOptions.numberStep,
				numberOptions.numberMin,
				numberOptions.numberMax,
			],
			{ number: sliderState },
		);
		if (drag.numberChanged()) {
			commitEditorValue(store, definition.name, drag.state.number.value, state, onPersist);
		}

		return;
	}

	if (definition.kind === "boolean") {
		const checkboxState = getOrCreateState(
			widgetStates.booleans,
			widgetKey,
			definition.currentValue as boolean,
		);
		const checkbox = Iris.Checkbox([definition.name], { isChecked: checkboxState });
		if (checkbox.checked() || checkbox.unchecked()) {
			commitEditorValue(
				store,
				definition.name,
				checkbox.state.isChecked.value,
				state,
				onPersist,
			);
		}

		return;
	}

	if (definition.kind === "string") {
		const inputState = getOrCreateState(
			widgetStates.strings,
			widgetKey,
			definition.currentValue as string,
		);
		const input = Iris.InputText([definition.name], { text: inputState });
		if (input.textChanged()) {
			commitEditorValue(store, definition.name, input.state.text.value, state, onPersist);
		}

		return;
	}

	if (definition.kind === "Color3") {
		const currentColor = definition.currentValue as Color3;
		const colorState = getOrCreateState(
			widgetStates.colorVectors,
			widgetKey,
			new Vector3(currentColor.R * 255, currentColor.G * 255, currentColor.B * 255),
		);
		const input = Iris.DragVector3(
			[
				definition.name,
				new Vector3(
					numberOptions.numberStep,
					numberOptions.numberStep,
					numberOptions.numberStep,
				),
				new Vector3(0, 0, 0),
				new Vector3(255, 255, 255),
			],
			{ number: colorState },
		);
		if (input.numberChanged()) {
			const nextValue = input.state.number.value;
			commitEditorValue(
				store,
				definition.name,
				Color3.fromRGB(
					math.round(nextValue.X),
					math.round(nextValue.Y),
					math.round(nextValue.Z),
				),
				state,
				onPersist,
			);
		}

		return;
	}

	if (definition.kind === "Vector3") {
		const vectorState = getOrCreateState(
			widgetStates.vectors,
			widgetKey,
			definition.currentValue as Vector3,
		);
		const input = Iris.DragVector3(
			[
				definition.name,
				new Vector3(
					numberOptions.numberStep,
					numberOptions.numberStep,
					numberOptions.numberStep,
				),
			],
			{ number: vectorState },
		);
		if (input.numberChanged()) {
			commitEditorValue(store, definition.name, input.state.number.value, state, onPersist);
		}

		return;
	}

	if (definition.kind === "CFrame") {
		const positionState = getOrCreateState(
			widgetStates.cframePositions,
			widgetKey,
			new Vector3(),
		);
		const rotationState = getOrCreateState(
			widgetStates.cframeRotations,
			widgetKey,
			new Vector3(),
		);
		const positionInput = Iris.DragVector3(
			[
				`${definition.name} Position`,
				new Vector3(
					numberOptions.numberStep,
					numberOptions.numberStep,
					numberOptions.numberStep,
				),
			],
			{ number: positionState },
		);
		const rotationInput = Iris.DragVector3(
			[
				`${definition.name} Rotation`,
				new Vector3(
					numberOptions.numberStep,
					numberOptions.numberStep,
					numberOptions.numberStep,
				),
			],
			{ number: rotationState },
		);
		if (positionInput.numberChanged() || rotationInput.numberChanged()) {
			const position = positionInput.state.number.value;
			const rotation = rotationInput.state.number.value;
			const nextValue = new CFrame(position).mul(
				CFrame.Angles(math.rad(rotation.X), math.rad(rotation.Y), math.rad(rotation.Z)),
			);
			commitEditorValue(store, definition.name, nextValue, state, onPersist);
		}

		return;
	}

	Iris.Text([`${definition.name}: ${formatValue(definition.currentValue)}`]);
}

if (RunService.IsClient()) {
	ensureReplicatedClientEditorListenerInstalled();
}
