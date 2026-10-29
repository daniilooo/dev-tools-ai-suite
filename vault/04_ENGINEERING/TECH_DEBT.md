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
| TD-06 | "Sair" não revoga a sessão no servidor (sessões sem estado); WebSockets abertos seguem até a sessão expirar | Fase 3 | Baixo (cookie HttpOnly, SameSite=Strict) | Lista de revogação ou geração de sessão na Fase 8 |
| TD-07 | Processos com `nohup` iniciados no terminal também são encerrados ao fechá-lo (mesma sessão POSIX) | Fase 3 | Baixo | Documentado: usar `setsid`/systemd para serviços de longa duração |
| TD-08 | Árvore de processos no Windows via `taskkill /T` e no macOS via `ps`: sem teste automatizado | Fase 3 | Médio | Validar na Fase 8 (multiplataforma) |
| TD-09 | O PATH do servidor pode diferir do PATH do shell interativo (ex.: `~/.local/bin` só no `.zshrc`): provedor pode aparecer ausente e ainda abrir no terminal | Fase 4 | Baixo | Avaliar na Fase 8 resolver o PATH via shell de login |
| TD-10 | Fixture de "não logado" do Claude Code não foi capturada de uma saída real (máquina de referência está logada) | Fase 4 | Baixo | Capturar ao testar em máquina sem login |

Registrar aqui atalhos conscientes tomados para entregar o MVP, com plano de pagamento.
