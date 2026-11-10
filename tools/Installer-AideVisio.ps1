<#
.SYNOPSIS
  Installe Aide Visio sur ce PC : raccourcis Bureau et menu Démarrer qui ouvrent l'app
  dans sa propre fenêtre (Chrome, sinon Edge), avec l'icône Aide Visio.

.DESCRIPTION
  Aucun droit administrateur requis. Rien n'est installé en dehors de :
    %LOCALAPPDATA%\Aide Visio\aidevisio.ico   (icône)
    Bureau\Aide Visio.lnk, menu Démarrer\Programmes\Aide Visio.lnk
  Compatible Windows PowerShell 5.1 et PowerShell 7.

.PARAMETER Url
  Adresse de l'app (par défaut la version publique).

.PARAMETER Uninstall
  Supprime les raccourcis et l'icône (le dossier %LOCALAPPDATA%\Aide Visio seulement s'il est vide).

.PARAMETER ShortcutDir
  Crée un seul raccourci dans ce dossier (au lieu du Bureau et du menu Démarrer).

.PARAMETER NoLaunch
  N'ouvre pas Aide Visio à la fin de l'installation.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\Installer-AideVisio.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\Installer-AideVisio.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string]$Url = 'https://cmssmc-code.github.io/aide-visio/',
  [switch]$Uninstall,
  [switch]$NoDesktop,
  [switch]$NoStartMenu,
  [switch]$NoLaunch,
  [string]$ShortcutDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$AppName     = 'Aide Visio'
$Description = "Aide Visio — oral d'anglais (UE 218)"
$InstallDir  = Join-Path $env:LOCALAPPDATA 'Aide Visio'
$IconPath    = Join-Path $InstallDir 'aidevisio.ico'
$DesktopLnk  = Join-Path ([Environment]::GetFolderPath('Desktop')) "$AppName.lnk"
$ProgramsLnk = Join-Path ([Environment]::GetFolderPath('Programs')) "$AppName.lnk"
$DesktopUrl  = Join-Path ([Environment]::GetFolderPath('Desktop')) "$AppName.url"
$ProgramsUrl = Join-Path ([Environment]::GetFolderPath('Programs')) "$AppName.url"
$Pairs = @()
if ($ShortcutDir) {
  $Pairs += ,@((Join-Path $ShortcutDir "$AppName.lnk"), (Join-Path $ShortcutDir "$AppName.url"))
} else {
  if (-not $NoDesktop)   { $Pairs += ,@($DesktopLnk, $DesktopUrl) }
  if (-not $NoStartMenu) { $Pairs += ,@($ProgramsLnk, $ProgramsUrl) }
}

function Write-Step([string]$Message, [string]$Color = 'Gray') {
  Write-Host "  $Message" -ForegroundColor $Color
}

if ($Uninstall) {
  Write-Host "Désinstallation de Aide Visio" -ForegroundColor Cyan
  $items = @($DesktopLnk, $ProgramsLnk, $DesktopUrl, $ProgramsUrl)
  if ($ShortcutDir) { $items = @((Join-Path $ShortcutDir "$AppName.lnk"), (Join-Path $ShortcutDir "$AppName.url")) }
  foreach ($item in $items) {
    if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Force; Write-Step "Supprimé : $item" }
  }
  # Le dossier est partagé avec « Son du PC » (son-pc.log, son-pc.json) : ne retirer que l'icône.
  if (Test-Path -LiteralPath $IconPath) { Remove-Item -LiteralPath $IconPath -Force; Write-Step "Supprimé : $IconPath" }
  if ((Test-Path -LiteralPath $InstallDir) -and -not (Get-ChildItem -LiteralPath $InstallDir -Force)) {
    Remove-Item -LiteralPath $InstallDir -Force; Write-Step "Supprimé : $InstallDir"
  }
  Write-Host "Aide Visio est désinstallé. Vos oraux blancs et réglages restent dans le navigateur (Réglages > Effacer mes données pour les supprimer)." -ForegroundColor Green
  exit 0
}

if ($Url -notmatch '^(https?|file)://') {
  Write-Host "Adresse invalide : $Url (attendu https://…, http://localhost… ou file:///…)" -ForegroundColor Red
  exit 1
}

function Get-AppPath([string]$Exe) {
  foreach ($hive in @('HKCU:', 'HKLM:')) {
    $key = "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$Exe"
    try {
      $value = (Get-Item -LiteralPath $key -ErrorAction Stop).GetValue('')
      if ($value) {
        $value = $value.Trim('"')
        if (Test-Path -LiteralPath $value) { return $value }
      }
    } catch { }
  }
  return $null
}

