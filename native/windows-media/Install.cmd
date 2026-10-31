@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1" %*
set "LUNAR_MEDIA_INSTALL_RESULT=%ERRORLEVEL%"
if /I not "%~1"=="-Yes" pause
exit /b %LUNAR_MEDIA_INSTALL_RESULT%
