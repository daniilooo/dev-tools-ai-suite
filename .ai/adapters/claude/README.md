# Adapter — Claude Code

Versão de referência no bootstrap: Claude Code 2.1.312 (Linux).

## Como o Claude Code consome o workflow
| Conceito do projeto | Mecanismo no Claude Code |
|---|---|
| Entrada | `CLAUDE.md` (raiz) → `.ai/README.md` |
| Orchestrator | a **sessão principal** atua como Orchestrator |
| Agentes | subagentes em `.claude/agents/*.md` (wrappers finos para `.ai/agents/`) |
| Skills | `.claude/skills/<nome>/SKILL.md` (wrappers para `.ai/skills/`) |
| Hooks git | `.githooks/` (independente de fornecedor) |
| MCPs | nenhum obrigatório; GitHub via `gh` CLI |

## Tiers → modelos
Os wrappers usam **aliases** (`haiku`, `sonnet`, `opus`), resolvidos pelo Claude Code para os modelos efetivamente disponíveis na conta. Não presumir modelos ou limites pelo plano; confirmar com `/model` e `/usage` (ou `/status`).

| Tier | Alias |
|---|---|
| 1 | `haiku` |
| 2 | `sonnet` |
| 3 | `opus` |

## Regras
- Respeitar limites de uso: evitar vários subagentes `opus` em paralelo.
- Permissões de git conforme `.ai/workflow/COMMIT_PUSH.md`.
- `.claude/skills/monitor-do-contexto-local/` é local e não versionado.
