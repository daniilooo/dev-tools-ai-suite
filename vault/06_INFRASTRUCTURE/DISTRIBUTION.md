---
tags: [infra, distribuicao]
---

# Distribuição

Interface planejada (pacote **ainda não publicado**):
```bash
npm install -g devtools-ai-suite
devtools start      # inicia em 127.0.0.1 e abre o dashboard
devtools doctor     # diagnóstico
```

## Requisitos do instalador/primeira execução
Verificar dependências · detectar Claude Code, Codex, Ollama · criar `~/.dev-tools-ai-suite/` com permissões seguras · gerar segredo · iniciar em localhost · abrir navegador (ADR-0007).

## Canais npm
| dist-tag | Uso |
|---|---|
| `next` | pré-lançamento e validação (`0.1.0-next.N`) |
| `latest` | estável aprovado |

## Plataformas
Linux homologado no MVP; Windows e macOS considerados na arquitetura e no build (prebuilds de `node-pty`), homologação pós-MVP.

## Riscos
Nome do pacote no npm pode estar ocupado → verificar antes da primeira publicação. Dependências nativas → spike S-01.
