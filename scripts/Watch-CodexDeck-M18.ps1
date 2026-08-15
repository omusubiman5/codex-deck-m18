$ErrorActionPreference = 'Continue'
$runtimeRoot = $PSScriptRoot
$launcher = Join-Path $runtimeRoot 'launcher\Start-CodexDeck.ps1'
$runtime = Join-Path $runtimeRoot 'codex-deck-m18.mjs'
$log = Join-Path (Split-Path -Parent $runtimeRoot) 'm18.log'
$mutex = [Threading.Mutex]::new($false, 'Local\CodexDeckM18Watcher')

if (-not $mutex.WaitOne(0)) { exit 0 }

function Write-M18Log([string]$Message) {
  $line = "[$([DateTimeOffset]::Now.ToString('o'))] $Message"
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}
try {
  Write-M18Log 'M18 watcher started.'
  while ($true) {
    try {
      $node = Get-Command node -ErrorAction Stop
      & $launcher *>> $log
      if ($LASTEXITCODE -ne 0) { throw "Codex Deck launcher exited with code $LASTEXITCODE" }
      Write-M18Log 'Starting M18 runtime.'
      & $node.Source $runtime *>> $log
      Write-M18Log "M18 runtime exited with code $LASTEXITCODE; retrying."
    } catch {
      Write-M18Log "M18 watcher cycle failed: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 5
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
