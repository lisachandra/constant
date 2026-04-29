import Iris = require("@rbxts/iris");
import { RunService } from "@rbxts/services";
import { createConstantUpdatePayload } from "./bridge";
import { formatValue } from "./serialize";
import { ConstantStore } from "./store";
import type { ConstantDefinition, ConstantEditorOptions, ConstantPersistMode, ConstantUpdatePayload, SupportedPrimitive } from "./types";

export function mountConstantEditor<T extends object>(store: ConstantStore<T>, options: ConstantEditorOptions = {}): () => void {
	const title = options.title ?? `${store.getScope()} constants`;
	const allowEditing = options.allowEditing ?? RunService.IsStudio();
	const numberStep = options.numberStep ?? 0.1;
	const numberMin = options.numberMin ?? 0;
	const numberMax = options.numberMax ?? 100;
	const persistMode = options.persistMode ?? "manual";
	const dirtyNames = new Set<string>();

	Iris.Init();
	return Iris.Connect(() => {
		Iris.Window([title]);
		Iris.Text([`Persist mode: ${persistMode}`]);

		if (persistMode === "manual" && dirtyNames.size() > 0 && Iris.Button(["Save All Preview Changes"]).clicked()) {
			for (const [name, definition] of store.getDefinitions()) {
				if (!dirtyNames.has(name)) continue;
				emitPersist(store.getScope(), name, definition.currentValue, definition.defaultValue, options.onPersist);
				dirtyNames.delete(name);
			}
		}

		for (const [name, definition] of store.getDefinitions()) {
			Iris.PushId(name);
			Iris.Text([`${name} (${definition.kind})`]);
			if (definition.defaultDrifted) Iris.Text(["default changed since last persisted save"]);
			if (persistMode === "manual" && dirtyNames.has(name)) Iris.Text(["preview only"]);

			if (allowEditing) {
				renderWidget(store, definition, { numberStep, numberMin, numberMax }, { persistMode, dirtyNames }, options.onPersist);
			} else {
				Iris.Text(["editing disabled"]);
			}

			if (persistMode === "manual" && dirtyNames.has(name) && Iris.Button([`Save ${name}`]).clicked()) {
				emitPersist(store.getScope(), name, definition.currentValue, definition.defaultValue, options.onPersist);
				dirtyNames.delete(name);
			}

			if (Iris.Button([`Reset ${name}`]).clicked()) {
				store.resetValue(name as keyof T & string);
				dirtyNames.delete(name);
				if (persistMode === "auto") {
					const resetDefinition = store.getDefinitions().get(name)!;
					emitPersist(store.getScope(), name, resetDefinition.currentValue, resetDefinition.defaultValue, options.onPersist);
				}
			}

			Iris.Text([`Current: ${formatValue(definition.currentValue)}`]);
			Iris.Separator();
			Iris.PopId(name);
		}
		Iris.End();
	});
}

function emitPersist(
	scope: "client" | "server",
	name: string,
	value: SupportedPrimitive,
	defaultValue: SupportedPrimitive,
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	onPersist?.(createConstantUpdatePayload(scope, name, value, defaultValue));
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
		emitPersist(store.getScope(), name, definition.currentValue, definition.defaultValue, onPersist);
		state.dirtyNames.delete(name);
	} else {
		state.dirtyNames.add(name);
	}
}

function renderWidget<T extends object>(
	store: ConstantStore<T>,
	definition: ConstantDefinition,
	numberOptions: { numberStep: number; numberMin: number; numberMax: number },
	state: { persistMode: ConstantPersistMode; dirtyNames: Set<string> },
	onPersist?: (payload: ConstantUpdatePayload) => void,
): void {
	if (definition.kind === "number") {
		const slider = Iris.SliderNum(
			[definition.name, numberOptions.numberStep, numberOptions.numberMin, numberOptions.numberMax],
			{ number: definition.currentValue as number },
		);
		if (slider.numberChanged()) commitEditorValue(store, definition.name, slider.state.number.value, state, onPersist);
		return;
	}

	if (definition.kind === "boolean") {
		const checkbox = Iris.Checkbox([definition.name], { isChecked: definition.currentValue as boolean });
		if (checkbox.checked() || checkbox.unchecked()) {
			commitEditorValue(store, definition.name, checkbox.state.isChecked.value, state, onPersist);
		}
		return;
	}

	if (definition.kind === "string") {
		const input = Iris.InputText([definition.name], { text: definition.currentValue as string });
		if (input.textChanged()) commitEditorValue(store, definition.name, input.state.text.value, state, onPersist);
		return;
	}

	if (definition.kind === "Color3") {
		const input = Iris.InputColor3([definition.name], { color: definition.currentValue as Color3 });
		if (input.numberChanged()) commitEditorValue(store, definition.name, input.state.color.value, state, onPersist);
		return;
	}

	if (definition.kind === "Vector3") {
		const input = Iris.InputVector3([definition.name], { number: definition.currentValue as Vector3 });
		if (input.numberChanged()) commitEditorValue(store, definition.name, input.state.number.value, state, onPersist);
		return;
	}

	Iris.Text([`${definition.name}: ${formatValue(definition.currentValue)}`]);
}
