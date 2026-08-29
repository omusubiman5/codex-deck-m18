$ErrorActionPreference = 'Continue'
$runtimeRoot = $PSScriptRoot
$launcher = Join-Path $runtimeRoot 'launcher\Start-CodexDeck.ps1'
$runtime = Join-Path $runtimeRoot 'codex-deck-m18.mjs'
$log = Join-Path (Split-Path -Parent $runtimeRoot) 'm18.log'
$mutex = [Threading.Mutex]::new($false, 'Local\CodexDeckM18Watcher')
$logLimitBytes = 8MB
$retrySeconds = 5
$maxRetrySeconds = 60

if (-not $mutex.WaitOne(0)) { exit 0 }

function Rotate-M18Log {
  if (-not (Test-Path -LiteralPath $log)) { return }
  $item = Get-Item -LiteralPath $log -ErrorAction SilentlyContinue
  if ($null -eq $item -or $item.Length -lt $logLimitBytes) { return }
  $previous = "$log.previous"
  Remove-Item -LiteralPath $previous -Force -ErrorAction SilentlyContinue
  Move-Item -LiteralPath $log -Destination $previous -Force
}

function Write-M18Log([string]$Message) {
  Rotate-M18Log
  $line = "[$([DateTimeOffset]::Now.ToString('o'))] $Message"
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

function Invoke-M18LoggedCommand([string]$FilePath, [object[]]$Arguments = @()) {
  Rotate-M18Log
  & $FilePath @Arguments 2>&1 | ForEach-Object {
    Add-Content -LiteralPath $log -Value ([string]$_) -Encoding UTF8
  }
  $LASTEXITCODE
}
try {
  Write-M18Log 'M18 watcher started.'
  while ($true) {
    $cycleStarted = [DateTimeOffset]::Now
    try {
      $node = Get-Command node -ErrorAction Stop
      $launcherExit = Invoke-M18LoggedCommand $launcher
      if ($launcherExit -ne 0) { throw "Codex Deck launcher exited with code $launcherExit" }
      Write-M18Log 'Starting M18 runtime.'
      $runtimeExit = Invoke-M18LoggedCommand $node.Source @($runtime)
      Write-M18Log "M18 runtime exited with code $runtimeExit; retrying."
    } catch {
      Write-M18Log "M18 watcher cycle failed: $($_.Exception.Message)"
    }
    $elapsed = ([DateTimeOffset]::Now - $cycleStarted).TotalSeconds
    if ($elapsed -ge 30) { $retrySeconds = 5 }
    Write-M18Log "Retrying M18 startup in $retrySeconds seconds."
    Start-Sleep -Seconds $retrySeconds
    if ($elapsed -lt 30) { $retrySeconds = [Math]::Min($maxRetrySeconds, $retrySeconds * 2) }
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
