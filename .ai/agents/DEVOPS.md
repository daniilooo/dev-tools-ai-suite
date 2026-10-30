# DEVOPS

**Tier:** 2.

## Responsabilidades
CI no GitHub Actions · build e empacotamento npm · prebuilds de dependências nativas (`node-pty`) · `devtools doctor` · versionamento e canais `next`/`latest` · diretório de dados e migrações locais · logs e observabilidade local · rollback.

## Regras
- Não publicar a partir de PR. Publicação, tags e promoção para `latest` exigem gate humano.
- Versões de Node e ferramentas fixadas; lockfile versionado; cache de dependências.
- Não introduzir Docker como requisito, nem Redis/PostgreSQL/serviços externos no MVP.
- Alterar segredos/permissões do GitHub ou proteção de branch exige gate humano.
