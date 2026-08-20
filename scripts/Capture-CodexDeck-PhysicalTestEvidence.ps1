param(
  [ValidateRange(10, 3600)]
  [int]$DurationSeconds = 600,
  [ValidateNotNullOrEmpty()]
  [string]$RunLabel = "physical-m18"
)

$ErrorActionPreference = "Stop"

function Get-CodexDeckProcesses {
  $all = Get-CimInstance Win32_Process
  $codexUi = @($all | Where-Object {
    $_.Name -eq "ChatGPT.exe" -and $_.ExecutablePath -and
    $_.ExecutablePath.IndexOf("\WindowsApps\OpenAI.Codex_", [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  $codexUiIds = @($codexUi.ProcessId)
  [ordered]@{
    Timestamp = (Get-Date).ToString("o")
    CodexRoot = @($codexUi | Where-Object { $_.ParentProcessId -notin $codexUiIds } | ForEach-Object ProcessId)
    CodexMain = @($all | Where-Object {
      $_.Name -eq "codex.exe" -and $_.CommandLine -and
      $_.CommandLine.IndexOf("features.code_mode_host=true", [StringComparison]::OrdinalIgnoreCase) -ge 0
    } | ForEach-Object ProcessId)
    VSDCraft = @($all | Where-Object { $_.Name -eq "VSD Craft.exe" } | ForEach-Object ProcessId)
    Plugin = @($all | Where-Object {
      $_.CommandLine -match "com\.simeo\.codex-deck\.sdPlugin\\bin\\plugin\.mjs"
    } | ForEach-Object ProcessId)
    Watcher = @($all | Where-Object {
      $_.CommandLine -match "-File .*com\.simeo\.codex-deck\.sdPlugin\\launcher\\Watch-CodexDeck\.ps1"
    } | ForEach-Object ProcessId)
  }
}

function Assert-SingleProcess([hashtable]$Snapshot, [string]$Name) {
  if (@($Snapshot[$Name]).Count -ne 1) {
    throw "Expected exactly one $Name process before physical testing; found $(@($Snapshot[$Name]).Count)."
  }
}

function Get-LatestLog([string]$Directory, [string]$Filter) {
  Get-ChildItem $Directory -File -Filter $Filter -ErrorAction Stop |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

$safeLabel = $RunLabel -replace "[^A-Za-z0-9._-]", "-"
$runRoot = Join-Path $env:LOCALAPPDATA ("CodexDeck\live-runs\{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $safeLabel)
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

$pluginLogDirectory = Join-Path $env:APPDATA "HotSpot\StreamDock\plugins\com.simeo.codex-deck.sdPlugin\logs"
$vsdLogDirectory = Join-Path $env:APPDATA "HotSpot\StreamDock\logs"
$pluginLog = Get-LatestLog $pluginLogDirectory "com.simeo.codex-deck.*.log"
$vsdLog = Get-LatestLog $vsdLogDirectory "log-*.txt"
$pluginStartLength = $pluginLog.Length
$vsdStartLength = $vsdLog.Length

$baseline = Get-CodexDeckProcesses
foreach ($role in @("CodexRoot", "CodexMain", "VSDCraft", "Plugin", "Watcher")) {
  Assert-SingleProcess $baseline $role
}
$baseline | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $runRoot "baseline.json") -Encoding UTF8

$samplesPath = Join-Path $runRoot "process-samples.jsonl"
$startedAt = Get-Date
while (((Get-Date) - $startedAt).TotalSeconds -lt $DurationSeconds) {
  (Get-CodexDeckProcesses | ConvertTo-Json -Compress -Depth 4) | Add-Content $samplesPath -Encoding UTF8
  Start-Sleep -Seconds 1
}

$final = Get-CodexDeckProcesses
$final | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $runRoot "final.json") -Encoding UTF8

$pluginBytes = [System.IO.File]::ReadAllBytes($pluginLog.FullName)
$vsdBytes = [System.IO.File]::ReadAllBytes($vsdLog.FullName)
if ($pluginBytes.Length -gt $pluginStartLength) {
  [System.IO.File]::WriteAllBytes(
    (Join-Path $runRoot "plugin-log-delta.txt"),
    $pluginBytes[$pluginStartLength..($pluginBytes.Length - 1)]
  )
} else {
  [System.IO.File]::WriteAllBytes((Join-Path $runRoot "plugin-log-delta.txt"), [byte[]]@())
}
if ($vsdBytes.Length -gt $vsdStartLength) {
  [System.IO.File]::WriteAllBytes(
    (Join-Path $runRoot "vsd-log-delta.txt"),
    $vsdBytes[$vsdStartLength..($vsdBytes.Length - 1)]
  )
} else {
  [System.IO.File]::WriteAllBytes((Join-Path $runRoot "vsd-log-delta.txt"), [byte[]]@())
}

$samples = Get-Content $samplesPath | ForEach-Object { $_ | ConvertFrom-Json }
$summary = [ordered]@{
  StartedAt = $startedAt.ToString("o")
  EndedAt = (Get-Date).ToString("o")
  DurationSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
  SampleCount = @($samples).Count
  Stable = [ordered]@{}
  Baseline = $baseline
  Final = $final
  PluginLog = $pluginLog.FullName
  VSDLog = $vsdLog.FullName
  PhysicalActionsAutomaticallyCertified = $false
  RunRoot = $runRoot
}
foreach ($role in @("CodexRoot", "CodexMain", "VSDCraft", "Plugin", "Watcher")) {
  $signatures = @($samples | ForEach-Object { (@($_.$role) -join ",") } | Sort-Object -Unique)
  $summary.Stable[$role] = $signatures.Count -eq 1 -and $signatures[0] -eq (@($baseline[$role]) -join ",")
}
$summary | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runRoot "summary.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 6
