# Contrato de Tarefa (Orchestrator → Agente)

Objetivo: reduzir tokens e perda de contexto. Cada agente recebe **apenas** o necessário.

```yaml
task_id: "F3-T07"              # <fase>-<sequencial>
agent: "backend-developer"
objective: "Uma frase com o resultado esperado"
context: "2–5 linhas; nunca o histórico da conversa"
constraints:
  - "invariantes/regras aplicáveis (referenciar por id, ex.: INV-01)"
inputs:
  - "arquivos ou dados de entrada"
expected_output: "o que deve ser entregue"
acceptance_criteria:
  - "critério verificável"
allowed_tools: ["read", "edit", "bash:pnpm test"]
forbidden_actions:
  - "merge em main"
  - "alterar core/security sem gate"
references:
  - "vault/03_ARCHITECTURE/MODULE_MAP.md#terminal"
human_gate: false
```
