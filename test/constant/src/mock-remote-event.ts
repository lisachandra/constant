/**
 * A mock RemoteEvent for use in jest-roblox tests.
 *
 * Provides bidirectional event routing within a single process:
 * - FireServer(...)  → triggers all OnServerEvent.Connect callbacks
 * - FireAllClients(...) / FireClient(...)  → triggers all OnClientEvent.Connect callbacks
 * - Connect returns a connection handle whose Disconnect() unsubscribes the callback.
 */
export class MockRemoteEvent {
	private serverConnections: Array<(player: Player, ...args: Array<unknown>) => void> = [];
	private clientConnections: Array<(...args: Array<unknown>) => void> = [];

	public Parent: Instance | undefined;
	public Name: string = "";

	public readonly OnServerEvent = {
		serverConnections: this.serverConnections,
		Connect(callback: (player: Player, ...args: Array<unknown>) => void) {
			const serverConnections = this.serverConnections
			serverConnections.push(callback);
			return {
				Disconnect() {
					const idx = serverConnections.indexOf(callback);
					if (idx !== -1) {
						serverConnections.remove(idx);
					}
				},
			};
		},
	};

	public readonly OnClientEvent = {
		clientConnections: this.clientConnections,
		Connect(callback: (...args: Array<unknown>) => void) {
			const clientConnections = this.clientConnections
			clientConnections.push(callback);
			return {
				Disconnect() {
					const idx = clientConnections.indexOf(callback);
					if (idx !== -1) {
						clientConnections.remove(idx);
					}
				},
			};
		},
	};

	public FireServer(...args: Array<unknown>): void {
		const mockPlayer = {} as Player;
		for (const cb of this.serverConnections) {
			cb(mockPlayer, ...args);
		}
	}

	public FireClient(_player: Player, ...args: Array<unknown>): void {
		for (const cb of this.clientConnections) {
			cb(...args);
		}
	}

	public FireAllClients(...args: Array<unknown>): void {
		for (const cb of this.clientConnections) {
			cb(...args);
		}
	}

	public Destroy(): void {
		const sc = this.serverConnections;
		while (sc.size() > 0) sc.pop();
		const cc = this.clientConnections;
		while (cc.size() > 0) cc.pop();
	}

	public IsA(className: string): boolean {
		return className === "RemoteEvent";
	}
}
