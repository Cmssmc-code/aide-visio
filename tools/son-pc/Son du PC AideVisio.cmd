@echo off
setlocal
set "HERE=%~dp0"
where pythonw >nul 2>nul
if errorlevel 1 (
  echo Python est introuvable. Installez Python 3 puis : pip install pyaudiowpatch numpy websockets faster-whisper
  pause
  exit /b 1
)
start "" pythonw "%HERE%aidevisio_son_pc.py"
exit /b 0
