param([ValidateSet('dev', 'build', 'preview')][string]$Mode = 'dev')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
# Prefer the desktop runtime on this machine; ordinary Node is the portable fallback.
$desktopNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$runtime = if (Test-Path -LiteralPath $desktopNode) { $desktopNode } else { (Get-Command node -ErrorAction Stop).Source }
if (!(Test-Path -LiteralPath 'node_modules\vite\bin\vite.js')) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if ($Mode -eq 'build') {
  & $runtime 'node_modules/typescript/bin/tsc' '-b'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $runtime 'node_modules/vite/bin/vite.js' 'build'
} elseif ($Mode -eq 'preview') {
  & $runtime 'node_modules/vite/bin/vite.js' 'preview' '--host' '127.0.0.1'
} else {
  & $runtime 'node_modules/vite/bin/vite.js' '--host' '127.0.0.1' '--port' '5173' '--open'
}
exit $LASTEXITCODE
