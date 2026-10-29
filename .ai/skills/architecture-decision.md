# Skill: architecture-decision

1. Confirmar que a decisão é relevante (difícil de reverter, afeta vários módulos, segurança ou contrato público).
2. Copiar `.ai/templates/ADR_TEMPLATE.md` para `vault/03_ARCHITECTURE/adr/ADR-XXXX-<slug>.md` (próximo número livre).
3. Preencher contexto, opções consideradas, decisão e consequências. Status inicial: `Proposto`.
4. Registrar em `vault/10_DECISIONS/DECISION_LOG.md`.
5. Alterar ADR `Aceito` ou mudança arquitetural relevante → `HUMAN_GATE_START`.
6. ADR substituída: status `Substituído por ADR-YYYY`; nunca apagar.
