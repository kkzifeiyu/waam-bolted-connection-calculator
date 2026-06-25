@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --open
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py --open
  goto :eof
)
echo Python 3 was not found. Install Python 3 and run this file again.
pause
