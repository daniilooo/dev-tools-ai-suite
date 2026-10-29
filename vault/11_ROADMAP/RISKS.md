---
tags: [roadmap, riscos]
---

# Riscos

| ID | Risco | Prob. | Impacto | Mitigação | Fase |
|---|---|---|---|---|---|
| R-01 | Formatos de transcripts/sessões mudam entre versões dos provedores | Alta | Médio | adapters versionados, testes de contrato, degradação para `INDISPONÍVEL` | 5 |
| R-02 | Pouca/nenhuma fonte oficial de cotas para planos de assinatura | Média (S-05: Codex e Claude via status line) | Médio | categoria explícita; DoD aceita indisponibilidade; status line da suíte no Claude ([[ADR-0014-fontes-quota-monitor]]) | 6 |
| R-03 | `node-pty` (e drivers nativos) dificultam "instalação simples" — **confirmado no S-01**: sem binário Linux oficial | Alta | Alto | spike S-01; prebuilds; `doctor` com instruções | 2 |
| R-04 | Graphify instável/indisponível ou dependência Python pesada | Média | Médio | módulo opcional; plano B tree-sitter | 7 |
| R-05 | CPU sem GPU / 20 GB RAM limitam embeddings e modelos locais | Média | Médio | modelos pequenos ONNX; indexação incremental | 7 |
| R-06 | Escopo grande sem prazo → túnel infinito | Alta | Alto | fases finitas, HG-14/HG-15, backlog pós-MVP | todas |
| R-07 | Falha de segurança no terminal web | Média | Crítico | ADR-0007, Security Engineer, testes obrigatórios, gates HG-05/06 | 2–3 |
| R-08 | Nome do pacote npm indisponível | Média | Baixo | verificar cedo; alternativa com escopo `@daniilooo/` | 9 |
| R-09 | Limites de uso de Claude/Codex reduzem a velocidade do desenvolvimento | Média | Médio | tiers de modelo; Explorer barato; handoff para alternar LLM | todas |
