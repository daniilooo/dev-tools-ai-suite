# PLANEJAMENTO

Responsável: Orchestrator (+ Architect quando houver impacto estrutural).

## Entradas
- Demanda classificada (`START.md`).
- Fase atual do roadmap e seus critérios de aceite.
- Respostas do Explorer (arquivos e pontos de impacto).

## Saída — plano curto
```text
Objetivo:
Fase/roadmap:
Arquivos/módulos afetados:
Passos (≤ 7):
Testes previstos:
Riscos:
Gate humano necessário? (sim/não — qual)
ADR necessária? (sim/não)
```

## Regras
- Plano proporcional: demandas pequenas não precisam de plano escrito.
- Não introduzir abstração sem segundo caso de uso real.
- Mudança arquitetural relevante → ADR (`.ai/templates/ADR_TEMPLATE.md`) + gate humano.
