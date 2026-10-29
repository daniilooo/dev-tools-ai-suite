---
id: ADR-0010
titulo: Fontes de dados de provedores — oficiais, locais e classificadas
status: Aceito
data: 2026-10-28
decisores: humano (Intake B2)
tags: [adr, integracoes]
---

# ADR-0010 — Fontes de dados dos provedores

## Decisão
Agent Monitor e Quota Monitor usam somente fontes locais, oficiais e documentadas (RN-03). Cada fonte é classificada em nível A/B/C ([[INTEGRATIONS]]). Todo dado carrega origem, horário, categoria (`oficial`/`calculado`/`estimado`) e frescor; ausência = `INDISPONÍVEL`.

## Consequências
- + Sem risco jurídico/técnico de scraping ou APIs privadas; sem tocar credenciais.
- − Para planos de assinatura, boa parte das cotas tende a aparecer como `INDISPONÍVEL` ou `estimado` (R-02). A Definition of MVP Done (item 7) aceita isso.
- − Formatos de nível B mudam entre versões → adapters versionados + testes de contrato.
