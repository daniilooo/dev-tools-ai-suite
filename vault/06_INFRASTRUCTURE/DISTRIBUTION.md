---
tags: [infra, distribuicao]
---

# Distribuição

Interface do MVP (D-27): pacote `devtools-ai-suite` no registro npm; o mesmo `.tgz` fica anexado à GitHub Release de cada versão (alternativa: `npm install -g <URL do .tgz>`).
```bash
npm install -g devtools-ai-suite
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
| Registro npm (`latest`) | depois da validação da pré-release, o humano publica o mesmo `.tgz` (HG-03, D-27); `next` não é usado no MVP |

O `.tgz` anexado e o publicado no registro são sempre o mesmo arquivo, gerado e testado por `scripts/release-pack.sh`, com o SHA-256 nas notas da release.

O npm CLI 11 publica em etapas: o registro mostra primeiro um marcador `0.0.0-stage` ("Temporary package placeholder for staged publishing") e a versão real aparece minutos depois. O marcador é do próprio npm: não despublicar.

## Plataformas
Linux homologado no MVP; Windows e macOS considerados na arquitetura e no build (prebuilds de `node-pty`), homologação pós-MVP.

## Riscos
Publicar no registro exige a conta do humano com 2FA; com chave de acesso (passkey), o `npm publish` precisa de um terminal interativo (D-27). Dependências nativas → spike S-01.
