# Estado do Desenvolvimento (operacional)

> Fonte rápida para trocar de LLM sem depender do histórico. Visão executiva: `vault/00_HOME/PROJECT_STATUS.md`.

| Campo | Valor |
|---|---|
| Fase atual | FASE 3 — Integrated Terminal (concluída) |
| Etapa atual | Aguardando autorização da Fase 4 (HG-14) |
| Branch atual | `release` |
| Última entrega | Terminal web (PTY + WS + xterm.js), abas, reconexão, encerramento da árvore de processos |
| Última decisão | Terminal validado e PR #4 mergeado pelo humano (2026-10-28) |
| Tarefas em andamento | Nenhuma; ambiente de dev rodando (`pnpm dev:server` + `pnpm dev:web`) |
| Bloqueios | Nenhum |
| Próxima ação | Humano autoriza a FASE 4 — Provider Integration (HG-14) |
| Testes atuais | `pnpm test` (52 servidor + 5 web), `pnpm test:e2e` (5), `validate:bootstrap` |
| Release atual | nenhuma (`v0.0.0`) |

---

## HANDOFF — 2026-10-28 (Fase 3) — Claude Code (Opus)

**Contexto:** Fase 3 autorizada pelo humano, com pedido de deixar o ambiente rodando para acompanhar a evolução.
**Estado:** terminal implementado em `feature/03-terminal`; testes locais verdes (68 servidor, 5 web, 7 E2E).
**Alterações:** `apps/server/src/modules/terminal/*` (backend PTY, gerenciador, rotas REST/WS, repositório), `core/process-tree.ts`, migração 2, hook de segurança para `/ws/`, `apps/web/src/app/features/terminal/*`, `tests/e2e/terminal.spec.ts`.
**Decisões:** retenção 8 h; sessão POSIX para achar processos órfãos; `Origin` obrigatória no upgrade WS; variáveis `DEVTOOLS_*` fora do ambiente do shell.
**Pendências:** dívidas TD-06 a TD-08. Terminal validado pelo humano, CI verde e PR #4 mergeado.
**Próximo passo:** PR para `release`; **não iniciar a Fase 4 sem autorização (HG-14)**.
**Arquivos relevantes:** `apps/server/src/modules/terminal/terminal-manager.ts`, `apps/server/src/core/security.ts`, `apps/server/src/core/process-tree.ts`, `apps/web/src/app/features/terminal/terminal-view.ts`.

---

## HANDOFF — 2026-10-28 (Fase 2) — Claude Code (Opus)

**Contexto:** Fase 2 autorizada (HG-14). Gates HG-07 (PTY híbrido + better-sqlite3), HG-05/06 (ADR-0007) aprovados; HG-11 autorizado para depois do CI existir.
**Estado:** implementação da Fase 2 concluída em `feature/02-foundation`, empilhada sobre `feature/00-bootstrap` porque o merge do PR #1 pela LLM foi bloqueado pela política de permissões. Tudo verde localmente.
**Alterações:** `apps/server` (core, módulos session/projects/system, CLI), `apps/web` (Angular 22 + Tailwind 4), `packages/shared` (tipos), `tests/e2e`, `.github/workflows/ci.yml`, tooling da raiz, Vault atualizado.
**Decisões:** token descartável HMAC para o CLI (achado de segurança: o CLI enviava o segredo bruto a qualquer processo na porta); CSP restritiva com `inlineCritical` desligado; sessões sem estado assinadas por HMAC.
**Pendências:** dívidas TD-01 a TD-05. PRs #1 e #2 mergeados em `release`; CI verde; proteção de branches (HG-11) aplicada.
**Próximo passo:** Fase 2 concluída; **não iniciar a Fase 3 sem autorização (HG-14)**. A Fase 3 instala `@lydell/node-pty` com fallback para `node-pty` (ADR-0012).
**Arquivos relevantes:** `apps/server/src/core/security.ts`, `apps/server/src/core/cli-auth.ts`, `apps/server/src/app.ts`, `apps/web/src/app/core/auth.service.ts`, `vault/11_ROADMAP/DEVELOPMENT_PLAN.md`.

---

## HANDOFF — 2026-10-28 — Claude Code (Opus)

**Contexto:** Intake completo em 4 blocos e bootstrap aprovado pelo humano. Nenhum código de produto foi escrito.
**Estado:** FASE 1 em validação. Branch `feature/00-bootstrap` a partir de `release`. `main` e `release` contêm apenas o commit inicial (LICENSE, README, .gitignore).
**Alterações:** criação de `vault/`, `.ai/`, `CLAUDE.md`, `AGENTS.md`, `.claude/agents`, `.claude/skills`, `.agents/skills`, `.githooks/`, `scripts/`, `docs/*.html`, esqueleto `apps/` e `packages/`.
**Decisões:** ver `vault/10_DECISIONS/DECISION_LOG.md` (ADR-0001 a ADR-0011).
**Pendências:** prazo/dedicação semanal não informados (hipótese H-01); spikes técnicos S-01 a S-05 planejados para Fases 2 e 7.
**Próximo passo:** aguardar aprovação humana do PR; **não iniciar a Fase 2 sem autorização**.
**Arquivos relevantes:** `vault/00_HOME/START_HERE.md`, `vault/11_ROADMAP/DEVELOPMENT_PLAN.md`, `vault/11_ROADMAP/TECHNICAL_SPIKES.md`.
