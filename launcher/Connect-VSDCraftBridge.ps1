param([Parameter(Mandatory = $true)][string]$NodePath)

$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Start-CodexDeck.ps1'
$shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$mutex = [Threading.Mutex]::new($false, 'Local\CodexDeckInteractiveRecovery')
$locked = $false
try {
  try { $locked = $mutex.WaitOne(0) }
  catch [Threading.AbandonedMutexException] { $locked = $true }
  if (-not $locked) { exit 0 }
  $inspection = & $shell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $launcher -NodePath $NodePath -Inspect
  if ($LASTEXITCODE -ne 0) { throw 'Codexの起動状態を取得できませんでした。' }
  $state = ($inspection | ConvertFrom-Json).state
  $extra = @()
  if ($state -eq 'restart-required') {
    Add-Type -AssemblyName System.Windows.Forms
    $choice = [System.Windows.Forms.MessageBox]::Show(
      "ボタンを接続するため、Codexを再起動します。すべてのCodexウィンドウが閉じ、実行中の作業が中断されます。未送信の入力を保存してから「OK」を選んでください。",
      'VSD Craft — Codexの接続を復旧',
      [System.Windows.Forms.MessageBoxButtons]::OKCancel,
      [System.Windows.Forms.MessageBoxIcon]::Warning,
      [System.Windows.Forms.MessageBoxDefaultButton]::Button2,
      [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly
    )
    if ($choice -ne [System.Windows.Forms.DialogResult]::OK) { Write-Output 'CANCELLED'; exit 0 }
    $extra = @('-ForceRestart')
  }
  & $shell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $launcher -NodePath $NodePath @extra
  if ($LASTEXITCODE -ne 0) { throw '接続に失敗しました。Codexの起動完了後に、もう一度「接続・復旧」を押してください。' }
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
