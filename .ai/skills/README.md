# Skills (especificação portável)

A lógica de cada skill vive **aqui**. Os adapters apenas apontam para estes arquivos:
- Claude Code: `.claude/skills/<nome>/SKILL.md`
- Codex: `.agents/skills/<nome>/SKILL.md`

| Skill | Arquivo | Uso |
|---|---|---|
| commit | `commit.md` | commit seguro com Conventional Commits PT-BR |
| git-flow | `git-flow.md` | branches, PRs e merges conforme o GitFlow do projeto |
| code-review | `code-review.md` | revisão de diff |
| testing | `testing.md` | escrever/rodar testes conforme a estratégia |
| documentation | `documentation.md` | atualizar Vault e estado |
| release | `release.md` | preparar versão (com gates humanos) |
| architecture-decision | `architecture-decision.md` | criar/atualizar ADR |
| security-review | `security-review.md` | revisão de segurança das áreas sensíveis |
| dependency-update | `dependency-update.md` | atualizar dependências com segurança |

**Não criadas:** `jira` (não há gestor de tarefas; GitHub Issues via `gh` quando necessário), `deploy` (coberta por `release`), `database-migration` (avaliar na Fase 2 junto com o esquema SQLite).
