---
tags: [arquitetura, modulos]
---

# Mapa de Módulos

| Módulo | Responsabilidade | Depende de | Não pode |
|---|---|---|---|
| `core` | config, diretório de dados, segredo/sessão, middleware de auth, validação Origin/Host, `ProcessRunner`, redator de segredos, logger, migrações SQLite | — | depender de outros módulos |
| `projects` | cadastro, detecção de stack, isolamento, `.devtools/config.yaml` opcional (RN-05) | core | escrever em projeto sem autorização |
| `terminal` | ciclo de vida PTY, abas, buffer de reconexão, WS `/ws/terminal` | core, projects, integrations (só o comando de lançamento) | rodar sem sessão autenticada |
| `integrations` | registro de `ProviderAdapter`s, detecção (`/providers`, `doctor`), comando de lançamento de CLIs | core | ler arquivos — `fs` bloqueado por lint (INV-02) |
| `agents` | normalizar e persistir `AgentRun`/`SubagentRun`/`AgentEvent`, publicar eventos | core, integrations | inventar estado (INV-03) |
| `quota` | agendar leituras, `QuotaReading` com categoria/frescor | core, integrations | usar API não documentada (RN-03) |
| `knowledge` | indexação, exclusões, RAG, grafo de código | core, projects | enviar conteúdo para fora (INV-04) |
| `telemetry` | sessões, métricas, tokens quando disponíveis | core | — |

## Regras de dependência
- Direção única: módulos de feature → `core`. Ciclos proibidos (verificação por lint de imports na Fase 2).
- `terminal` não depende de `agents`, `quota` nem `knowledge` (módulos de IA desacoplados da execução — RN-06).

## Mapeamento para o monorepo
| Módulo | Local |
|---|---|
| todos (orquestração HTTP/WS) | `apps/server/src/modules/<modulo>` |
| contratos | `packages/shared` |
| adapters de provedores | `packages/provider-adapters` |
| RAG/embeddings/grafo | `packages/knowledge` |
| métricas | `packages/observability` |
| UI | `apps/web/src/app/features/<modulo>` |
