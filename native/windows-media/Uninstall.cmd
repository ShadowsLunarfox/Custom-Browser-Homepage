@echo off
setlocal DisableDelayedExpansion
rem Leave batch-file execution before uninstall deletes an installed launcher.
(goto) 2>nul & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall.ps1" -Pause %*
