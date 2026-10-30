---
id: ADR-0006
titulo: RAG local com EmbeddingProvider, VectorStore e CodeGraphProvider
status: Aceito (HG-07 aprovado pelo humano em 2026-10-29, após os spikes S-02 e S-03)
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

## Decisão final (HG-07, 2026-10-29)
Aprovada pelo humano após os spikes S-02 e S-03 ([[TECHNICAL_SPIKES]]):
- **`VectorStore` = `sqlite-vec`** (extensão do SQLite, 188 KB, busca exata). LanceDB descartado: 1,1 GB de instalação para os mesmos resultados.
- **Busca semântica opcional e ligada pelo humano por projeto**, com indexação em segundo plano e reaproveitamento dos vetores de trechos que não mudaram. Arquivo próprio `indexes/<projeto>.vec.db` (0600), separado do índice textual.
- **`EmbeddingProvider`** com dois adaptadores:
  - **Ollama local** (somente `127.0.0.1`/`localhost`); o modelo é baixado pelo humano (`ollama pull`), nunca pela suíte;
  - **Transformers.js** instalado sob demanda pelo humano num diretório de complementos da suíte (não vai no pacote base, por causa dos 548 MB do ONNX); o modelo multilíngue só é baixado depois do consentimento explícito na tela.
  Sem nenhum dos dois, a busca semântica fica INDISPONÍVEL com o motivo, e a textual segue funcionando.
- **Consulta híbrida:** quando há vetores, junta a busca textual e a semântica (Reciprocal Rank Fusion).
- **`CodeGraphProvider` = Graphify externo opcional** (`graphify extract --code-only`), executado por repositório (raiz e aninhados), com saída no diretório de dados e ambiente sem chaves de API. Atende impacto e dependências de um símbolo, com arquivo e linha. Plano B (tree-sitter em Node) só se o Graphify se mostrar instável.

## Consequências
- + Privacidade e funcionamento offline.
- − Qualidade de embeddings pequenos inferior a modelos grandes; mitigado por chunking por estrutura de código e grafo.
- `sqlite-vec` é a única dependência nativa nova no pacote; embeddings e grafo dependem de ferramentas que o humano instala.
