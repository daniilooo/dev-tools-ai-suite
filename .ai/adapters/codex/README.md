# Adapter — OpenAI Codex

Versão de referência no bootstrap: codex-cli 0.162.0, conta ChatGPT Plus.

## Como o Codex consome o workflow
| Conceito do projeto | Mecanismo no Codex |
|---|---|
| Entrada | `AGENTS.md` (raiz) → `.ai/README.md` |
| Orchestrator | a sessão principal atua como Orchestrator |
| Agentes | sem subagentes nativos garantidos: o Orchestrator **assume o papel** lendo `.ai/agents/<AGENTE>.md` e aplicando o contrato correspondente, em sequência |
| Skills | `.agents/skills/<nome>/SKILL.md` (wrappers para `.ai/skills/`) — invocação `$<nome>` |
| Hooks git | `.githooks/` |

## Tiers → modelos
Consultar os modelos disponíveis no ambiente autenticado (`/model` no Codex). Registrar o mapeamento observado em `vault/13_AI_SYSTEM/LLM_ENVIRONMENTS.md`. Não presumir disponibilidade.

## Regras
- Plano Plus tem limites de uso menores: preferir Codex para tarefas Tier 2 bem delimitadas.
- Mesmo workflow, mesmos gates, mesmo HANDOFF.
