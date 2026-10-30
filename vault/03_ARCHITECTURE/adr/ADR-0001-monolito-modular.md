---
id: ADR-0001
titulo: Monólito modular com portas apenas nas bordas externas
status: Aceito
data: 2026-10-28
decisores: humano (Intake B3)
tags: [adr]
---

# ADR-0001 — Monólito modular com portas nas bordas

## Contexto
Produto local, monousuário, instalado via npm, com vários domínios (terminal, agentes, cotas, conhecimento, telemetria). Prioridade: MVP rápido e sustentável.

## Opções consideradas
1. **Microserviços** — isolamento, mas custo operacional incompatível com instalação local simples.
2. **Hexagonal completa** — desacoplamento total, mas burocracia sem ganho no núcleo.
3. **Monólito modular + portas nas bordas** — simples, com substituição onde há variação real.

## Decisão
Opção 3. Módulos: `core`, `projects`, `terminal`, `agents`, `quota`, `knowledge`, `telemetry`, `integrations`. Portas: `ProviderAdapter`, `EmbeddingProvider`, `CodeGraphProvider`, `VectorStore`.

## Consequências
- + Um processo, um deploy, depuração simples.
- + Substituição de provedores/mecanismos sem tocar no núcleo.
- − Disciplina de limites depende de convenção + lint de imports.

## Validação
Ausência de ciclos entre módulos; adicionar um provider novo sem alterar `core`.
