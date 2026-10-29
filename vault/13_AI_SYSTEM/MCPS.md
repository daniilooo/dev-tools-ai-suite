---
tags: [ai-system, mcp]
---

# MCPs e Ferramentas

Princípio: instalar MCP apenas com necessidade concreta.

| Integração | Tipo | Finalidade | Agentes | Proibido | Aprovação humana |
|---|---|---|---|---|---|
| GitHub | `gh` CLI | branches, PRs, issues, checks | Orchestrator, DevOps, Reviewer | merge em `main`, alterar proteção/segredos, excluir branch protegida | HG-01, HG-11 |
| Playwright | dependência de teste | E2E reproduzível no CI | QA, DevOps | — | — |
| Playwright MCP | MCP opcional | exploração manual do dashboard pelo QA | QA | substituir testes do pipeline | não |
| Filesystem | nativo das ferramentas | leitura/edição do repositório | todos | ler credenciais, sair do repositório sem necessidade | — |

**Não utilizados no desenvolvimento:** GitHub MCP (avaliar se trouxer vantagem concreta), Jira, Slack, AWS, Obsidian MCP (o Vault é Markdown no filesystem).
