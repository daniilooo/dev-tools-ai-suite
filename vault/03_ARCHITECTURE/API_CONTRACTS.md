---
tags: [arquitetura, api]
---

# Contratos de API (rascunho)

> Rascunho de alto nível. Contratos TypeScript definitivos vivem em `packages/shared` a partir da Fase 2.

## Autenticação
Todas as rotas exigem sessão local válida, exceto o endpoint de troca do código de inicialização (ver [[ADR-0007-seguranca-local]]).

## REST (prefixo `/api/v1`)
| Método | Rota | Descrição | Fase |
|---|---|---|---|
| POST | `/session/exchange` | troca código de uso único por cookie de sessão | 2 |
| GET | `/health` | status do Core e módulos (sem dados sensíveis) | 2 |
| GET | `/doctor` | diagnóstico de dependências e provedores | 2 |
| GET/POST | `/projects` | listar / cadastrar projeto | 2 |
| GET/DELETE | `/projects/:id` | detalhe / remover cadastro (dados: gate do usuário) | 2 |
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
