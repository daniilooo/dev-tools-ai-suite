---
tags: [negocio, glossario]
---

# Glossário de Domínio

| Entidade | Definição |
|---|---|
| **Project** | Diretório local cadastrado pelo usuário; unidade de isolamento de sessões, índices e histórico. |
| **TerminalSession** | PTY associado a um projeto, com estado (ver [[STATE_MACHINES]]) e buffer de reconexão. |
| **Provider** | Ferramenta de IA integrada (`claude-code`, `codex`, `ollama`). |
| **ProviderCapability** | O que um provider oferece na versão detectada (hooks, transcripts, comando de uso, modelos). |
| **AgentRun** | Execução de um agente principal observada pela suíte. |
| **SubagentRun** | Execução filha de um AgentRun; pode não ter terminal próprio (só eventos). |
| **AgentEvent** | Evento normalizado (início, ferramenta, mensagem, fim, erro) com origem e timestamp. |
| **QuotaReading** | Leitura de limite/uso: `value`, `unit`, `resetAt?`, `source`, `fetchedAt`, `category`, `freshness`. |
| **DataCategory** | `oficial` · `calculado` · `estimado` · `indisponível`. |
| **KnowledgeIndex** | Índice de um projeto (chunks, embeddings, metadados de fonte). |
| **Chunk** | Trecho indexado com referência verificável (arquivo, linhas, hash). |
| **CodeGraph** | Grafo estrutural do código produzido por `CodeGraphProvider`. |
| **ConfigChange** | Alteração proposta/aplicada pela suíte em arquivo do projeto, com backup (RN-05). |
| **TelemetryRecord** | Métrica de execução (duração, tokens quando disponíveis, provider, agente). |
