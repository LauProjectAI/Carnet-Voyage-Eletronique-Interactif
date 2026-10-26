@echo off
rem Lanceur Carnet de Voyage Girardot (masque la fenêtre console et lance le script PowerShell)
start /B powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0launch_app.ps1"
exit
