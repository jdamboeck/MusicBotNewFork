@echo off
setlocal
cd /d "%~dp0"

echo Starting BgUtil PO Token Provider Server...
cd bgutil-ytdlp-pot-provider\server
set SERVER_DIR=%CD%
cd /d "%~dp0"

powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList 'build\main.js' -WorkingDirectory '%SERVER_DIR%' -PassThru; Set-Content -Path '%~dp0po-provider.pid' -Value $p.Id"
echo PO Token Provider started.
echo Waiting 5 seconds for provider to initialize...
timeout /t 5 /nobreak > nul

echo.
echo Starting zen-bot...
node main.js

echo.
echo Stopping PO Token Provider...
for /f "usebackq delims=" %%i in ("%~dp0po-provider.pid") do taskkill /PID %%i /F /T 2>nul
del "%~dp0po-provider.pid" 2>nul
endlocal
