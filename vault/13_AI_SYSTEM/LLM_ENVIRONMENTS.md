---
tags: [ai-system]
atualizado: 2026-10-28
---

# Ambientes de LLM

| Ambiente | Versão | Conta | Subagentes | Skills | Hooks | Terminal | Internet | Observações |
|---|---|---|---|---|---|---|---|---|
| Claude Code | 2.1.312 | Claude (acesso ao Claude Code) | Sim (`.claude/agents`) | Sim | Sim | Sim | Sim | modelos efetivos: confirmar com `/model` |
| Codex CLI | 0.162.0 | ChatGPT Plus | não garantido — papéis assumidos em sequência | Sim (`.agents/skills`) | a verificar | Sim | Sim | limites menores no Plus |
| Ollama | 0.40.0 | local | Não | Não | Não | Não | Não | CPU, ~20 GB RAM; `qwen3:8b` |

Hardware de referência: Ubuntu 24.04 · ~20 GB RAM · sem GPU dedicada.

Atualizar esta tabela quando versões, contas ou modelos mudarem.
