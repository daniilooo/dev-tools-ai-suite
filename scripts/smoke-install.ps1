# Instalação limpa do pacote npm no Windows (x64), equivalente a scripts/smoke-install.sh (ADR-0015).
#
# Uso: pwsh scripts/smoke-install.ps1 <devtools-ai-suite-X.Y.Z.tgz | URL do .tgz | pacote@versão>
#
# Instala o pacote num prefixo global e num perfil de usuário temporários (sem tocar no
# ~/.dev-tools-ai-suite real), roda `devtools doctor` e percorre a mesma jornada pela API
# do Linux (scripts/smoke-install-check.mjs). Os módulos nativos precisam vir prontos.
param([Parameter(Mandatory = $true)][string]$Package)
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$spec = if (Test-Path $Package) { (Resolve-Path $Package).Path } else { $Package }
$root = Join-Path ([System.IO.Path]::GetTempPath()) ("devtools-smoke-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$prefix = Join-Path $root "npm-global"
$home_ = Join-Path $root "home"
New-Item -ItemType Directory -Force -Path $prefix, $home_ | Out-Null

$env:NPM_CONFIG_PREFIX = $prefix
$env:Path = "$prefix;$env:Path"
# homedir() no Windows vem do USERPROFILE: dados e projeto de teste ficam no perfil temporário.
$env:USERPROFILE = $home_

Write-Host "== Windows: $([System.Environment]::OSVersion.VersionString), Node $(node --version), arquitetura $env:PROCESSOR_ARCHITECTURE"
Write-Host "== npm install -g $spec"
$elapsed = Measure-Command { npm install -g --no-fund --no-audit $spec | Select-Object -Last 3 | Write-Host }
Write-Host ("   instalado em {0:N1} s" -f $elapsed.TotalSeconds)
Write-Host "== devtools --version: $(devtools --version)"
devtools doctor
node (Join-Path $PSScriptRoot "smoke-install-check.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
