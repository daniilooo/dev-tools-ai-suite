---
id: ADR-0009
titulo: GitFlow simplificado main ← release ← feature/fix/chore
status: Aceito
data: 2026-10-28
decisores: humano (Intake B4)
tags: [adr, git]
---

# ADR-0009 — GitFlow simplificado

## Decisão
`main` (versões publicadas, protegida) ← `release` (integração/homologação, protegida) ← `feature/*`, `fix/*`, `chore/*`. Sem `develop`. Tags SemVer `vX.Y.Z`. Conventional Commits com descrição em PT-BR. Squash merge em `release`; merge commit `release → main`. LLM pode fazer merge em `release` após CI verde e revisão; `main`, tags, releases e npm exigem gate humano.

Detalhes: [[GITFLOW]] · [[HUMAN_GATES]]
