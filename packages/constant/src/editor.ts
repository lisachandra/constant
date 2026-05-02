import Iris = require("@rbxts/iris");
import { RunService, UserInputService } from "@rbxts/services";
import { createConstantUpdatePayload } from "./bridge";
import { createConstantReplicationClient } from "./replication";
import {
	getOrCreateReplicatedEditorEvent,
	isReplicatedEditorRegistrationPayload,
	type ReplicatedEditorDefinitionPayload,
	type ReplicatedEditorRegistrationPayload,
} from "./editor-transport";
import { formatValue, serializeConstant, serializedEquals } from "./serialize";
import { ConstantStore } from "./store";
import type {
	ConstantDefinition,
	ConstantEditorOptions,
	ConstantPersistMode,
	ConstantUpdatePayload,
	SerializedConstant,
	SupportedPrimitive,
} from "./types";

interface EditorWidgetStates {
	numbers: Map<string, Iris.State<number>>;
	booleans: Map<string, Iris.State<boolean>>;
	strings: Map<string, Iris.State<string>>;
	colors: Map<string, Iris.State<Color3>>;
	colorVectors: Map<string, Iris.State<Vector3>>;
	vectors: Map<string, Iris.State<Vector3>>;
	cframePositions: Map<string, Iris.State<Vector3>>;
	cframeRotations: Map<string, Iris.State<Vector3>>;
	serializedValues: Map<string, SerializedConstant>;
}

interface RegisteredEditor {
	readonly id: string;
	readonly path: string;
	readonly store: ConstantStore<object>;
	readonly options: ConstantEditorOptions;
	readonly dirtyNames: Set<string>;
	readonly states: EditorWidgetStates;
}

interface ReplicatedClientEditor {
	readonly store: ConstantStore<object>;
	readonly disconnectHotkey: () => void;
	readonly disconnectReplication: () => void;
}

let irisInitialized = false;
let sharedDisconnect: (() => void) | undefined;
let replicatedClientListenerInstalled = false;
const registeredEditors = new Map<string, RegisteredEditor>();
const replicatedClientEditors = new Map<string, ReplicatedClientEditor>();
const replicatedEditorIds = new Set<string>();

function ensureIrisInitialized(): void {
	if (irisInitialized) return;
	Iris.Init();
	irisInitialized = true;
}

function createEditorWidgetStates(): EditorWidgetStates {
	return {
		numbers: new Map(),
		booleans: new Map(),
		strings: new Map(),
		colors: new Map(),
		colorVectors: new Map(),
		vectors: new Map(),
		cframePositions: new Map(),
		cframeRotations: new Map(),
		serializedValues: new Map(),
	};
}

