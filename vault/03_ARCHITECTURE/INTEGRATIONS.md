---
tags: [arquitetura, integracoes]
---

# Integrações

Classificação obrigatória de cada fonte (RN-03):

| Nível de suporte | Significado |
|---|---|
| **A — documentada/estável** | interface oficial e documentada (ex.: hooks do Claude Code, flags do CLI) |
| **B — local observável** | arquivo/saída local acessível mas sem contrato de estabilidade (ex.: transcripts `.jsonl`) |
| **C — indisponível** | sem fonte permitida → `INDISPONÍVEL` |

| Integração | Uso | Fonte | Nível (hipótese) | Risco | Validação |
|---|---|---|---|---|---|
| Claude Code — execução | terminal | CLI `claude` no PTY | A | baixo | ✅ Fase 4 |
| Claude Code — login | Provedores, doctor | `claude auth status --json` | A | baixo | ✅ Fase 4 (2.1.x) |
| Claude Code — eventos de agentes | Agent Monitor | transcrições locais (`projects/…/<sessão>.jsonl`, subagentes); hooks adiados | B | médio (formato muda) | ✅ Fase 5 (2.1.312) — [[ADR-0013-fontes-agent-monitor]] |
| Claude Code — uso/limites | Quota | saída de comandos oficiais de uso, quando consumível | B / C | alto | spike S-05 |
| Codex — execução | terminal | CLI `codex` no PTY | A | baixo | ✅ Fase 4 |
| Codex — login | Provedores, doctor | `codex login status` | A | baixo | ✅ Fase 4 (0.165.x) |
| Codex — eventos | Agent Monitor | sessões locais (`sessions/…/rollout-*.jsonl`) | B | médio | ✅ Fase 5 (0.165.0) |
| Codex — uso/limites | Quota | comandos oficiais, quando consumíveis | B / C | alto | spike S-05 |
| Ollama | detecção; embeddings opcionais | `ollama --version` + `GET 127.0.0.1:11434/api/version` | A | baixo | ✅ detecção Fase 4; embeddings Fase 7 |
| Graphify | grafo de código | CLI como processo externo | B (a validar) | médio (Python, não instalado) | spike S-02 |
| GitHub | desenvolvimento deste repo | `gh` CLI | A | baixo | — |

## Regras para cada adapter
- Declarar versões testadas do provedor e degradar com aviso em versões desconhecidas.
- Testes de contrato com fixtures anonimizadas por versão (`tests/fixtures/<provedor>/<versão>/`).
- Falha do adapter → dado `INDISPONÍVEL` + motivo, nunca exceção que derrube o servidor.
- Nunca ler arquivos de credenciais (INV-02); allowlist explícita de caminhos lidos.
- Implementação: `apps/server/src/modules/integrations/`. O ESLint proíbe `fs` e SQLite nesse módulo; a única exceção é `sources/local-files.ts`, com allowlist de caminhos testada (`agent-sources.test.ts`).
- Comandos oficiais rodam com `cwd` = home do usuário (fora de qualquer projeto), timeout de 5 s e saída limitada.
- Da saída de `claude auth status --json` só são aproveitados `loggedIn`, `authMethod` e `subscriptionType`; e-mail, organização e diretórios são descartados.

## Agent Monitor (Fase 5)
- Raízes: `CLAUDE_CONFIG_DIR` (padrão `~/.claude`) e `CODEX_HOME` (padrão `~/.codex`).
- Varredura a cada 2 s, incremental (só bytes novos); sessões sem alteração há mais de 30 dias não são descobertas.
- Parsers: `sources/claude-transcript.ts` e `sources/codex-session.ts`, testados com fixtures em `apps/server/test/fixtures/claude-code/2.1.312/transcript/` e `codex/0.165.0/sessions/`.
- Tokens: Claude soma o `usage` de cada mensagem uma vez; Codex usa o total acumulado do último `token_count`. Categoria **calculado**.
- Ao abrir o Claude Code pela suíte, o comando recebe `--session-id <uuid>` para ligar a sessão ao terminal.
