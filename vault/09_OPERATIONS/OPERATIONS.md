---
tags: [operacoes]
---

# Operações (usuário final)

| Tarefa | Como (planejado) |
|---|---|
| Iniciar | `devtools start` (abre o navegador; código curto exibido no terminal como alternativa) · `--port`, `--data-dir`, `--no-open` |
| Novo código de acesso | executar `devtools start` de novo: se a suíte já estiver rodando, apenas gera um novo código |
| Diagnóstico | `devtools doctor` |
| Logs | `~/.dev-tools-ai-suite/logs/` (redigidos) |
| Backup | copiar `~/.dev-tools-ai-suite/` com a suíte parada |
| Rotacionar segredo/sessões | parar a suíte e remover `~/.dev-tools-ai-suite/secret` (comando dedicado previsto — TD-02) |
| Remover dados de um projeto | dashboard → projeto → remover índices/histórico (confirmação) |
| Reverter configuração aplicada em projeto | dashboard → projeto → integrações → reverter (RN-05) |
| Atualizar | `npm install -g devtools-ai-suite@latest` (migrações automáticas, G-09) |
| Desinstalar | `npm uninstall -g devtools-ai-suite`; dados ficam até remoção manual |
