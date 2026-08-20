[CmdletBinding()]
param(
  [ValidateRange(5, 3600)]
  [int]$DurationSeconds = 300,
  [ValidateRange(1, 60)]
  [int]$IntervalSeconds = 5,
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$stateRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck'))
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $stateRoot (Join-Path 'live-runs' ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-observation'))
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$samplesPath = Join-Path $OutputDirectory 'samples.jsonl'
$summaryPath = Join-Path $OutputDirectory 'summary.json'

function Get-LiveState {
  $all = @(Get-CimInstance Win32_Process)
  $codexUi = @($all | Where-Object {
    $_.Name -eq 'ChatGPT.exe' -and $_.ExecutablePath -and $_.ExecutablePath.IndexOf('\WindowsApps\OpenAI.Codex_', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  $codexUiIds = @($codexUi.ProcessId)
  $codexRoot = @($codexUi | Where-Object { $_.ParentProcessId -notin $codexUiIds })
  $codexMain = @($all | Where-Object {
    $_.Name -eq 'codex.exe' -and $_.CommandLine -and $_.CommandLine.IndexOf('features.code_mode_host=true', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  $vsdRoot = @($all | Where-Object { $_.Name -eq 'VSD Craft.exe' })
  $plugin = @($all | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\bin\plugin.mjs', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  $watcher = @($all | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf('com.simeo.codex-deck.sdPlugin\launcher\Watch-CodexDeck.ps1', [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  [pscustomobject]@{
    Timestamp = (Get-Date).ToString('o')
    CodexRoot = @($codexRoot.ProcessId)
    CodexMain = @($codexMain.ProcessId)
    VSDCraft = @($vsdRoot.ProcessId)
    Plugin = @($plugin.ProcessId)
    Watcher = @($watcher.ProcessId)
  }
}

$started = Get-Date
$first = Get-LiveState
$first | ConvertTo-Json -Compress | Add-Content -LiteralPath $samplesPath -Encoding utf8
do {
  Start-Sleep -Seconds $IntervalSeconds
  $sample = Get-LiveState
  $sample | ConvertTo-Json -Compress | Add-Content -LiteralPath $samplesPath -Encoding utf8
} while (((Get-Date) - $started).TotalSeconds -lt $DurationSeconds)

$samples = @(Get-Content -LiteralPath $samplesPath | ForEach-Object { $_ | ConvertFrom-Json })
$rootSignatures = @($samples | ForEach-Object { (@($_.CodexRoot) -join ',') } | Sort-Object -Unique)
$mainSignatures = @($samples | ForEach-Object { (@($_.CodexMain) -join ',') } | Sort-Object -Unique)
$summary = [pscustomobject]@{
  StartedAt = $started.ToString('o')
  EndedAt = (Get-Date).ToString('o')
  DurationSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
  SampleCount = $samples.Count
  CodexRootStable = ($rootSignatures.Count -eq 1 -and @($first.CodexRoot).Count -eq 1)
  CodexMainStable = ($mainSignatures.Count -eq 1 -and @($first.CodexMain).Count -eq 1)
  CodexRootSignatures = $rootSignatures
  CodexMainSignatures = $mainSignatures
  Final = $samples[-1]
  SamplesPath = $samplesPath
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $summaryPath -Encoding utf8
$summary | ConvertTo-Json -Depth 5
