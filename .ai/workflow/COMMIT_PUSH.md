# COMMIT / PUSH / PR

Skill: `.ai/skills/commit.md` e `.ai/skills/git-flow.md`.

## Permissões das LLMs
| Operação | Permitido |
|---|---|
| Criar branch de trabalho a partir de `release` | Sim |
| Commit e push em branch de trabalho | Sim |
| Abrir PR para `release` | Sim |
| Merge em `release` | Sim, após CI verde e revisão sem bloqueantes |
| Merge em `main`, tags, releases, npm | **Somente com aprovação humana** |
| Alterar proteção de branch, segredos e permissões do GitHub | **Somente com aprovação humana** |
| Excluir branch protegida remota | **Nunca** |

## Checklist antes do commit
- [ ] Diff lido; apenas arquivos da demanda.
- [ ] Hooks passaram (`.githooks/pre-commit`).
- [ ] Nenhum segredo (`scripts/check-secrets.sh`).
- [ ] Mensagem Conventional Commits em PT-BR.

## Checklist antes do PR
- [ ] `.githooks/pre-push` passou.
- [ ] PR usa `.ai/templates/PR_TEMPLATE.md`.
- [ ] Vault/estado atualizados se a mudança altera decisões, regras ou status.
