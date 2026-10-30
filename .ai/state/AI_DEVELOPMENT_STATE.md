# Estado do Desenvolvimento (operacional)

> Fonte rápida para trocar de LLM sem depender do histórico. Visão executiva: `vault/00_HOME/PROJECT_STATUS.md`.

| Campo | Valor |
|---|---|
| Fase atual | FASE 8 — Hardening e Validação (em andamento) |
| Etapa atual | Validação da DoD: tour no Chrome feito; faltam instalação limpa, persistência/upgrade, E2E da jornada, revisão de segurança e documentação |
| Branch atual | `feature/08-hardening` |
| Última entrega | Fase 7 concluída (PRs #9, #10, #11); correções do tour: stack em subpastas, seletor de projeto, 404 de arquivo estático |
| Última decisão | D-22 (Fase 8 autorizada) |
| Tarefas em andamento | Itens da DoD da Fase 8; ambiente de dev rodando desacoplado |
| Bloqueios | Nenhum |
| Próxima ação | Concluir os itens da DoD e entregar o relatório de validação (aprovação humana) |
| Testes atuais | `pnpm test` (134 servidor + 15 web), `pnpm test:e2e` (14), `validate:bootstrap` |
| Release atual | nenhuma (`v0.0.0`) |

---

## HANDOFF — 2026-10-29 (Fase 8, início) — Claude Code (Opus)

**Contexto:** Fase 7 integrada (PR #11); Fase 8 autorizada pelo humano (D-22). Branch `feature/08-hardening` a partir de `release`.
**Estado:** em andamento. Tour do dashboard real no Chrome com o `srm-credit-engine` (Angular + Spring Boot) em todas as telas.
**Alterações:** `projects/stack-detection.ts` procura manifestos até 2 níveis abaixo; `<select>` de projeto nas telas Agentes e Conhecimento usa `[selected]` por opção; fallback da SPA devolve 404 para caminho com extensão.
**Pendências:** instalação limpa do pacote, testes de persistência/upgrade, E2E da jornada, revisão de segurança, documentação, TD-20, relatório dos 12 itens da DoD. Vulnerabilidade do vite (só dev, via vitest) fica para um chore separado.
**Próximo passo:** seguir os itens da DoD. **Não iniciar a Fase 9 sem autorização.**
**Arquivos relevantes:** `vault/01_PRODUCT/MVP_SCOPE.md` (DoD), `vault/11_ROADMAP/DEVELOPMENT_PLAN.md` (Fase 8).

---

## HANDOFF — 2026-10-29 (Fase 7, parte 2) — Claude Code (Opus)

**Contexto:** HG-07 aprovado pelo humano (D-20, ADR-0006 Aceito). Implementação em `feature/07-semantic-graph`, a partir de `docs/07-spikes-s02-s03` (PR #10).
**Estado:** pronto; testes locais verdes (132 servidor, 15 web, 14 E2E). Validação com ferramentas reais no `srm-credit-engine` (Transformers.js + `multilingual-e5-small`, Graphify 0.9.97).
**Alterações:** `modules/knowledge/{vector-store,embeddings,semantic.service,code-graph,code-graph.service}.ts`, consulta híbrida e novas rotas em `knowledge.service.ts`/`knowledge.routes.ts`, migração 5, `config.knowledge` (`DEVTOOLS_OLLAMA_URL` só loopback, modelos, `DEVTOOLS_GRAPHIFY_BIN`), `runProcess` com `signal`, layout `graphs/addons/models`; web `knowledge-semantic.ts`, `knowledge-graph.ts`; E2E com Ollama e Graphify falsos (`tests/e2e/support/fake-knowledge.ts`).
**Decisões:** D-21 (modelos padrão).
**Pendências:** TD-19 (embeddings lentos na CPU), TD-20 (Graphify/Transformers.js fora do doctor). O teste de reinício do `foundation.spec.ts` passou a tolerar a recusa esperada do `/ws/events` durante o reinício (falhou uma vez sob carga).
**Próximo passo:** revisão humana dos PRs #10 e da parte 2. **Não iniciar a Fase 8 sem autorização.**
**Arquivos relevantes:** `apps/server/src/modules/knowledge/semantic.service.ts`, `code-graph.service.ts`, `code-graph.ts`, `embeddings.ts`, `vector-store.ts`, `apps/web/src/app/features/knowledge/knowledge-semantic.ts`, `knowledge-graph.ts`.

---

## HANDOFF — 2026-10-29 (Fase 7, spikes S-02/S-03) — Claude Code (Opus)

**Contexto:** PR #9 (parte 1) aprovado e integrado na `release`. O humano autorizou os spikes em diretório isolado.
**Estado:** spikes executados no scratchpad com o `jinsei`; nada instalado no produto. Resultados em `vault/11_ROADMAP/TECHNICAL_SPIKES.md`.
**Achados:** `sqlite-vec` (188 KB, consulta 9–15 ms) vence LanceDB (1,1 GB, mesmos resultados). Embeddings ONNX locais: runtime de 548 MB, 1,3–1,5 GB de RAM, 21 min para o `jinsei` com MiniLM (ruim em PT-BR); o multilíngue é ~2× mais lento. Graphify `--code-only` é preciso em `explain`/`affected`, ruidoso em busca livre, e ignora repositórios aninhados se seguir o `.gitignore` da raiz.
**Recomendação (HG-07):** `sqlite-vec`; busca semântica opcional por projeto com Ollama local ou Transformers.js instalado sob demanda; Graphify como ferramenta externa opcional com `--out` no diretório de dados.
**Próximo passo:** HG-07 aprovado pelo humano (D-20, ADR-0006 Aceito); implementar em `feature/07-semantic-graph`. **Não iniciar a Fase 8 sem autorização.**

---

## HANDOFF — 2026-10-29 (Fase 7, parte 1) — Claude Code (Opus)

**Contexto:** Fase 7 autorizada após o merge da Fase 6 (PR #8). O humano está em modo remoto e avalia à noite.
**Estado:** parte 1 implementada em `feature/07-knowledge`; testes locais verdes (123 servidor, 13 web, 13 E2E).
**Alterações:** `apps/server/src/modules/knowledge/*` (exclusões, listagem git com repositórios aninhados, chunking, índice FTS5 por projeto, serviço, rotas), migração 4, `apps/web/src/app/features/knowledge/*`, card no detalhe do projeto, `tests/e2e/knowledge.spec.ts`.
**Decisões:** D-18 (FTS5 como base, índice em `indexes/<projeto>.db`), D-19 (repositórios aninhados).
**Pendências:** spikes S-02 (Graphify) e S-03 (sqlite-vec × LanceDB + embeddings ONNX) — instalação de pacotes externos bloqueada pelo modo automático; pesquisa documental registrada em TECHNICAL_SPIKES. Dívidas TD-17 e TD-18.
**Próximo passo:** com permissão, rodar os benchmarks em diretório isolado (scratchpad) com o repositório `jinsei` (Angular + Spring Boot), propor ADR-0006 Aceito e pedir HG-07. **Não iniciar a Fase 8 sem autorização.**
**Arquivos relevantes:** `apps/server/src/modules/knowledge/knowledge.service.ts`, `indexer.ts`, `knowledge-index.ts`, `exclusions.ts`, `apps/web/src/app/features/knowledge/knowledge-page.ts`.

---

## HANDOFF — 2026-10-29 (Fase 6) — Claude Code (Opus)

**Contexto:** Fase 6 autorizada pelo humano após o merge da Fase 5 (PR #7). No spike S-05 o humano escolheu a status line da suíte via `--settings` para as cotas do Claude (D-15).
**Estado:** implementado em `feature/06-quota-monitor`; testes locais verdes (115 servidor, 11 web, 12 E2E).
**Alterações:** `apps/server/src/statusline.ts` (script autocontido executado pelo Claude Code), `modules/quota/*` (preparo da status line, monitor, rota), `integrations/sources/quota-sources.ts`, `system/events.routes.ts` (`/ws/events` reúne agentes e cotas), `--settings` no lançamento do Claude, `DEVTOOLS_CLAUDE_STATUSLINE`, fixtures de cotas, `apps/web/src/app/features/quota/*` (tela e resumo na barra lateral), `tests/e2e/quota.spec.ts`; o Claude falso do E2E executa a status line como o real.
**Decisões:** ADR-0014, D-15 (status line com `--settings`), D-16 (sem persistência; frescor 15 min).
**Pendências:** dívidas TD-15 e TD-16. PR #8 aprovado e mergeado; validação com o Claude Code real fica com o humano.
**Próximo passo:** **não iniciar a Fase 7 sem autorização (HG-14)**. A Fase 7 começa pelos spikes S-02 (Graphify) e S-03 (vetores + embeddings).
**Arquivos relevantes:** `apps/server/src/modules/quota/quota-monitor.ts`, `claude-statusline.ts`, `apps/server/src/modules/integrations/sources/quota-sources.ts`, `apps/server/src/statusline.ts`, `apps/web/src/app/features/quota/quota-page.ts`.

---

## HANDOFF — 2026-10-28 (Fase 5) — Claude Code (Opus)

**Contexto:** Fase 5 autorizada pelo humano após o merge da Fase 4 (PR #6).
**Estado:** implementado em `feature/05-agent-monitor`; testes locais verdes (102 servidor, 8 web, 11 E2E).
**Alterações:** `apps/server/src/modules/integrations/sources/*` (allowlist, leitura incremental, parsers Claude/Codex, descoberta), `apps/server/src/modules/agents/*` (monitor, repositório, rotas, `/ws/events`), migração 3, `--session-id` no lançamento do Claude, fixtures de transcrição, `apps/web/src/app/features/agents/*`, `core/server-events.service.ts`, card no detalhe do projeto, `tests/e2e/agents.spec.ts`; E2E isolado de `~/.claude`/`~/.codex`.
**Decisões:** ADR-0013 (transcrições nível B; hooks adiados), D-12 (frescor 5/30 min), D-13 (`--session-id`).
**Pendências:** dívidas TD-11 a TD-14. PR #7 aprovado e mergeado.
**Próximo passo:** **não iniciar a Fase 6 sem autorização (HG-14)**. A Fase 6 começa pelo spike S-05 (fontes de uso/limites); o `token_count` do Codex traz `rate_limits` — avaliar no spike.
**Arquivos relevantes:** `apps/server/src/modules/agents/agent-monitor.ts`, `apps/server/src/modules/integrations/sources/agent-sources.ts`, `local-files.ts`, `run-snapshot.ts`, `apps/web/src/app/features/agents/agents-page.ts`.

---

## HANDOFF — 2026-10-28 (Fase 4) — Claude Code (Opus)

**Contexto:** Fase 4 autorizada pelo humano após o merge da Fase 3.
**Estado:** implementado em `feature/04-providers`; testes locais verdes (77 servidor, 5 web, 9 E2E).
**Alterações:** `apps/server/src/modules/integrations/*` (adapters claude-code/codex/ollama, serviço, rota), doctor e CLI com login real, `launch` na criação de terminal, regra ESLint INV-02, fixtures por versão, `apps/web/src/app/features/providers/*`, botões de lançamento, `tests/e2e/providers.spec.ts` (binários falsos), hook pre-push pula push que só apaga branches.
**Decisões:** D-09 (comando fixo digitado no shell) e D-10 (lint proíbe `fs` em `integrations`).
**Pendências:** dívidas TD-09 e TD-10. CI verde e PR #6 mergeado.
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
