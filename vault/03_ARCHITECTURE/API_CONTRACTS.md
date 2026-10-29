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
| GET/POST | `/projects/:id/terminals` | listar / criar sessão PTY | 3 |
| DELETE | `/terminals/:id` | encerrar sessão | 3 |
| GET | `/providers` | provedores detectados, versão, capacidades | 4 |
| GET | `/projects/:id/agents/runs` | histórico de execuções | 5 |
| GET | `/quota` | leituras atuais com categoria e frescor | 6 |
| POST | `/projects/:id/knowledge/index` | (re)indexar | 7 |
| DELETE | `/projects/:id/knowledge/index` | remover índice | 7 |
| POST | `/projects/:id/knowledge/query` | consulta RAG com referências | 7 |

## WebSocket
| Canal | Direção | Mensagens |
|---|---|---|
| `/ws/terminal/:id` | bidirecional | `input`, `resize`, `output`, `exit`, `replay` (reconexão) |
| `/ws/events` | servidor → cliente | `agent.event`, `agent.run.state`, `quota.reading`, `module.status` |

## Convenções
- Erros: `{ "error": { "code": "STRING", "message": "PT-BR", "details"?: {} } }`.
- Dados de provedores sempre com `source`, `fetchedAt`, `category`.
- Versionamento por prefixo `/api/v1`.
