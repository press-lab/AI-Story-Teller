[CmdletBinding()]
param(
  [string]$Branch = "backend-local-implementation",
  [int]$CheckSeconds = 60,
  [switch]$Once,
  [switch]$ForceDeploy
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LocalDir = Join-Path $RepoRoot ".local-backend"
$ToolsDir = Join-Path $LocalDir "tools"
$EnvPath = Join-Path $RepoRoot ".env"
$EnvExamplePath = Join-Path $RepoRoot ".env.example"
$CloudflaredExe = Join-Path $ToolsDir "cloudflared.exe"
$ApiOutLog = Join-Path $LocalDir "api-serve.out.log"
$ApiErrLog = Join-Path $LocalDir "api-serve.err.log"
$ApiSourceVersionFile = Join-Path $LocalDir "api-source-version.txt"
$TunnelOutLog = Join-Path $LocalDir "cloudflared.out.log"
$TunnelErrLog = Join-Path $LocalDir "cloudflared.err.log"
$TunnelResetLog = Join-Path $LocalDir "cloudflare-reset-events.log"
$TunnelPidFile = Join-Path $LocalDir "cloudflared.pid"
$WatchdogPidFile = Join-Path $LocalDir "owner-watchdog.pid"
$StateFile = Join-Path $LocalDir "pages-api-url.txt"
$CloudflaredDownloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
$forceDeployRequested = [bool]$ForceDeploy

function Write-OwnerLog([string]$Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$timestamp] $Message"
}

function Write-TunnelResetLog([string]$Event, [hashtable]$Fields = @{}) {
  New-Item -ItemType Directory -Force $LocalDir | Out-Null
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $parts = New-Object System.Collections.Generic.List[string]
  $parts.Add("[$timestamp]")
  $parts.Add($Event)
  foreach ($key in ($Fields.Keys | Sort-Object)) {
    $value = [string]$Fields[$key]
    if ($value -match "\s") { $value = '"' + ($value -replace '"', '\"') + '"' }
    $parts.Add("$key=$value")
  }
  Add-Content -Path $TunnelResetLog -Value ($parts -join " ") -Encoding UTF8
}

function Ensure-LocalFiles {
  New-Item -ItemType Directory -Force $LocalDir | Out-Null
  New-Item -ItemType Directory -Force $ToolsDir | Out-Null
  if (-not (Test-Path $EnvPath) -and (Test-Path $EnvExamplePath)) {
    Copy-Item $EnvExamplePath $EnvPath
    Write-OwnerLog "Created .env from .env.example. Fill secrets before real tester use."
  }
}

function Get-EnvValue([string]$Name, [string]$Fallback = "") {
  if (-not (Test-Path $EnvPath)) { return $Fallback }
  $line = Get-Content $EnvPath | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -First 1
  if (-not $line) { return $Fallback }
  return ($line -replace "^$([regex]::Escape($Name))=", "").Trim()
}

function Set-EnvValue([string]$Name, [string]$Value) {
  $lines = New-Object System.Collections.Generic.List[string]
  if (Test-Path $EnvPath) {
    foreach ($line in Get-Content $EnvPath) { $lines.Add($line) }
  }
  $found = $false
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match "^$([regex]::Escape($Name))=") {
      $lines[$index] = "$Name=$Value"
      $found = $true
    }
  }
  if (-not $found) { $lines.Add("$Name=$Value") }
  Set-Content -Path $EnvPath -Value $lines -Encoding UTF8
}

function Get-ApiPort {
  $value = Get-EnvValue "AIST_API_PORT" "8787"
  $port = 8787
  if ([int]::TryParse($value, [ref]$port)) { return $port }
  return 8787
}

function Get-LocalApiUrl {
  return "http://127.0.0.1:$(Get-ApiPort)"
}

