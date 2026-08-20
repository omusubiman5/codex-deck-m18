param(
  [switch]$Once,
  [switch]$SelfTest,
  [ValidateRange(1, 30)]
  [int]$PollSeconds = 2
)

$ErrorActionPreference = 'Stop'

$launcherPath = Join-Path $PSScriptRoot 'Start-CodexDeck.ps1'
$powerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDeck'
$statePath = Join-Path $stateRoot 'codex-micro-bridge.json'
$relayConfigPath = Join-Path $stateRoot 'relay-client.json'
$relayTunnelPidPath = Join-Path $stateRoot 'relay-tunnel.pid'
$stopPath = Join-Path $stateRoot 'watcher.stop'
$logPath = Join-Path $stateRoot 'watcher.log'
$mutexName = 'Local\CodexDeckBridgeWatcher'

function Test-RelayTunnelCommand([string]$CommandLine, [string]$SshHost, [int]$LocalPort, [int]$RemotePort) {
  if ([string]::IsNullOrWhiteSpace($CommandLine) -or [string]::IsNullOrWhiteSpace($SshHost)) { return $false }
  $forward = "127.0.0.1:${LocalPort}:127.0.0.1:${RemotePort}"
  $hostPattern = [Regex]::Escape($SshHost)
  $forwardPattern = [Regex]::Escape($forward)
  $CommandLine -match '(?i)(?:^|\s)-N(?:\s|$)' -and
    $CommandLine -match "(?i)(?:^|\s)-L(?:\s+|=)$forwardPattern(?:\s|$)" -and
    $CommandLine -match "(?i)(?:^|\s)$hostPattern\s*$"
}

if ($SelfTest) {
  $cases = @(
    @{ Name = 'managed relay tunnel is recognized'; Expected = $true; Actual = Test-RelayTunnelCommand 'ssh.exe -N -T -L 127.0.0.1:47651:127.0.0.1:47651 example-mac' 'example-mac' 47651 47651 },
    @{ Name = 'Codex remote CLI SSH is not adopted'; Expected = $false; Actual = Test-RelayTunnelCommand 'ssh -T example-mac "codex app-server proxy"' 'example-mac' 47651 47651 },
    @{ Name = 'different forwarded port is not adopted'; Expected = $false; Actual = Test-RelayTunnelCommand 'ssh.exe -N -T -L 127.0.0.1:40000:127.0.0.1:40000 example-mac' 'example-mac' 47651 47651 }
  )
  $failures = @($cases | Where-Object { $_.Actual -ne $_.Expected })
  if ($failures.Count -gt 0) { throw "Watcher self-test failed: $($failures.Name -join ', ')" }
  Write-Host "Codex Deck watcher self-test passed ($($cases.Count) cases)."
  exit 0
}

New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null

function Write-WatcherLog([string]$Message) {
  if (Test-Path -LiteralPath $logPath) {
    $log = Get-Item -LiteralPath $logPath -ErrorAction SilentlyContinue
    if ($null -ne $log -and $log.Length -gt 524288) {
      Move-Item -LiteralPath $logPath -Destination "$logPath.previous" -Force
    }
  }
  $line = "[$([DateTimeOffset]::Now.ToString('o'))] $Message"
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-RelayTunnelConfig {
  if (-not (Test-Path -LiteralPath $relayConfigPath)) { return $null }
  $config = Get-Content -LiteralPath $relayConfigPath -Raw | ConvertFrom-Json
  if ($config.enabled -ne $true -or [string]::IsNullOrWhiteSpace([string]$config.sshHost)) { return $null }
  if ([string]$config.sshHost -notmatch '^[A-Za-z0-9._-]+$') { throw 'Relay sshHost is invalid.' }
  if ([string]$config.url -notmatch '^ws://127\.0\.0\.1:(\d+)$') { throw 'Managed SSH relay URL must use 127.0.0.1 with an explicit port.' }
  $urlPort = [int]$Matches[1]
  $localPort = if ($null -ne $config.localPort) { [int]$config.localPort } else { $urlPort }
  $remotePort = if ($null -ne $config.remotePort) { [int]$config.remotePort } else { $localPort }
  if ($localPort -lt 1024 -or $localPort -gt 65535 -or $remotePort -lt 1024 -or $remotePort -gt 65535) {
    throw 'Relay tunnel ports must be between 1024 and 65535.'
  }
  if ($localPort -ne $urlPort) { throw 'Relay localPort must match the loopback URL port.' }
  [pscustomobject]@{ SshHost = [string]$config.sshHost; LocalPort = $localPort; RemotePort = $remotePort }
}

function Get-RelayTunnelProcess($Config) {
  @(Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" -ErrorAction SilentlyContinue | Where-Object {
    Test-RelayTunnelCommand ([string]$_.CommandLine) $Config.SshHost $Config.LocalPort $Config.RemotePort
  } | Sort-Object ProcessId | Select-Object -First 1)[0]
}

