#!/usr/bin/env bash
# Valida a fundação do bootstrap: estrutura, wikilinks do Vault, adapters, HTMLs e segredos.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
errors=0
fail() { echo "❌ $*"; errors=$((errors+1)); }
ok()   { echo "✅ $*"; }

# 1. Arquivos obrigatórios
required=(
  README.md LICENSE CLAUDE.md AGENTS.md CONTRIBUTING.md SECURITY.md .env.example
  package.json pnpm-workspace.yaml
  .ai/README.md .ai/state/AI_DEVELOPMENT_STATE.md
  .ai/workflow/{START,INTAKE,PLANEJAMENTO,IMPLEMENTACAO,TESTES,REVISAO,DEPLOY,COMMIT_PUSH}.md
  .ai/agents/{ORCHESTRATOR,EXPLORER,REPORTER,ARCHITECT,DEVOPS,QA,REVIEWER}.md
  .ai/contracts/{TASK_CONTRACT,RESPONSE_CONTRACT}.md
  .ai/adapters/{claude,codex,local}/README.md
  .ai/hooks/HOOKS.md .githooks/pre-commit .githooks/pre-push
  vault/00_HOME/START_HERE.md vault/00_HOME/PROJECT_STATUS.md
  vault/11_ROADMAP/DEVELOPMENT_PLAN.md vault/11_ROADMAP/POST_MVP_BACKLOG.md
  vault/13_AI_SYSTEM/AI_DEVELOPMENT_MANUAL.md
  docs/development-plan.html docs/ai-development-system.html
)
missing=0
for f in "${required[@]}"; do [[ -f "$f" ]] || { fail "ausente: $f"; missing=1; }; done
[[ $missing -eq 0 ]] && ok "arquivos obrigatórios presentes (${#required[@]})"

# 2. Wikilinks do Vault resolvem para arquivos existentes
broken=0
while IFS= read -r link; do
  target="${link%%|*}"; target="${target%%#*}"
  if ! find vault -name "${target}.md" | grep -q .; then fail "wikilink quebrado: [[${target}]]"; broken=1; fi
done < <(grep -rhoP '\[\[\K[^\]]+(?=\]\])' vault | sort -u)
[[ $broken -eq 0 ]] && ok "wikilinks do Vault resolvidos"

# 3. Wrappers de agentes e skills têm frontmatter e apontam para arquivos existentes
wr=0
for f in .claude/agents/*.md .claude/skills/*/SKILL.md .agents/skills/*/SKILL.md; do
  [[ "$f" == *monitor-do-contexto-local* ]] && continue
  head -1 "$f" | grep -q '^---$' || { fail "sem frontmatter: $f"; wr=1; }
  ref=$(grep -oP '`\K\.ai/(agents|skills)/[^`]+' "$f" | head -1)
  [[ -n "$ref" && -f "$ref" ]] || { fail "referência inválida em $f ($ref)"; wr=1; }
done
[[ $wr -eq 0 ]] && ok "wrappers de agentes/skills válidos"

# 4. HTMLs standalone (sem scripts/estilos externos) e bem fechados
for h in docs/*.html; do
  grep -q '</html>' "$h" || fail "HTML não fechado: $h"
  if grep -Eq '<script[^>]+src=|<link[^>]+href="https?:' "$h"; then fail "HTML com recurso externo: $h"; fi
done
ok "HTMLs verificados"

# 5. package.json válido
node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8"))' && ok "package.json válido" || fail "package.json inválido"

# 6. Segredos
bash scripts/check-secrets.sh >/dev/null && ok "sem segredos" || fail "varredura de segredos falhou"

echo
if [[ $errors -gt 0 ]]; then echo "Validação do bootstrap FALHOU ($errors erro(s))."; exit 1; fi
echo "Validação do bootstrap OK."
