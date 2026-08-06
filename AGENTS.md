# Agent Instructions

- Use `./.tmp/` for temp files. No OS temp.
- Use **pnpm** for package management and `./scripts/build.mjs` scopes
  (`all`, `packages`, `test`) for builds.

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

## Commit Attribution

AI commits MUST include:

```text
Co-Authored-By: (the agent's name and attribution byline)
```

## Agent Workflow

- Check matching GitHub issue/sub-issue when useful. Mention in plan and
  summary.
- Before changeset: check related changesets. Avoid duplicate.
- One commit may have many changesets when user-facing behaviors differ.
- After work: create/update issues for material follow-up. Do not bury follow-up
  in chat.

## Verification

- `pnpm lint:fix`, `pnpm typecheck`, `pnpm build`
- Always use the most efficient test option:
    - selective tests: `pnpm --filter @lisachandra/test-<name> test --testPathPattern <pattern>`
    - all tests: `pnpm test`
- Report exact tests/tools run and blockers.

## Project Conventions

- Packages live in `packages/<name>` and their test projects in `test/<name>`.
- Package names are `@lisachandra/<name>`; test packages are
  `@lisachandra/test-<name>` and private.
- Workspace deps use `workspace:*`; tooling versions come from the pnpm
  catalog in `pnpm-workspace.yaml`.
- Release notes are changesets; every user-facing change gets one.
