# Fixtures de provedores

Saídas reais dos comandos oficiais, capturadas em 2026-10-28 e anonimizadas (e-mail, organização e caminhos trocados). Uma pasta por versão testada: `<provedor>/<versão>/`. Ao suportar uma versão nova, capture as saídas, anonimize e adicione a pasta.

| Arquivo | Comando |
|---|---|
| `claude-code/*/version.txt` | `claude --version` |
| `claude-code/*/auth-status.json` | `claude auth status --json` |
| `codex/*/version.txt` | `codex --version` |
| `codex/*/login-status.txt` | `codex login status` |
| `ollama/*/version.txt` | `ollama --version` |

## Transcrições (Agent Monitor, Fase 5)

Montadas a partir da **estrutura** (chaves e tipos) de transcrições reais, sem copiar conteúdo. Marcadores `__CWD__`, `__SESSION__`, `__MAIN__`, `__SUB__` e `__SECRET__` são trocados por `test/agent-fixtures.ts` ao instalar as fixtures em raízes temporárias; o segredo de teste é montado em tempo de execução para não acionar o scanner de segredos.

| Pasta | Origem |
|---|---|
| `claude-code/*/transcript/` | `~/.claude/projects/<projeto>/<sessão>.jsonl` e `<sessão>/subagents/agent-<id>.jsonl` + `.meta.json` |
| `codex/*/sessions/` | `~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl` (sessão principal e subagente com `parent_thread_id`) |