function Test-LocalTcpPort([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.ConnectAsync('127.0.0.1', $Port)
    $connect.Wait(250) -and $client.Connected
  }
  catch { $false }
  finally { $client.Dispose() }
}

function Save-RelayTunnelPid([int]$ProcessId) {
  [IO.File]::WriteAllText($relayTunnelPidPath, "$ProcessId`n", [Text.UTF8Encoding]::new($false))
}

function Stop-OwnedRelayTunnel {
  if (-not (Test-Path -LiteralPath $relayTunnelPidPath)) { return 'disabled' }
  try {
    $processId = [int](Get-Content -LiteralPath $relayTunnelPidPath -Raw).Trim()
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if ($null -ne $process -and $process.Name -ieq 'ssh.exe' -and [string]$process.CommandLine -match '(?i)(?:^|\s)-N(?:\s|$)' -and [string]$process.CommandLine -match '(?i)(?:^|\s)-L(?:\s|$)') {
      Stop-Process -Id $processId -ErrorAction SilentlyContinue
    }
  }
  finally { Remove-Item -LiteralPath $relayTunnelPidPath -Force -ErrorAction SilentlyContinue }
  'disabled'
}

function Ensure-RelayTunnel {
  $config = Get-RelayTunnelConfig
  if ($null -eq $config) { return Stop-OwnedRelayTunnel }

  $existing = Get-RelayTunnelProcess $config
  if ($null -ne $existing) {
    Save-RelayTunnelPid ([int]$existing.ProcessId)
    return "connected:$($existing.ProcessId)"
  }

  if (Test-LocalTcpPort $config.LocalPort) { return "port-in-use:$($config.LocalPort)" }
  $sshPath = (Get-Command ssh.exe -ErrorAction Stop).Source
  $arguments = @(
    '-N', '-T', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
    '-L', "127.0.0.1:$($config.LocalPort):127.0.0.1:$($config.RemotePort)", $config.SshHost
  )
  $process = Start-Process -FilePath $sshPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
  Save-RelayTunnelPid $process.Id
  "starting:$($process.Id)"
}

function Get-CodexInstallation {
  $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue |
    Sort-Object Version -Descending |
    Select-Object -First 1
  if ($null -eq $package -or [string]::IsNullOrWhiteSpace($package.InstallLocation)) { return $null }
  $appRoot = Join-Path $package.InstallLocation 'app'
  [pscustomobject]@{
    Root = [IO.Path]::GetFullPath($appRoot).TrimEnd('\')
    Version = $package.Version.ToString()
  }
}

function Get-CodexProcesses([string]$AppRoot) {
  $prefix = $AppRoot.TrimEnd('\') + '\'
  @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    -not [string]::IsNullOrWhiteSpace($_.ExecutablePath) -and
    $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
  })
}

function Get-CodexGeneration([string]$Version, $Processes) {
  $main = $Processes |
    Where-Object { $_.Name -ieq 'ChatGPT.exe' -and $_.CommandLine -notmatch '--type=' } |
    Sort-Object ProcessId |
    Select-Object -First 1
  if ($null -eq $main) { $main = $Processes | Sort-Object ProcessId | Select-Object -First 1 }
  "${Version}:$($main.ProcessId)"
}

function Get-CodexMainProcessCount($Processes) {
  @($Processes | Where-Object { $_.Name -ieq 'ChatGPT.exe' -and $_.CommandLine -notmatch '--type=' }).Count
}

