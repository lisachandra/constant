export interface ConstantStudioPluginStatus {
	readonly connected: boolean;
	readonly playMode: boolean;
}

/**
 * Returns the human-readable Studio status text for the constant plugin bridge.
 * @param status - Current Studio plugin bridge status.
 * @returns A concise status label suitable for dock widget UI.
 * @example
 * ```ts
 * const text = formatConstantStudioPluginStatus({ connected: true, playMode: false });
 * ```
 */
export function formatConstantStudioPluginStatus(status: ConstantStudioPluginStatus): string {
	if (!status.connected) {
		return status.playMode ? "Disconnected (Play mode)" : "Disconnected (Edit mode)";
	}

	return status.playMode ? "Listening (Play mode)" : "Listening (Edit mode)";
}
