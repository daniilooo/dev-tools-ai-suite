---
tags: [arquitetura, api]
---

# Contratos de API (rascunho)

> Contratos TypeScript em `packages/shared` (somente tipos). Rotas marcadas com ✅ estão implementadas.

## Autenticação
Todas as rotas `/api` exigem sessão local válida (cookie `devtools_session`) **ou** token descartável do CLI (`Authorization: DevtoolsCli …`), exceto a troca do código de inicialização (ver [[ADR-0007-seguranca-local]]). Métodos `POST/PUT/PATCH/DELETE` via cookie exigem o header `x-csrf-token`.

## REST (prefixo `/api/v1`)
| Método | Rota | Descrição | Fase |
|---|---|---|---|
| POST | `/session/exchange` | ✅ troca código de uso único (longo ou curto) por cookie de sessão; rate limit 10/min | 2 |
| GET | `/session` | ✅ sessão atual + token anti-CSRF | 2 |
| POST | `/session/launch-code` | ✅ novo código de acesso — somente CLI | 2 |
| POST | `/session/logout` | ✅ encerra a sessão do navegador | 2 |
| GET | `/health` | ✅ status do Core e módulos (sem dados sensíveis) | 2 |
| GET | `/doctor` | ✅ diagnóstico de dependências e provedores | 2 |
| GET/POST | `/projects` | ✅ listar / cadastrar projeto | 2 |
| GET/DELETE | `/projects/:id` | ✅ detalhe / remover **apenas o cadastro** | 2 |
| POST | `/projects/:id/redetect` | ✅ detectar a stack novamente | 2 |
| GET/POST | `/projects/:id/terminals` | ✅ listar / criar sessão PTY (`cols`, `rows`, `launch` opcionais — `launch`: `claude-code` ou `codex`); 503 sem biblioteca de PTY, 409 no limite, 400 provedor inválido | 3–4 |
| DELETE | `/terminals/:id` | ✅ encerrar sessão e sua árvore de processos | 3 |
| GET | `/providers` | ✅ provedores detectados: versão (testada ou não), login via comando oficial com fonte e horário, capacidades com nível A/B/C; cache 60 s, `?refresh=1` força | 4 |
| GET | `/projects/:id/agents/runs` | ✅ execuções do projeto (`AgentRunDetail[]`, sessões principais com `subagents`), mais recentes primeiro, até 100 | 5 |
| GET | `/agents/runs/:id` | ✅ uma execução com subagentes; 404 se não existir | 5 |
| GET | `/quota` | ✅ `QuotaResponse`: por provedor, janelas com % usado (ou limite atingido), renovação, frescor (`fresh`/`stale`/`reset`), categoria, horário da medida e fonte com nível; `unavailableReason` quando não há leitura | 6 |
| POST | `/projects/:id/knowledge/index` | (re)indexar | 7 |
| DELETE | `/projects/:id/knowledge/index` | remover índice | 7 |
| POST | `/projects/:id/knowledge/query` | consulta RAG com referências | 7 |

## WebSocket
| Canal | Direção | Mensagens |
|---|---|---|
| `/ws/terminal/:id` | bidirecional | ✅ cliente: `input`, `resize` · servidor: `replay` (primeira mensagem, com a saída recente), `output`, `exit`. Upgrade exige `Origin` da suíte e cookie de sessão (sem token do CLI). Fechamento: 4401 sessão expirada, 4404 inexistente, 4410 encerrado, 4429 cliente lento. Mensagem máxima 64 KiB |
| `/ws/events` | servidor → cliente | ✅ `agent.run.state` (`{ type, run: AgentRun }`, enviado quando qualquer campo da execução muda) · ✅ `quota.updated` (`{ type, quota: QuotaResponse }`, enviado quando valor ou frescor mudam). Previsto: `module.status`. Mesma autenticação de `/ws/terminal` (Origin + cookie); fecha com 4401 quando a sessão expira |

## Convenções
- Erros: `{ "error": { "code": "STRING", "message": "PT-BR", "details"?: {} } }`.
- Dados de provedores sempre com `source`, `fetchedAt`, `category`.
- Versionamento por prefixo `/api/v1`.