function Get-ExpectedDatabaseMode {
  $databaseUrl = Get-EnvValue "AIST_DATABASE_URL" ""
  if ($databaseUrl -match "^postgres(ql)?://") { return "postgres" }
  return "local-json"
}

function Ensure-PostgresIfConfigured {
  $databaseUrl = Get-EnvValue "AIST_DATABASE_URL" ""
  if (-not $databaseUrl) { return }
  if ($databaseUrl -notmatch "^postgres(ql)?://") { return }
  if ($databaseUrl -notmatch "127\.0\.0\.1:55432/aist_local") { return }
  Write-OwnerLog "Ensuring app-owned Postgres is running."
  & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "owner-postgres.ps1") start
  if ($LASTEXITCODE -ne 0) { throw "App-owned Postgres failed to start." }
}

function Start-HiddenCommand([string]$FilePath, [string]$Arguments, [string]$OutLog, [string]$ErrLog) {
  if (Test-Path $OutLog) { Clear-Content $OutLog -ErrorAction SilentlyContinue }
  if (Test-Path $ErrLog) { Clear-Content $ErrLog -ErrorAction SilentlyContinue }
  $resolvedFilePath = $FilePath
  if (-not [System.IO.Path]::IsPathRooted($resolvedFilePath)) {
    $command = Get-Command $resolvedFilePath -ErrorAction SilentlyContinue
    if ($command) { $resolvedFilePath = $command.Source }
  }
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $env:ComSpec
  $psi.Arguments = "/d /c `"`"$resolvedFilePath`" $Arguments > `"$OutLog`" 2> `"$ErrLog`"`""
  $psi.WorkingDirectory = $RepoRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  return [System.Diagnostics.Process]::Start($psi)
}

function Test-LocalApi {
  try {
    $response = Invoke-RestMethod -Uri "$(Get-LocalApiUrl)/version" -TimeoutSec 8
    if ($response.app -ne "ai-story-teller-api") { return $false }
    if ($response.database -ne (Get-ExpectedDatabaseMode)) { return $false }
    return $true
  } catch {
    return $false
  }
}

function Get-ApiSourceVersion {
  $head = "unknown"
  try {
    $headValue = (& git -C $RepoRoot rev-parse HEAD 2>$null | Select-Object -First 1)
    if (-not [string]::IsNullOrWhiteSpace($headValue)) { $head = $headValue.Trim() }
  } catch {
    $head = "unknown"
  }

  $latestTicks = 0L
  $sourceRoots = @(
    "apps\api",
    "src\ai",
    "src\contextBuilder",
    "src\memory",
    "src\providers",
    "src\security",
    "src\state",
    "src\tokenizer",
    "src\triggers",
    "src\types",
    "src\utils"
  )
  foreach ($relativeRoot in $sourceRoots) {
    $root = Join-Path $RepoRoot $relativeRoot
    if (-not (Test-Path $root)) { continue }
    $latest = Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTimeUtc -Descending |
      Select-Object -First 1
    if ($latest -and $latest.LastWriteTimeUtc.Ticks -gt $latestTicks) {
      $latestTicks = $latest.LastWriteTimeUtc.Ticks
    }
  }
  return "$head|$latestTicks"
}

function Stop-ApiListener {
  $port = Get-ApiPort
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    if ($listener.OwningProcess -and $listener.OwningProcess -ne 0) {
      Write-OwnerLog "Stopping stale API listener PID $($listener.OwningProcess) on port $port."
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

function Ensure-Api {
  $sourceVersion = Get-ApiSourceVersion
  $recordedSourceVersion = ""
  if (Test-Path $ApiSourceVersionFile) {
    $recordedSourceVersion = (Get-Content $ApiSourceVersionFile -Raw).Trim()
  }
  if (Test-LocalApi) {
    if ($recordedSourceVersion -eq $sourceVersion) { return }
    Write-OwnerLog "Backend source changed; restarting owner API."
  }
  Stop-ApiListener
  Write-OwnerLog "Starting owner API on $(Get-LocalApiUrl)."
  Start-HiddenCommand "npm.cmd" "run api:serve" $ApiOutLog $ApiErrLog | Out-Null
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-LocalApi) {
      Set-Content -Path $ApiSourceVersionFile -Value $sourceVersion -Encoding ASCII
      Write-OwnerLog "Owner API is healthy."
      return
    }
  }
  Write-OwnerLog "API stdout:"
  if (Test-Path $ApiOutLog) { Get-Content $ApiOutLog -Tail 40 }
  Write-OwnerLog "API stderr:"
  if (Test-Path $ApiErrLog) { Get-Content $ApiErrLog -Tail 40 }
  throw "Owner API did not become healthy."
}

function Ensure-Cloudflared {
  if (Test-Path $CloudflaredExe) { return }
  Write-OwnerLog "Downloading cloudflared."
  Invoke-WebRequest -Uri $CloudflaredDownloadUrl -OutFile $CloudflaredExe -UseBasicParsing
}

function Get-TunnelUrl {
  foreach ($path in @($TunnelErrLog, $TunnelOutLog)) {
    if (-not (Test-Path $path)) { continue }
    $text = Get-Content $path -Raw
    $matches = [regex]::Matches($text, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($matches.Count -gt 0) {
      return $matches[$matches.Count - 1].Value
    }
  }
  return $null
}

function Test-PublicApi([string]$PublicUrl) {
  if (-not $PublicUrl) { return $false }
  try {
    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromSeconds(15)
    $response = $client.GetAsync("$PublicUrl/version").GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { return $false }
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if ($text -match '"app"\s*:\s*"ai-story-teller-api"') { return $true }
  } catch {
    Write-OwnerLog "Direct public tunnel check failed: $($_.Exception.Message)"
  }
  if (Test-Path $TunnelErrLog) {
    $log = (Get-Content $TunnelErrLog -Tail 120) -join "`n"
    $hasRegisteredConnection = $log -match "Registered tunnel connection"
    $hasRecentDisconnect = $log -match "Unregistered tunnel connection|failed to serve quick Tunnel|connection.*closed"
    if ($hasRegisteredConnection -and -not $hasRecentDisconnect) {
      Write-OwnerLog "Using cloudflared registered-connection log as tunnel health evidence."
      return $true
    }
  }
  return $false
}

