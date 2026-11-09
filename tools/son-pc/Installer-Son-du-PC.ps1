<#
.SYNOPSIS
  Installe « Son du PC » pour Aide Visio : dépendances Python, lancement automatique à l'ouverture de session,
  démarrage immédiat.
.DESCRIPTION
  « Son du PC » (aidevisio_son_pc.py) écoute séparément le son joué par Windows (le correspondant) et le micro
  (vous), découpe les phrases et les transcrit sur le PC (Whisper), puis les envoie à Aide Visio (mode « Appel
  ou visio sur ce PC (son interne) »). Sans droits administrateur.
  -Uninstall : retire le lancement automatique et arrête le programme.
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here 'aidevisio_son_pc.py'
$startup = [Environment]::GetFolderPath('Startup')
$lnkPath = Join-Path $startup 'Son du PC AideVisio.lnk'

function Stop-SonPC {
  Get-CimInstance Win32_Process -Filter "Name='pythonw.exe' OR Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'aidevisio_son_pc' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($Uninstall) {
  Stop-SonPC
  if (Test-Path -LiteralPath $lnkPath) { Remove-Item -LiteralPath $lnkPath -Force }
  Write-Host 'Son du PC : désinstallé (lancement automatique retiré).'
  exit 0
}

$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
$py = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
if (-not $pyw -or -not $py) { Write-Host 'Python 3 est introuvable : installez-le (python.org), puis relancez.' -ForegroundColor Red; exit 1 }

& $py -m pip install --user --quiet --disable-pip-version-check pyaudiowpatch numpy websockets faster-whisper
if ($LASTEXITCODE -ne 0) { Write-Host 'Installation des modules Python impossible.' -ForegroundColor Red; exit 1 }

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $pyw
$lnk.Arguments = '"' + $script + '"'
$lnk.WorkingDirectory = $here
$lnk.Description = 'Aide Visio : écoute et transcription locales (son du PC + micro)'
$lnk.Save()

Stop-SonPC
& $py -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"
Start-Process -FilePath $pyw -ArgumentList ('"' + $script + '"') -WorkingDirectory $here -WindowStyle Hidden
Write-Host "Son du PC : installé, lancé, et relancé à chaque ouverture de session ($lnkPath)."
