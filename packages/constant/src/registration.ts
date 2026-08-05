import { deserializeConstant } from "./serialize";
import { ConstantStore } from "./store";
import type { ReplicatedEditorRegistrationPayload } from "./transport";
import type { ConstantScope, PersistedConstantGroup, SerializedConstant } from "./types";

/**
 * Builds the editor id that identifies a constant store across the runtime and replication
 * transport.
 *
 * @param scope - Client or server scope.
 * @param persistPath - Persisted JSON path for the store.
 * @param sourcePath - Source script path of the store.
 * @returns Stable editor id used by registrations and editor sessions.
 */
export function createEditorId(
	scope: ConstantScope,
	persistPath: string,
	sourcePath: string,
): string {
	return `${scope}:${persistPath}:${sourcePath}`;
}

/**
 * Builds the persisted group shape from a replicated editor registration.
 *
 * @param payload - Registration payload received over the transport.
 * @returns Persisted group with current values and defaults.
 */
export function createPersistedFromRegistration(
	payload: ReplicatedEditorRegistrationPayload,
): PersistedConstantGroup {
	const defaults: Record<string, SerializedConstant> = {};
	const persisted: PersistedConstantGroup = { _defaults: defaults };
	for (const definition of payload.definitions) {
		persisted[definition.name] = definition.serializedCurrent;
		defaults[definition.name] = definition.serializedDefault;
	}

	return persisted;
}

/**
 * Reconstructs a constant store from a replicated editor registration. Used by both the server
 * relay and the client editor mirror so the two call sites cannot drift.
 *
 * @param payload - Registration payload received over the transport.
 * @returns Store seeded with the registered definitions.
 */
export function createStoreFromRegistration(
	payload: ReplicatedEditorRegistrationPayload,
): ConstantStore {
	let store = new ConstantStore(
		payload.scope,
		createPersistedFromRegistration(payload),
		payload.persistPath,
		payload.sourcePath,
	);
	for (const definition of payload.definitions) {
		store = store.add(
			definition.name,
			deserializeConstant(definition.serializedDefault, undefined),
		);
	}

	return store;
}
