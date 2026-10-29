---
tags: [decisoes, intake]
data: 2026-10-28
---

# Registro do Intake (2026-10-28)

Intake executado em 4 blocos com o mantenedor e aprovado via HUMAN_GATE.

| Bloco | Tema | Onde foi consolidado |
|---|---|---|
| 1 | Produto, público, jornada, funcionalidades, DoD | [[PRODUCT_VISION]] · [[MVP_SCOPE]] · [[PERSONAS]] · [[USER_JOURNEYS]] |
| 2 | Regras de negócio e invariantes, prioridade P0/P1/P2 | [[BUSINESS_RULES]] · [[BUSINESS_INVARIANTS]] |
| 3 | Stack, arquitetura, qualidade, distribuição | [[SYSTEM_OVERVIEW]] · [[ARCHITECTURE]] · ADR-0001 a 0008 |
| 4 | GitFlow, gates, LLMs, MCPs, CI/CD, infra | [[GITFLOW]] · [[HUMAN_GATES]] · [[LLM_ENVIRONMENTS]] · [[CI_CD]] |

## Ambiente verificado no bootstrap
Ubuntu 24.04 · ~20 GB RAM · CPU sem GPU · Node v22.23.3 · pnpm 12.11.2 · git 2.43.0 · gh 2.45.0 (autenticado como `daniilooo`) · Claude Code 2.1.312 · codex-cli 0.162.0 · Ollama 0.40.0 (`qwen3:8b`) · Python 3.12.3 · Docker 29.9.2 · **Graphify não instalado**.

## Divergências encontradas e resolvidas
- Repositório remoto informado com `main`, mas estava **vazio** → commit inicial mínimo autorizado (D-03).
- Nenhum modelo de embeddings no Ollama → reforça ONNX como primeira opção (ADR-0006).

## Hipóteses registradas
| ID | Hipótese | Validar quando |
|---|---|---|
| H-01 | Sem prazo fixo; roadmap guiado por fases. Dedicação semanal não informada. | Ao iniciar Fase 2 |
| H-02 | Porta padrão `4317`. | Fase 2 |
| H-03 | Nome do pacote npm `devtools-ai-suite` disponível. | Antes da primeira publicação |
| H-04 | Hooks e transcripts do Claude Code e sessões do Codex fornecem eventos suficientes para o Agent Monitor. | Spike S-04 |
| H-05 | Há saída oficial consumível de uso/limites para os planos atuais. | Spike S-05 |
