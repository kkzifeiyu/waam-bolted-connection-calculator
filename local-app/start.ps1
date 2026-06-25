$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    & py -3 server.py --open
    exit $LASTEXITCODE
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    & python server.py --open
    exit $LASTEXITCODE
}

Write-Error "Python 3 was not found. Install Python 3 and run start.ps1 again."
