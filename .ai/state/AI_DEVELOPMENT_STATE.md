# Estado do Desenvolvimento (operacional)

> Fonte rápida para trocar de LLM sem depender do histórico. Visão executiva: `vault/00_HOME/PROJECT_STATUS.md`.

| Campo | Valor |
|---|---|
| Fase atual | FASE 4 — Provider Integration (em validação) |
| Etapa atual | Implementado; PR e revisão humana |
| Branch atual | `feature/04-providers` |
| Última entrega | Módulo `integrations`, `/providers`, doctor com login real, abrir Claude/Codex no projeto |
| Última decisão | Fase 4 autorizada (HG-14); D-09 e D-10 |
| Tarefas em andamento | Nenhuma; ambiente de dev rodando (`pnpm dev:server` + `pnpm dev:web`) |
| Bloqueios | Nenhum |
| Próxima ação | PR `feature/04-providers → release`, CI verde, revisão humana |
| Testes atuais | `pnpm test` (52 servidor + 5 web), `pnpm test:e2e` (5), `validate:bootstrap` |
| Release atual | nenhuma (`v0.0.0`) |

---

## HANDOFF — 2026-10-28 (Fase 4) — Claude Code (Opus)

**Contexto:** Fase 4 autorizada pelo humano após o merge da Fase 3.
**Estado:** implementado em `feature/04-providers`; testes locais verdes (77 servidor, 5 web, 9 E2E).
**Alterações:** `apps/server/src/modules/integrations/*` (adapters claude-code/codex/ollama, serviço, rota), doctor e CLI com login real, `launch` na criação de terminal, regra ESLint INV-02, fixtures por versão, `apps/web/src/app/features/providers/*`, botões de lançamento, `tests/e2e/providers.spec.ts` (binários falsos), hook pre-push pula push que só apaga branches.
**Decisões:** D-09 (comando fixo digitado no shell) e D-10 (lint proíbe `fs` em `integrations`).
**Pendências:** revisão humana e merge; dívidas TD-09 e TD-10.
**Próximo passo:** **não iniciar a Fase 5 sem autorização (HG-14)**. A Fase 5 exige spike S-04 (hooks do Claude Code e arquivos de sessão do Codex).
**Arquivos relevantes:** `apps/server/src/modules/integrations/provider-adapter.ts`, `claude-code.adapter.ts`, `codex.adapter.ts`, `apps/server/test/providers.test.ts`.

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
