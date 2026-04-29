# Agent Instructions

## Package Manager
Use **pnpm**: `pnpm install`, `pnpm build`, `pnpm serve`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Build package | `pnpm --filter @lisachandra/constant build` |
| Build plugin | `pnpm --filter @lisachandra/plugin build` |
| Build test place | `pnpm --filter @lisachandra/test-constant build` |
| Run constant tests | `pnpm --filter @lisachandra/test-constant test` |
| Run plugin tests | `pnpm --filter @lisachandra/test-plugin test` |

## Monorepo Layout
- `packages/constant`: runtime library
- `packages/plugin`: Studio plugin bridge
- `test/constant`: runtime test place
- `test/plugin`: plugin test place
- `docs/superpowers/specs`: specs and design docs

## Key Conventions
- Prefer `roblox-ts` source in `src/` and compiled output in `out/`
- Keep client/server persistence scoped separately
- Use the real `@rbxts/iris` API names: `InputColor3`, `InputVector3`, `InputNum`, `SliderNum`, `Checkbox`, `InputText`
- Always pair `Iris.Window(...)` with `Iris.End()` and `Iris.PushId(id)` with `Iris.PopId(id)`
- Guard live-edit features for Studio or privileged users only
