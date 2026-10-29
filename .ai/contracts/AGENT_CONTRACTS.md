# Adaptações de contrato por agente

| Agente | Entrada específica | Saída específica |
|---|---|---|
| Explorer | `question` objetiva | `answer` + `references[]` (arquivo:linha). Sem opinião. |
| Architect | requisito + restrições + módulos afetados | `proposal`, `alternatives[]`, `impact`, `adr_needed`, `human_gate` |
| backend/frontend-developer | plano aprovado + arquivos-alvo | `changes[]`, `tests`, desvios do plano |
| DevOps | alvo (CI, build, release) | `pipeline_changes`, `rollback_plan` |
| QA | critérios de aceite + diff | `test_cases[]`, `failures[]`, `regressions[]` |
| Reviewer | diff + critérios + arquitetura relevante | `findings[]` com severidade `bloqueante/importante/sugestão` |
| Security Engineer | diff + superfície afetada | `threats[]`, `mitigations[]`, `blocking` |
| Reporter | respostas consolidadas + público-alvo | relatório no template `.ai/templates/REPORT_TEMPLATE.md` |
