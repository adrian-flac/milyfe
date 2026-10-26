[CmdletBinding()]
param(
  [string]$DatabaseUrl,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"

function Get-DatabaseUrlFromEnvFile {
  $envFile = Join-Path $PSScriptRoot "..\.env"
  if (-not (Test-Path -LiteralPath $envFile)) {
    throw "No se encontró .env. Usa -DatabaseUrl para indicar la conexión de origen."
  }

  $entry = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $entry) {
    throw "No se encontró DATABASE_URL en .env."
  }

  $value = ($entry -split '=', 2)[1].Trim()
  return $value.Trim('"').Trim("'")
}

function Convert-PrismaUrlForPostgresTools([string]$url) {
  $parts = $url -split '\?', 2
  if ($parts.Count -eq 1) {
    return $url
  }

  $query = $parts[1] -split '&' | Where-Object { $_ -notmatch '^schema=' }
  if ($query.Count -eq 0) {
    return $parts[0]
  }
  return "$($parts[0])?$($query -join '&')"
}

if (-not $DatabaseUrl) {
  $DatabaseUrl = Get-DatabaseUrlFromEnvFile
}
if ($DatabaseUrl -notmatch '^postgres(ql)?://') {
  throw "La conexión debe ser una URL de PostgreSQL."
}
$pgConnectionString = Convert-PrismaUrlForPostgresTools $DatabaseUrl

function Find-PostgresTool([string]$name) {
  $command = Get-Command "$name.exe" -ErrorAction SilentlyContinue
  if (-not $command) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
  }
  if ($command) {
    return $command.Source
  }

  $installRoot = "C:\Program Files\PostgreSQL"
  if (Test-Path -LiteralPath $installRoot) {
    foreach ($installation in (Get-ChildItem -LiteralPath $installRoot -Directory | Sort-Object Name -Descending)) {
      $tool = Join-Path $installation.FullName "bin\$name.exe"
      if (Test-Path -LiteralPath $tool) {
        return $tool
      }
    }
  }

  throw "No se encontró $name. Instala las herramientas de PostgreSQL o añade su carpeta bin al PATH."
}

$pgDump = Find-PostgresTool "pg_dump"
$pgRestore = Find-PostgresTool "pg_restore"

$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $outputPath "milyfe-$timestamp.backup"

& $pgDump "--dbname=$pgConnectionString" --format=custom --no-owner --no-acl "--file=$backupFile"
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump no pudo crear la copia."
}

& $pgRestore --list $backupFile | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "La copia se creó pero no pasó la verificación de pg_restore. No la uses para restaurar."
}

Write-Output "Copia verificada: $backupFile"
