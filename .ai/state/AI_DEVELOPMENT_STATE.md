# Estado do Desenvolvimento (operacional)

> Fonte rápida para trocar de LLM sem depender do histórico. Visão executiva: `vault/00_HOME/PROJECT_STATUS.md`.

| Campo | Valor |
|---|---|
| Fase atual | FASE 1 — Bootstrap (em validação) |
| Etapa atual | PR do bootstrap aberto para `release`, aguardando revisão humana |
| Branch atual | `feature/00-bootstrap` |
| Última entrega | Fundação do bootstrap: Vault, `.ai/`, adapters, roadmap, HTMLs, esqueleto do monorepo |
| Última decisão | Bootstrap aprovado (HUMAN_GATE, 2026-10-28) |
| Tarefas em andamento | Revisão do PR do bootstrap |
| Bloqueios | Nenhum |
| Próxima ação | Humano revisa e aprova o merge do PR em `release`; depois autoriza o início da Fase 2 |
| Testes atuais | `scripts/validate-bootstrap.sh` (estrutura, links, segredos, HTML) |
| Release atual | nenhuma (`v0.0.0`) |

---

## HANDOFF — 2026-10-28 — Claude Code (Opus)

**Contexto:** Intake completo em 4 blocos e bootstrap aprovado pelo humano. Nenhum código de produto foi escrito.
**Estado:** FASE 1 em validação. Branch `feature/00-bootstrap` a partir de `release`. `main` e `release` contêm apenas o commit inicial (LICENSE, README, .gitignore).
**Alterações:** criação de `vault/`, `.ai/`, `CLAUDE.md`, `AGENTS.md`, `.claude/agents`, `.claude/skills`, `.agents/skills`, `.githooks/`, `scripts/`, `docs/*.html`, esqueleto `apps/` e `packages/`.
**Decisões:** ver `vault/10_DECISIONS/DECISION_LOG.md` (ADR-0001 a ADR-0011).
**Pendências:** prazo/dedicação semanal não informados (hipótese H-01); spikes técnicos S-01 a S-05 planejados para Fases 2 e 7.
**Próximo passo:** aguardar aprovação humana do PR; **não iniciar a Fase 2 sem autorização**.
**Arquivos relevantes:** `vault/00_HOME/START_HERE.md`, `vault/11_ROADMAP/DEVELOPMENT_PLAN.md`, `vault/11_ROADMAP/TECHNICAL_SPIKES.md`.
