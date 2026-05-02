import { ReplicatedStorage } from "@rbxts/services";
import type { ConstantPersistMode, ConstantScope, SerializedConstant } from "./types";

export const REPLICATED_EDITOR_FOLDER_NAME = "constantEditor";
export const REPLICATED_EDITOR_EVENT_NAME = "constantEditor";

export interface ReplicatedEditorDefinitionPayload {
	readonly name: string;
	readonly serializedDefault: SerializedConstant;
	readonly serializedCurrent: SerializedConstant;
}

export interface ReplicatedEditorRegistrationPayload {
	readonly action: "register";
	readonly id: string;
	readonly scope: ConstantScope;
	readonly persistPath: string;
	readonly sourcePath: string;
	readonly title?: string;
	readonly persistMode?: ConstantPersistMode;
	readonly keyCodeName: string;
	readonly definitions: ReadonlyArray<ReplicatedEditorDefinitionPayload>;
}

export function getOrCreateReplicatedEditorEvent(parent: Instance = ReplicatedStorage): RemoteEvent {
	const existingEvent = parent.FindFirstChild(REPLICATED_EDITOR_EVENT_NAME);
	if (existingEvent?.IsA("RemoteEvent")) return existingEvent;

	const event = new Instance("RemoteEvent");
	event.Name = REPLICATED_EDITOR_EVENT_NAME;
	event.Parent = parent;
	return event;
}

export function isReplicatedEditorRegistrationPayload(value: unknown): value is ReplicatedEditorRegistrationPayload {
	if (!typeIs(value, "table")) return false;
	const payload = value as Partial<ReplicatedEditorRegistrationPayload>;
	return payload.action === "register"
}
