/**
 * A mock RemoteEvent for use in jest-roblox tests.
 *
 * Provides bidirectional event routing within a single process: - FireServer(...) → triggers all
 * OnServerEvent.Connect callbacks - FireAllClients(...) / FireClient(...) → triggers all
 * OnClientEvent.Connect callbacks - Connect returns a connection handle whose Disconnect()
 * unsubscribes the callback.
 */
export class MockRemoteEvent {
	private readonly clientConnections: Array<(...args: Array<unknown>) => void> = [];
	private readonly serverConnections: Array<(player: Player, ...args: Array<unknown>) => void> =
		[];

	public Name = "";
	public Parent: Instance | undefined;

	public readonly OnServerEvent = {
		Connect(callback: (player: Player, ...args: Array<unknown>) => void) {
			const { serverConnections } = this;
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
		serverConnections: this.serverConnections,
	};

	public readonly OnClientEvent = {
		clientConnections: this.clientConnections,
		Connect(callback: (...args: Array<unknown>) => void) {
			const { clientConnections } = this;
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
		this.FireAllClients(...args);
	}

	public FireAllClients(...args: Array<unknown>): void {
		for (const cb of this.clientConnections) {
			cb(...args);
		}
	}

	public Destroy(): void {
		const sc = this.serverConnections;
		while (sc.size() > 0) {
			sc.pop();
		}

		const cc = this.clientConnections;
		while (cc.size() > 0) {
			cc.pop();
		}
	}

	public IsA(className: string): boolean {
		return className === "RemoteEvent";
	}
}
