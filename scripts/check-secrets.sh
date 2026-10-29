#!/usr/bin/env bash
# Varredura determinística de segredos.
# Uso: scripts/check-secrets.sh            -> todos os arquivos versionados
#      scripts/check-secrets.sh --staged   -> apenas linhas adicionadas no stage
set -euo pipefail

PATTERNS=(
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{50,}'
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'sk-(proj-)?[A-Za-z0-9]{32,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'npm_[A-Za-z0-9]{36}'
  'AIza[0-9A-Za-z_-]{35}'
)
REGEX=$(IFS='|'; echo "${PATTERNS[*]}")
SELF="scripts/check-secrets.sh"
found=0

if [[ "${1:-}" == "--staged" ]]; then
  while IFS= read -r file; do
    [[ "$file" == "$SELF" ]] && continue
    if git diff --cached -U0 -- "$file" | grep -E '^\+' | grep -v '^+++' | grep -En -- "$REGEX" >/dev/null; then
      echo "❌ Possível segredo em (stage): $file"; found=1
    fi
  done < <(git diff --cached --name-only --diff-filter=ACM)
else
  while IFS= read -r file; do
    [[ "$file" == "$SELF" || ! -f "$file" ]] && continue
    if grep -EnI -- "$REGEX" "$file" >/dev/null 2>&1; then
      echo "❌ Possível segredo em: $file"; found=1
    fi
  done < <(git ls-files --cached --others --exclude-standard)
fi

# Arquivos que nunca devem ser versionados
if git ls-files --cached | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' >/dev/null; then
  echo "❌ Arquivo .env versionado"; found=1
fi

if [[ $found -ne 0 ]]; then
  echo "Varredura de segredos FALHOU. Remova o segredo e rotacione-o se já foi exposto."
  exit 1
fi
echo "✅ Nenhum segredo encontrado."
