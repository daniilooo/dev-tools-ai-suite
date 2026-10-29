---
id: ADR-0003
titulo: Frontend Angular + Tailwind CSS
status: Aceito
data: 2026-10-28
decisores: humano (Intake B3)
tags: [adr]
---

# ADR-0003 — Frontend Angular + Tailwind CSS

## Contexto
Dashboard com terminal, painéis em tempo real e muitas features; mantenedor com familiaridade em Angular.

## Opções consideradas
1. **React** — mais componentes prontos de dashboard.
2. **Angular** — estrutura robusta, organização por feature, RxJS para WebSocket, familiaridade.

## Decisão
Angular + TypeScript + Tailwind CSS; Angular CDK para comportamentos avançados; design system próprio (inspiração VS Code/Linear); tema escuro padrão + claro. React não será usado no MVP.

## Consequências
- + Manutenção facilitada pelo mantenedor; contratos TS compartilhados.
- − Componentes de dashboard precisarão ser construídos no design system próprio.
