#!/usr/bin/env bash
# Gera o pacote npm de uma versão a partir do commit atual, num worktree limpo, e testa a
# instalação limpa. O .tgz gerado é exatamente o que será publicado (`npm publish <tgz>`).
#
# Uso: scripts/release-pack.sh <diretório de saída>
#
# O worktree isola o build do ambiente de desenvolvimento: nada do watcher do dashboard,
# de arquivos não versionados ou de alterações locais entra no pacote.
set -euo pipefail

OUT="$(realpath "${1:?informe o diretório de saída do .tgz}")"
ROOT="$(git rev-parse --show-toplevel)"
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "Há alterações não commitadas: o pacote precisa sair de um commit." >&2
  exit 1
fi
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD)"
WORK="$(mktemp -d)"
trap 'git -C "$ROOT" worktree remove --force "$WORK/repo" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

echo "== worktree limpo em $COMMIT"
git -C "$ROOT" worktree add --detach "$WORK/repo" HEAD >/dev/null
cd "$WORK/repo"
pnpm install --frozen-lockfile --reporter=silent
pnpm build >/dev/null

echo "== pnpm pack"
mkdir -p "$OUT"
(cd apps/server && pnpm pack --pack-destination "$OUT" | tail -1)
VERSION="$(node -p 'require("./apps/server/package.json").version')"
TARBALL="$OUT/devtools-ai-suite-$VERSION.tgz"

echo "== instalação limpa"
"$ROOT/scripts/smoke-install.sh" "$TARBALL"

echo
echo "Pacote: $TARBALL"
echo "Commit: $COMMIT"
echo "SHA-256: $(sha256sum "$TARBALL" | cut -d' ' -f1)"
