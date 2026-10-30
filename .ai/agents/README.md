# Agentes

Catálogo enxuto: só existem agentes com benefício real. Tiers em `vault/13_AI_SYSTEM/MODEL_STRATEGY.md`.

| Agente | Arquivo | Tier | Paralelizável |
|---|---|---|---|
| Orchestrator | `ORCHESTRATOR.md` | 2 | — |
| Explorer | `EXPLORER.md` | 1 | Sim (várias instâncias) |
| Reporter | `REPORTER.md` | 1 | — |
| Architect | `ARCHITECT.md` | 2–3 | Especializações podem debater |
| backend-developer | `BACKEND_DEVELOPER.md` | 2 | Sim, em módulos independentes |
| frontend-developer | `FRONTEND_DEVELOPER.md` | 2 | Sim, em features independentes |
| DevOps | `DEVOPS.md` | 2 | — |
| QA | `QA.md` | 1–2 | Sim (QA_API, QA_FRONTEND, QA_SECURITY, QA_TERMINAL) |
| Reviewer | `REVIEWER.md` | 2 | — |
| Security Engineer | `SECURITY_ENGINEER.md` | 3 | — |

**Não criados** (sem benefício no MVP monousuário): Product Owner, Project Manager, Tech Lead, DBA, UX, Data Engineer, SRE, FinOps. O humano exerce PO/Tech Lead.

Adapters: `.claude/agents/` (Claude Code) e `.ai/adapters/codex/README.md` (Codex).
