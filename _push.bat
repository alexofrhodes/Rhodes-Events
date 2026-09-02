@echo off
setlocal enableextensions

cd /d "%~dp0.."
echo Deploying site repo (auto SHELL bump if shell changed)...
python -m app.exporters.deploy push --site-dir "%~dp0"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" pause
exit /b %ERR%
