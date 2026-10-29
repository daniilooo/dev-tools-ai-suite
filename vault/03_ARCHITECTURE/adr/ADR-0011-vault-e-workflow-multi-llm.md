---
id: ADR-0011
titulo: Vault Obsidian como fonte da verdade e workflow multi-LLM em .ai/
status: Aceito
data: 2026-10-28
decisores: humano (bootstrap)
tags: [adr, processo]
---

# ADR-0011 — Vault + workflow multi-LLM

## Decisão
O conhecimento estrutural vive em `vault/` (Markdown versionado, navegável no Obsidian). O workflow, agentes, contratos e skills vivem em `.ai/`. `CLAUDE.md`, `AGENTS.md`, `.claude/` e `.agents/` são adapters finos. Estado e HANDOFF em `.ai/state/AI_DEVELOPMENT_STATE.md` permitem trocar de LLM sem histórico de chat.

## Consequências
- + Troca de Claude ↔ Codex ↔ local sem perda de contexto.
- − Disciplina de atualizar Vault/estado ao fim de cada sessão (skill `documentation`).
- O Markdown é a origem; HTMLs em `docs/` são derivados e atualizados na mesma mudança.
