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
  if (Test-Path $WatchdogErrLog) {
    $errLog = Get-Item $WatchdogErrLog
    if ($errLog.Length -gt 0 -and $errLog.LastWriteTime -ge $log.LastWriteTime.AddSeconds(-5)) {
      return $false
    }
  }
  return ((Get-Date) - $log.LastWriteTime).TotalSeconds -lt $freshSeconds
}

$existing = Get-ExistingWatchdog
if ($existing) {
  Write-Host "AI Story Teller owner watchdog is already running as PID $($existing.Id)."
  exit 0
}

if (Test-WatchdogLogFresh) {
  $log = Get-Item $WatchdogOutLog
  Write-Host "AI Story Teller owner watchdog log was updated at $($log.LastWriteTime), but no live watchdog PID was found."
  Write-Host "Starting a replacement watchdog."
}

if (Test-Path $WatchdogPidFile) {
  Remove-Item -LiteralPath $WatchdogPidFile -Force -ErrorAction SilentlyContinue
}

$processPath = [System.Environment]::GetEnvironmentVariable("Path", "Process")
if ([string]::IsNullOrWhiteSpace($processPath)) {
  $processPath = [System.Environment]::GetEnvironmentVariable("PATH", "Process")
}
[System.Environment]::SetEnvironmentVariable("PATH", $null, "Process")
if (-not [string]::IsNullOrWhiteSpace($processPath)) {
  [System.Environment]::SetEnvironmentVariable("Path", $processPath, "Process")
}

$powerShellExe = (Get-Command "powershell.exe" -ErrorAction Stop).Source
$forceDeployArgument = ""
if ($ForceDeploy) { $forceDeployArgument = " -ForceDeploy" }
$commandLine = "`"$powerShellExe`" -NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`" -Branch `"$Branch`" -CheckSeconds $CheckSeconds -Detached$forceDeployArgument"
$startup = ([wmiclass]"Win32_ProcessStartup").CreateInstance()
$startup.ShowWindow = 0
$result = ([wmiclass]"Win32_Process").Create($commandLine, $RepoRoot, $startup)
if ($result.ReturnValue -ne 0) {
  throw "Could not start owner watchdog. Win32_Process.Create returned $($result.ReturnValue)."
}

Write-Host "AI Story Teller owner watchdog started as PID $($result.ProcessId)."
Write-Host "Logs: $WatchdogOutLog"
