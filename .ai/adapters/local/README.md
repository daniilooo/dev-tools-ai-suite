# Adapter — Modelos locais (Ollama)

Ambiente de referência: Ubuntu 24.04, ~20 GB RAM, **CPU sem GPU**, Ollama 0.40.0.
Modelo instalado no bootstrap: `qwen3:8b` (5,2 GB).

## Uso recomendado
| Uso | Adequado? |
|---|---|
| Explorer em perguntas simples sobre poucos arquivos | Sim, com tolerância a latência |
| Resumos/relatórios curtos (Reporter) | Sim |
| Implementação, revisão, arquitetura | Não recomendado (qualidade e latência em CPU) |
| Embeddings do RAG do **produto** | Via `EmbeddingProvider` (ONNX preferencial; Ollama opcional) — tema da Fase 7 |

## Como usar
Ferramentas locais não leem `CLAUDE.md`/`AGENTS.md` automaticamente. Inicie a conversa com o prompt `.ai/prompts/RETOMAR_SESSAO.md` e forneça os arquivos citados.

## Regras
- Modelo local nunca aprova gate humano nem faz merge.
- Validar com `ollama list` quais modelos existem antes de atribuir tarefas.
