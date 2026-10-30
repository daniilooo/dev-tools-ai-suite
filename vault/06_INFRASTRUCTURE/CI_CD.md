---
tags: [infra, ci]
---

# CI/CD

Plataforma: **GitHub Actions**, runner `ubuntu-24.04`. Implementado em `.github/workflows/ci.yml` (Fase 2), job **Validação**.

```mermaid
flowchart LR
  PR[Pull Request] --> I[Install<br/>pnpm + cache] --> L[Lint / Prettier] --> T[Typecheck] --> U[Unit] --> IT[Integration] --> B[Build] --> S[Security<br/>audit + segredos] --> E[E2E Playwright] --> OK[PR Ready]
```

- Node e pnpm com versões fixadas; lockfile versionado; cache de dependências.
- Validar build e testes com **PTY real** no runner.
- Relatórios de falha e artefatos (Playwright report, logs).
- **Nunca** publicar a partir de PR.
- Release (D-26, D-27): manual, pelo `scripts/release-pack.sh`, `gh release` e `npm publish` do humano, com gates humanos (`.ai/workflow/DEPLOY.md`). Publicação automatizada (ex.: trusted publishing) fica para o pós-MVP.
- Checks obrigatórios configurados na proteção de `main` e `release`.

## Etapas implementadas
`pnpm install --frozen-lockfile` → `format:check` → `lint` → `typecheck` → `test` → `build` → `check:secrets` → `pnpm audit --prod --audit-level high` → `validate:bootstrap` → Playwright (Chromium) → `test:e2e` → `pnpm pack` com verificação do conteúdo do pacote (sem publicar) → instalação limpa do pacote num contêiner `node:22-bookworm-slim` sem compilador (`scripts/smoke-install.sh`: doctor, login, projeto, índice, reinício com dados preservados, projeto do usuário intocado). Relatório do Playwright é anexado em caso de falha.

Ainda não implementado: workflow de release com environment protegido (Fase 9).
