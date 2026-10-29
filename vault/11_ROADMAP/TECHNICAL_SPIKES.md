---
tags: [roadmap, spikes]
---

# Spikes Técnicos

Spikes têm **timebox** e produzem uma resposta + recomendação (não código de produção).

| ID | Pergunta | Timebox | Fase | Saída |
|---|---|---|---|---|
| S-01 | `node-pty` instala sem toolchain em Linux limpo via npm? Qual driver SQLite (`node:sqlite` vs `better-sqlite3`)? Impacto em Windows/macOS? | 1 dia | 2 (início) | recomendação + HG-07 |
| S-02 | Interface do Graphify: instalação, comandos, formato de saída, versões, tempo em repo médio; viabilidade do plano B tree-sitter | 1 dia | 7 | atualização do ADR-0006 |
| S-03 | Benchmark `sqlite-vec` vs LanceDB + modelo de embeddings ONNX (tamanho, RAM, latência, qualidade) na máquina de referência | 1–2 dias | 7 | ADR-0006 Aceito + HG-07 |
| S-04 | Quais eventos de agentes/subagentes os hooks e transcripts do Claude Code 2.1.x e as sessões do Codex 0.16x fornecem? Nível A/B/C de cada | 1 dia | 5 (início) | atualização de [[INTEGRATIONS]] |
| S-05 | Existe saída oficial consumível de uso/limites para Claude Code e Codex nos planos atuais? | 0,5 dia | 6 (início) | atualização de [[INTEGRATIONS]] e expectativa da UI |

## Resultados

### S-01 — concluído em 2026-10-28
- `node-pty` 1.1.0 **não** traz binário pronto para Linux: compila via node-gyp (exige g++, make, Python e download de headers). Funciona após compilar.
- `@lydell/node-pty` 1.2.0-beta.18 traz binários prontos (linux x64/arm64, darwin, win32) e funciona com a mesma API — porém é beta.
- `node:sqlite` funciona no Node 22.23, com `ExperimentalWarning`.
- `better-sqlite3` 13.0.3 instala com binário pronto e funciona.
- Decisão proposta: [[ADR-0012-dependencias-nativas]] (aguardando HG-07).
