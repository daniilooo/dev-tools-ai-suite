---
tags: [engenharia, monorepo]
---

# Estrutura do Monorepo

```text
dev-tools-ai-suite/
├── apps/
│   ├── server/              # Fastify + módulos do monólito
│   └── web/                 # Angular
├── packages/
│   ├── shared/              # contratos TS
│   ├── provider-adapters/   # Claude Code, Codex, Ollama
│   ├── knowledge/           # embeddings, vetores, grafo
│   └── observability/       # telemetria
├── skills/                  # skills distribuídas pelo produto
├── scripts/                 # validação, segredos, utilitários
├── tests/                   # E2E e fixtures compartilhadas
├── docs/                    # HTMLs derivados do Vault
├── vault/                   # Obsidian — fonte da verdade
├── .ai/                     # workflow multi-LLM
├── .githooks/               # hooks git determinísticos
├── .claude/ · .agents/      # adapters de agentes/skills
├── AGENTS.md · CLAUDE.md
├── package.json · pnpm-workspace.yaml
```

- Gerenciador: **pnpm** (workspaces), lockfile versionado.
- Node fixado em `.nvmrc` (22).
- O pacote publicado no npm será montado a partir de `apps/server` com o build de `apps/web` embutido (Fase 2/8).
- Refinamentos durante a Fase 2 são permitidos se preservarem os limites de módulos.
