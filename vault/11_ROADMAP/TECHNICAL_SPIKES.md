---
tags: [roadmap, spikes]
---

# Spikes Técnicos

Spikes têm **timebox** e produzem uma resposta + recomendação (não código de produção).

| ID | Pergunta | Timebox | Fase | Saída |
|---|---|---|---|---|
| S-01 | `node-pty` instala sem toolchain em Linux limpo via npm? Qual driver SQLite (`node:sqlite` vs `better-sqlite3`)? Impacto em Windows/macOS? | 1 dia | 2 (início) | recomendação + HG-07 |
| S-02 | Interface do Graphify: instalação, comandos, formato de saída, versões, tempo em repo médio; viabilidade do plano B tree-sitter | 1 dia | 7 | ⏸ bloqueado: instalar `graphifyy` exige permissão do humano |
| S-03 | Benchmark `sqlite-vec` vs LanceDB + modelo de embeddings ONNX (tamanho, RAM, latência, qualidade) na máquina de referência | 1–2 dias | 7 | ⏸ bloqueado: instalar pacotes e baixar modelo exige permissão do humano; depois HG-07 |
| S-04 | Quais eventos de agentes/subagentes os hooks e transcripts do Claude Code 2.1.x e as sessões do Codex 0.16x fornecem? Nível A/B/C de cada | 1 dia | 5 (início) | ✅ concluído — [[ADR-0013-fontes-agent-monitor]] |
| S-05 | Existe saída oficial consumível de uso/limites para Claude Code e Codex nos planos atuais? | 0,5 dia | 6 (início) | ✅ concluído — [[ADR-0014-fontes-quota-monitor]] |

## Resultados

### S-01 — concluído em 2026-10-28
- `node-pty` 1.1.0 **não** traz binário pronto para Linux: compila via node-gyp (exige g++, make, Python e download de headers). Funciona após compilar.
- `@lydell/node-pty` 1.2.0-beta.18 traz binários prontos (linux x64/arm64, darwin, win32) e funciona com a mesma API — porém é beta.
- `node:sqlite` funciona no Node 22.23, com `ExperimentalWarning`.
- `better-sqlite3` 13.0.3 instala com binário pronto e funciona.
- Decisão proposta: [[ADR-0012-dependencias-nativas]] (aguardando HG-07).

### S-04 — concluído em 2026-10-28
Verificado em Claude Code 2.1.312 e Codex 0.165.0, com as transcrições reais da máquina de referência (lidas só como estrutura de chaves; as fixtures são anonimizadas).

| Fonte | Nível | O que fornece | Limitação |
|---|---|---|---|
| Hooks do Claude Code | A | eventos de ferramenta, subagente e fim de sessão | exige alterar `settings.json` (RN-05) → adiado |
| Transcrição do Claude (`projects/<dir>/<sessão>.jsonl`) | B | `timestamp`, `version`, `cwd`, `message.model`, `message.usage` (repetido por bloco: deduplicar por `message.id`), `stop_reason`, nomes de `tool_use`, `ai-title`, `system` com `level: error` | sem evento de fim de sessão |
| Subagentes do Claude (`<sessão>/subagents/agent-<id>.jsonl` + `.meta.json`) | B | mesmo formato; meta com `agentType` e `description` | — |
| Sessão do Codex (`sessions/AAAA/MM/DD/rollout-*.jsonl`) | B | `session_meta` (id, cwd, `cli_version`, `parent_thread_id`, `agent_nickname`), `turn_context.model`, `task_started`/`task_complete`, `token_count.info.total_token_usage` (acumulado), `function_call`/`custom_tool_call` | primeira linha pode ter centenas de KB (instruções) |

Desempenho: varredura incremental de 240 sessões e subagentes reais em ~0,4 s; arquivos grandes são lidos em blocos de 4 MB.
Decisão: [[ADR-0013-fontes-agent-monitor]].

### S-05 — concluído em 2026-10-29
Verificado em Claude Code 2.1.312 e Codex 0.165.0 (só a estrutura das chaves; fixtures anonimizadas).

| Fonte | Nível | O que fornece | Limitação |
|---|---|---|---|
| `rate_limits` em `token_count` do rollout do Codex | B | % usado, duração e renovação das janelas de 5 h e 7 dias; `plan_type` | só atualiza quando o Codex recebe uma resposta; alguns registros (`limit_id: "premium"`) vêm sem janelas |
| Entrada da status line do Claude Code (`rate_limits`) | A | `used_percentage` e `resets_at` das janelas de 5 h e 7 dias (planos Pro/Max) | só chega a um comando de status line configurado |
| Transcrição do Claude (`quotaLimits`) | B | tipo da janela e renovação quando o limite é atingido (`status: "rejected"`) | nada antes de atingir o limite |
| `/usage` do Claude Code | — | — | só no modo interativo: não consumível |

Hipótese H-05 confirmada em parte: há fonte oficial para o Codex (registrada localmente) e para o Claude Code (status line), mas a do Claude exige configurar a status line. O humano escolheu passá-la com `--settings` só nas sessões abertas pela suíte (D-15). Leitura das fontes reais da máquina de referência: ~40 ms por varredura.
Decisão: [[ADR-0014-fontes-quota-monitor]].

### S-02 e S-03 — pesquisa documental (2026-10-29), execução pendente
- **Graphify** ([safishamsi/graphify](https://github.com/safishamsi/graphify), PyPI `graphifyy`, Python ≥ 3.10, Apache-2.0/MIT): `graphify extract --code-only` roda offline com tree-sitter (~40 linguagens) e gera `graphify-out/graph.json`, `graph.html` e `GRAPH_REPORT.md`. Documentos e PDFs pedem LLM (assistente ou backend configurado) — a suíte usaria só `--code-only` para não enviar nada (INV-04). Registra consultas em `~/.cache/graphify-queries.log` (desligável com `GRAPHIFY_QUERY_LOG_DISABLE=1`). Pacotes `graphify*` homônimos no PyPI não são do projeto. Grava a saída dentro do projeto (`graphify-out/`) — verificar no spike se há opção de diretório de saída, senão rodar numa cópia ou no diretório de dados (INV-05).
- **Vetores:** referências públicas apontam `sqlite-vec` como busca exata (força bruta, recall 100%), adequada até ~100 mil vetores, e LanceDB com índice IVF, mais rápido em escala mas com ajuste por tamanho. O repositório real medido gera ~7 mil trechos por projeto: ordem de grandeza confortável para `sqlite-vec`. Precisa de benchmark local.
- **Bloqueio:** o modo automático do Claude Code recusou instalar código externo (pip/npm) sem autorização explícita. Próximo passo: o humano permite a instalação em diretório isolado (scratchpad) para o benchmark; a adoção no produto segue para HG-07.
