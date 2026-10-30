# .ai/ — Sistema de Desenvolvimento AI-Native

O workflow pertence ao **projeto**, não a um fornecedor. Claude Code, Codex e modelos locais são **executores intercambiáveis** que leem estes arquivos por meio de adapters (`CLAUDE.md`, `AGENTS.md`, `.ai/adapters/`).

## Fonte da verdade

| O quê | Onde |
|---|---|
| Produto, regras, arquitetura, decisões, roadmap | `vault/` (Obsidian) — começar por `vault/00_HOME/START_HERE.md` |
| Workflow, agentes, contratos, skills, hooks | `.ai/` (este diretório) |
| Estado operacional e handoff | `.ai/state/AI_DEVELOPMENT_STATE.md` |
| Adapters por ferramenta | `.ai/adapters/{claude,codex,local}/` |

## Ordem de leitura para qualquer LLM

1. Adapter da ferramenta (`CLAUDE.md` ou `AGENTS.md`).
2. Este arquivo.
3. `vault/00_HOME/START_HERE.md`.
4. `vault/00_HOME/PROJECT_STATUS.md`.
5. `.ai/state/AI_DEVELOPMENT_STATE.md` — **bloco HANDOFF**.
6. `.ai/workflow/START.md` — escolher o fluxo proporcional à demanda.

## Estrutura

```text
.ai/
├── workflow/    etapas do fluxo (START, INTAKE, PLANEJAMENTO, IMPLEMENTACAO, TESTES, REVISAO, DEPLOY, COMMIT_PUSH)
├── agents/      especificação conceitual de cada agente
├── contracts/   contratos de entrada/saída entre agentes
├── skills/      especificação conceitual das skills (portável)
├── hooks/       hooks determinísticos (git e ferramentas)
├── prompts/     prompts reutilizáveis (nova demanda, handoff, relatório)
├── templates/   ADR, handoff, PR, fase, relatório
├── adapters/    particularidades de Claude Code, Codex e modelos locais
└── state/       estado do desenvolvimento e handoff
```

## Regras inegociáveis

- PT-BR em comunicação e documentação.
- Contexto mínimo suficiente: nunca encaminhar o histórico inteiro a um agente.
- Gates humanos: `vault/05_WORKFLOWS/HUMAN_GATES.md` (`HUMAN_GATE_START` … `HUMAN_GATE_END`).
- Invariantes de negócio: `vault/02_BUSINESS/BUSINESS_INVARIANTS.md`.
- Escopo do MVP fechado: melhorias vão para `vault/11_ROADMAP/POST_MVP_BACKLOG.md`.
- Antes de encerrar sessão longa ou trocar de LLM: atualizar o HANDOFF.
