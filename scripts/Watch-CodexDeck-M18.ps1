$ErrorActionPreference = 'Continue'
$runtimeRoot = $PSScriptRoot
$launcher = Join-Path $runtimeRoot 'launcher\Start-CodexDeck.ps1'
$runtime = Join-Path $runtimeRoot 'codex-deck-m18.mjs'
$log = Join-Path (Split-Path -Parent $runtimeRoot) 'm18.log'
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDeck'
$environmentFile = Join-Path $stateRoot 'm18-environment'
$mutex = [Threading.Mutex]::new($false, 'Local\CodexDeckM18Watcher')

if (-not $mutex.WaitOne(0)) { exit 0 }

function Write-M18Log([string]$Message) {
  $line = "[$([DateTimeOffset]::Now.ToString('o'))] $Message"
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}
function Get-M18Environment {
  if (-not (Test-Path -LiteralPath $environmentFile)) { return 1 }
  $value = (Get-Content -LiteralPath $environmentFile -Raw).Trim()
  if ($value -in @('1', '2', '3')) { return [int]$value }
  return 1
}
function Find-VsdCraft {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\VSDCraft\VSDCraft.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\VSD Craft\VSDCraft.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\VSD Craft\VSD Craft.exe'),
    (Join-Path $env:LOCALAPPDATA 'VSDCraft\VSDCraft.exe'),
    (Join-Path $env:LOCALAPPDATA 'VSD Craft\VSD Craft.exe'),
    (Join-Path $env:ProgramFiles 'VSDCraft\VSDCraft.exe'),
    (Join-Path $env:ProgramFiles 'VSD Craft\VSDCraft.exe'),
    (Join-Path $env:ProgramFiles 'VSD Craft\VSD Craft.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'VSDCraft\VSDCraft.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'VSD Craft\VSDCraft.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'VSD Craft\VSD Craft.exe')
  )
  $registry = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($entry in Get-ItemProperty $registry -ErrorAction SilentlyContinue | Where-Object DisplayName -Match 'VSD\s*Craft') {
    if ($entry.DisplayIcon) { $candidates += ($entry.DisplayIcon -replace ',\d+$','').Trim('"') }
    if ($entry.InstallLocation) {
      $candidates += (Join-Path $entry.InstallLocation 'VSDCraft.exe')
      $candidates += (Join-Path $entry.InstallLocation 'VSD Craft.exe')
    }
  }
  return $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}
try {
  Write-M18Log 'M18 watcher started.'
  while ($true) {
    try {
      if ((Get-M18Environment) -eq 3) {
        $vsdCraft = Find-VsdCraft
        if (-not $vsdCraft) {
          Write-M18Log 'Environment 3 requested, but VSD Craft is not installed. Returning to environment 1.'
          New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
          Set-Content -LiteralPath $environmentFile -Value '1' -NoNewline -Encoding ascii
          continue
        }
        $running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $vsdCraft } | Select-Object -First 1
        if (-not $running) {
          Write-M18Log "Starting VSD Craft for environment 3: $vsdCraft"
          Start-Process -FilePath $vsdCraft
        }
        Start-Sleep -Seconds 2
        continue
      }
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
