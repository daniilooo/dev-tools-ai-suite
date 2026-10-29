---
tags: [arquitetura]
---

# Arquitetura

**Estilo:** monólito modular com portas e adaptadores **somente nas fronteiras externas** → [[ADR-0001-monolito-modular]].

> Arquitetura deve reduzir complexidade, não demonstrar conhecimento.

Sem microserviços, mensageria distribuída, CQRS ou hexagonal completa no MVP.

## Contêineres (C4 nível 2)
```mermaid
flowchart LR
  subgraph web[apps/web — Angular]
    ui[Features: projects · terminal · agents · quota · knowledge · telemetry]
    xterm[xterm.js]
  end
  subgraph server[apps/server — Fastify]
    core[core<br/>config · segurança · sessão · ProcessRunner · redator]
    projects
    terminal[terminal<br/>PTY manager]
    agents
    quota
    knowledge
    telemetry
    integrations
  end
  subgraph pkgs[packages]
    shared[shared<br/>contratos TS]
    pa[provider-adapters]
    kn[knowledge<br/>EmbeddingProvider · VectorStore · CodeGraphProvider]
    obs[observability]
  end
  ui -- REST --> server
  xterm -- WS /ws/terminal --> terminal
  ui -- WS /ws/events --> agents & quota & telemetry
  integrations --> pa
  knowledge --> kn
  telemetry --> obs
  server & web --> shared
  core --> sqlite[(SQLite)]
```

## Portas (contratos substituíveis)
| Porta | Responsabilidade | Implementações MVP |
|---|---|---|
| `ProviderAdapter` | detectar, versão, capacidades, comando de execução, fontes de eventos/uso | `claude-code`, `codex` (+ `ollama` para detecção) |
| `EmbeddingProvider` | gerar embeddings localmente | `onnx` (Transformers.js), `ollama` |
| `VectorStore` | armazenar/consultar vetores por projeto | `sqlite-vec` ou `lancedb` (S-03) |
| `CodeGraphProvider` | grafo estrutural do código | `graphify` (processo externo) |

Fora dessas portas, módulos usam código direto e simples.

## Fluxos principais
- **Terminal:** browser ↔ WS autenticado ↔ `terminal` ↔ `node-pty` ↔ shell do usuário, `cwd` = diretório do projeto.
- **Agent Monitor:** `integrations` lê fontes permitidas (RN-03) → normaliza em `AgentEvent` → `agents` persiste e publica em `/ws/events`.
- **Quota:** `quota` agenda leituras por provider → `QuotaReading` com categoria e frescor → UI.
- **Knowledge:** `knowledge` varre projeto (com exclusões) → chunks → `EmbeddingProvider` → `VectorStore`; consulta retorna chunks com referência verificável.

## Princípios
1. Core inicia mesmo sem módulos opcionais (G-05, RN-06).
2. Toda borda externa tem timeout, log redigido e erro tipado.
3. Contratos compartilhados em `packages/shared` (fonte única para server e web).
4. Dados de provedores sempre com proveniência (INV-03, G-06).
5. Nenhum módulo acessa internals de outro; comunicação por interface pública do módulo.

Sequência de segurança da sessão: [[ADR-0007-seguranca-local]]. Modelo de dados: [[DATA_MODEL]].
