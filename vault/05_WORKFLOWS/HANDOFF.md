---
tags: [workflow, handoff]
---

# Regra de Handoff

Antes de interromper sessão longa, atingir limite de uso ou trocar de LLM: **atualizar o estado**.

1. Atualizar o bloco HANDOFF em `.ai/state/AI_DEVELOPMENT_STATE.md` (template `.ai/templates/HANDOFF_TEMPLATE.md`).
2. Atualizar [[PROJECT_STATUS]] se fase, etapa ou próxima ação mudaram.
3. Commitar ou registrar no handoff qualquer alteração não commitada.

A próxima LLM começa pelo handoff (prompt `.ai/prompts/RETOMAR_SESSAO.md`).

```text
HANDOFF
Contexto:
Estado:
Alterações:
Decisões:
Pendências:
Próximo passo:
Arquivos relevantes:
```
