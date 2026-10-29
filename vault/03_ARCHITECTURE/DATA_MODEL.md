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
    text provider_id
    text kind
    text parent_run_id
    text external_id
    text title
    text agent_type
    text model
    text provider_version
    text state
    datetime started_at
    datetime last_event_at
    datetime ended_at
    text tokens_json
    text tool_calls_json
    text terminal_id
    text source_level
    text source_description
    text error }
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
- `AGENT_RUN` (migração 3, `agent_runs`): id = `<provedor>:<id externo>` ou `<provedor>:<sessão>:<subagente>`. Guarda só metadados (título e descrição redigidos e truncados); tokens são **calculados** a partir dos registros do provedor. `AGENT_EVENT` (`agent_events`) registra cada mudança de estado (`{state, previous}`). Ao iniciar, execuções `running`/`waiting`/`detected` viram `unknown` até a releitura (INV-03). Remover o projeto apaga o histórico (`ON DELETE CASCADE`).
- `category` em `QUOTA_READING`/`TELEMETRY_RECORD` ∈ {oficial, calculado, estimado}; ausência é representada pela falta de leitura válida → UI mostra `INDISPONÍVEL`.
- `QUOTA_READING` **não é persistido no MVP** (D-16): as leituras são recalculadas a cada 5 s a partir das fontes em disco (sessões do Codex, transcrições do Claude e `<dados>/quota/claude-statusline.json`, gravado pela status line da suíte). O tipo exposto é `QuotaResponse`/`QuotaWindow` (`packages/shared`).
- `KNOWLEDGE_INDEX` (migração 4, `knowledge_indexes`) guarda só o estado e as contagens. Arquivos e trechos (`CHUNK`) ficam no índice do próprio projeto, `indexes/<projeto>.db` (tabelas `files` e `chunks` FTS5), removido com o índice ou com o projeto (D-18).
- Vetores (migração 5, `knowledge_semantic` guarda mecanismo, modelo, estado e progresso) ficam em `indexes/<projeto>.vec.db` (0600, `sqlite-vec`): tabela `refs` (hash do trecho, arquivo, linhas, prévia redigida) e tabela virtual `vectors` (`vec0`, cosseno). O hash de caminho + linhas + conteúdo permite recalcular só os trechos que mudaram; trocar de modelo descarta os vetores.
- Grafo de código (migração 5, `knowledge_graphs` guarda estado e contagens) fica em `graphs/<projeto>.json` (0600): só símbolos, arquivos, linhas e relações extraídos pelo Graphify; símbolos de arquivos excluídos não entram.
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
