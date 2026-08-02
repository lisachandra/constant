$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
node "$Root/scripts/javascript/hoist.mjs"
