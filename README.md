# constant

Strongly-typed, chainable runtime constants for `roblox-ts` with Studio live editing, JSON persistence, and a plugin bridge for `io-serve`.

## Packages

- `@lisachandra/constant` — runtime constants, serialization, Iris editor, transport helpers, remote replication
- `@lisachandra/plugin` — Studio bridge, persistence coordinator, `io-serve` writers
- `@lisachandra/test-constant` — runtime test place and example wiring
- `@lisachandra/test-plugin` — plugin-side tests and bootstrap wiring

## What it does

`constant` resolves values through a priority chain:

1. live in-memory edits
2. persisted JSON values (nested by source path)
3. script defaults

It gives you:

- typed chained `.add()` inference
- client/server scope separation
- Studio-only live editing through `@rbxts/iris`
- manual preview mode or auto-persist mode
- plugin-side debounced persistence pipeline with `io-serve`
- remote replication for server-authoritative persistence

## Setup

Before creating any constants, configure the persistence file for the current scope:

```ts
import { configureConstant } from "@lisachandra/constant";

// Client scope
configureConstant("src/client/constants.json", import("./constants.json").expect() as never);

// Server scope (in a server script)
configureConstant("src/server/constants.json", import("./server/constants.json").expect() as never);
```

To bind the Iris editor hotkey (client only), pass editor options as a third argument:

```ts
configureConstant("src/client/constants.json", import("./constants.json").expect() as never, {
	keyCode: Enum.KeyCode.F8,
	title: "Client Constants",
});
```

## Runtime usage

```ts
import { Constant } from "@lisachandra/constant";

const clientConstants = new Constant()
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("THEME_COLOR", Color3.fromRGB(255, 0, 0));

const c = clientConstants.build();
print(c.WALK_SPEED);
```

## Persisted files

Expected JSON files:

- `src/client/constants.json`
- `src/server/constants.json`

Values are nested by source path so multiple scripts can contribute to the same file independently:

```json
{
  "src/client/main.client.ts": {
    "WALK_SPEED": 16,
    "_defaults": {
      "WALK_SPEED": 16
    }
  },
  "src/client/folder/second.client.ts": {
    "DEBUG_RAYCASTS": true,
    "THEME_COLOR": { "type": "Color3", "value": [0, 0.667, 1] },
    "_defaults": {
      "DEBUG_RAYCASTS": true,
      "THEME_COLOR": { "type": "Color3", "value": [0, 0.667, 1] }
    }
  }
}
```

Tagged Roblox values are stored as objects:

```json
{
  "THEME_COLOR": { "type": "Color3", "value": [1, 0, 0] },
  "SPAWN_OFFSET": { "type": "Vector3", "value": [0, 5, 0] }
}
```

## Iris editor

The runtime package uses the actual `@rbxts/iris` APIs:

- `Iris.DragNum` / `Iris.SliderNum`
- `Iris.InputNum`
- `Iris.Checkbox`
- `Iris.InputText`
- `Iris.DragVector3`
- `Iris.ColorEdit3`

Editor modes:

- `manual` — edits are preview-only until saved
- `auto` — edits emit persist-intent payloads immediately

```ts
import { Constant, createBindableEventSink } from "@lisachandra/constant";

const constants = new Constant()
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false);

constants.mountEditor({
	title: "Server Constants",
	persistMode: "manual",
});
```

## Transport

Persist-intent updates are sent through a shared `BindableEvent`:

- folder: `ReplicatedStorage/constant`
- event: `constant`

Runtime helpers:

```ts
import {
	createBindableEventSink,
	connectBindableTransport,
	publishBindableTransport,
} from "@lisachandra/constant";
```

Plugin helpers:

```ts
import {
	connectPluginTransport,
	getOrCreatePluginTransportEvent,
} from "@lisachandra/plugin";
```

## Remote replication

Server-authoritative update pipeline — client editors send update requests to the server, which validates, applies, and broadcasts the approved state back to all clients.

```ts
import { configureAutomaticConstantReplication } from "@lisachandra/constant";

configureAutomaticConstantReplication({
	canEdit: (player, request) => {
		// Only allow edits from specific players
		return true;
	},
});
```

## Plugin pipeline

The plugin package provides these layers:

- `transport.ts` — receive runtime payloads
- `persistence.ts` — apply sourcePath-nested updates and map scope to JSON path
- `service.ts` — keep per-scope snapshots in memory
- `coordinator.ts` — subscribe, accumulate, debounce, flush
- `writer.ts` — encode JSON and send through `io-serve`
- `bootstrap.ts` — create the HTTP writer and start the coordinator

Bootstrap example:

```ts
import { startConstantPluginBootstrap } from "@lisachandra/plugin";

const pluginBootstrap = startConstantPluginBootstrap({
	flushDelaySeconds: 0.25,
	autoFlush: true,
});
```
