# Agent Instructions

- Use `./.tmp/` for temp files. No OS temp.
- Use **pnpm** for package management and `./scripts/build.mjs` scopes
  (`all`, `packages`, `test`) for builds.
- AI commits MUST include a `Co-Authored-By:` attribution line.

## Setup

```bash
pnpm setup
```

## Commands

| Task           | Command               |
| -------------- | --------------------- |
| Build all      | `pnpm build`          |
| Build packages | `pnpm build:packages` |
| Build tests    | `pnpm build:test`     |
| Dev (watch)    | `pnpm dev`            |
| Lint           | `pnpm lint:fix`       |
| Typecheck      | `pnpm typecheck`      |
| Test           | `pnpm test`           |
| Changeset      | `pnpm changeset`      |
| Version        | `pnpm version`        |
| Release        | `pnpm release`        |

## Verification

Run `pnpm lint:fix`, `pnpm typecheck`, `pnpm build`, and `pnpm test` (or the
relevant test package's `pnpm test` with a path pattern). Report exact
tests/tools run and blockers.

## Project Conventions

- Packages live in `packages/<name>` and their test projects in `test/<name>`.
- Package names are `@lisachandra/<name>`; test packages are
  `@lisachandra/test-<name>` and private.
- Workspace deps use `workspace:*`; tooling versions come from the pnpm
  catalog in `pnpm-workspace.yaml`.
- Release notes are changesets; every user-facing change gets one.
