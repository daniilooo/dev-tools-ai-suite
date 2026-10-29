# Fixtures de provedores

Saídas reais dos comandos oficiais, capturadas em 2026-10-28 e anonimizadas (e-mail, organização e caminhos trocados). Uma pasta por versão testada: `<provedor>/<versão>/`. Ao suportar uma versão nova, capture as saídas, anonimize e adicione a pasta.

| Arquivo | Comando |
|---|---|
| `claude-code/*/version.txt` | `claude --version` |
| `claude-code/*/auth-status.json` | `claude auth status --json` |
| `codex/*/version.txt` | `codex --version` |
| `codex/*/login-status.txt` | `codex login status` |
| `ollama/*/version.txt` | `ollama --version` |
