---
tags: [infra, distribuicao]
---

# Distribuição

Interface do MVP (D-26): o pacote npm vai anexado à GitHub Release de cada versão.
```bash
npm install -g https://github.com/daniilooo/dev-tools-ai-suite/releases/download/v0.1.0/devtools-ai-suite-0.1.0.tgz
devtools start      # inicia em 127.0.0.1 e abre o dashboard
devtools doctor     # diagnóstico
```

## Requisitos do instalador/primeira execução
Verificar dependências · detectar Claude Code, Codex, Ollama · criar `~/.dev-tools-ai-suite/` com permissões seguras · gerar segredo · iniciar em localhost · abrir navegador (ADR-0007).

## Canais
| Canal | Uso |
|---|---|
| Pré-release no GitHub | versão publicada para validação (instalação pela URL num ambiente limpo) |
| Release estável no GitHub | depois da validação, a mesma release deixa de ser pré-release |
| Registro npm (`next`/`latest`) | futuro, quando houver conta no npm (ADR-0008, D-26) |

O `.tgz` anexado é sempre o gerado e testado por `scripts/release-pack.sh`, com o SHA-256 nas notas da release.

## Plataformas
Linux homologado no MVP; Windows e macOS considerados na arquitetura e no build (prebuilds de `node-pty`), homologação pós-MVP.

## Riscos
Nome do pacote no npm estava livre em 2026-10-29; publicar no registro exige conta (D-26). Dependências nativas → spike S-01.
