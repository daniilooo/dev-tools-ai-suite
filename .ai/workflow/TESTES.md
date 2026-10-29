# TESTES

Responsável: QA (pode ser paralelizado: QA_API, QA_FRONTEND, QA_SECURITY, QA_TERMINAL).

## Pirâmide
| Nível | Ferramenta | Quando |
|---|---|---|
| Unitário | Vitest | toda lógica de domínio e adapters |
| Integração | Vitest + Fastify `inject` + PTY real | rotas, WebSocket, PTY, SQLite |
| Contrato | Vitest + fixtures | parsers de transcripts/eventos de provedores |
| E2E | Playwright | jornadas do dashboard e terminal |

## Obrigatórios por área sensível
- Autenticação local e sessão; rejeição de WebSocket sem sessão válida.
- Validação de `Origin` e CORS restritivo.
- Isolamento entre sessões PTY e entre projetos.
- Ciclo de vida de processos (start/stop/timeout/órfãos).
- Reconexão de terminal.
- Exclusão de arquivos sensíveis da indexação.
- Persistência após reinicialização.

## Regras
- Sem meta numérica de cobertura no início; cobertura é monitorada e limites definidos por maturidade do módulo.
- Fixtures nunca contêm dados reais ou segredos.
- Teste instável (flaky) é bug: registrar e corrigir, não ignorar.

Estratégia completa: `vault/08_TESTING/TEST_STRATEGY.md`.
