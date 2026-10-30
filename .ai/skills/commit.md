# Skill: commit

1. `git status` e `git diff` (staged e não staged). Entender a mudança.
2. Confirmar branch: nunca `main` nem `release` diretamente.
3. Adicionar **somente** arquivos da demanda, por nome (nunca `git add -A` cego). Recusar: `.env*` (exceto `.env.example`), chaves, dumps, `node_modules`, artefatos de build, `.token-saver/`, dados de `~/.dev-tools-ai-suite`.
4. Rodar `bash scripts/check-secrets.sh --staged`. Qualquer achado → parar.
5. Rodar validações proporcionais (o hook `pre-commit` faz o mínimo).
6. Mensagem Conventional Commits, tipo/escopo em inglês, descrição em PT-BR, imperativo/presente:
   ```text
   feat(terminal): adiciona reconexão de sessão

   Corpo opcional explicando o porquê.
   ```
   Tipos: `feat fix refactor perf test docs build ci chore revert`.
   Escopos: `core projects terminal agents quota knowledge telemetry integrations web server shared ci deps vault ai`.
7. Nunca usar `--no-verify` sem autorização humana.
