# Module-based `constant()` API Design

## Summary
Shift the design away from pure no-arg `constant()` and toward a module-based API where callers pass a persisted module handle. The module provides persisted values plus explicit persistence metadata, so runtime identity does not depend on `debug.info()`. `debug.info()` should only be used for script-path labeling in the editor UI.

## Recommended API
Primary ergonomic API:
```ts
import { constant } from "@lisachandra/constant";
import clientPersisted from "./constants";

const clientConstants = constant(clientPersisted)
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("THEME_COLOR", Color3.fromRGB(255, 0, 0))
	.add("STATUS_TEXT", "Client ready");
```

Equivalent constructor form:
```ts
const clientConstants = new Constant(clientPersisted)
	.add("WALK_SPEED", 16);
```

## Core decision
Use:
- `constant(persistedModule)` / `new Constant(persistedModule)`

Not:
- pure `constant()` with no arguments as the primary design

## Why this is better
A module argument gives the system:
- persisted values
- explicit persist path metadata
- a stable anchor for plugin persistence
- deterministic behavior without stack-based identity inference

That removes the need for runtime identity to come from `debug.info()`.

## `debug.info()` role
`debug.info()` should **not** decide which constant group is being constructed or where it persists.

It should only be used for:
- script path labeling in the UI
- optional human-readable editor titles
- diagnostics / display purposes

It should **not** be the source of truth for:
- persistence identity
- save path resolution
- constant-group ownership

## Persisted module shape
Recommended shape:
```ts
interface PersistedConstantModule {
	persistPath: string;
	values: PersistedConstantFile;
}
```

Example module:
```ts
export = {
	persistPath: "src/client/constants.json",
	values: {
		WALK_SPEED: 24,
		DEBUG_RAYCASTS: false,
		THEME_COLOR: { type: "Color3", value: [1, 0, 0] },
		STATUS_TEXT: "Client ready",
		_defaults: {
			WALK_SPEED: 16,
			DEBUG_RAYCASTS: false,
			THEME_COLOR: { type: "Color3", value: [1, 0, 0] },
			STATUS_TEXT: "Client ready",
		},
	},
} satisfies PersistedConstantModule;
```

## Runtime behavior
When `constant(persistedModule)` is called, runtime should:
1. read `persistedModule.values`
2. infer `scope` from runtime context or, if needed, from `persistPath`
3. retain `persistPath` metadata for persistence flows
4. construct the constant store from the provided values

## Plugin behavior
The plugin does **not** need to read `sourcemap.json` from disk for the primary persistence path.

Instead, it should receive or discover:
- the updated persisted snapshot
- the explicit `persistPath`

Then it writes directly through the existing local writer bridge (`io-serve` / HTTP writer).

## Why this avoids the sourcemap problem
A Studio plugin cannot directly rely on arbitrary local file reads. Using explicit `persistPath` metadata means:
- no sourcemap file-read requirement
- no sourcemap HTTP bridge requirement for basic save behavior
- no output-path to source-path guessing

Sourcemap can still exist as an optional validation tool, but it is no longer required for core persistence.

## Scope inference
Scope can still be inferred automatically:
- `RunService.IsClient()` -> `"client"`
- otherwise -> `"server"`

This is acceptable because scope is a small runtime property, not identity.

## Keep existing escape hatches
Retain explicit APIs for advanced/tests:
- `new Constant(scope, persisted)`
- `createConstant(scope, persisted)`

These remain useful for direct unit tests and low-level construction.

## Data flow
### Runtime
- caller imports persisted module
- caller passes persisted module to `constant(...)`
- runtime creates `ConstantStore` from `persistedModule.values`
- runtime/editor changes emit updated persistence payloads that include `persistPath`

### Plugin
- plugin receives persistence payload
- plugin uses `persistPath` from metadata/payload
- plugin writes JSON to that path via `io-serve`

## Repo impacts
### `packages/constant`
Likely changes:
- add exported `PersistedConstantModule` type
- add constructor/factory overloads for module-based input
- add input normalization for:
  - explicit `(scope, persisted)`
  - module-based `(persistedModule)`
- propagate `persistPath` through persistence/update payloads
- keep `debug.info()` usage limited to editor labeling

### `packages/plugin`
Likely changes:
- persist using explicit `persistPath` from runtime payloads
- stop relying on scope-only path mapping as the primary write target
- keep current HTTP write flow

## Migration example
Current:
```ts
import {
	Constant,
	createConstantReplicationClient,
	type PersistedConstantFile,
} from "@lisachandra/constant";
import clientPersistedData from "./constants.json";

const clientPersisted = clientPersistedData as unknown as PersistedConstantFile;
const clientConstants = new Constant("client", clientPersisted)
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false);
```

Proposed:
```ts
import {
	constant,
	createConstantReplicationClient,
} from "@lisachandra/constant";
import clientPersisted from "./constants";

const clientConstants = constant(clientPersisted)
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false);
```

## Testing strategy
- constructs from a persisted module
- preserves persisted override behavior
- infers client/server scope correctly
- carries `persistPath` through save flows
- plugin writes to explicit `persistPath`
- existing explicit constructor remains compatible
- `debug.info()` is only used for UI labels, not persistence identity

## Final recommendation
Implement **module-based construction** as the main ergonomic API:
- `constant(persistedModule)`
- `new Constant(persistedModule)`

Use explicit `persistPath` metadata for plugin saves, keep scope inference lightweight, and restrict `debug.info()` to UI labeling only.
