---
tags: [home, status]
atualizado: 2026-11-05
---

# Status do Projeto

| Campo | Valor |
|---|---|
| Fase atual | **FASE 10 — Suporte ao Windows** (pós-MVP, D-28) |
| Status da fase | Em andamento — CI verde no Linux e no Windows; aguarda homologação manual |
| Etapa | PR #19 (`feature/10-windows`): código, testes, CI Windows e documentação ([[ADR-0015-suporte-windows]]) |
| Branch atual | `feature/10-windows` |
| Versão / release | `0.1.0` — `npm install -g devtools-ai-suite` · [GitHub Release](https://github.com/daniilooo/dev-tools-ai-suite/releases/tag/v0.1.0) |
| Última entrega | Job "Validação (Windows)" verde: 143 testes do servidor, 15 web, 15 E2E e instalação limpa do `.tgz` com a jornada pela API |
| Última decisão | Windows nativo x64, terminais em PowerShell, homologação manual pelo humano (D-28) |
| Tarefas em andamento | Homologação manual no Windows (terminal, Claude Code, Codex, cotas, conhecimento) |
| Bloqueios | Nenhum |
| Próxima ação | Humano homologa no Windows com o `.tgz` do CI; depois merge do PR #19 e preparo da `0.2.0` (HG-01/02/03) |
| Testes atuais | 149 servidor + 15 web + 15 E2E + instalação limpa, no Linux e no Windows (CI) |

## Progresso por fase
| Fase | Status |
|---|---|
| 0 — Intake e Discovery | Concluído (spikes técnicos migrados para as fases 2 e 7) |
| 1 — Bootstrap | Concluído |
| 2 — Foundation | Concluído |
| 3 — Integrated Terminal | Concluído |
| 4 — Provider Integration | Concluído |
| 5 — Agent Monitor + Telemetria | Concluído |
| 6 — AI Quota Monitor | Concluído |
| 7 — Knowledge (RAG + Grafo) | Concluído |
| 8 — Hardening e Validação | Concluído |
| 9 — MVP Release | Concluído |
| 10 — Suporte ao Windows | Em andamento (homologação manual pendente) |

## Hipóteses abertas
- **H-01:** sem prazo fixo; roadmap guiado por fases, não por datas. Dedicação semanal não informada. → [[INTAKE_RECORD]]

Detalhes operacionais e HANDOFF: `.ai/state/AI_DEVELOPMENT_STATE.md`. Plano: [[DEVELOPMENT_PLAN]].
