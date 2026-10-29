# IMPLEMENTAÇÃO

Responsáveis: backend-developer, frontend-developer, devops (conforme módulo).

## Regras
- Trabalhar sempre em branch `feature/*`, `fix/*` ou `chore/*` criada a partir de `release`.
- Respeitar limites de módulo (`vault/03_ARCHITECTURE/MODULE_MAP.md`): módulos se comunicam por interfaces públicas, nunca por internals.
- TypeScript `strict`. Sem `any` sem justificativa em comentário.
- Integrações externas apenas via portas: `ProviderAdapter`, `EmbeddingProvider`, `CodeGraphProvider`, `VectorStore`.
- Processos externos sempre com timeout, captura de stderr, log e tratamento de falha.
- Nunca registrar segredos; usar o redator de segredos do `core`.
- Não ampliar escopo. Ideias novas → `POST_MVP_BACKLOG.md`.
- Testes junto com o código (ver `TESTES.md`).

## Saída
Resposta no formato `.ai/contracts/RESPONSE_CONTRACT.md` com lista de arquivos alterados e testes executados.
