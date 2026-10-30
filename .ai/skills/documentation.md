# Skill: documentation

Documentar apenas o que será reutilizado, afeta decisões, explica comportamento, protege regras ou evita investigação futura.

| Mudou… | Atualizar |
|---|---|
| decisão arquitetural | ADR + `vault/10_DECISIONS/DECISION_LOG.md` |
| regra de negócio | `vault/02_BUSINESS/BUSINESS_RULES.md` / `BUSINESS_INVARIANTS.md` |
| contrato de API/evento | `vault/03_ARCHITECTURE/API_CONTRACTS.md` |
| módulo novo/limite | `vault/03_ARCHITECTURE/MODULE_MAP.md` |
| progresso de fase | `vault/11_ROADMAP/DEVELOPMENT_PLAN.md` + `docs/development-plan.html` |
| estado/sessão | `vault/00_HOME/PROJECT_STATUS.md` + HANDOFF |
| aprendizado relevante | `vault/15_KNOWLEDGE/LEARNINGS.md` |

Regras: wikilinks `[[ARQUIVO]]` no Vault; Mermaid para diagramas; nunca segredos — só nomes de variáveis.

O Markdown é a origem; o HTML do roadmap é derivado e deve ser atualizado na mesma mudança.
