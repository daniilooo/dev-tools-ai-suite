# Skill: testing

1. Identificar o nível adequado (unitário, integração, contrato, E2E) — `.ai/workflow/TESTES.md`.
2. Escrever o teste que falha antes da correção, quando for bug.
3. Comandos (disponíveis a partir da Fase 2):
   ```bash
   pnpm test            # unitários + integração
   pnpm test:e2e        # Playwright
   pnpm typecheck
   ```
4. Fixtures de provedores em `tests/fixtures/<provedor>/<versão>/` — anonimizadas, sem segredos.
5. Reportar comandos executados e resultado real. Falha é reportada com a saída, nunca omitida.
