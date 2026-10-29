# Skill: git-flow

Modelo: `main` (estável, publicada) ← `release` (integração/homologação) ← `feature/*`, `fix/*`, `chore/*`.

## Iniciar trabalho
```bash
git fetch origin
git switch release && git pull --ff-only
git switch -c feature/<fase>-<descricao-curta>   # ex.: feature/03-reconexao-terminal
```

## Abrir PR
```bash
git push -u origin HEAD
gh pr create --base release --title "<conventional commit>" --body-file <corpo baseado em .ai/templates/PR_TEMPLATE.md>
```

## Merge em `release` (LLM permitido)
Somente com CI verde e revisão sem achados bloqueantes. Estratégia: **squash merge**.

## Merge `release → main` (gate humano)
`HUMAN_GATE_START` com versão, mudanças, riscos e rollback. Estratégia: **merge commit** (preserva o ponto de integração), seguido de tag `vX.Y.Z` (também gate humano).

## Proibido
Commit direto em `main` · force-push em `main`/`release` · excluir branch protegida · alterar proteção de branch sem gate.
