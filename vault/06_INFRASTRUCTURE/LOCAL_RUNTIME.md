---
tags: [infra]
---

# Runtime Local

Tudo roda na máquina do desenvolvedor, em um processo Node:

| Componente | Execução |
|---|---|
| Dashboard Angular | estático servido pelo Fastify |
| Backend Fastify | processo principal, `127.0.0.1:4317` (porta padrão proposta) |
| PTYs | processos filhos via `node-pty` |
| SQLite | arquivo em `~/.dev-tools-ai-suite/` |
| Coletor de eventos | dentro do backend (leitura de hooks/arquivos) |
| Monitor de cotas | agendador interno |
| RAG/vetores | biblioteca embutida; embeddings ONNX in-process ou Ollama via HTTP local |
| Graphify | processo externo opcional |

**Não exigido:** Redis, Kafka, PostgreSQL, Kubernetes, Docker, AWS, servidores próprios.

Evolução futura: modo Team com sincronização e dashboard centralizado ([[POST_MVP_BACKLOG]]).
