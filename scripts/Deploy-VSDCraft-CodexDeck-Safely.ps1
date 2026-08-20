[CmdletBinding()]
param(
  [string]$PluginSource,
  [int]$GracefulExitTimeoutSeconds = 20,
  [switch]$HotPatchRunning,
  [switch]$StartVSDCraft
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $PluginSource) {
  $PluginSource = Join-Path $root 'dist-vsd-craft\com.simeo.codex-deck.sdPlugin'
}
$pluginTarget = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins\com.simeo.codex-deck.sdPlugin'))
$pluginSourceFull = [IO.Path]::GetFullPath($PluginSource)
$stateRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck'))
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$runRoot = Join-Path $stateRoot (Join-Path 'live-runs' $runId)
$backupRoot = Join-Path $runRoot 'backup'
$evidenceRoot = Join-Path $runRoot 'evidence'

function Get-CodexDesktopProcesses {
  $all = @(Get-CimInstance Win32_Process)
  $codexUi = @($all | Where-Object {
    $_.Name -eq 'ChatGPT.exe' -and $_.ExecutablePath -and $_.ExecutablePath.IndexOf('\WindowsApps\OpenAI.Codex_', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  $codexUiIds = @($codexUi.ProcessId)
  $roots = @($codexUi | Where-Object { $_.ParentProcessId -notin $codexUiIds })
  $main = @($all | Where-Object {
    $_.Name -eq 'codex.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf('features.code_mode_host=true', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  @($roots) + @($main)
}

function Get-VSDRuntimeProcesses {
  @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'VSD Craft.exe' -or
    ($_.CommandLine -and $_.CommandLine.IndexOf($pluginTarget, [StringComparison]::OrdinalIgnoreCase) -ge 0)
  })
}

function Write-ProcessSnapshot([string]$Name) {
  $snapshot = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'VSD Craft.exe' -or
    ($_.ExecutablePath -and $_.ExecutablePath.IndexOf('\AppData\Local\OpenAI\Codex\', [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
    ($_.CommandLine -and $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin', [StringComparison]::OrdinalIgnoreCase) -ge 0)
  } | Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine
  $snapshot | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidenceRoot "$Name-processes.json") -Encoding utf8
}

if (-not (Test-Path -LiteralPath (Join-Path $pluginSourceFull 'manifest.json'))) {
  throw "Built VSD Craft plugin is missing: $pluginSourceFull"
}

New-Item -ItemType Directory -Force -Path $backupRoot, $evidenceRoot | Out-Null
$codexBaseline = Get-CodexDesktopProcesses
$codexBaselineIds = @($codexBaseline.ProcessId)
if ($codexBaselineIds.Count -eq 0) { throw 'Codex Desktop baseline was not found; refusing live deployment.' }

Write-ProcessSnapshot 'before'
$codexBaseline | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'codex-baseline.json') -Encoding utf8

if (Test-Path -LiteralPath $pluginTarget) {
  Copy-Item -LiteralPath $pluginTarget -Destination (Join-Path $backupRoot 'com.simeo.codex-deck.sdPlugin') -Recurse
}

$profileRoot = Join-Path $env:APPDATA 'HotSpot\StreamDock\profiles'
if (Test-Path -LiteralPath $profileRoot) {
  $profileBackupRoot = Join-Path $backupRoot 'profiles'
  New-Item -ItemType Directory -Force -Path $profileBackupRoot | Out-Null
  $codexM18ProfileIds = @(
    '958M229P-ODG0-T190-KT30-D18NN43IM5HZ',
    'E20ACZ9G-35Q9-UTQ7-9VN0-38058CP6N18K',
    '2YD4ACZ2-8K19-0184-XYLF-H11W2P0MWH22'
  )
  foreach ($profileId in $codexM18ProfileIds) {
    $profileSource = Join-Path $profileRoot "$profileId.sdProfile"
    if (-not (Test-Path -LiteralPath (Join-Path $profileSource 'manifest.json'))) {
      throw "Required Codex M18 profile is missing: $profileId"
    }
    $profileDestination = Join-Path $profileBackupRoot "$profileId.sdProfile"
    & robocopy.exe $profileSource $profileDestination /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Profile backup failed with robocopy exit code ${LASTEXITCODE}: $profileId" }
  }
}

foreach ($logName in @('watcher.log', 'watcher-recovery.json', 'm18-events.log')) {
  $logPath = Join-Path $stateRoot $logName
  if (Test-Path -LiteralPath $logPath) { Copy-Item -LiteralPath $logPath -Destination (Join-Path $backupRoot $logName) }
}

if ($HotPatchRunning) {
  & robocopy.exe $pluginSourceFull $pluginTarget /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Running plugin hot patch failed with robocopy exit code ${LASTEXITCODE}." }

  $watcherProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('powershell.exe', 'pwsh.exe') -and
    $_.CommandLine -and
    $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\launcher\Watch-CodexDeck.ps1', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  foreach ($watcherProcess in $watcherProcesses) {
    Stop-Process -Id $watcherProcess.ProcessId -ErrorAction Stop
  }

  $watcherDeadline = (Get-Date).AddSeconds(10)
  do {
    Start-Sleep -Milliseconds 250
    $activeWatcher = @(Get-CimInstance Win32_Process | Where-Object {
      $_.Name -in @('powershell.exe', 'pwsh.exe') -and
      $_.CommandLine -and
      $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\launcher\Watch-CodexDeck.ps1', [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
  } while ($activeWatcher.Count -eq 0 -and (Get-Date) -lt $watcherDeadline)
  if ($activeWatcher.Count -eq 0) {
    $watcherPath = Join-Path $pluginTarget 'launcher\Watch-CodexDeck.ps1'
    Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $watcherPath) -WindowStyle Hidden
    Start-Sleep -Seconds 1
    $activeWatcher = @(Get-CimInstance Win32_Process | Where-Object {
      $_.Name -in @('powershell.exe', 'pwsh.exe') -and
      $_.CommandLine -and
      $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\launcher\Watch-CodexDeck.ps1', [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
  }
  if ($activeWatcher.Count -ne 1) { throw "Expected one observation watcher after hot patch; found $($activeWatcher.Count)." }

  $hashFiles = @('bin\plugin.mjs', 'launcher\Watch-CodexDeck.ps1', 'launcher\Start-CodexDeck.ps1', 'manifest.json')
  $hashResults = foreach ($relativePath in $hashFiles) {
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $pluginSourceFull $relativePath) -Algorithm SHA256).Hash
    $installedHash = (Get-FileHash -LiteralPath (Join-Path $pluginTarget $relativePath) -Algorithm SHA256).Hash
    [pscustomobject]@{ File = $relativePath; Source = $sourceHash; Installed = $installedHash; Match = ($sourceHash -eq $installedHash) }
  }
  $hashResults | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'installed-hashes.json') -Encoding utf8
  if (@($hashResults | Where-Object { -not $_.Match }).Count -gt 0) { throw 'Hot-patched plugin hash verification failed.' }

  $codexAfterHotPatch = Get-CodexDesktopProcesses
  $missingCodex = @($codexBaselineIds | Where-Object { $_ -notin @($codexAfterHotPatch.ProcessId) })
  if ($missingCodex.Count -gt 0) { throw "Codex baseline process changed during hot patch: $($missingCodex -join ', ')" }
  Write-ProcessSnapshot 'after-hot-patch'
  [pscustomobject]@{
    RunRoot = $runRoot
    BackupRoot = $backupRoot
    EvidenceRoot = $evidenceRoot
    CodexBaselineProcessIds = $codexBaselineIds
    WatcherProcessId = $activeWatcher[0].ProcessId
    HashesMatch = $true
    PluginReloadPending = $true
  } | ConvertTo-Json -Depth 4
  return
}

$vsdRoots = @(Get-Process -Name 'VSD Craft' -ErrorAction SilentlyContinue)
foreach ($process in $vsdRoots) { $null = $process.CloseMainWindow() }
$deadline = (Get-Date).AddSeconds($GracefulExitTimeoutSeconds)
do {
  Start-Sleep -Milliseconds 250
  $remainingRoots = @(Get-Process -Name 'VSD Craft' -ErrorAction SilentlyContinue)
} while ($remainingRoots.Count -gt 0 -and (Get-Date) -lt $deadline)
if ($remainingRoots.Count -gt 0) {
  throw 'VSD Craft did not exit normally. No forced termination was used; deployment stopped.'
}

$remainingRuntime = @(Get-VSDRuntimeProcesses)
if ($remainingRuntime.Count -gt 0) {
  throw "VSD Craft child runtime remained after graceful exit. Deployment stopped: $($remainingRuntime.ProcessId -join ', ')"
}

$staging = Join-Path (Split-Path $pluginTarget -Parent) (".codex-deck-stage-" + $runId)
Copy-Item -LiteralPath $pluginSourceFull -Destination $staging -Recurse
if (Test-Path -LiteralPath $pluginTarget) {
  Move-Item -LiteralPath $pluginTarget -Destination (Join-Path $backupRoot 'installed-original')
}
Move-Item -LiteralPath $staging -Destination $pluginTarget

$hashFiles = @('bin\plugin.mjs', 'launcher\Watch-CodexDeck.ps1', 'launcher\Start-CodexDeck.ps1', 'manifest.json')
$hashResults = foreach ($relativePath in $hashFiles) {
  $sourceHash = (Get-FileHash -LiteralPath (Join-Path $pluginSourceFull $relativePath) -Algorithm SHA256).Hash
  $installedHash = (Get-FileHash -LiteralPath (Join-Path $pluginTarget $relativePath) -Algorithm SHA256).Hash
  [pscustomobject]@{ File = $relativePath; Source = $sourceHash; Installed = $installedHash; Match = ($sourceHash -eq $installedHash) }
}
$hashResults | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'installed-hashes.json') -Encoding utf8
if (@($hashResults | Where-Object { -not $_.Match }).Count -gt 0) { throw 'Installed plugin hash verification failed.' }

$codexAfterInstall = Get-CodexDesktopProcesses
$missingCodex = @($codexBaselineIds | Where-Object { $_ -notin @($codexAfterInstall.ProcessId) })
if ($missingCodex.Count -gt 0) { throw "Codex baseline process changed during deployment: $($missingCodex -join ', ')" }

if ($StartVSDCraft) {
  $vsdExecutable = @(
    'C:\Program Files (x86)\VSD Craft\VSD Craft.exe',
    'C:\Program Files\VSD Craft\VSD Craft.exe',
    (Join-Path $env:LOCALAPPDATA 'Programs\VSD Craft\VSD Craft.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $vsdExecutable) { throw 'VSD Craft executable was not found.' }
  Start-Process -FilePath $vsdExecutable
}

Write-ProcessSnapshot 'after'
[pscustomobject]@{
  RunRoot = $runRoot
  BackupRoot = $backupRoot
  EvidenceRoot = $evidenceRoot
  CodexBaselineProcessIds = $codexBaselineIds
  VSDCraftStarted = $StartVSDCraft.IsPresent
  HashesMatch = $true
} | ConvertTo-Json -Depth 4
