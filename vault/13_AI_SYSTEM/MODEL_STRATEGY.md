---
tags: [ai-system, modelos]
---

# Estratégia de Modelos (independente de fornecedor)

| Tier | Uso | Claude Code (alias) | Codex | Local |
|---|---|---|---|---|
| **1 — barato** | exploração, buscas, relatórios, tarefas mecânicas | `haiku` | modelo mais leve disponível | `qwen3:8b` (latência alta em CPU) |
| **2 — intermediário** | orquestração, implementação, testes, revisão comum | `sonnet` | modelo padrão | — |
| **3 — avançado** | arquitetura crítica, segurança, incidentes, decisões difíceis | `opus` | modelo mais capaz disponível | — |

Regras:
- Não presumir modelos ou limites pelo plano; detectar no ambiente (`/model`, `/usage`/`/status`, `ollama list`) e registrar em [[LLM_ENVIRONMENTS]].
- Orchestrator em Tier 2 por padrão; Tier 3 só quando justificado.
- Evitar múltiplos agentes Tier 3 simultâneos.
- Ao atingir limite de um provedor: HANDOFF → continuar em outro ([[AI_DEVELOPMENT_MANUAL]]).
