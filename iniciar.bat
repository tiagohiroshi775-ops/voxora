@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale Node.js 20 ou superior em https://nodejs.org/
 pause
 exit /b 1
)
echo Abra http://localhost:3000 no navegador.
node server.js
pause
