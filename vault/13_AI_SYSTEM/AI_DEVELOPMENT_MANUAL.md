---
tags: [ai-system, manual]
---

# Manual de Desenvolvimento com IA

## Como iniciar o projeto
```bash
git clone git@github.com:daniilooo/dev-tools-ai-suite.git
cd dev-tools-ai-suite
git switch release
git config core.hooksPath .githooks     # ativa hooks locais
bash scripts/validate-bootstrap.sh      # valida a fundação
```
A partir da Fase 2: `pnpm install` e os scripts de desenvolvimento descritos no README.

## Como abrir o Vault no Obsidian
1. Instale o Obsidian (obsidian.md).
2. Na tela inicial, escolha **"Open folder as vault"**.
3. Selecione a pasta `vault/` deste repositório (não a raiz).
4. Recursos necessários já são nativos: **wikilinks**, **Mermaid** e **Graph view**. Em *Settings → Files & Links*, mantenha a opção "Use Wikilinks" ativa. Nenhum plugin externo é necessário.
5. Abra `00_HOME/START_HERE.md` e navegue pelos links.

## Workflow
```text
nova demanda
↓ orquestrador (classifica, checa escopo e invariantes)
↓ exploração (Explorer, contexto mínimo)
↓ arquitetura, se necessário (Architect + ADR + gate)
↓ implementação (backend / frontend / devops)
↓ QA
↓ review (+ Security Engineer em áreas sensíveis)
↓ report
↓ gate humano (quando aplicável)
↓ commit/push → PR para release
```

### Exemplo 1 — demanda padrão (Claude Code)
> "Adicionar botão para fechar todas as abas do terminal."
1. Orchestrator classifica como **Padrão**, fase 3.
2. Subagente `explorer` localiza a feature `terminal` no web e o endpoint de encerramento.
3. Plano curto → `frontend-developer` implementa → `qa` cria E2E → `reviewer` revisa.
4. Skill `commit` → `git-flow` abre PR para `release`.
5. Reporter resume; status e handoff atualizados.

### Exemplo 2 — demanda sensível
> "Permitir acessar o dashboard pelo celular na rede local."
1. Classe **Sensível** + fora do MVP (HG-12, HG-15).
2. Orchestrator registra em [[POST_MVP_BACKLOG]] e informa o humano. Nada é implementado sem aprovação.

## Como trocar de LLM
O processo é sempre o mesmo:
1. abrir o repositório;
2. ler o adapter da ferramenta;
3. ler `.ai/README.md`;
4. ler [[START_HERE]];
5. ler [[PROJECT_STATUS]];
6. ler o HANDOFF em `.ai/state/AI_DEVELOPMENT_STATE.md`;
7. continuar o workflow.

Antes de sair da ferramenta atual: prompt `.ai/prompts/ENCERRAR_SESSAO.md` ([[HANDOFF]]).

# Trocando de Claude para Codex
1. No Claude Code: execute o prompt de encerramento → HANDOFF atualizado e commitado/registrado.
2. Abra o terminal na raiz e rode `codex`.
3. O Codex lê `AGENTS.md` automaticamente. Envie o prompt `.ai/prompts/RETOMAR_SESSAO.md`.
4. Skills disponíveis como `$commit`, `$git-flow` etc. (`.agents/skills/`).
5. Sem subagentes nativos: o Codex assume os papéis em sequência (ver `.ai/adapters/codex/README.md`).

# Trocando de Codex para Claude
1. No Codex: prompt de encerramento → HANDOFF atualizado.
2. Rode `claude` na raiz. O Claude Code lê `CLAUDE.md`.
3. Envie `.ai/prompts/RETOMAR_SESSAO.md`.
4. Subagentes em `.claude/agents/` e skills em `.claude/skills/` ficam disponíveis (`/commit`, `/git-flow`…).

# Utilizando modelo local
1. `ollama list` para confirmar modelos (`qwen3:8b` instalado).
2. Use para tarefas Tier 1 (perguntas factuais, resumos). Não use para implementação, revisão ou gates.
3. Forneça manualmente o prompt `.ai/prompts/RETOMAR_SESSAO.md` e o conteúdo dos arquivos citados.
4. Detalhes: `.ai/adapters/local/README.md`.

## Como iniciar a primeira demanda
Após autorização humana da Fase 2, em Claude Code ou Codex:
```text
Atue como ORCHESTRATOR. Leia o HANDOFF e inicie a FASE 2 — Foundation
conforme vault/11_ROADMAP/DEVELOPMENT_PLAN.md, começando pelo spike S-01.
Proponha o plano antes de implementar.
```
