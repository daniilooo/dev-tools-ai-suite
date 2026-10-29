---
tags: [arquitetura, dados]
---

# Modelo de Dados (inicial)

> Esboço para a Fase 2. Esquema definitivo nasce com migrações versionadas no `core`.

```mermaid
erDiagram
  PROJECT ||--o{ TERMINAL_SESSION : possui
  PROJECT ||--o{ AGENT_RUN : observa
  AGENT_RUN ||--o{ AGENT_RUN : subagente
  AGENT_RUN ||--o{ AGENT_EVENT : emite
  PROVIDER ||--o{ AGENT_RUN : executa
  PROVIDER ||--o{ QUOTA_READING : informa
  PROJECT ||--o| KNOWLEDGE_INDEX : tem
  KNOWLEDGE_INDEX ||--o{ CHUNK : contem
  PROJECT ||--o{ CONFIG_CHANGE : registra
  AGENT_RUN ||--o{ TELEMETRY_RECORD : mede

  PROJECT { text id PK
    text name
    text path
    text detected_stack
    datetime created_at }
  TERMINAL_SESSION { text id PK
    text project_id FK
    text state
    text shell
    datetime started_at
    datetime ended_at }
  PROVIDER { text id PK
    text version
    text capabilities_json
    datetime detected_at }
  AGENT_RUN { text id PK
    text project_id FK
    text provider_id FK
    text parent_run_id FK
    text kind
    text state
    text source
    datetime last_event_at }
  AGENT_EVENT { text id PK
    text run_id FK
    text type
    text payload_redacted_json
    text source
    datetime occurred_at }
  QUOTA_READING { text id PK
    text provider_id FK
    text metric
    real value
    text unit
    datetime reset_at
    text category
    text source
    datetime fetched_at }
  KNOWLEDGE_INDEX { text project_id PK
    text state
    text embedding_provider
    text vector_store
    datetime indexed_at }
  CHUNK { text id PK
    text project_id FK
    text file_path
    int line_start
    int line_end
    text content_hash }
  CONFIG_CHANGE { text id PK
    text project_id FK
    text file_path
    text diff
    text backup_path
    text state
    datetime applied_at }
  TELEMETRY_RECORD { text id PK
    text run_id FK
    text metric
    real value
    text category
    datetime recorded_at }
```

## Regras
- Payloads de eventos são **redigidos** antes de persistir.
- `category` em `QUOTA_READING`/`TELEMETRY_RECORD` ∈ {oficial, calculado, estimado}; ausência é representada pela falta de leitura válida → UI mostra `INDISPONÍVEL`.
- Vetores ficam no `VectorStore` (tabela virtual sqlite-vec ou diretório LanceDB por projeto), referenciando `CHUNK.id`.
- Nenhuma credencial é armazenada (INV-02). O segredo de instalação fica em arquivo próprio 0600, não no banco.

## Diretório de dados
```text
~/.dev-tools-ai-suite/
├── config.yaml
├── secret            (0600)
├── devtools.db       (SQLite)
├── indexes/<project-id>/
├── logs/
└── backups/config-changes/
```