function Get-HealthyDebugPort($Processes) {
  foreach ($process in $Processes) {
    if ([string]::IsNullOrWhiteSpace($process.CommandLine)) { continue }
    if ($process.CommandLine -match '--remote-debugging-port=(\d+)') {
      $candidate = [int]$Matches[1]
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$candidate/json/version" -TimeoutSec 1
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return $candidate }
      }
      catch { }
    }
  }
  return $null
}

function Clear-StalePortFile {
  if (-not (Test-Path -LiteralPath $statePath)) { return }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $port = [int]$state.port
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 1
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return }
  }
  catch { }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-WatcherLog 'Removed a stale Codex Deck bridge port file.'
}

function Test-LauncherReady {
  if (-not (Test-Path -LiteralPath $launcherPath)) { return $false }
  if ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  $runtimeCandidates = @(
    (Join-Path $PSScriptRoot 'runtime-override.mjs'),
    (Join-Path $PSScriptRoot '..\release\codex-deck-launcher\runtime-override.mjs')
  )
  @($runtimeCandidates | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0
}

function Invoke-CodexDeckLauncher {
  if (-not (Test-LauncherReady)) {
    throw 'The Codex Deck launcher bundle or Node.js is unavailable; Codex was not restarted.'
  }
  $arguments = @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcherPath)
  $output = & $powerShellPath @arguments 2>&1
  foreach ($line in $output) { Write-WatcherLog "Launcher: $line" }
  if ($LASTEXITCODE -ne 0) { throw "Codex Deck launcher failed with exit code $LASTEXITCODE." }
}

$createdNew = $false
$mutex = [Threading.Mutex]::new($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
  Write-Host 'A Codex Deck watcher is already running.'
  $mutex.Dispose()
  exit 0
}

$handledGeneration = ''
$lastHealthyGeneration = ''
$lastState = ''
$lastRelayState = ''

try {
  Write-WatcherLog 'Watcher started in observation-only mode; automatic Codex restart is disabled.'
  while ($true) {
    if (Test-Path -LiteralPath $stopPath) {
      Write-WatcherLog 'Watcher stop requested.'
      break
    }

    try {
      $relayState = Ensure-RelayTunnel
      if ($relayState -ne $lastRelayState) {
        if ($relayState -like 'connected:*') { Write-WatcherLog "Mac app relay tunnel connected (SSH PID $($relayState.Split(':')[1]))." }
        elseif ($relayState -like 'starting:*') { Write-WatcherLog "Starting the separate Mac app relay tunnel (SSH PID $($relayState.Split(':')[1]))." }
        elseif ($relayState -like 'port-in-use:*') { Write-WatcherLog "Relay loopback port $($relayState.Split(':')[1]) is occupied by an unmanaged process; no second tunnel was started." }
        elseif ($relayState -eq 'disabled') { Write-WatcherLog 'Managed Mac app relay tunnel is disabled.' }
        $lastRelayState = $relayState
      }

      $codex = Get-CodexInstallation
      $processes = if ($null -eq $codex) { @() } else { Get-CodexProcesses $codex.Root }

      if ($processes.Count -eq 0) {
        if ($lastState -ne 'stopped') { Write-WatcherLog 'Codex is not running; waiting for its next launch.' }
        $lastState = 'stopped'
        $handledGeneration = ''
        Clear-StalePortFile
      }
      else {
        $generation = Get-CodexGeneration $codex.Version $processes
        $port = Get-HealthyDebugPort $processes

        if ($port) {
          $handledGeneration = $generation
          if ($lastHealthyGeneration -ne $generation) {
            Write-WatcherLog "Healthy Codex Deck bridge detected for Codex $($codex.Version) on port $port."
            Invoke-CodexDeckLauncher
            $lastHealthyGeneration = $generation
          }
          $lastState = "healthy:$generation"
        }
        else {
          Clear-StalePortFile
          if ($lastState -ne "unmanaged:$generation") {
            Write-WatcherLog "Codex generation $generation is running without the bridge and was left untouched (automatic restart disabled)."
            $lastState = "unmanaged:$generation"
            $handledGeneration = $generation
          }
        }
      }
    }
    catch {
      $message = $_.Exception.Message
      if ($lastState -ne "error:$message") { Write-WatcherLog "Watcher check failed: $message" }
      $lastState = "error:$message"
    }

    if ($Once) { break }
    Start-Sleep -Seconds $PollSeconds
  }
}
finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
  Write-WatcherLog 'Watcher stopped.'
}
