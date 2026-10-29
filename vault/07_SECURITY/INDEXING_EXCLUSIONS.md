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
- Respeitar `.gitignore` do projeto.
- Conteúdo indexado passa pelo redator de segredos.
- Testes automatizados garantem as exclusões (Fase 7).
