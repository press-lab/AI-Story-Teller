[CmdletBinding()]
param(
  [string]$Branch = "backend-local-implementation",
  [int]$CheckSeconds = 60,
  [switch]$ForceDeploy
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LocalDir = Join-Path $RepoRoot ".local-backend"
$WatchdogPidFile = Join-Path $LocalDir "owner-watchdog.pid"
$WatchdogOutLog = Join-Path $LocalDir "owner-watch.out.log"
$WatchdogErrLog = Join-Path $LocalDir "owner-watch.err.log"
$WatchdogScript = Join-Path $PSScriptRoot "owner-tunnel-watchdog.ps1"

New-Item -ItemType Directory -Force $LocalDir | Out-Null

function Get-ExistingWatchdog {
  if (-not (Test-Path $WatchdogPidFile)) { return $null }
  $pidText = (Get-Content $WatchdogPidFile -Raw).Trim()
  $pidValue = 0
  if (-not [int]::TryParse($pidText, [ref]$pidValue)) { return $null }
  return Get-Process -Id $pidValue -ErrorAction SilentlyContinue
}

function Test-WatchdogLogFresh {
  if (-not (Test-Path $WatchdogOutLog)) { return $false }
  $freshSeconds = [Math]::Max(180, $CheckSeconds * 3)
  $log = Get-Item $WatchdogOutLog
  return ((Get-Date) - $log.LastWriteTime).TotalSeconds -lt $freshSeconds
}

$existing = Get-ExistingWatchdog
if ($existing) {
  Write-Host "AI Story Teller owner watchdog is already running as PID $($existing.Id)."
  exit 0
}

if (Test-WatchdogLogFresh) {
  $log = Get-Item $WatchdogOutLog
  Write-Host "AI Story Teller owner watchdog appears active; log updated at $($log.LastWriteTime)."
  Write-Host "Logs: $WatchdogOutLog"
  exit 0
}

if (Test-Path $WatchdogPidFile) {
  Remove-Item -LiteralPath $WatchdogPidFile -Force -ErrorAction SilentlyContinue
}

$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$WatchdogScript`"",
  "-Branch", "`"$Branch`"",
  "-CheckSeconds", "$CheckSeconds"
)
if ($ForceDeploy) { $arguments += "-ForceDeploy" }

$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList $arguments `
  -WorkingDirectory $RepoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $WatchdogOutLog `
  -RedirectStandardError $WatchdogErrLog `
  -PassThru

Write-Host "AI Story Teller owner watchdog started as PID $($process.Id)."
Write-Host "Logs: $WatchdogOutLog"
