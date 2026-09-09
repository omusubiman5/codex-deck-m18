param(
  [Parameter(Mandatory = $true)][string]$VsdCraftExecutable,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$stateRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexDeck'))
$pluginRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins\com.simeo.codex-deck.sdPlugin'))
$vsdExecutable = [IO.Path]::GetFullPath($VsdCraftExecutable)
if (-not (Test-Path -LiteralPath $vsdExecutable -PathType Leaf)) { throw 'VSD Craft executable is missing.' }
foreach ($file in @('vsd-bridge-managed.json', 'bin\plugin.mjs', 'launcher\Start-CodexDeck.ps1', 'launcher\Connect-VSDCraftBridge.ps1', 'launcher\runtime-override.mjs')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pluginRoot $file) -PathType Leaf)) {
    throw "Integrated VSD Craft bridge is incomplete: $file. Legacy files were not changed."
  }
}

# Only the obsolete executable directories are retired. Shared host/port/relay
# state and installation backups remain where the integrated plugin expects them.
$legacyRoots = @('launcher', 'M18', 'pending-restart') | ForEach-Object { Join-Path $stateRoot $_ }
$existingRoots = @($legacyRoots | Where-Object { Test-Path -LiteralPath $_ -PathType Container })
$backupRoot = Join-Path $stateRoot ('backups\legacy-bridge-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID)
function Assert-ChildPath([string]$Path, [string]$Parent) {
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not $resolved.StartsWith(([IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside the expected directory: $resolved"
  }
  $resolved
}
foreach ($directory in $existingRoots) {
  $null = Assert-ChildPath $directory $stateRoot
  if ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing to retire a linked directory: $directory" }
}
$null = Assert-ChildPath $backupRoot (Join-Path $stateRoot 'backups')

function References-Legacy([string]$Text) {
  foreach ($directory in $legacyRoots) {
    if ($Text.IndexOf(($directory.TrimEnd('\') + '\'), [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
  }
  return $false
}

$shell = New-Object -ComObject WScript.Shell
$startup = [Environment]::GetFolderPath('Startup')
$linkDirectories = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('StartMenu'), $startup)
$linkPlans = @(foreach ($file in @($linkDirectories | ForEach-Object {
  Get-ChildItem -LiteralPath $_ -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue
} | Sort-Object FullName -Unique)) {
  $link = $shell.CreateShortcut($file.FullName)
  $command = $link.TargetPath + ' ' + $link.Arguments
  $separateStartup = $file.DirectoryName -eq $startup -and $file.Name -eq 'Codex Deck.lnk' -and
    $command.IndexOf((Join-Path $pluginRoot 'launcher\'), [StringComparison]::OrdinalIgnoreCase) -ge 0
  if ((References-Legacy $command) -or $separateStartup) {
    [pscustomobject]@{ Path = $file.FullName; Operation = $(if ($file.Name -eq 'VSD Craft.exe.lnk') { 'retarget-vsd' } else { 'remove' }) }
  }
})
$task = Get-ScheduledTask -TaskName 'CodexDeck-M18-Approved-Restart' -ErrorAction SilentlyContinue
$retireTask = $null -ne $task -and (References-Legacy ($task.Actions.Arguments -join ' '))
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runProperties = Get-ItemProperty -LiteralPath $runKey -ErrorAction SilentlyContinue
$runPlans = @($runProperties.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' -and $_.Value -is [string] -and (References-Legacy $_.Value) })
$processes = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $PID -and $_.Name -in @('node.exe', 'node20.exe', 'powershell.exe', 'pwsh.exe', 'codex-deck-m18-adapter.exe') -and
  $_.CommandLine -and (References-Legacy $_.CommandLine)
})
$plan = [pscustomobject]@{
  LegacyDirectories = $existingRoots; Shortcuts = $linkPlans; ScheduledTask = $(if ($retireTask) { $task.TaskName } else { $null })
  RunEntries = @($runPlans | ForEach-Object { $_.Name }); StopProcesses = @($processes | ForEach-Object { $_.ProcessId }); Backup = $backupRoot; CheckOnly = [bool]$CheckOnly
}
if ($CheckOnly) { $plan | ConvertTo-Json -Depth 5; return }
if ($existingRoots.Count -eq 0 -and $linkPlans.Count -eq 0 -and -not $retireTask -and $runPlans.Count -eq 0 -and $processes.Count -eq 0) {
  Write-Host 'No active legacy Codex Deck installation remains.'
  return
}

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot 'migration.json') -Encoding UTF8
if ($retireTask) {
  Export-ScheduledTask -TaskName $task.TaskName | Set-Content -LiteralPath (Join-Path $backupRoot 'scheduled-task.xml') -Encoding UTF8
  Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false
}
foreach ($entry in $runPlans) {
  @{ Name = $entry.Name; Value = $entry.Value } | ConvertTo-Json | Add-Content -LiteralPath (Join-Path $backupRoot 'run-entries.jsonl') -Encoding UTF8
  Remove-ItemProperty -LiteralPath $runKey -Name $entry.Name
}
$linkIndex = 0
foreach ($entry in $linkPlans) {
  Copy-Item -LiteralPath $entry.Path -Destination (Join-Path $backupRoot ("shortcut-$linkIndex.lnk"))
  $linkIndex++
  if ($entry.Operation -eq 'retarget-vsd') {
    $link = $shell.CreateShortcut($entry.Path)
    $link.TargetPath = $vsdExecutable
    $link.Arguments = ''
    $link.WorkingDirectory = Split-Path $vsdExecutable
    $link.IconLocation = $vsdExecutable + ',0'
    $link.Description = 'VSD Craft'
    $link.Save()
  } else { Remove-Item -LiteralPath $entry.Path }
}
foreach ($process in $processes) { Stop-Process -Id $process.ProcessId -ErrorAction SilentlyContinue }
foreach ($directory in $existingRoots) {
  $source = Assert-ChildPath $directory $stateRoot
  $destination = Assert-ChildPath (Join-Path $backupRoot (Split-Path $source -Leaf)) $backupRoot
  Move-Item -LiteralPath $source -Destination $destination
}
Write-Host "Retired active legacy bridge files and startup entries. Recovery archive: $backupRoot"
