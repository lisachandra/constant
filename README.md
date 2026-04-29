# constant

Strongly-typed, chainable runtime constants for `roblox-ts` with Studio live editing, JSON persistence, and a plugin bridge for `io-serve`.

## Packages
- `@lisachandra/constant` — runtime constants, serialization, Iris editor, transport helpers
- `@lisachandra/plugin` — Studio bridge, persistence coordinator, `io-serve` writers
- `@lisachandra/test-constant` — runtime test place and example editor wiring
- `@lisachandra/test-plugin` — plugin-side tests and bootstrap wiring

## What it does
`constant` resolves values through a priority chain:
1. live in-memory edits
2. persisted JSON values
3. script defaults

It gives you:
- typed chained `.add()` inference
- client/server scope separation
- Studio-only live editing through `@rbxts/iris`
- manual preview mode or auto-persist mode
- plugin-side debounced persistence pipeline

## Runtime usage
```ts
import { Constant } from "@lisachandra/constant";

const clientConstants = new Constant("client")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("THEME_COLOR", Color3.fromRGB(255, 0, 0));

const built = clientConstants.build();
print(built.WALK_SPEED);
```

## Persisted files
Expected JSON files:
- `src/client/constants.json`
- `src/server/constants.json`

Example shape:
```json
{
  "WALK_SPEED": 16,
  "DEBUG_RAYCASTS": false,
  "_defaults": {
    "WALK_SPEED": 16,
    "DEBUG_RAYCASTS": false
  }
}
```

Tagged Roblox values are stored as objects, for example:
```json
{
  "THEME_COLOR": { "type": "Color3", "value": [1, 0, 0] },
  "SPAWN_OFFSET": { "type": "Vector3", "value": [0, 5, 0] }
}
```

## Iris editor
The runtime package uses the actual `@rbxts/iris` APIs:
- `Iris.SliderNum`
- `Iris.InputNum`
- `Iris.Checkbox`
- `Iris.InputText`
- `Iris.InputColor3`
- `Iris.InputVector3`

Editor modes:
- `manual` — edits are preview-only until saved
- `auto` — edits emit persist-intent payloads immediately

Example:
```ts
import { Constant, createBindableEventSink } from "@lisachandra/constant";

const persistSink = createBindableEventSink();

const constants = new Constant("server")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false);

constants.mountEditor({
	title: "Server Constants",
	persistMode: "manual",
	onPersist: (payload) => persistSink.publish(payload),
});
```

## Transport
Persist-intent updates are sent through a shared `BindableEvent`:
- folder: `ReplicatedStorage/constant`
- event: `PersistRequested`

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

## Plugin pipeline
The plugin package currently provides these layers:
- `transport.ts` — receive runtime payloads
- `persistence.ts` — apply flat updates and map scope to JSON path
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

## Test-place wiring
Current sample wiring lives in:
- `test/constant/src/index.ts`
- `test/plugin/src/index.ts`

These show:
- mounted client/server editors
- bindable persistence publishing
- plugin bootstrap startup

## Current status
Implemented:
- typed builder API
- serialization/deserialization helpers
- drift detection through `_defaults`
- manual and auto persist editor modes
- bindable transport
- plugin persistence coordinator and writer abstractions
- sample JSON files and test-place wiring

Not fully finished yet:
- runtime loading from `src/client/constants.json` and `src/server/constants.json`
- confirmed final `io-serve` HTTP contract
- real Studio plugin packaging/bootstrap entry beyond the current module bootstrap

## Spec
Full design/spec:
- `docs/superpowers/specs/2026-04-29-constant-design.md`
