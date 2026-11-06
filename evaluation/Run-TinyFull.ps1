$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
& "$projectRoot\backend\.venv\Scripts\python.exe" -B "$projectRoot\evaluation\scripts\asr_full.py" --model tiny
exit $LASTEXITCODE