function Find-Browser {
  $roots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA) | Where-Object { $_ }
  foreach ($root in $roots) {
    $p = Join-Path $root 'Google\Chrome\Application\chrome.exe'
    if (Test-Path -LiteralPath $p) { return $p }
  }
  $p = Get-AppPath 'chrome.exe'
  if ($p) { return $p }
  foreach ($root in $roots) {
    $p = Join-Path $root 'Microsoft\Edge\Application\msedge.exe'
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return (Get-AppPath 'msedge.exe')
}

function Install-Icon {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $here = $PSScriptRoot
  if (-not $here) { $here = (Get-Location).Path }
  $candidates = @(
    (Join-Path $here 'aidevisio.ico'),
    (Join-Path $here 'icons\aidevisio.ico'),
    (Join-Path $here '..\icons\aidevisio.ico'),
    (Join-Path $here '..\src\icons\aidevisio.ico'),
    (Join-Path $here '..\dist\site\icons\aidevisio.ico')
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) {
      Copy-Item -LiteralPath $c -Destination $IconPath -Force
      return $IconPath
    }
  }
  if ($Url -match '^https?://') {
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
      $base = if ($Url.EndsWith('/')) { $Url } else { $Url.Substring(0, $Url.LastIndexOf('/') + 1) }
      Invoke-WebRequest -UseBasicParsing -Uri ($base + 'icons/aidevisio.ico') -OutFile $IconPath -TimeoutSec 20
      if ((Get-Item -LiteralPath $IconPath).Length -gt 0) { return $IconPath }
    } catch {
      Write-Step "Icône non téléchargée ($($_.Exception.Message)) : icône du navigateur utilisée." 'Yellow'
    }
  }
  return $null
}

function New-AppShortcut([string]$Path, [string]$Browser, [string]$Icon) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($Path)
  # Copie du dépôt : passer par le lanceur (relance Son du PC, Chrome à part), comme le raccourci existant.
  $vbs = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'Lancer-AideVisio.vbs' } else { $null }
  if ($vbs -and (Test-Path -LiteralPath $vbs)) {
    $lnk.TargetPath = "$env:WINDIR\System32\wscript.exe"
    $lnk.Arguments = '"' + $vbs + '" "' + $Url + '"'
  } else {
    $lnk.TargetPath = $Browser
    $lnk.Arguments = "--app=`"$Url`""
  }
  $lnk.WorkingDirectory = Split-Path -Parent $Browser
  $lnk.Description = $Description
  $lnk.WindowStyle = 1
  if ($Icon) { $lnk.IconLocation = "$Icon,0" } else { $lnk.IconLocation = "$Browser,0" }
  $lnk.Save()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}

function New-UrlShortcut([string]$Path, [string]$Icon) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  $lines = @('[InternetShortcut]', "URL=$Url")
  if ($Icon) { $lines += @("IconFile=$Icon", 'IconIndex=0') }
  Set-Content -LiteralPath $Path -Value $lines -Encoding ASCII
}

Write-Host "Installation de Aide Visio" -ForegroundColor Cyan
Write-Step "Adresse : $Url"

$browser = Find-Browser
if ($browser) { Write-Step "Navigateur : $browser" }
else { Write-Step "Chrome et Edge introuvables : raccourci vers le navigateur par défaut." 'Yellow' }

$icon = Install-Icon
if ($icon) { Write-Step "Icône : $icon" }

$created = @()
foreach ($t in $Pairs) {
  try {
    if ($browser) {
      if (Test-Path -LiteralPath $t[1]) { Remove-Item -LiteralPath $t[1] -Force }
      New-AppShortcut -Path $t[0] -Browser $browser -Icon $icon
      $created += $t[0]
    } else {
      New-UrlShortcut -Path $t[1] -Icon $icon
      $created += $t[1]
    }
  } catch {
    Write-Step "Raccourci impossible ($($t[0])) : $($_.Exception.Message)" 'Yellow'
  }
}

if ($created.Count -eq 0) {
  Write-Host "Aucun raccourci créé." -ForegroundColor Red
  exit 1
}
foreach ($c in $created) { Write-Step "Raccourci : $c" 'Green' }
Write-Host "Aide Visio est installé. Astuce : clic droit sur le raccourci du menu Démarrer > Épingler à la barre des tâches." -ForegroundColor Green

if (-not $NoLaunch) {
  if ($browser) { Start-Process -FilePath $browser -ArgumentList "--app=`"$Url`"" }
  else { Start-Process $Url }
}
exit 0
