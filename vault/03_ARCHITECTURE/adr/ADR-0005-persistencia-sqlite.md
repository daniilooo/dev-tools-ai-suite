---
id: ADR-0005
titulo: Persistência local em SQLite
status: Aceito
data: 2026-10-28
decisores: humano (Intake B3)
tags: [adr]
---

# ADR-0005 — SQLite como persistência local

## Decisão
SQLite em `~/.dev-tools-ai-suite/devtools.db`, com migrações versionadas no `core`. Sem Redis, PostgreSQL ou serviços externos no MVP.

## Consequências
- + Zero infraestrutura; backup = copiar arquivo.
- − Driver nativo (ex.: `better-sqlite3`) ou `node:sqlite` embutido — escolha na Fase 2 (impacta dependências nativas, gate humano).
- Upgrades devem migrar sem perda (G-09).
