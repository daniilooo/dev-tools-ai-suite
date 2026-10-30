# Dev Tools AI Suite

Camada **local-first** de integração, observabilidade e conhecimento para desenvolvimento assistido por IA. Reúne Claude Code, Codex e modelos locais em um dashboard web que roda na sua máquina, com terminal real, monitor de agentes, monitor de cotas, RAG local e observabilidade, sem substituir nenhum desses assistentes.

> **Status:** Fase 8 (Hardening e Validação) em validação, com os 12 itens da DoD do MVP verificados; Fases 1–7 concluídas: servidor local seguro, projetos, diagnóstico, terminal real no navegador, detecção de Claude Code, Codex e Ollama com login via comandos oficiais, atalho para abrir Claude/Codex no projeto, monitor de agentes e subagentes (estado, tokens, ferramentas, histórico) lido das transcrições locais, só com metadados, monitor de cotas (janelas de 5 h e semanal, com fonte e frescor) e conhecimento local do projeto: busca textual por arquivo e linhas, busca semântica opcional (embeddings locais) e grafo de código (Graphify). Nenhum pacote publicado ainda. Roadmap: [`vault/11_ROADMAP/DEVELOPMENT_PLAN.md`](vault/11_ROADMAP/DEVELOPMENT_PLAN.md) · [visual](docs/development-plan.html)

## Produto

| Módulo | O que faz |
|---|---|
| Integrated Terminal | Terminal real no navegador, com abas, reconexão e processos interativos (`claude`, `codex`) |
| Agent Monitor | Acompanha agentes e subagentes, status, eventos e histórico |
| AI Quota Monitor | Mostra limites e renovações, informando a origem de cada dado (oficial, calculado, estimado ou indisponível) |
| Knowledge | RAG 100% local e grafo de código, com respostas que citam a fonte |
| Observabilidade | Sessões, eventos, métricas e tokens, quando disponíveis |

Princípios: tudo roda local por padrão, nenhuma credencial dos provedores é tocada, nenhum dado é inventado e nada sai da máquina sem consentimento. Ver [invariantes](vault/02_BUSINESS/BUSINESS_INVARIANTS.md).

## Como executar

O pacote ainda não foi publicado no npm. Para rodar a partir do código, use Node 22.22.3 ou superior e pnpm:

```bash
git clone git@github.com:daniilooo/dev-tools-ai-suite.git
cd dev-tools-ai-suite && git switch release
pnpm install
pnpm build
pnpm start          # = devtools start: sobe em 127.0.0.1:4317 e abre o dashboard
```

- O navegador abre já autenticado. Se não abrir, acesse `http://127.0.0.1:4317` e digite o **código curto** mostrado no terminal. Ele vale uma vez e expira em 60 s.
- Para gerar um novo código, rode `pnpm start` de novo. Se a suíte já estiver rodando, ele apenas emite outro código.
- Para o diagnóstico, use `node apps/server/dist/cli.js doctor`.
- Os dados ficam em `~/.dev-tools-ai-suite/` (diretório 0700, segredo 0600).

Interface final, depois da publicação: `npm install -g devtools-ai-suite`, `devtools start` e `devtools doctor`. Guia de operação (variáveis, dados, backup, atualização, problemas comuns): [`vault/09_OPERATIONS/OPERATIONS.md`](vault/09_OPERATIONS/OPERATIONS.md).

### Conhecimento (opcional)

A busca textual funciona sem instalar nada. A busca semântica e o grafo de código usam ferramentas que você instala; nada é baixado nem enviado sem a sua ação:

- **Busca semântica com Ollama:** `ollama pull embeddinggemma` (o Ollama precisa estar em `127.0.0.1`). Outro modelo: `DEVTOOLS_OLLAMA_EMBED_MODEL`.
- **Busca semântica sem Ollama:** `npm install --prefix ~/.dev-tools-ai-suite/addons @huggingface/transformers@4.3.2` (≈560 MB). O modelo multilíngue (≈130 MB) só é baixado depois que você confirma na tela.
- **Grafo de código:** `pipx install graphifyy` (ou `pip install graphifyy`), com `graphify` no PATH ou em `DEVTOOLS_GRAPHIFY_BIN`. Roda só com análise do código, sem IA e sem gravar nada no projeto.

Depois, na tela **Conhecimento**, indexe o projeto e ligue a busca semântica ou gere o grafo.

### Desenvolvimento

```bash
git config core.hooksPath .githooks   # hooks pre-commit e pre-push
pnpm dev:web                          # recompila o dashboard a cada alteração
pnpm dev:server                       # servidor com recarga automática (sem abrir o navegador)
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e                         # requer `pnpm build` e `pnpm exec playwright install chromium`
scripts/smoke-install.sh <pacote.tgz>  # instalação limpa num contêiner Debian (requer Docker)
```

## Onde está a documentação

| Conteúdo | Local |
|---|---|
| Fonte da verdade (produto, regras, arquitetura, ADRs, roadmap) | [`vault/`](vault/00_HOME/START_HERE.md) |
| Workflow de IA (agentes, contratos, skills, hooks) | [`.ai/`](.ai/README.md) |
| Roadmap visual | [`docs/development-plan.html`](docs/development-plan.html) |
| Sistema de desenvolvimento com IA (visual) | [`docs/ai-development-system.html`](docs/ai-development-system.html) |
| Manual de desenvolvimento | [`vault/13_AI_SYSTEM/AI_DEVELOPMENT_MANUAL.md`](vault/13_AI_SYSTEM/AI_DEVELOPMENT_MANUAL.md) |

## Como abrir no Obsidian

1. Instale o [Obsidian](https://obsidian.md).
2. Escolha **Open folder as vault** e selecione a pasta `vault/`.
3. Abra `00_HOME/START_HERE.md`. Nenhum plugin externo é necessário: wikilinks, Mermaid e Graph view já vêm no Obsidian.

## Como usar o workflow de IA

O workflow pertence ao projeto. Claude Code, Codex e modelos locais são executores intercambiáveis.

- **Claude Code:** rode `claude` na raiz. Ele lê o [`CLAUDE.md`](CLAUDE.md) e usa os subagentes de `.claude/agents/` e as skills `/commit`, `/git-flow`, `/code-review`…
- **Codex:** rode `codex` na raiz. Ele lê o [`AGENTS.md`](AGENTS.md) e usa as skills `$commit`, `$git-flow`…
- **Modelo local:** veja [`.ai/adapters/local/README.md`](.ai/adapters/local/README.md).
- **Trocar de LLM:** atualize o HANDOFF em [`.ai/state/AI_DEVELOPMENT_STATE.md`](.ai/state/AI_DEVELOPMENT_STATE.md) e, na nova ferramenta, use o prompt [`.ai/prompts/RETOMAR_SESSAO.md`](.ai/prompts/RETOMAR_SESSAO.md).

Branches: `main` ← `release` ← `feature/*` · `fix/*` · `chore/*`. Ver [GitFlow](vault/05_WORKFLOWS/GITFLOW.md) e [gates humanos](vault/05_WORKFLOWS/HUMAN_GATES.md).

## Contribuição, segurança e licença

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [Apache License 2.0](LICENSE)
