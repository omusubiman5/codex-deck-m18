param(
  [switch]$DryRun,
  [switch]$ForceRestart
)

$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'launcher\Start-CodexDeck.ps1'
$adapter = Join-Path $PSScriptRoot 'codex-deck-m18-adapter.exe'
$runtime = Join-Path $PSScriptRoot 'codex-deck-m18.mjs'

foreach ($required in @($launcher, $adapter, $runtime)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Required M18 component not found: $required" }
}

if ($DryRun) {
  & $launcher -DryRun
  & $adapter --probe
  exit $LASTEXITCODE
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 20 or newer is required.' }
$major = [int]((& $node.Source --version).TrimStart('v').Split('.')[0])
if ($major -lt 20) { throw "Node.js 20 or newer is required; found major version $major." }

if ($ForceRestart) { & $launcher -ForceRestart } else { & $launcher }
& $node.Source $runtime
exit $LASTEXITCODE
