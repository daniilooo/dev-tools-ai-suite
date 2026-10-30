#!/usr/bin/env bash
# Instalação limpa do pacote npm num Linux sem nada da máquina de desenvolvimento (DoD 1 e 9).
#
# Uso: scripts/smoke-install.sh <devtools-ai-suite-X.Y.Z.tgz | devtools-ai-suite@next> [imagem]
#
# Com um .tgz, instala o arquivo local; senão, instala a versão do registro npm.
#
# Sobe um contêiner Debian com Node 22 (sem compilador nem python: os módulos nativos
# precisam vir prontos), instala o pacote como usuário comum, roda `devtools doctor`,
# inicia o servidor e percorre a jornada pela API: projeto, stack, índice, consulta,
# reinício com os dados preservados e projeto do usuário intocado.
set -euo pipefail

PACKAGE="${1:?informe o .tgz gerado por pnpm pack ou a versão do registro}"
IMAGE="${2:-node:22-bookworm-slim}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$PACKAGE" ]; then
  MOUNT=(-v "$(realpath "$PACKAGE")":/pkg/devtools.tgz:ro)
  SPEC=/pkg/devtools.tgz
else
  MOUNT=()
  SPEC="$PACKAGE"
fi

docker run --rm \
  "${MOUNT[@]}" \
  -e SPEC="$SPEC" \
  -v "$HERE/smoke-install-check.mjs":/pkg/check.mjs:ro \
  "$IMAGE" bash -euo pipefail -c '
    apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends git ca-certificates >/dev/null
    echo "== Linux: $(. /etc/os-release && echo "$PRETTY_NAME"), Node $(node --version), sem gcc/python: $(command -v gcc python3 || echo ok)"
    su node -s /bin/bash -c "
      set -euo pipefail
      export NPM_CONFIG_PREFIX=\$HOME/.npm-global PATH=\$HOME/.npm-global/bin:\$PATH
      cd \$HOME
      echo == npm install -g $SPEC
      time npm install -g --no-fund --no-audit $SPEC 2>&1 | tail -3
      echo == devtools --version: \$(devtools --version)
      devtools doctor
      node /pkg/check.mjs
    "
  '
