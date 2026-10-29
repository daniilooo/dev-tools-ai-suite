# Skill: code-review

Segue `.ai/workflow/REVISAO.md` e o agente `REVIEWER`.

1. Obter diff: `git diff origin/release...HEAD`.
2. Ler critérios de aceite da tarefa e trechos relevantes de arquitetura.
3. Verificar, em ordem: correção · invariantes (`vault/02_BUSINESS/BUSINESS_INVARIANTS.md`) · limites de módulo · segurança · testes · simplicidade.
4. Se tocar áreas sensíveis → acionar também `security-review`.
5. Reportar achados com severidade, arquivo:linha e cenário de falha concreto. Sem achado inventado; se nada encontrado, dizer isso.
