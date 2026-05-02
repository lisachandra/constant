# Manual demo checklist

This place is for hand-verifying the integrated constant + plugin flow.

## Start the demo
1. Build packages:
   - `pnpm --filter @lisachandra/constant build`
   - `pnpm --filter @lisachandra/plugin build`
   - `pnpm --filter @lisachandra/test-demo build`
2. Start the demo services from `test/demo`:
   - `pnpm serve:rbx-tree`
   - `pnpm serve:sourcemap`
   - `pnpm serve:rojo`
3. Build/install the Studio plugin artifact:
   - `pnpm --filter @lisachandra/plugin build:plugin`
4. Open the place in Studio with the plugin enabled.

## Verify runtime flows
- Press `F8` to toggle the client constant editor UI.
- Open the `Client Constants` Iris window.
- Confirm client values affect walk speed, head color, and the billboard text.
- Confirm server values affect the neon marker part, its position/size/color, and the world billboard text.

## Verify replicated edit flows
- Edit a client constant and save it from the editor.
- Confirm the request goes through the new remote replication path.
- Confirm the authoritative server update comes back to the client.
- Confirm approved updates drive persistence from the server path rather than directly from the client.

## Verify persistence flows
- Client constants use `persistMode: manual`.
  - Edit a client value.
  - Confirm the place changes immediately.
  - Confirm `src/client/constants.json` does not update until `Save <NAME>` or `Save All Preview Changes` is clicked.
- Confirm approved client edits are persisted by the server-backed plugin bridge.
- Confirm `src/server/constants.json` updates through `io-serve` after approved updates.

## Verify rehydration/reset flows
- Restart play mode or reopen the place.
- Confirm persisted values are loaded back in.
- Change a script default in `src/client/main.client.ts` or `src/server/main.server.ts`, rebuild, and confirm the editor shows the default drift warning for any persisted key whose default changed.

## Replication note
- `@lisachandra/constant` now has an opt-in remote replication layer.
- The intended authoritative flow is: client editor -> remote request -> server approval -> broadcast -> persistence.
- Persistence must remain on the server side to avoid the `Http requests can only be executed by game server` error.
