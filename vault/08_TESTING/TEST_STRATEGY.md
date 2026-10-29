---
tags: [testes]
---

# Estratégia de Testes

| Nível | Ferramenta | Escopo |
|---|---|---|
| Unitário | Vitest | domínio, normalização de eventos, redator, exclusões |
| Integração | Vitest + Fastify `inject` + `ws` + `node-pty` real | rotas, auth, WebSocket, PTY, SQLite |
| Contrato | Vitest + fixtures versionadas | parsers de hooks/transcripts/saídas dos provedores |
| E2E | Playwright | jornadas do dashboard e terminal |

## Cobertura obrigatória de fluxos críticos
Autenticação local · segurança de WebSocket · validação de origem · isolamento de sessões · início/encerramento de processos · reconexão de terminal · detecção de agentes · leitura de eventos e transcripts · persistência e recuperação · exclusão de sensíveis da indexação.

## Hooks
- **pre-commit:** formatter, lint dos modificados, segredos.
- **pre-push:** typecheck, unitários, integração essenciais, build.
- **CI:** tudo acima + E2E + segurança + validação do pacote.

## Cobertura
Sem meta numérica arbitrária no início. Monitorar e definir limites por maturidade do módulo, priorizando fluxos críticos.

## Validação do MVP
Jornada completa em projeto real Angular + Spring Boot (Fase 8).
