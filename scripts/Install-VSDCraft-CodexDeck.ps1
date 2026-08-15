[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$VSDCraftInstallerPath,
  [switch]$SkipVSDCraftInstall,
  [switch]$SkipEsetScan,
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'

function Assert-File([string]$Path, [string]$Label) {
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) { throw "$Label not found: $resolved" }
  return $resolved
}

function Stop-LegacyM18Runtime {
  $legacyRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck\M18'))
  $targets = @(Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($legacyRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  foreach ($name in @('codex-deck-m18-adapter.exe', 'node.exe', 'powershell.exe', 'pwsh.exe')) {
    foreach ($process in @($targets | Where-Object Name -eq $name)) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Disable-LegacyM18Startup {
  $startup = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'))
  $source = Join-Path $startup 'Codex Deck M18.lnk'
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return }
  $disabledRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck\disabled-startup'))
  New-Item -ItemType Directory -Force -Path $disabledRoot | Out-Null
  $destination = Join-Path $disabledRoot 'Codex Deck M18.lnk'
  if (Test-Path -LiteralPath $destination) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $destination = Join-Path $disabledRoot "Codex Deck M18-$stamp.lnk"
  }
  Move-Item -LiteralPath $source -Destination $destination
  Write-Host "Disabled legacy M18 startup: $destination"
}

function Stop-VSDCraftRuntime {
  $running = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'VSD Craft.exe' -or
    ($_.Name -eq 'node20.exe' -and $_.CommandLine -and
      $_.CommandLine.IndexOf('HotSpot\StreamDock\plugins', [StringComparison]::OrdinalIgnoreCase) -ge 0)
  })
  foreach ($process in $running) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  if ($running.Count -gt 0) {
    Wait-Process -Id $running.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    Write-Host 'Stopped VSD Craft runtime for plugin update.'
  }
}

function Find-VSDCraftExecutable {
  $uninstallKeys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $uninstall = @(Get-ItemProperty $uninstallKeys -ErrorAction SilentlyContinue |
    Where-Object DisplayName -Match 'VSD Craft|StreamDock')
  foreach ($entry in $uninstall) {
    if ($entry.DisplayIcon) {
      $candidate = ([string]$entry.DisplayIcon).Trim('"').Split(',')[0]
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    if ($entry.InstallLocation -and (Test-Path -LiteralPath $entry.InstallLocation -PathType Container)) {
      $candidate = Get-ChildItem -LiteralPath $entry.InstallLocation -Filter '*.exe' -File |
        Where-Object Name -Match 'VSD|StreamDock' | Select-Object -First 1
      if ($candidate) { return $candidate.FullName }
    }
  }
  foreach ($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'Programs\VSD Craft\VSD Craft.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\StreamDock\StreamDock.exe'),
    'C:\Program Files\VSD Craft\VSD Craft.exe',
    'C:\Program Files\StreamDock\StreamDock.exe'
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  return $null
}

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$installer = Assert-File $VSDCraftInstallerPath 'VSD Craft installer'
$pluginSource = [IO.Path]::GetFullPath((Join-Path $root 'dist-vsd-craft\com.simeo.codex-deck.sdPlugin'))
$manifestPath = Assert-File (Join-Path $pluginSource 'manifest.json') 'VSD Craft plugin manifest'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.SDKVersion -ne 1 -or $manifest.CodePathWin -ne 'bin/plugin.mjs') {
  throw 'VSD Craft plugin manifest was not built with the expected compatibility settings.'
}

$signature = Get-AuthenticodeSignature -LiteralPath $installer
if ($signature.Status -ne 'Valid') { throw "VSD Craft installer signature is not valid: $($signature.Status)" }
Write-Host "Verified installer signature: $($signature.SignerCertificate.Subject)"

if (-not $SkipEsetScan) {
  $scanner = 'C:\Program Files\ESET\ESET Security\ecls.exe'
  if (-not (Test-Path -LiteralPath $scanner -PathType Leaf)) { throw 'ESET command-line scanner was not found.' }
  & $scanner /files /no-arch /no-sfx /unsafe /unwanted /suspicious /heur /adv-heur /clean-mode=none /no-quarantine /no-log-all /no-log-console $installer
  if ($LASTEXITCODE -ne 0) { throw "ESET scan failed with exit code $LASTEXITCODE." }
  Write-Host 'ESET scan completed with no detection.'
}

if (-not $SkipVSDCraftInstall) {
  $install = Start-Process -FilePath $installer -ArgumentList @('/exenoui', '/qn') -Wait -PassThru
  if ($install.ExitCode -notin @(0, 1641, 3010)) { throw "VSD Craft installer failed with exit code $($install.ExitCode)." }
  Write-Host "VSD Craft installer completed with exit code $($install.ExitCode)."
}

Stop-LegacyM18Runtime
Disable-LegacyM18Startup
Stop-VSDCraftRuntime

$pluginRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins'))
$pluginDestination = Join-Path $pluginRoot 'com.simeo.codex-deck.sdPlugin'
New-Item -ItemType Directory -Force -Path $pluginRoot | Out-Null
if (Test-Path -LiteralPath $pluginDestination -PathType Container) {
  $backupRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck\backups'))
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backup = Join-Path $backupRoot ("com.simeo.codex-deck.sdPlugin-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  Move-Item -LiteralPath $pluginDestination -Destination $backup
  Write-Host "Backed up existing VSD Craft plugin: $backup"
}
Copy-Item -LiteralPath $pluginSource -Destination $pluginDestination -Recurse
Write-Host "Installed Codex Deck plugin: $pluginDestination"

if ($Launch) {
  $executable = Find-VSDCraftExecutable
  if (-not $executable) { throw 'VSD Craft executable was not found after installation.' }
  Start-Process -FilePath $executable
  Write-Host "Started VSD Craft: $executable"
}
