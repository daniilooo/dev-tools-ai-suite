---
tags: [testes, mvp, validacao]
atualizado: 2026-10-29
---

# Validação da Definition of MVP Done — Fase 8

Relatório para aprovação humana (DoD da Fase 8). Critérios: [[MVP_SCOPE]] · Plano: [[DEVELOPMENT_PLAN]].

**Ambientes:** máquina de referência (Ubuntu, Linux 7.0, Node 22.23.3) com Claude Code 2.1.312, Codex 0.165 e Ollama 0.40 reais; contêiner `node:22-bookworm-slim` limpo (Debian 12, sem compilador).
**Projeto real:** `srm-credit-engine` (Angular em `frontend/`, Spring Boot em `backend/`). Também `jinsei` (Angular + Spring Boot com repositórios aninhados) na Fase 7.
**Testes automatizados no fim da fase:** 144 no servidor, 15 no dashboard, 15 E2E, instalação limpa com 27 verificações. Todos passando localmente.

## Resultado por item

| # | Critério | Resultado | Evidência |
|---|---|---|---|
| 1 | Instala e inicializa em Linux limpo e compatível | ✅ | `scripts/smoke-install.sh`: `npm install -g` do pacote em 8,5 s num Debian 12 sem gcc/python; doctor sem erros; módulos nativos prontos, `sqlite-vec` incluso. Roda no CI a cada PR |
| 2 | Dashboard web funcional | ✅ | Tour no Chrome por todas as telas com o projeto real, sem erros no console; E2E sem erros de console nem violação de CSP |
| 3 | Cadastrar e abrir projeto | ✅ | `srm-credit-engine` cadastrado; stack Angular/Maven/Spring Boot/TypeScript/Node detectada nas subpastas (corrigido nesta fase); E2E da jornada |
| 4 | Terminal executa comandos reais e aplicações interativas | ✅ | No projeto real: `git log` (pager), `ls backend`, `top`; Claude Code e Codex (TUIs) dentro do terminal; testes com PTY real |
| 5 | Claude Code e Codex iniciam pela plataforma | ✅ | Reais, nesta fase: Claude Code 2.1.312 abriu no projeto com `--session-id` e `--settings` e saiu com `/exit`; Codex abriu no projeto (pediu confiança na pasta, não aceita pela LLM: decisão do humano). E2E com binários falsos |
| 6 | Agent Monitor acompanha sessões e eventos suportados | ✅ | Fase 5: 240 sessões e subagentes reais da máquina; sessão real do Claude visível com "Ver terminal"; E2E com atualização ao vivo. Limite do provedor: a sessão do Claude só aparece depois da primeira mensagem (é quando ele grava a transcrição) |
| 7 | Cotas verificáveis **ou** indisponibilidade clara | ✅ | Claude e Codex como INDISPONÍVEL com o motivo e o que fazer; com a status line da suíte (Fase 6, real), valores com fonte e frescor; E2E dos dois casos |
| 8 | Indexa e responde com referências verificáveis, com embeddings locais validados | ✅ | Fase 7: `jinsei` com 2.090 arquivos em 7,2 s; `srm-credit-engine` com Transformers.js + `multilingual-e5-small` real (a busca semântica achou o arquivo certo em PT-BR) e Graphify real; nesta fase, 248 arquivos em 385 ms e consulta com arquivo e linhas |
| 9 | Dados persistem entre reinicializações | ✅ | Reinício no E2E da jornada e na instalação limpa (projeto, índice, segredo); upgrade de cada versão do banco com dados (`migrations.test.ts`); banco mais novo recusado sem alteração (D-23) |
| 10 | Fluxos críticos com testes automatizados | ✅ | Auth, Host/Origin/CSRF, terminal, provedores (contrato por versão), agentes, cotas, conhecimento, migrações, instalação; E2E da jornada completa |
| 11 | Documentação de instalação, operação e arquitetura | ✅ | [[OPERATIONS]] reescrito com o comportamento atual; README; Vault de arquitetura e ADRs atualizados até a Fase 7 |
| 12 | Jornada completa sem terminal externo | ✅ | `journey.spec.ts`: projeto → terminal → Claude Code → Agentes → Cotas → Conhecimento → Diagnóstico → reinício, sem tocar no projeto do usuário; tour real no Chrome |

## Corrigido durante a validação
- **S-01, bloqueante de segurança:** desvio de autenticação com caminho codificado (`/%61pi/...`), corrigido e com teste de regressão ([[SECURITY_REVIEW_F8]]).
- Stack não detectada em projetos com `frontend/` e `backend/`.
- Seletor de projeto nas telas Agentes e Conhecimento mostrava o primeiro projeto.
- Arquivo estático inexistente devolvia `index.html` (dashboard sem estilo, sem erro claro).
- Doctor sem Transformers.js e ignorando `DEVTOOLS_GRAPHIFY_BIN` (TD-20); log sem rotação (TD-03).

## Pendências e limites conhecidos (não bloqueiam a DoD, na avaliação da LLM)
| Item | Situação | Sugestão |
|---|---|---|
| TD-02 `devtools auth rotate` | Rotação = remover `secret` | Plano diz "antes do MVP Release": decidir se entra na Fase 9 |
| TD-13 retenção de `agent_runs` | Sem limpeza automática | Apagar histórico é decisão de produto: definir prazo (ex.: 90 dias) ou manter |
| TD-01 `@lydell/node-pty` beta | Funciona no Debian limpo e na máquina de referência | Manter; reavaliar quando o `node-pty` oficial tiver prebuilds |
| TD-08 Windows/macOS | Fora do MVP (só Linux homologado) | Pós-MVP |
| TD-09, TD-11, TD-19, TD-21 | Baixo impacto, documentados | Pós-MVP |
| Vite com vulnerabilidade só em desenvolvimento | Fora do pacote (`audit --prod` limpo) | Chore de dependências |
| Validação em uma máquina de referência | Mais o contêiner limpo | Fase 9 instala o `next` publicado numa máquina limpa |

## Decisão pedida ao humano
Aprovar este relatório (DoD da Fase 8) e decidir sobre TD-02 e TD-13 antes da Fase 9 (MVP Release), que só começa com nova autorização (HG-14).
