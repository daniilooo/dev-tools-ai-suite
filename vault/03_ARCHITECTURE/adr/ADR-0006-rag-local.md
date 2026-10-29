---
id: ADR-0006
titulo: RAG local com EmbeddingProvider, VectorStore e CodeGraphProvider
status: Proposto (spikes S-02 e S-03 concluídos; aguarda HG-07)
data: 2026-10-28
decisores: humano (Intake B2/B3) + Architect
tags: [adr]
---

# ADR-0006 — RAG local

## Contexto
Privacidade exige processamento local (INV-04). Ambiente de referência: CPU sem GPU, ~20 GB RAM. Ollama não pode ser obrigatório.

## Decisão (parcial)
- `EmbeddingProvider`: **ONNX/Transformers.js** como primeira opção (modelo pequeno, ~100 MB ou menos); **Ollama** como alternativa.
- `VectorStore`: **sqlite-vec** vs **LanceDB** — decidir por benchmark (S-03): tamanho, latência de consulta, consumo de RAM, empacotamento nativo.
- `CodeGraphProvider`: Graphify via processo externo; interface a validar (S-02). Plano B: adapter próprio baseado em tree-sitter.
- Sem embeddings configurados → RAG semântico desabilitado, demais funções intactas.
- **Base textual (Fase 7, D-18):** índice FTS5 do SQLite já embutido no `better-sqlite3` (sem dependência nova), um arquivo por projeto em `indexes/<projeto>.db`. Atende consulta por identificador/termo com arquivo e linhas e serve de complemento à busca semântica (busca híbrida) quando os embeddings chegarem.

## Consequências
- + Privacidade e funcionamento offline.
- − Qualidade de embeddings pequenos inferior a modelos grandes; mitigado por chunking por estrutura de código e grafo.
- Status passa a **Aceito** após spikes, com gate humano (nova dependência nativa).
