---
tags: [workflow, gates]
---

# Gates Humanos

Ações que exigem aprovação humana explícita. O agente apresenta **justificativa, impacto, riscos e plano de rollback** entre os marcadores:

```text
HUMAN_GATE_START
Gate: HG-XX — <nome>
Justificativa:
Impacto:
Riscos:
Rollback:
Decisão solicitada:
HUMAN_GATE_END
```

E aguarda resposta. Silêncio não é aprovação. Aprovação vale para a ação descrita, não para ações futuras semelhantes.

| ID | Gate |
|---|---|
| HG-01 | Merge em `main` |
| HG-02 | Criação de releases e tags oficiais |
| HG-03 | Publicação no npm (qualquer dist-tag) |
| HG-04 | Alterações arquiteturais relevantes ou mudança de ADR aceito |
| HG-05 | Alterações nos mecanismos de segurança do Core |
| HG-06 | Mudanças em autenticação, WebSocket e controle de PTY |
| HG-07 | Introdução ou substituição de dependências nativas críticas |
| HG-08 | Mudanças em políticas de privacidade, indexação e transmissão de dados |
| HG-09 | Exclusão de dados persistidos de usuários |
| HG-10 | Alterações destrutivas de banco de dados |
| HG-11 | Permissões, segredos ou configurações sensíveis do GitHub (incl. proteção de branch) |
| HG-12 | Exposição da aplicação na rede local ou internet |
| HG-13 | Transmissão automática de código-fonte para provedores externos |
| HG-14 | Iniciar uma nova fase do roadmap |
| HG-15 | Ampliar o escopo do MVP |
