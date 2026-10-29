---
tags: [engenharia, divida]
---

# Dívida Técnica

| ID | Descrição | Origem | Impacto | Plano |
|---|---|---|---|---|
| TD-01 | `@lydell/node-pty` é fork em beta (ADR-0012) | S-01 | Médio | Reavaliar na Fase 8; fallback para `node-pty` oficial |
| TD-02 | `devtools auth rotate` não implementado; rotação = remover o arquivo `secret` | Fase 2 | Baixo | Implementar antes do MVP Release |
| TD-03 | Logs em `logs/server.log` sem rotação de arquivo | Fase 2 | Baixo | Rotação por tamanho na Fase 8 |
| TD-04 | Avisos de peer (`@emnapi/*`) no toolchain de build do Angular/Tailwind | Fase 2 | Nenhum em runtime | Acompanhar atualizações do Angular |
| TD-05 | Rate limit da troca de código é global e em memória | Fase 2 | Baixo (servidor local) | Suficiente para monousuário; rever no modo Team |

Registrar aqui atalhos conscientes tomados para entregar o MVP, com plano de pagamento.
