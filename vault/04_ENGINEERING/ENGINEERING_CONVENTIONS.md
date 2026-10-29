---
tags: [engenharia]
---

# Convenções de Engenharia

## Idioma
Código, identificadores e mensagens técnicas de log em inglês (convenção da stack). Mensagens ao usuário, documentação, commits (descrição), PRs e relatórios em **PT-BR**.

## TypeScript
- `strict: true`; `any` somente com comentário justificando.
- Erros tipados por módulo (`TerminalError`, `ProviderUnavailableError`…); nunca `throw` de string.
- Sem estado global mutável fora do `core`.

## Nomes
| Item | Convenção |
|---|---|
| Arquivos | `kebab-case.ts` |
| Classes/Tipos | `PascalCase` |
| Funções/variáveis | `camelCase` |
| Constantes | `UPPER_SNAKE_CASE` |
| Componentes Angular | `<feature>-<nome>.component.ts` |
| Branches | `feature/<fase>-<descricao>` |

## Processos externos
Sempre via `ProcessRunner` do core: `spawn` com array de argumentos (nunca shell interpolado), timeout, kill da árvore, stderr capturado e redigido.

## Logs
Estruturados (JSON), nível configurável, **sempre** passando pelo redator de segredos. Nunca logar payload completo de PTY.

## Dependências
Preferir bibliotecas maduras e pequenas. Dependência nativa nova = gate humano (HG-07).

## Simplicidade
Sem abstração antes do segundo caso de uso real. Sem otimização sem medição.
