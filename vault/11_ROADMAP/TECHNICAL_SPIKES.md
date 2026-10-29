---
tags: [roadmap, spikes]
---

# Spikes Técnicos

Spikes têm **timebox** e produzem uma resposta + recomendação (não código de produção).

| ID | Pergunta | Timebox | Fase | Saída |
|---|---|---|---|---|
| S-01 | `node-pty` instala sem toolchain em Linux limpo via npm? Qual driver SQLite (`node:sqlite` vs `better-sqlite3`)? Impacto em Windows/macOS? | 1 dia | 2 (início) | recomendação + HG-07 |
| S-02 | Interface do Graphify: instalação, comandos, formato de saída, versões, tempo em repo médio; viabilidade do plano B tree-sitter | 1 dia | 7 | ✅ concluído — HG-07 aprovado (D-20) |
| S-03 | Benchmark `sqlite-vec` vs LanceDB + modelo de embeddings ONNX (tamanho, RAM, latência, qualidade) na máquina de referência | 1–2 dias | 7 | ✅ concluído — HG-07 aprovado (D-20) |
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

### S-02 e S-03 — concluídos em 2026-10-29 (HG-07 aprovado, D-20)

Executados com autorização do humano, em diretórios isolados (scratchpad), sem tocar no produto nem no repositório medido. Máquina de referência: 4 núcleos, sem GPU. Repositório medido: `jinsei` (Angular + Spring Boot, repositórios aninhados), 2.090 arquivos e 7.154 trechos gerados pelo indexador da suíte (já redigidos).

#### S-02 — Graphify (`graphifyy` 0.9.97, PyPI, Apache-2.0)
- **Instalação base:** venv de 203 MB (tree-sitter + gramáticas, networkx, numpy). Os conectores de LLM (`openai`, `anthropic`, `ollama`…) são extras opcionais, não instalados. Rodado com `env -i`, sem chaves de API: `extract --code-only` não fez chamadas a LLM.
- **Saída fora do projeto:** `extract <path> --out <dir>` grava `<dir>/graphify-out/`. O padrão grava dentro do projeto, então a suíte sempre passaria `--out` para o diretório de dados (INV-05). O log de consultas fica em `$HOME/.cache` (rodado com `HOME` isolado).
- **Armadilha — repositórios aninhados:** respeitando o `.gitignore` da raiz, viu só 72 arquivos de código (o mesmo problema da D-19). Com `--no-gitignore`, viu 1.778, mas também passaria a ler `node_modules`, `target` e `.env` de um projeto real. No spike rodou numa cópia filtrada. Na suíte, a saída é rodar em cada repositório (raiz + aninhados) e juntar com `merge-graphs`, ou passar uma cópia filtrada pela lista do indexador.
- **Medição** (inflada: dividiu CPU com o S-03): 12.254 nós, 44.892 arestas e 392 comunidades em 1 min 45 s; pico de 250 MB de RAM; `graph.json` de 26 MB. Arestas `EXTRACTED` (AST) 37.636 e `INFERRED` 7.256.
- **Qualidade:** `explain RefreshSessionRepository` e `affected RefreshSessionRepository --depth 2` foram precisos (herança, quem usa, métodos e cadeia `Controller → Service → Repository`), todos com `arquivo:Lnn`. O `query` em texto livre é ruidoso: misturou código PHP legado, workflows e helpers.
- **Conclusão:** útil para perguntas **estruturais** (impacto, dependências, hubs), não para busca. É dependência **Python externa**: não entra no pacote npm; seria uma ferramenta opcional detectada como os provedores (doctor indica a instalação), com saída no diretório de dados.

#### S-03 — vetores e embeddings locais
| Item | `sqlite-vec` 0.1.9 | LanceDB 0.41.0 |
|---|---|---|
| Instalação | 188 KB (extensão do SQLite já usado) | **1,1 GB** |
| Gravação de 7.154 vetores (384 dim) | 0,45 s | 0,97 s |
| Tamanho no disco | 11,2 MB | 11 MB |
| Consulta k=5 | 9–15 ms | 14–164 ms |
| Resultados | idênticos (busca exata) | idênticos |

- **Embeddings** (Transformers.js 4.3.2 + `onnxruntime-node`, CPU, `q8`): o runtime ocupa **548 MB** de instalação; 1,3–1,5 GB de RAM durante a indexação.
  - `all-MiniLM-L6-v2` (23 MB, inglês): o `jinsei` inteiro levou **21 min** (~180 ms por trecho). Acertou a pergunta em inglês ("how is the refresh token revoked on logout" → `AuthService.java:211`, `RefreshSession.java:71`, ADR de autenticação). **Errou as três perguntas em português**, devolvendo prompts e documentos sem relação.
  - `multilingual-e5-small` (130 MB): cerca de **2× mais lento** que o MiniLM na mesma amostra de 200 trechos. Estimativa: ~45 min para o `jinsei`.
  - Gerar a incorporação da pergunta leva 5–13 ms; o custo está todo na indexação.
- **Alternativa:** o Ollama já está instalado nesta máquina (só `qwen3:8b`, sem modelo de embeddings). Um modelo de embeddings no Ollama (`127.0.0.1`, local, sem violar INV-04) evitaria os 548 MB do ONNX no pacote. Não foi medido: baixar o modelo gravaria fora do diretório isolado.
- **Conclusão:** `sqlite-vec` vence com folga na escala real (~7 mil trechos por projeto). As embeddings locais funcionam, mas são caras (instalação, RAM e dezenas de minutos por projeto) e só têm qualidade aceitável em PT-BR com modelo multilíngue.

#### Recomendação para o HG-07
1. **Adotar `sqlite-vec`** como `VectorStore` (dependência nativa pequena, mesmo SQLite do índice textual). Descartar LanceDB.
2. **Busca semântica opcional, ligada pelo humano por projeto**, com indexação em segundo plano e incremental. O `EmbeddingProvider` teria dois adaptadores:
   - **Ollama local**, se instalado (sem dependência nova no pacote);
   - **Transformers.js** com modelo multilíngue baixado só após consentimento, instalado sob demanda e não no pacote base.
   Sem nenhum dos dois, a busca semântica continua INDISPONÍVEL e a textual segue funcionando.
3. **Graphify como ferramenta externa opcional** para o `CodeGraphProvider` (impacto e dependências), executado por repositório com `--code-only --out <dataDir>`. Plano B (tree-sitter direto em Node) só se o Graphify se mostrar instável.
