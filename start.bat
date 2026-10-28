@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org then run this again. & pause & exit /b)
start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"
node server.js
pause
