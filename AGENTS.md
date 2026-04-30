# Agent Instructions

## Project Overview
- `constant` is a Roblox-TS monorepo for live-editable constants.
- It includes a runtime library, a Studio plugin bridge, and test places for both.
- The plugin syncs constant updates to JSON files through `io-serve`.

## Package Manager
- Use **pnpm**: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm --filter <pkg> build`

## Commit Attribution
- AI commits MUST include:
```
Co-Authored-By: Dirac <noreply@example.com>
```

## File-Scoped Commands
| Task | Command |
|------|---------|
| Build runtime package | `pnpm --filter @lisachandra/constant build` |
| Build plugin package | `pnpm --filter @lisachandra/plugin build` |
| Build installable plugin artifact | `pnpm --filter @lisachandra/plugin build:plugin` |
| Build constant test place | `pnpm --filter @lisachandra/test-constant build` |
| Build plugin test place | `pnpm --filter @lisachandra/test-plugin build` |
| Run constant tests | `pnpm --filter @lisachandra/test-constant test` |
| Run plugin tests | `pnpm --filter @lisachandra/test-plugin test` |

## Monorepo Layout
- `packages/constant`: runtime library
- `packages/plugin`: Studio plugin package and bridge runtime
- `test/constant`: runtime test place
- `test/plugin`: plugin test place
- `docs/superpowers/specs`: design specs

## Key Conventions
- Keep `roblox-ts` source in `src/`; compiled output belongs in `out/`.
- Keep client and server persistence outputs scoped separately.
- Public TS APIs should follow the TSDoc policy in `.diracrules/rules/documentation.md`.
- Use real `@rbxts/iris` API names: `InputColor3`, `InputVector3`, `InputNum`, `SliderNum`, `Checkbox`, `InputText`.
- Pair `Iris.Window(...)` with `Iris.End()` and `Iris.PushId(id)` with `Iris.PopId(id)`.
- Guard live-edit and Studio-only behavior behind Studio/plugin context checks.
- For plugin work, verify both package build and generated `.rbxm` artifact shape.