function Stop-ManagedTunnel {
  $stopped = $false
  if (Test-Path $TunnelPidFile) {
    $pidText = (Get-Content $TunnelPidFile -Raw).Trim()
    $pidValue = 0
    if ([int]::TryParse($pidText, [ref]$pidValue)) {
      $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
      if ($process) {
        Write-OwnerLog "Stopping managed cloudflared PID $pidValue."
        Write-TunnelResetLog "cloudflare_tunnel_process_stopped" @{ pid = $pidValue; source = "managed_pid_file" }
        Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        $stopped = $true
      }
    }
  }
  if ($stopped) { return }
  foreach ($process in Get-Process cloudflared -ErrorAction SilentlyContinue) {
    $path = ""
    try { $path = $process.Path } catch { $path = "" }
    if ($path -eq $CloudflaredExe -or [string]::IsNullOrWhiteSpace($path)) {
      Write-OwnerLog "Stopping existing cloudflared PID $($process.Id)."
      Write-TunnelResetLog "cloudflare_tunnel_process_stopped" @{ pid = $process.Id; source = "existing_cloudflared_process" }
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

function Start-Tunnel([string]$Reason, [string]$PreviousUrl = "") {
  Stop-ManagedTunnel
  $target = Get-LocalApiUrl
  Write-OwnerLog "Starting Cloudflare Quick Tunnel to $target."
  Write-TunnelResetLog "cloudflare_tunnel_reset_started" @{
    reason = $Reason
    previousUrl = $PreviousUrl
    target = $target
  }
  $startTime = Get-Date
  Start-HiddenCommand $CloudflaredExe "tunnel --no-autoupdate --url $target" $TunnelOutLog $TunnelErrLog | Out-Null
  Start-Sleep -Seconds 2
  $cloudflared = Get-Process cloudflared -ErrorAction SilentlyContinue |
    Where-Object { $_.StartTime -ge $startTime.AddSeconds(-3) } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1
  if ($cloudflared) {
    Set-Content -Path $TunnelPidFile -Value $cloudflared.Id -Encoding ASCII
    Write-TunnelResetLog "cloudflare_tunnel_process_started" @{ pid = $cloudflared.Id; target = $target }
  }
}

function Wait-TunnelUrl {
  for ($attempt = 1; $attempt -le 45; $attempt++) {
    Start-Sleep -Seconds 1
    $url = Get-TunnelUrl
    if ($url) { return $url }
  }
  Write-OwnerLog "cloudflared stderr:"
  if (Test-Path $TunnelErrLog) { Get-Content $TunnelErrLog -Tail 80 }
  throw "Cloudflare did not return a Quick Tunnel URL."
}

function Ensure-Tunnel {
  $url = Get-TunnelUrl
  if ($url -and (Test-PublicApi $url)) { return $url }
  $reason = "missing_url"
  if ($url) {
    Write-OwnerLog "Tunnel URL exists but is not healthy: $url"
    $reason = "unhealthy_url"
  }
  $previousUrl = ""
  if ($url) { $previousUrl = $url }
  Start-Tunnel $reason $previousUrl
  $url = Wait-TunnelUrl
  if (-not (Test-PublicApi $url)) {
    Write-TunnelResetLog "cloudflare_tunnel_reset_failed" @{ url = $url; reason = "public_api_unhealthy" }
    throw "Cloudflare tunnel URL was created but /version did not respond: $url"
  }
  Write-OwnerLog "Tunnel is healthy: $url"
  Write-TunnelResetLog "cloudflare_tunnel_reset_completed" @{ url = $url; reason = $reason }
  return $url
}

function Get-PublishedPagesUrl {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if ($gh) {
    $value = (& gh variable get AIST_PUBLIC_API_BASE_URL 2>$null)
    if ($LASTEXITCODE -eq 0 -and $value) { return $value.Trim() }
  }
  if (Test-Path $StateFile) { return (Get-Content $StateFile -Raw).Trim() }
  return ""
}

function Publish-TunnelUrl([string]$Url) {
  Write-OwnerLog "Publishing Pages API URL: $Url"
  Write-TunnelResetLog "cloudflare_pages_url_publish_started" @{ url = $Url; branch = $Branch }
  Set-EnvValue "AIST_PUBLIC_API_BASE_URL" $Url
  Set-EnvValue "AIST_GOOGLE_REDIRECT_URI" "$Url/auth/google/callback"
  Set-Content -Path $StateFile -Value $Url -Encoding ASCII
  Stop-ApiListener
  Ensure-Api
  & npm.cmd run pages:set-api -- $Url $Branch
  if ($LASTEXITCODE -ne 0) { throw "GitHub Pages API URL update failed." }
  Write-TunnelResetLog "cloudflare_pages_url_publish_completed" @{ url = $Url; branch = $Branch }
}

Ensure-LocalFiles
Ensure-Cloudflared
Set-Content -Path $WatchdogPidFile -Value $PID -Encoding ASCII

do {
  Ensure-PostgresIfConfigured
  Ensure-Api
  $url = Ensure-Tunnel
  $published = Get-PublishedPagesUrl
  if ($forceDeployRequested -or $published -ne $url) {
    Publish-TunnelUrl $url
    $forceDeployRequested = $false
  } else {
    Write-OwnerLog "Pages already points at $url."
  }
  if ($Once) { break }
  Start-Sleep -Seconds $CheckSeconds
} while ($true)
