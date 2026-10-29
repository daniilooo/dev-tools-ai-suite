# Contribuindo

Obrigado pelo interesse na Dev Tools AI Suite.

## Antes de começar

- Leia `vault/00_HOME/START_HERE.md` e `vault/11_ROADMAP/DEVELOPMENT_PLAN.md`.
- Melhorias fora do escopo do MVP vão para `vault/11_ROADMAP/POST_MVP_BACKLOG.md`, não para o código.

## Fluxo

1. Crie sua branch a partir de `release`: `feature/<escopo>`, `fix/<escopo>` ou `chore/<escopo>`.
2. Use Conventional Commits com descrição em PT-BR: `feat(terminal): adiciona reconexão de sessão`.
3. Ative os hooks locais: `git config core.hooksPath .githooks`.
4. Abra o Pull Request para `release`. `main` recebe apenas merges de `release` aprovados por humano.

Detalhes: `vault/05_WORKFLOWS/GITFLOW.md`.

## Segurança

Nunca inclua tokens, senhas ou chaves em código, testes, logs ou documentação. Vulnerabilidades: veja `SECURITY.md`.

## Licença

Contribuições são aceitas sob a Apache License 2.0.
