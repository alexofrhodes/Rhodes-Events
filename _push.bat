@echo off
setlocal enableextensions enabledelayedexpansion

:: Get current date and time formatted (YYYY-MM-DD HH:MM)
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value') do set datetime=%%i
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2% %datetime:~8,2%:%datetime:~10,2%

echo Staging changes...
git add .

echo Committing...
git commit -m "+ events %TIMESTAMP%"

echo Pushing to GitHub...
git push origin main

echo Done!
pause