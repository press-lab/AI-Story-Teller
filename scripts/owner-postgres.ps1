[CmdletBinding()]
param(
  [ValidateSet("init", "start", "stop", "status", "url", "migrate-utf8")]
  [string]$Action = "start",
  [string]$PgBin = "",
  [int]$Port = 55432,
  [string]$Database = "aist_local",
  [string]$User = "aist_owner"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$LocalDir = Join-Path $RepoRoot ".local-backend"
$DataDir = Join-Path $LocalDir "postgres-data"
$LogPath = Join-Path $LocalDir "postgres.log"
$PasswordPath = Join-Path $LocalDir "postgres-password.txt"
$BackupDir = Join-Path $LocalDir "postgres-backups"
$EnvPath = Join-Path $RepoRoot ".env"
$ActiveDatabase = $Database

function Write-OwnerLog([string]$Message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$timestamp] $Message"
}

function Find-PostgresBin {
  if ($PgBin -and (Test-Path $PgBin)) { return (Resolve-Path $PgBin).Path }
  $candidates = @(
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "initdb.exe")) { return $candidate }
  }
  $initdb = Get-Command initdb -ErrorAction SilentlyContinue
  if ($initdb) { return Split-Path $initdb.Source -Parent }
  throw "Postgres binaries were not found. Install PostgreSQL or pass -PgBin."
}

$PgBin = Find-PostgresBin
$InitDb = Join-Path $PgBin "initdb.exe"
$PgCtl = Join-Path $PgBin "pg_ctl.exe"
$Psql = Join-Path $PgBin "psql.exe"
$Createdb = Join-Path $PgBin "createdb.exe"
$PgDump = Join-Path $PgBin "pg_dump.exe"
$PgRestore = Join-Path $PgBin "pg_restore.exe"

function New-Password {
  -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
}

function Get-Password {
  if (-not (Test-Path $PasswordPath)) {
    New-Item -ItemType Directory -Force $LocalDir | Out-Null
    Set-Content -Path $PasswordPath -Value (New-Password) -Encoding ASCII
  }
  return (Get-Content $PasswordPath -Raw).Trim()
}

