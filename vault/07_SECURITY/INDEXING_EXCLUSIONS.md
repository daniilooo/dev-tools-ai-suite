---
tags: [seguranca, rag]
---

# Exclusões de Indexação (padrão)

Aplicadas antes de qualquer leitura para RAG/grafo. Configuráveis por projeto, mas os itens **sensíveis** só podem ser removidos da lista com confirmação explícita.

## Sensíveis (sempre excluídos por padrão)
```text
.env  .env.*  (exceto .env.example)
*.pem  *.key  *.p12  *.pfx  id_rsa*  id_ed25519*
**/secrets/**  **/.secrets/**
*.kdbx  .npmrc  .pypirc  .netrc
**/credentials*  **/*token*.json
.claude/  .codex/  (configurações internas de provedores)
```

## Ruído
```text
.git/  node_modules/  dist/  build/  coverage/  .angular/  target/  out/
*.min.js  *.map  *.lock  pnpm-lock.yaml  package-lock.json
binários e mídia (imagens, vídeos, PDFs grandes, arquivos > 1 MB)
```

## Regras
- Respeitar `.gitignore` do projeto (listagem via `git ls-files --cached --others --exclude-standard`). Repositórios git aninhados (até 3 níveis) entram com o próprio `.gitignore` (D-19).
- Conteúdo indexado passa pelo redator de segredos.
- Arquivos acima de 1 MiB e binários (byte nulo nos primeiros 8 KiB) ficam de fora; links simbólicos não são seguidos.
- As mesmas exclusões valem para vetores (derivados dos trechos já filtrados e redigidos) e para o grafo de código (símbolos de arquivos excluídos são descartados ao juntar os grafos).
- Testes automatizados garantem as exclusões (`apps/server/test/knowledge.test.ts`, `knowledge-semantic.test.ts`). Implementação: `apps/server/src/modules/knowledge/exclusions.ts`.
