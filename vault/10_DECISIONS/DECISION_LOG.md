---
tags: [decisoes]
---

# Log de Decisões

| Data | ID | Decisão | Status | Ref |
|---|---|---|---|---|
| 2026-10-28 | ADR-0001 | Monólito modular com portas nas bordas | Aceito | [[ADR-0001-monolito-modular]] |
| 2026-10-28 | ADR-0002 | Backend Node.js + TS + Fastify | Aceito | [[ADR-0002-backend-node-fastify]] |
| 2026-10-28 | ADR-0003 | Frontend Angular + Tailwind | Aceito | [[ADR-0003-frontend-angular]] |
| 2026-10-28 | ADR-0004 | Terminal xterm.js + node-pty + WS | Aceito | [[ADR-0004-terminal-web]] |
| 2026-10-28 | ADR-0005 | SQLite local | Aceito | [[ADR-0005-persistencia-sqlite]] |
| 2026-10-28 | ADR-0006 | RAG local (ONNX/Ollama, sqlite-vec/LanceDB, Graphify) | Proposto | [[ADR-0006-rag-local]] |
| 2026-10-28 | ADR-0007 | Segurança local e sessão do navegador | Aceito (HG-05/06) | [[ADR-0007-seguranca-local]] |
| 2026-10-28 | ADR-0008 | Distribuição npm sem Docker | Aceito | [[ADR-0008-distribuicao-npm]] |
| 2026-10-28 | ADR-0009 | GitFlow simplificado | Aceito | [[ADR-0009-gitflow-simplificado]] |
| 2026-10-28 | ADR-0010 | Fontes de dados de provedores | Aceito | [[ADR-0010-fontes-dados-provedores]] |
| 2026-10-28 | ADR-0011 | Vault + workflow multi-LLM | Aceito | [[ADR-0011-vault-e-workflow-multi-llm]] |
| 2026-10-28 | ADR-0012 | Dependências nativas: PTY híbrido e better-sqlite3 | Aceito (HG-07) | [[ADR-0012-dependencias-nativas]] |
| 2026-10-28 | ADR-0013 | Fontes do Agent Monitor: transcrições locais (B) agora, hooks com opt-in depois | Proposto (aceito com o merge do PR da Fase 5) | [[ADR-0013-fontes-agent-monitor]] |
| 2026-10-28 | D-01 | Licença Apache-2.0; repositório público desde o início | Aceito | [[INTAKE_RECORD]] |
| 2026-10-28 | D-02 | `monitor-do-contexto-local` fica fora do versionamento | Aceito | [[INTAKE_RECORD]] |
| 2026-10-28 | D-03 | Commit inicial direto em `main` autorizado (repositório vazio) | Aceito (gate) | [[INTAKE_RECORD]] |
| 2026-10-28 | D-04 | Bootstrap aprovado; Fase 2 exige nova autorização | Aceito (gate) | [[PROJECT_STATUS]] |
| 2026-10-28 | D-05 | Fase 2 autorizada pelo humano (HG-14) | Aceito (gate) | [[DEVELOPMENT_PLAN]] |
| 2026-10-28 | D-06 | Fase 3 autorizada pelo humano (HG-14), com ambiente de desenvolvimento rodando para acompanhamento | Aceito (gate) | [[DEVELOPMENT_PLAN]] |
| 2026-10-28 | D-07 | Terminal desconectado fica vivo por 8 h (agentes seguem com o navegador fechado); revisável | Aceito (PR #4 aprovado) | [[STATE_MACHINES]] |
| 2026-10-28 | D-08 | Fase 4 autorizada pelo humano (HG-14) | Aceito (gate) | [[DEVELOPMENT_PLAN]] |
| 2026-10-28 | D-09 | Lançar provedor = digitar comando fixo no shell do projeto (o usuário volta ao shell ao sair) | Aceito (PR #6 aprovado) | [[INTEGRATIONS]] |
| 2026-10-28 | D-10 | Módulo de integrações proibido de ler arquivos por lint; leitores nível B ficam isolados com allowlist | Aceito (PR #6 aprovado) | [[INTEGRATIONS]] |
| 2026-10-28 | D-11 | Fase 5 autorizada pelo humano (HG-14) | Aceito (gate) | [[DEVELOPMENT_PLAN]] |
| 2026-10-28 | D-12 | Estado de agente com limite de frescor: 5 min em execução, 30 min aguardando/detectado; depois `Desconhecido` | Proposto pela LLM | [[STATE_MACHINES]] |
| 2026-10-28 | D-13 | Abrir o Claude Code pela suíte passa `--session-id <uuid>` para vincular sessão e terminal | Proposto pela LLM | [[ADR-0013-fontes-agent-monitor]] |
