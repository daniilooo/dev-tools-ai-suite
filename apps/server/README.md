# apps/server — pacote `devtools-ai-suite`

Backend em Node.js 22, TypeScript strict e Fastify, mais o CLI `devtools`. É um monólito modular (ADR-0001).

```text
src/
├── cli.ts              devtools start | doctor
├── app.ts              montagem do Fastify (segurança, rotas, dashboard estático)
├── core/               config, diretório de dados, segredo, sessões, cli-auth,
│                       segurança (Host/Origin/CSRF/CSP), redator, ProcessRunner, SQLite
└── modules/
    ├── session/        troca do código de uso único, sessão, logout
    ├── projects/       cadastro, detecção de stack (somente leitura)
    └── system/         health, doctor
```

- **Segurança:** `vault/03_ARCHITECTURE/adr/ADR-0007-seguranca-local.md`. Toda mudança em `core/security.ts`, `core/sessions.ts` ou `core/cli-auth.ts` exige os gates HG-05/HG-06.
- **Testes:** `pnpm test` roda Vitest com testes unitários e de integração via `fastify.inject`.
- **Build:** `pnpm build` gera `dist/` e copia o dashboard (`apps/web/dist/web/browser`) para `dist/public`.

Módulos planejados: `terminal` (Fase 3), `integrations` (Fase 4), `agents`/`telemetry` (Fase 5), `quota` (Fase 6) e `knowledge` (Fase 7). Referência: `vault/03_ARCHITECTURE/MODULE_MAP.md`.
