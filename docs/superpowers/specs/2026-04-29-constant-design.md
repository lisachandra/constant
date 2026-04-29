# constant Design Spec

## Goal
Build **constant** as a strongly-typed, chainable constant manager for `roblox-ts` that merges script defaults, persisted JSON values, and live Studio edits through an Iris debug UI.

## Scope
- Typed builder API for client/server constants
- Flat JSON persistence model for `constants.json`
- Studio-only live editor integration with `@rbxts/iris`
- Plugin/io-serve bridge contract for writing changes back to disk
- Default-change detection via persisted metadata

## Priority Chain
Constant values resolve in this order:
1. Live in-memory override from the Iris editor
2. Persisted JSON value from the matching scope file
3. Script default passed to `.add(name, defaultValue)`

Live edits are authoritative for the current session. Persisted JSON is authoritative across sessions. Script defaults define the fallback and source-of-truth type.

## Filesystem Layout
- `src/client/constants.json`
- `src/server/constants.json`

Persisted JSON stays flat for easy diffing and manual editing.

### Persisted Shape
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

## Supported Values
`constant` accepts JSON-friendly Roblox primitives:
- `number`
- `string`
- `boolean`
- `Color3`
- `Vector3`
- `CFrame`
- `EnumItem`
- `undefined`

Instances, functions, arrays, and arbitrary tables are rejected at the type level.

## Public API
```ts
type SupportedPrimitive =
  | number
  | string
  | boolean
  | Color3
  | Vector3
  | CFrame
  | EnumItem
  | undefined;

type AddConstant<T, K extends string, V extends SupportedPrimitive> =
  T & { readonly [P in K]: V };

class Constant<T extends object = {}> {
  constructor(scope: "client" | "server");

  add<K extends string, V extends SupportedPrimitive>(
    name: K,
    defaultValue: V,
  ): Constant<AddConstant<T, K, V>>;

  build(): T;
}
```

## Builder Behavior
- `new Constant(scope)` loads persisted data for the selected scope
- `.add()` records the default definition, resolves the effective value, and refines the builder type
- `.build()` returns the immutable typed value object for game code
- The builder also retains definition metadata for tooling and debug UI generation

## Resolution Rules
For each constant name:
1. If a live override exists, use it
2. Else if persisted JSON has a value, use it
3. Else use the script default

### Changed Default Detection
The JSON `_defaults` map stores the default that was last seen when the file was written.

When `.add(name, defaultValue)` runs:
- if no persisted value exists, use the script default
- if a persisted value exists and `_defaults[name]` matches the current script default, use the persisted value
- if a persisted value exists and `_defaults[name]` differs from the current script default, mark the constant as drifted for UI review and continue using the persisted value until explicitly reset or overwritten

This preserves designer tweaks while making changed hardcoded defaults visible.

## Runtime Model
### Constant Definition Record
Each definition tracks:
- `name`
- `scope`
- `kind`
- `defaultValue`
- `currentValue`
- `persistedValue`
- `hasPersistedValue`
- `hasLiveOverride`
- `defaultDrifted`

### Scope Separation
Client and server scopes do not share storage or live overrides. Each scope owns its own JSON file and UI session.

## Persistence Bridge
`constant` does not write directly to disk from game code.

### Flow
1. Iris UI changes a value in Studio
2. Runtime updates the in-memory constant immediately
3. In `manual` mode, changes stay preview-only until saved
4. In `auto` mode, or after a manual save, runtime emits a persist-intent bridge request
5. The Studio plugin receives the payload from `ReplicatedStorage/constant/PersistRequested`
6. The plugin updates the in-memory scope snapshot
7. The plugin debounces writes and forwards the final JSON payload to `io-serve`
8. Rojo syncs the file back into Studio

### Bridge Payload
```ts
interface ConstantUpdatePayload {
  scope: "client" | "server";
  name: string;
  serializedValue: unknown;
  serializedDefault: unknown;
}
```

### Studio Transport
A shared `BindableEvent` at `ReplicatedStorage/constant/PersistRequested` carries persist-intent payloads from the runtime package to the Studio plugin.

Runtime behavior:
- preview-only edits stay local in manual mode
- persisted edits emit `ConstantUpdatePayload`

Plugin behavior:
- subscribes to `PersistRequested`
- updates per-scope in-memory snapshots
- debounces flushes
- writes final JSON through `io-serve`

## Serialization Rules
To remain flat JSON, non-JSON Roblox primitives serialize into tagged objects.

```ts
type SerializedConstant =
  | number
  | string
  | boolean
  | null
  | { type: "Color3"; value: [number, number, number] }
  | { type: "Vector3"; value: [number, number, number] }
  | { type: "CFrame"; value: number[] }
  | { type: "EnumItem"; enum: string; item: string };
```

`undefined` persists as `null` or omission depending on file writer policy, but the runtime API exposes it as `undefined`.

## Iris Editor
The editor is generated from definition metadata instead of handwritten per-constant widgets.

### Correct `@rbxts/iris` Mapping
| Constant type | Iris API |
| --- | --- |
| `number` | `Iris.InputNum` or `Iris.SliderNum` |
| `boolean` | `Iris.Checkbox` |
| `string` | `Iris.InputText` |
| `Color3` | `Iris.InputColor3` |
| `Vector3` | `Iris.InputVector3` |

Notes:
- `@rbxts/iris` exposes `InputColor3`, not `ColorEdit`
- `Iris.PopId` requires the same id argument passed to `Iris.PushId`
- `Iris.End()` must always be called after `Iris.Window(...)`
- Numeric widgets expose `numberChanged()` and state fields like `state.number`
- Text widgets expose `textChanged()` and `state.text`
- Checkbox state lives at `state.isChecked`

### Editor Behavior
- Studio/admin gated
- One window per scope
- Per-row label, editor widget, current value display, and reset-to-default action
- Drifted defaults are visually marked
- Changing a widget updates live state immediately and emits a persistence request
- Editor persist mode supports `manual` preview changes or `auto` persistence
- Manual mode supports per-row save and save-all for previewed values

### Example Widget Logic
```ts
const window = Iris.Window(["Constant Editor"]);
for (const definition of definitions) {
  Iris.PushId(definition.name);

  const slider = Iris.SliderNum([definition.name, 0.1, 0, 100], {
    number: definition.currentValue as number,
  });

  if (slider.numberChanged()) {
    updateValue(definition.name, slider.state.number);
  }

  Iris.PopId(definition.name);
}
Iris.End();
```

## Security Rules
- Editing is disabled outside Studio unless an explicit privileged runtime policy allows it
- Plugin and bridge code must reject non-Studio callers by default
- Server-side update endpoints must verify caller identity before mutating shared values

## Package Boundaries
### `@lisachandra/constant`
Owns:
- builder API
- value resolution
- metadata tracking
- serialization helpers
- Iris editor runtime
- bridge event emission

### `@lisachandra/plugin`
Owns:
- Studio listener for runtime update messages
- `io-serve` HTTP forwarding
- disk sync orchestration

## Testing Strategy
- unit tests for add/build typing behavior where feasible
- unit tests for serialization and deserialization
- unit tests for resolution priority
- unit tests for default drift detection
- integration tests for Iris widget event handling with mocked update sinks
- plugin tests for bridge payload forwarding

## Success Criteria
- `.build()` returns strongly typed constants inferred from chained `.add()` calls
- persisted values override script defaults without losing type fidelity
- live Iris edits update runtime state using the actual `@rbxts/iris` API
- persisted files remain flat and readable
- changed script defaults are detectable without silently deleting designer overrides
