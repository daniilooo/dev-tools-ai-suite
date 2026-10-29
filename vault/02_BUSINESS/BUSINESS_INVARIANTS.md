---
tags: [negocio, invariantes]
---

# Invariantes de Negócio

Regras que, se violadas, tornam o produto inviável. Violação = achado **bloqueante** em revisão.

| ID | Invariante | Origem |
|---|---|---|
| **INV-01** | Nenhuma pessoa ou aplicação externa consegue executar comandos na máquina apenas porque a suíte está instalada. | Intake B2 §1 |
| **INV-02** | A suíte não precisa conhecer — e nunca lê, copia, armazena ou transmite — tokens de autenticação de Claude Code, Codex ou outros provedores. | Intake B2 §2 |
| **INV-03** | Nunca inventar estados de agentes, saldos, tokens ou horários de renovação. Ausência = `INDISPONÍVEL`. | Intake B2 §3 |
| **INV-04** | Código-fonte e documentação privada nunca são enviados a provedor externo de embeddings sem consentimento explícito. | Intake B2 §4 |
| **INV-05** | Instalar ou inicializar a suíte não modifica silenciosamente código-fonte nem substitui configurações existentes. | Intake B2 §5 |

## Invariantes globais
| ID | Regra |
|---|---|
| G-01 | **Local-first:** o essencial não depende de infraestrutura externa da Dev Tools. |
| G-02 | **Multi-LLM:** nenhuma funcionalidade estrutural depende exclusivamente de Claude ou Codex. |
| G-03 | **Sem privilégios elevados** por padrão; processos rodam com o usuário atual. |
| G-04 | **Isolamento entre projetos:** índices, sessões e dados sensíveis não se misturam. |
| G-05 | **Degradação controlada:** falha de um provedor/módulo opcional não derruba a plataforma. |
| G-06 | **Observabilidade confiável:** dados oficiais e estimados são sempre distinguíveis. |
| G-07 | **Configuração reversível:** integrações instaladas pela suíte podem ser desativadas e removidas. |
| G-08 | **Segurança do terminal:** acesso ao PTY = capacidade de executar comandos; exige proteção adequada. |
| G-09 | **Atualização segura:** upgrades preservam configurações e dados, com migração e recuperação. |
| G-10 | **Modularidade:** RAG, Graphify, observabilidade evoluem sem reinstalação completa. |

Detalhamento: [[BUSINESS_RULES]] · Segurança: [[SECURITY_MODEL]]
