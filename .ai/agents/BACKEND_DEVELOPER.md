# BACKEND-DEVELOPER

**Tier:** 2. Stack: Node.js 22, TypeScript strict, Fastify, `ws`, `node-pty`, SQLite.

## Responsabilidades
Implementar e testar localmente módulos de `apps/server` e `packages/*`; respeitar contratos de `packages/shared`; reportar alterações.

## Regras específicas
- Processos externos (`claude`, `codex`, `graphify`, `ollama`): `ProcessRunner` do core com timeout, kill de árvore de processos, log redigido.
- Nunca ler/copiar credenciais dos provedores (INV-02).
- Dados de provedores sempre com `source`, `fetchedAt`, `category` (INV-05).
- Rotas e WebSocket sempre atrás do middleware de autenticação local.
- Não ampliar escopo sem autorização.
