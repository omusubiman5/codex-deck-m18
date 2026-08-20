[CmdletBinding()]
param([string]$OutputPath)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$installed = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins\com.simeo.codex-deck.sdPlugin'))
$built = Join-Path $root 'dist-vsd-craft\com.simeo.codex-deck.sdPlugin'
$stateRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck'))
if (-not $OutputPath) {
  $runRoot = Join-Path $stateRoot (Join-Path 'live-runs' ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-readiness'))
  New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
  $OutputPath = Join-Path $runRoot 'readiness.json'
}

$hashFiles = @('bin\plugin.mjs', 'launcher\Watch-CodexDeck.ps1', 'launcher\Start-CodexDeck.ps1', 'manifest.json')
$hashes = foreach ($relativePath in $hashFiles) {
  $installedHash = (Get-FileHash -LiteralPath (Join-Path $installed $relativePath) -Algorithm SHA256).Hash
  $builtHash = (Get-FileHash -LiteralPath (Join-Path $built $relativePath) -Algorithm SHA256).Hash
  [pscustomobject]@{ File = $relativePath; Installed = $installedHash; Built = $builtHash; Match = ($installedHash -eq $builtHash) }
}

$all = @(Get-CimInstance Win32_Process)
$codexUi = @($all | Where-Object {
  $_.Name -eq 'ChatGPT.exe' -and $_.ExecutablePath -and $_.ExecutablePath.IndexOf('\WindowsApps\OpenAI.Codex_', [StringComparison]::OrdinalIgnoreCase) -ge 0
})
$codexUiIds = @($codexUi.ProcessId)
$codexRoot = @($codexUi | Where-Object { $_.ParentProcessId -notin $codexUiIds })
$codexMain = @($all | Where-Object {
  $_.Name -eq 'codex.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf('features.code_mode_host=true', [StringComparison]::OrdinalIgnoreCase) -ge 0
})
$vsdCraft = @($all | Where-Object { $_.Name -eq 'VSD Craft.exe' })
$plugin = @($all | Where-Object {
  $_.ProcessId -ne $PID -and $_.Name -eq 'node20.exe' -and $_.CommandLine -and
  $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\bin\plugin.mjs', [StringComparison]::OrdinalIgnoreCase) -ge 0
})
$watcher = @($all | Where-Object {
  $_.ProcessId -ne $PID -and $_.Name -in @('powershell.exe', 'pwsh.exe') -and $_.CommandLine -and
  $_.CommandLine.IndexOf('-File', [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
  $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\launcher\Watch-CodexDeck.ps1', [StringComparison]::OrdinalIgnoreCase) -ge 0
})

$watcherSource = Get-Content -LiteralPath (Join-Path $installed 'launcher\Watch-CodexDeck.ps1') -Raw
$watcherObservationOnly = $watcherSource.Contains('observation-only mode') -and -not $watcherSource.Contains('ForceRestart')
$latestVsdLog = Get-ChildItem -LiteralPath (Join-Path $env:APPDATA 'HotSpot\StreamDock\logs') -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
$vsdLogText = if ($latestVsdLog) { Get-Content -LiteralPath $latestVsdLog.FullName -Raw } else { '' }
$pluginConnected = $vsdLogText -match 'com\.simeo\.codex-deck\.sdPlugin is now connected'
$m18WillAppearCount = ([regex]::Matches($vsdLogText, 'SDPluginServer::willAppear "VSDM18"')).Count

$ready = @($hashes | Where-Object { -not $_.Match }).Count -eq 0 -and
  $codexRoot.Count -eq 1 -and $codexMain.Count -eq 1 -and $vsdCraft.Count -eq 1 -and
  $plugin.Count -eq 1 -and $watcher.Count -eq 1 -and $watcherObservationOnly -and
  $pluginConnected -and $m18WillAppearCount -ge 15

$result = [pscustomobject]@{
  Timestamp = (Get-Date).ToString('o')
  Ready = $ready
  Hashes = $hashes
  Processes = [pscustomobject]@{
    CodexRoot = @($codexRoot.ProcessId)
    CodexMain = @($codexMain.ProcessId)
    VSDCraft = @($vsdCraft.ProcessId)
    Plugin = @($plugin.ProcessId)
    Watcher = @($watcher.ProcessId)
  }
  WatcherObservationOnly = $watcherObservationOnly
  VSDLog = if ($latestVsdLog) { $latestVsdLog.FullName } else { $null }
  PluginConnected = $pluginConnected
  M18WillAppearCount = $m18WillAppearCount
  PhysicalKeyPressesVerified = $false
}

$outputDirectory = Split-Path $OutputPath -Parent
if ($outputDirectory) { New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null }
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding utf8
$result | ConvertTo-Json -Depth 6
if (-not $ready) { exit 1 }
