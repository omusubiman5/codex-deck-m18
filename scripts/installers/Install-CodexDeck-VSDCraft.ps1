[CmdletBinding()]
param([switch]$NoLaunch)

$ErrorActionPreference = 'Stop'
$officialDownloadPage = 'https://www.vsdinside.com/pages/download'
$officialWindowsInstaller = 'https://download.vsdinside.com/streamdock/win/VSD-Craft-Installer_Windows.msi'
$officialWindowsSigner = 'Shenzhen An Rui Xin Technology Co., Ltd.'

function Find-VSDCraftExecutable {
  $uninstallKeys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $entries = @(Get-ItemProperty $uninstallKeys -ErrorAction SilentlyContinue |
    Where-Object DisplayName -Match 'VSD Craft|StreamDock')
  foreach ($entry in $entries) {
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

function Stop-VSDCraftRuntime {
  $running = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'VSD Craft.exe' -or
    ($_.Name -eq 'node20.exe' -and $_.CommandLine -and
      $_.CommandLine.IndexOf('HotSpot\StreamDock\plugins', [StringComparison]::OrdinalIgnoreCase) -ge 0)
  })
  foreach ($process in $running) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
  if ($running.Count) { Wait-Process -Id $running.ProcessId -Timeout 10 -ErrorAction SilentlyContinue }
}

function Install-OfficialVSDCraft {
  $answer = Read-Host 'VSD Craft is not installed. Download and open the official signed installer now? [Y/N]'
  if ($answer -notmatch '^(?i:y|yes)$') {
    Start-Process $officialDownloadPage
    throw 'VSD Craft installation was cancelled. The official download page has been opened.'
  }
  $download = Join-Path ([IO.Path]::GetTempPath()) ("VSD-Craft-Installer_Windows-$PID.msi")
  try {
    Write-Host "Downloading VSD Craft from its official distribution server: $officialWindowsInstaller"
    if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
      Start-BitsTransfer -Source $officialWindowsInstaller -Destination $download
    } else {
      Invoke-WebRequest -Uri $officialWindowsInstaller -OutFile $download -UseBasicParsing
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $download
    if ($signature.Status -ne 'Valid' -or
        $signature.SignerCertificate.Subject -notlike "*$officialWindowsSigner*") {
      throw "Official VSD Craft installer signature verification failed: $($signature.Status), $($signature.SignerCertificate.Subject)"
    }
    Write-Host "Verified official installer signer: $($signature.SignerCertificate.Subject)"
    $install = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', "`"$download`"") -Wait -PassThru
    if ($install.ExitCode -notin @(0, 1641, 3010)) {
      throw "VSD Craft installer exited with code $($install.ExitCode)."
    }
  } finally {
    if (Test-Path -LiteralPath $download -PathType Leaf) { Remove-Item -LiteralPath $download -Force }
  }
}

$bundleRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$pluginSource = Join-Path $bundleRoot 'plugin\com.simeo.codex-deck.sdPlugin'
$manifestPath = Join-Path $pluginSource 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Bundled Codex Deck plugin is incomplete: $manifestPath"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.SDKVersion -ne 1 -or $manifest.CodePathWin -ne 'bin/plugin.mjs') {
  throw 'Bundled plugin is not a valid VSD Craft package.'
}

$vsdCraft = Find-VSDCraftExecutable
if (-not $vsdCraft) {
  Install-OfficialVSDCraft
  $vsdCraft = Find-VSDCraftExecutable
  if (-not $vsdCraft) { throw 'VSD Craft was not found after the official installer completed.' }
}

$pluginRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins'))
$pluginTarget = Join-Path $pluginRoot 'com.simeo.codex-deck.sdPlugin'
$stateRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck'))
$backupRoot = Join-Path $stateRoot 'backups'
$staging = Join-Path $pluginRoot ".com.simeo.codex-deck.sdPlugin.installing.$PID"
$backup = $null

Stop-VSDCraftRuntime
New-Item -ItemType Directory -Force -Path $pluginRoot, $backupRoot | Out-Null
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
Copy-Item -LiteralPath $pluginSource -Destination $staging -Recurse

try {
  if (Test-Path -LiteralPath $pluginTarget) {
    $backup = Join-Path $backupRoot ("com.simeo.codex-deck.sdPlugin-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Move-Item -LiteralPath $pluginTarget -Destination $backup
  }
  Move-Item -LiteralPath $staging -Destination $pluginTarget
} catch {
  if (-not (Test-Path -LiteralPath $pluginTarget) -and $backup -and (Test-Path -LiteralPath $backup)) {
    Move-Item -LiteralPath $backup -Destination $pluginTarget
  }
  throw
} finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}

Write-Host "Installed Codex Deck for VSD Craft: $pluginTarget"
if ($backup) { Write-Host "Previous plugin backup: $backup" }
if (-not $NoLaunch) {
  Start-Process -FilePath $vsdCraft
  Write-Host "Started VSD Craft: $vsdCraft"
}
