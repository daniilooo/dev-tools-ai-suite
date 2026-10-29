# Hooks

Hooks executam apenas tarefas **determinísticas**. Nada de decisão de arquitetura em hook.

Ativação local (uma vez por clone):
```bash
git config core.hooksPath .githooks
```

| Nome | Momento | Comando | Objetivo | Tempo esperado | Bloqueante |
|---|---|---|---|---|---|
| pre-commit | antes do commit | `.githooks/pre-commit` → `check-secrets --staged`; `prettier --check` e `eslint` nos arquivos staged (quando o tooling existir) | evitar segredos e código fora do padrão | < 10 s | Sim |
| pre-push | antes do push | `.githooks/pre-push` → `pnpm typecheck`, `pnpm test`, `pnpm build` (quando existirem); `validate-bootstrap` | evitar quebrar `release` | 1–3 min | Sim |
| CI (PR) | Pull Request | GitHub Actions: install → lint → typecheck → unit → integration → build → security → E2E | gate técnico de merge | < 15 min | Sim |
| pre-release | antes de publicar | `pnpm pack` + instalação limpa + `devtools doctor` | validar pacote | 5 min | Sim + gate humano |

Até a Fase 2 os scripts `pnpm` não existem; os hooks detectam isso e executam apenas o que está disponível (comportamento documentado nos próprios scripts).

## Hooks de ferramentas de IA
Hooks do Claude Code (`.claude/settings.json`) **não** são usados no desenvolvimento deste repositório no momento. O produto, por sua vez, poderá instalar hooks nos projetos do usuário — sempre seguindo o procedimento seguro de `vault/02_BUSINESS/BUSINESS_RULES.md` (RN-05).
