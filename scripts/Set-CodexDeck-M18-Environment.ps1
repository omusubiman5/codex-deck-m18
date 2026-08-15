param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(1, 2, 3)]
  [int]$Environment
)

$ErrorActionPreference = 'Stop'
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDeck'
$environmentFile = Join-Path $stateRoot 'm18-environment'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
Set-Content -LiteralPath $environmentFile -Value ([string]$Environment) -NoNewline -Encoding ascii

if ($Environment -ne 3) {
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -match '^VSD.?Craft$' -or $_.Path -match 'VSD.?Craft' } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host "M18 environment $Environment selected."