function Get-DatabaseUrl {
  $password = [Uri]::EscapeDataString((Get-Password))
  return "postgres://$User`:$password@127.0.0.1:$Port/$script:ActiveDatabase"
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

function Test-ClusterInitialized {
  return Test-Path (Join-Path $DataDir "PG_VERSION")
}

function Test-PostgresReady {
  try {
    $env:PGPASSWORD = Get-Password
    & $Psql -h 127.0.0.1 -p $Port -U $User -d postgres -w -tAc "select 1" 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Initialize-Cluster {
  New-Item -ItemType Directory -Force $LocalDir | Out-Null
  if (Test-ClusterInitialized) {
    Write-OwnerLog "Postgres cluster already exists at $DataDir."
    return
  }
  $password = Get-Password
  $temporaryPasswordFile = Join-Path $LocalDir "postgres-init-password.tmp"
  Set-Content -Path $temporaryPasswordFile -Value $password -Encoding ASCII
  try {
    Write-OwnerLog "Initializing app-owned Postgres cluster at $DataDir."
    & $InitDb -D $DataDir -U $User -A scram-sha-256 --auth-host=scram-sha-256 --auth-local=trust --pwfile=$temporaryPasswordFile
    if ($LASTEXITCODE -ne 0) { throw "initdb failed." }
  } finally {
    Remove-Item $temporaryPasswordFile -Force -ErrorAction SilentlyContinue
  }
  Add-Content -Path (Join-Path $DataDir "postgresql.conf") -Value @"

# AI Story Teller owner-local cluster settings.
listen_addresses = '127.0.0.1'
port = $Port
"@
}

function Start-Cluster {
  Initialize-Cluster
  if (Test-PostgresReady) {
    Write-OwnerLog "Postgres is already running on 127.0.0.1:$Port."
  } else {
    Write-OwnerLog "Starting Postgres on 127.0.0.1:$Port."
    & $PgCtl -D $DataDir -l $LogPath -w start
    if ($LASTEXITCODE -ne 0) { throw "pg_ctl start failed. See $LogPath." }
  }
  Ensure-Database
  $url = Get-DatabaseUrl
  Set-EnvValue "AIST_DATABASE_URL" $url
  Write-OwnerLog "AIST_DATABASE_URL points at local Postgres."
}

function Ensure-Database {
  $env:PGPASSWORD = Get-Password
  try {
    $exists = & $Psql -h 127.0.0.1 -p $Port -U $User -d postgres -w -tAc "select 1 from pg_database where datname = '$Database'"
    if (($exists -join "").Trim() -eq "1") {
      $encoding = Get-DatabaseEncoding $Database
      if ($encoding -eq "UTF8") {
        $script:ActiveDatabase = $Database
        Write-OwnerLog "Database $Database already exists with UTF8 encoding."
        return
      }
      Write-OwnerLog "Database $Database uses $encoding encoding; migrating active database to UTF8."
      $script:ActiveDatabase = Ensure-Utf8DatabaseFromSource $Database
      return
    }
    Write-OwnerLog "Creating UTF8 database $Database."
    & $Createdb -h 127.0.0.1 -p $Port -U $User -w -E UTF8 --locale=C -T template0 $Database
    if ($LASTEXITCODE -ne 0) { throw "createdb failed." }
    $script:ActiveDatabase = $Database
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Get-DatabaseEncoding([string]$DatabaseName) {
  $result = & $Psql -h 127.0.0.1 -p $Port -U $User -d postgres -w -tAc "select pg_encoding_to_char(encoding) from pg_database where datname = '$DatabaseName'"
  if ($LASTEXITCODE -ne 0) { throw "Could not read encoding for database $DatabaseName." }
  return (($result -join "").Trim())
}

function Ensure-Utf8DatabaseFromSource([string]$SourceDatabase) {
  $target = if ($SourceDatabase.EndsWith("_utf8")) { $SourceDatabase } else { "$SourceDatabase`_utf8" }
  $targetExists = & $Psql -h 127.0.0.1 -p $Port -U $User -d postgres -w -tAc "select 1 from pg_database where datname = '$target'"
  if (($targetExists -join "").Trim() -eq "1") {
    $targetEncoding = Get-DatabaseEncoding $target
    if ($targetEncoding -ne "UTF8") { throw "Target database $target exists but uses $targetEncoding encoding." }
    $sourceRecords = Get-AppRecordCount $SourceDatabase
    $targetRecords = Get-AppRecordCount $target
    if ($sourceRecords -gt $targetRecords) {
      throw "Target database $target already exists but has fewer app records ($targetRecords) than $SourceDatabase ($sourceRecords). Back it up or remove it before migrating."
    }
    Write-OwnerLog "UTF8 database $target already exists; using it as the active app database."
    return $target
  }

  New-Item -ItemType Directory -Force $BackupDir | Out-Null
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path $BackupDir "$SourceDatabase-before-utf8-$timestamp.dump"
  Write-OwnerLog "Creating backup before UTF8 migration: $backupPath"
  $env:PGCLIENTENCODING = "UTF8"
  try {
    & $PgDump -h 127.0.0.1 -p $Port -U $User -w --encoding=UTF8 -Fc -f $backupPath $SourceDatabase
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
  } finally {
    Remove-Item Env:\PGCLIENTENCODING -ErrorAction SilentlyContinue
  }

  Write-OwnerLog "Creating UTF8 database $target."
  & $Createdb -h 127.0.0.1 -p $Port -U $User -w -E UTF8 --locale=C -T template0 $target
  if ($LASTEXITCODE -ne 0) { throw "createdb failed for $target." }

  Write-OwnerLog "Restoring backup into $target."
  & $PgRestore -h 127.0.0.1 -p $Port -U $User -w -d $target $backupPath
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed for $target." }

  $targetEncoding = Get-DatabaseEncoding $target
  if ($targetEncoding -ne "UTF8") { throw "UTF8 migration failed; $target uses $targetEncoding." }
  Write-OwnerLog "UTF8 migration complete. Old database $SourceDatabase was left in place."
  return $target
}

function Get-AppRecordCount([string]$DatabaseName) {
  $query = "select case when to_regclass('public.aist_records') is null then 0 else (select count(*) from public.aist_records) end"
  $result = & $Psql -h 127.0.0.1 -p $Port -U $User -d $DatabaseName -w -tAc $query
  if ($LASTEXITCODE -ne 0) { throw "Could not count app records in database $DatabaseName." }
  return [int](($result -join "").Trim())
}

function Stop-Cluster {
  if (-not (Test-ClusterInitialized)) {
    Write-OwnerLog "Postgres cluster is not initialized."
    return
  }
  Write-OwnerLog "Stopping Postgres cluster."
  & $PgCtl -D $DataDir -w stop
}

function Show-Status {
  if (-not (Test-ClusterInitialized)) {
    Write-Host "not-initialized"
    return
  }
  if (Test-PostgresReady) {
    Write-Host "running 127.0.0.1:$Port"
  } else {
    Write-Host "stopped"
  }
}

switch ($Action) {
  "init" { Initialize-Cluster; Start-Cluster }
  "start" { Start-Cluster }
  "migrate-utf8" { Start-Cluster }
  "stop" { Stop-Cluster }
  "status" { Show-Status }
  "url" { Write-Host (Get-DatabaseUrl) }
}
