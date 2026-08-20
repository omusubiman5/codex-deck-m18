@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-CodexDeck-VSDCraft.ps1"
if errorlevel 1 (
  echo.
  echo Codex Deck installation failed. Review the message above.
  pause
  exit /b 1
)
echo.
echo Codex Deck installation completed.
pause
