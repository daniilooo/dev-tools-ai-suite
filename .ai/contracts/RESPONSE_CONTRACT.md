# Contrato de Resposta (Agente → Orchestrator)

```yaml
task_id: "F3-T07"
status: "done | partial | blocked | failed"
summary: "2–3 linhas"
findings: []          # fatos relevantes descobertos (com referência arquivo:linha)
decisions: []         # decisões tomadas dentro da autonomia do agente
changes: []           # arquivos criados/alterados
risks: []
tests:
  executed: []        # comandos executados
  result: "pass | fail | not_run"
artifacts: []
recommendations: []
needs_human_decision: false   # true → descrever a decisão e opções
```

Regras: respostas curtas; nada de colar arquivos inteiros; sempre referenciar caminhos.
