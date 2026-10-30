---
tags: [home]
atualizado: 2026-10-30
---

# 🧭 START HERE — Dev Tools AI Suite

## O que é
Camada **local-first** de integração, observabilidade e conhecimento sobre Claude Code, Codex e modelos locais. Não substitui os assistentes: os reúne em um dashboard web local com terminal real, monitor de agentes, monitor de cotas, RAG local e observabilidade. Open source (Apache-2.0). → [[PRODUCT_VISION]]

## Resposta rápida
| Pergunta | Resposta |
|---|---|
| Estado atual | MVP publicado; Fases 0–9 concluídas → [[PROJECT_STATUS]] |
| Versão | `0.1.0` — npm (`devtools-ai-suite`) e GitHub Release → [[RELEASES]] |
| Arquitetura | Monólito modular, portas apenas nas bordas externas → [[ARCHITECTURE]] |
| Stack | Angular + Tailwind · Node.js + Fastify + TS · xterm.js + node-pty · SQLite · RAG local → [[SYSTEM_OVERVIEW]] |
| Roadmap | 10 fases finitas (0–9) → [[DEVELOPMENT_PLAN]] |
| Etapa atual | Pós-MVP, aguardando autorização |
| Última decisão | Registro npm + GitHub Release (D-27) → [[DECISION_LOG]] |
| Próxima ação | Definir com o humano o próximo ciclo ([[POST_MVP_BACKLOG]], TD-02) |

## Mapa do Vault
| Pasta | Conteúdo |
|---|---|
| `01_PRODUCT` | [[PRODUCT_VISION]] · [[MVP_SCOPE]] · [[PERSONAS]] · [[USER_JOURNEYS]] · [[GLOSSARY]] |
| `02_BUSINESS` | [[BUSINESS_RULES]] · [[BUSINESS_INVARIANTS]] · [[STATE_MACHINES]] · [[DOMAIN_GLOSSARY]] |
| `03_ARCHITECTURE` | [[SYSTEM_OVERVIEW]] · [[ARCHITECTURE]] · [[MODULE_MAP]] · [[DATA_MODEL]] · [[INTEGRATIONS]] · [[API_CONTRACTS]] · `adr/` |
| `04_ENGINEERING` | [[ENGINEERING_CONVENTIONS]] · [[MONOREPO_STRUCTURE]] · [[TECH_DEBT]] |
| `05_WORKFLOWS` | [[DEVELOPMENT_WORKFLOW]] · [[GITFLOW]] · [[HUMAN_GATES]] · [[HANDOFF]] |
| `06_INFRASTRUCTURE` | [[LOCAL_RUNTIME]] · [[CI_CD]] · [[DISTRIBUTION]] |
| `07_SECURITY` | [[SECURITY_MODEL]] · [[SECRETS_POLICY]] · [[INDEXING_EXCLUSIONS]] |
| `08_TESTING` | [[TEST_STRATEGY]] |
| `09_OPERATIONS` | [[OPERATIONS]] |
| `10_DECISIONS` | [[DECISION_LOG]] · [[INTAKE_RECORD]] |
| `11_ROADMAP` | [[DEVELOPMENT_PLAN]] · [[POST_MVP_BACKLOG]] · [[RISKS]] · [[TECHNICAL_SPIKES]] |
| `12_RELEASES` | [[RELEASES]] · [[VERSIONING]] |
| `13_AI_SYSTEM` | [[AI_DEVELOPMENT_MANUAL]] · [[AI_SYSTEM_OVERVIEW]] · [[MODEL_STRATEGY]] · [[LLM_ENVIRONMENTS]] · [[MCPS]] |
| `14_MEETINGS` | registros de reuniões/decisões síncronas |
| `15_KNOWLEDGE` | [[LEARNINGS]] |
| `99_ARCHIVE` | material obsoleto |

## Regras que não podem ser violadas
Ver [[BUSINESS_INVARIANTS]]. As mais críticas: ninguém executa comandos só porque a suíte está instalada (INV-01); a suíte nunca conhece tokens dos provedores (INV-02); nunca inventar estados, saldos ou horários (INV-03); código nunca sai da máquina para embeddings sem consentimento (INV-04).

## Workflow de IA
Operacional em `.ai/README.md`. Manual humano: [[AI_DEVELOPMENT_MANUAL]].
