@echo off
echo Starting auto-commit process...
powershell -ExecutionPolicy Bypass -File "%~dp0auto-commit.ps1"
echo.
echo Auto-commit completed. Press any key to exit.
pause > nul 