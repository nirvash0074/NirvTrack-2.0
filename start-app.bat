@echo off
title NirvTrack App Server
cd /d "%~dp0"
echo ========================================================
echo   Starting NirvTrack Standalone Web App...
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
pause