function getOrCreateState<T>(states: Map<string, Iris.State<T>>, key: string, initialValue: T): Iris.State<T> {
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

function getScriptPathLabel(path: string): string {
	return path.gsub("^game%.", "")[0]
}

function getEditorTitle(editors: RegisteredEditor[]): string {
	const explicitTitle = editors.find((editor) => editor.options.title !== undefined)?.options.title;
	return explicitTitle ?? "Constants";
}

function ensureSharedEditorMounted(): void {
	if (sharedDisconnect) return;

	ensureIrisInitialized();
	const windowSize = Iris.State(new Vector2(420, 520));
	sharedDisconnect = Iris.Connect(() => {
		const editors = new Array<RegisteredEditor>();
		for (const [, editor] of registeredEditors) {
			editors.push(editor);
		}
		if (editors.size() === 0) return;

		Iris.Window([getEditorTitle(editors)], { size: windowSize });
		for (const editor of editors) {
			renderEditorGroup(editor);
		}
		Iris.End();
	});
}

function teardownSharedEditorIfEmpty(): void {
	if (registeredEditors.size() > 0) return;
	sharedDisconnect?.();
	sharedDisconnect = undefined;
}

function renderEditorGroup(editor: RegisteredEditor): void {
	const scopeLabel = editor.store.getScope();
	const scriptPathLabel = getScriptPathLabel(editor.path);

	Iris.Tree([scopeLabel]);
	Iris.Tree([scriptPathLabel]);

	const persistMode = editor.options.persistMode ?? "manual";
	Iris.Text([`Persist mode: ${persistMode}`]);

	if (persistMode === "manual" && editor.dirtyNames.size() > 0 && Iris.Button(["Save All Preview Changes"]).clicked()) {
		for (const [name, definition] of editor.store.getDefinitions()) {
			if (!editor.dirtyNames.has(name)) continue;
			emitPersist(editor.store, name, definition.currentValue, definition.defaultValue, editor.options.onPersist);
			editor.dirtyNames.delete(name);
		}
	}

	for (const [name, definition] of editor.store.getDefinitions()) {
		Iris.PushId(`${editor.id}:${name}`);
		Iris.Text([`${name} (${definition.kind})`]);
		if (definition.defaultDrifted) Iris.Text(["default changed since last persisted save"]);
		if (persistMode === "manual" && editor.dirtyNames.has(name)) Iris.Text(["preview only"]);

		if (editor.options.allowEditing ?? RunService.IsStudio()) {
			renderWidget(
				editor.store,
				definition,
				{
					numberStep: editor.options.numberStep ?? 0.1,
					numberMin: editor.options.numberMin ?? 0,
					numberMax: editor.options.numberMax ?? 100,
				},
				{ persistMode, dirtyNames: editor.dirtyNames },
				editor.states,
				editor.options.onPersist,
			);
		} else {
			Iris.Text(["editing disabled"]);
		}

		if (persistMode === "manual" && editor.dirtyNames.has(name) && Iris.Button([`Save ${name}`]).clicked()) {
			emitPersist(editor.store, name, definition.currentValue, definition.defaultValue, editor.options.onPersist);
			editor.dirtyNames.delete(name);
		}

		if (Iris.Button([`Reset ${name}`]).clicked()) {
			editor.store.resetValue(name as never);
			editor.dirtyNames.delete(name);
			const resetDefinition = editor.store.getDefinitions().get(name)!;
			syncWidgetState(`${editor.id}:${name}`, resetDefinition, editor.states);
			if (persistMode === "auto") {
				emitPersist(editor.store, name, resetDefinition.currentValue, resetDefinition.defaultValue, editor.options.onPersist);
			}
		}

		Iris.Text([`Current: ${formatValue(definition.currentValue)}`]);
		Iris.Separator();
		Iris.PopId(`${editor.id}:${name}`);
	}

	Iris.End();
	Iris.End();
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

function createPersistedFromRegistration(payload: ReplicatedEditorRegistrationPayload) {
	const persisted: { _defaults: Record<string, SerializedConstant>; [name: string]: SerializedConstant | Record<string, SerializedConstant> } = {
		_defaults: {},
	};
	for (const definition of payload.definitions) {
		persisted[definition.name] = definition.serializedCurrent;
		persisted._defaults[definition.name] = definition.serializedDefault;
	}
	return persisted;
}

function getKeyCodeByName(name: string): Enum.KeyCode | undefined {
	return Enum.KeyCode.GetEnumItems().find((item) => item.Name === name);
}

function ensureReplicatedClientEditorListenerInstalled(): void {
	if (replicatedClientListenerInstalled || !RunService.IsClient()) return;
	replicatedClientListenerInstalled = true;

	getOrCreateReplicatedEditorEvent().OnClientEvent.Connect((payload) => {
		if (!isReplicatedEditorRegistrationPayload(payload)) return;
		if (replicatedClientEditors.has(payload.id)) return;
		replicatedEditorIds.add(payload.id);

		let mirrorStore = new ConstantStore<object>(
			payload.scope,
			createPersistedFromRegistration(payload),
			payload.persistPath,
			payload.sourcePath,
		);
		for (const definition of payload.definitions) {
			const defaultValue = deserializeSerializedValue(definition.serializedDefault);
			mirrorStore = mirrorStore.add(definition.name, defaultValue);
		}

		const replication = createConstantReplicationClient(mirrorStore);
		const keyCode = getKeyCodeByName(payload.keyCodeName);
		const disconnectHotkey = keyCode
			? bindConstantEditorHotkey(mirrorStore, keyCode, {
					title: payload.title,
					persistMode: payload.persistMode,
					onPersist: (update) => replication.requestUpdate(update),
				})
			: () => undefined;

		replicatedClientEditors.set(payload.id, {
			store: mirrorStore,
			disconnectHotkey,
			disconnectReplication: () => replication.disconnect(),
		});
	});
}

export function mountConstantEditor<T extends object>(store: ConstantStore<T>, options: ConstantEditorOptions = {}): () => void {
	ensureReplicatedClientEditorListenerInstalled();

	const editorId = `${store.getScope()}:${store.getPersistPath()}:${store.getSourcePath()}`
	const resolvedStore = replicatedClientEditors.get(editorId)?.store ?? store

	registeredEditors.set(editorId, {
		id: editorId,
		path: store.getSourcePath(),
		store: resolvedStore,
		options,
		dirtyNames: new Set<string>(),
		states: createEditorWidgetStates(),
	});
	ensureSharedEditorMounted();

	return () => {
		registeredEditors.delete(editorId);
		teardownSharedEditorIfEmpty();
	};
}

/**
 * Binds a hotkey that toggles a mounted constant editor connection.
 * @param store - Constant store backing the editor.
 * @param keyCode - Keyboard key that toggles the editor.
 * @param options - Editor options passed through when mounting.
 * @returns Cleanup function that disconnects the hotkey and closes the editor.
 * @example
 * ```ts
 * const cleanup = bindConstantEditorHotkey(store, Enum.KeyCode.F8, { title: "Client Constants" });
 * ```
 */
export function bindConstantEditorHotkey<T extends object>(
	store: ConstantStore<T>,
	keyCode: Enum.KeyCode,
	options: ConstantEditorOptions = {},
): () => void {
	ensureReplicatedClientEditorListenerInstalled();
	let disconnectEditor: (() => void) | undefined;
	const inputConnection = UserInputService.InputBegan.Connect((input, processed) => {
		if (processed || input.KeyCode !== keyCode) return;
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
	store: ConstantStore<object>,
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	onPersist?.(createConstantUpdatePayload(store.getScope(), name, value, defaultValue, store.getPersistPath()));
}

function commitEditorValue<T extends object>(
	store: ConstantStore<T>,
	name: string,
	value: SupportedPrimitive,
	state: { persistMode: ConstantPersistMode; dirtyNames: Set<string> },
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	store.updateValue(name as keyof T & string, value as T[keyof T & string] & SupportedPrimitive);
	const definition = store.getDefinitions().get(name);
	if (!definition) return;

	if (state.persistMode === "auto") {
		emitPersist(store as unknown as ConstantStore<object>, name, definition.currentValue, definition.defaultValue, onPersist);
		state.dirtyNames.delete(name);
	} else {
		state.dirtyNames.add(name);
	}
}

function syncWidgetState(key: string, definition: ConstantDefinition, states: EditorWidgetStates): void {
	const currentSerialized = serializeConstant(definition.currentValue);
	const lastSerialized = states.serializedValues.get(key);
	if (lastSerialized !== undefined && serializedEquals(lastSerialized, currentSerialized)) {
		return;
	}

	states.serializedValues.set(key, currentSerialized);

	if (definition.kind === "number") {
		syncState(getOrCreateState(states.numbers, key, definition.currentValue as number), definition.currentValue as number);
		return;
	}

	if (definition.kind === "boolean") {
		syncState(getOrCreateState(states.booleans, key, definition.currentValue as boolean), definition.currentValue as boolean);
		return;
	}

	if (definition.kind === "string") {
		syncState(getOrCreateState(states.strings, key, definition.currentValue as string), definition.currentValue as string);
		return;
	}

	if (definition.kind === "Color3") {
		syncState(getOrCreateState(states.colors, key, definition.currentValue as Color3), definition.currentValue as Color3);
		const color = definition.currentValue as Color3;
		syncState(getOrCreateState(states.colorVectors, key, new Vector3(color.R, color.G, color.B)), new Vector3(color.R, color.G, color.B));
		return;
	}

	if (definition.kind === "Vector3") {
		syncState(getOrCreateState(states.vectors, key, definition.currentValue as Vector3), definition.currentValue as Vector3);
		return;
	}

	if (definition.kind === "CFrame") {
		const cf = definition.currentValue as CFrame;
		const [x, y, z] = [cf.Position.X, cf.Position.Y, cf.Position.Z];
		const rx = math.atan2(cf.LookVector.Y, cf.LookVector.Z);
		const ry = math.atan2(-cf.LookVector.X, math.sqrt(cf.LookVector.Y * cf.LookVector.Y + cf.LookVector.Z * cf.LookVector.Z));
		const rz = math.atan2(cf.RightVector.Y, cf.UpVector.Y);
		const position = new Vector3(x, y, z);
		const rotation = new Vector3(math.deg(rx), math.deg(ry), math.deg(rz));
		syncState(getOrCreateState(states.cframePositions, key, position), position);
		syncState(getOrCreateState(states.cframeRotations, key, rotation), rotation);
		return;
	}
}

function renderWidget<T extends object>(
	store: ConstantStore<T>,
	definition: ConstantDefinition,
	numberOptions: { numberStep: number; numberMin: number; numberMax: number },
	state: { persistMode: ConstantPersistMode; dirtyNames: Set<string> },
	widgetStates: EditorWidgetStates,
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	const widgetKey = `${tostring(store)}:${definition.name}`;
	syncWidgetState(widgetKey, definition, widgetStates);

	if (definition.kind === "number") {
		const sliderState = getOrCreateState(widgetStates.numbers, widgetKey, definition.currentValue as number);
		const drag = Iris.DragNum(
			[definition.name, numberOptions.numberStep, numberOptions.numberMin, numberOptions.numberMax],
			{ number: sliderState },
		);
		if (drag.numberChanged()) commitEditorValue(store, definition.name, drag.state.number.value, state, onPersist);
		return;
	}

	if (definition.kind === "boolean") {
		const checkboxState = getOrCreateState(widgetStates.booleans, widgetKey, definition.currentValue as boolean);
		const checkbox = Iris.Checkbox([definition.name], { isChecked: checkboxState });
		if (checkbox.checked() || checkbox.unchecked()) {
			commitEditorValue(store, definition.name, checkbox.state.isChecked.value, state, onPersist);
		}
		return;
	}

	if (definition.kind === "string") {
		const inputState = getOrCreateState(widgetStates.strings, widgetKey, definition.currentValue as string);
		const input = Iris.InputText([definition.name], { text: inputState });
		if (input.textChanged()) commitEditorValue(store, definition.name, input.state.text.value, state, onPersist);
		return;
	}

	if (definition.kind === "Color3") {
		const colorState = getOrCreateState(widgetStates.colorVectors, widgetKey, new Vector3());
		const input = Iris.DragVector3(
			[definition.name, new Vector3(numberOptions.numberStep, numberOptions.numberStep, numberOptions.numberStep), new Vector3(0, 0, 0), new Vector3(1, 1, 1)],
			{ number: colorState },
		);
		if (input.numberChanged()) {
			const nextValue = input.state.number.value;
			commitEditorValue(store, definition.name, new Color3(nextValue.X, nextValue.Y, nextValue.Z), state, onPersist);
		}
		return;
	}

	if (definition.kind === "Vector3") {
		const vectorState = getOrCreateState(widgetStates.vectors, widgetKey, definition.currentValue as Vector3);
		const input = Iris.DragVector3(
			[definition.name, new Vector3(numberOptions.numberStep, numberOptions.numberStep, numberOptions.numberStep)],
			{ number: vectorState },
		);
		if (input.numberChanged()) commitEditorValue(store, definition.name, input.state.number.value, state, onPersist);
		return;
	}

	if (definition.kind === "CFrame") {
		const positionState = getOrCreateState(widgetStates.cframePositions, widgetKey, new Vector3());
		const rotationState = getOrCreateState(widgetStates.cframeRotations, widgetKey, new Vector3());
		const positionInput = Iris.DragVector3(
			[`${definition.name} Position`, new Vector3(numberOptions.numberStep, numberOptions.numberStep, numberOptions.numberStep)],
			{ number: positionState },
		);
		const rotationInput = Iris.DragVector3(
			[`${definition.name} Rotation`, new Vector3(numberOptions.numberStep, numberOptions.numberStep, numberOptions.numberStep)],
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
	task.defer(ensureReplicatedClientEditorListenerInstalled);
}
