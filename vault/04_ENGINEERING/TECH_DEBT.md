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
| TD-11 | Agent Monitor faz varredura periódica (2 s) em vez de observar o sistema de arquivos; atraso de até 2 s | Fase 5 | Baixo | Avaliar `fs.watch` na Fase 8 se o custo aparecer |
| TD-12 | Sessão principal nunca vira `Concluído`: transcrições não registram o fim (fica `Aguardando` → `Desconhecido`) | Fase 5 | Baixo | Hooks do Claude Code com opt-in (pós-MVP, RN-05) |
| TD-13 | Histórico de `agent_runs` sem limpeza automática; descoberta limitada a 30 dias | Fase 5 | Baixo | Política de retenção na Fase 8 |
| TD-14 | Vínculo terminal ↔ Codex por janela de tempo (sem flag de id de sessão no Codex 0.165) | Fase 5 | Baixo | Trocar por flag oficial quando existir |
| TD-15 | Nas sessões do Claude abertas pela suíte, a status line da suíte substitui uma status line própria do usuário | Fase 6 | Baixo | `DEVTOOLS_CLAUDE_STATUSLINE=off`; avaliar encadear a status line do usuário (pós-MVP) |
| TD-16 | Cotas lidas por varredura (5 s), sem histórico persistido de leituras | Fase 6 | Baixo | Persistir histórico se surgir necessidade de gráfico de consumo (pós-MVP) |
| TD-17 | Busca textual não separa CamelCase (`ReservaController` não casa com `controller`; só prefixo) | Fase 7 | Baixo | Busca semântica/híbrida; ou tokenização de identificadores |
| TD-18 | Indexação acompanhada por consulta a cada 1 s e sem reindexação incremental (refaz o projeto todo) | Fase 7 | Baixo | Evento em `/ws/events` e reindexação só dos arquivos alterados |

Registrar aqui atalhos conscientes tomados para entregar o MVP, com plano de pagamento.
