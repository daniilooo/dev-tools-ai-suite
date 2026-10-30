---
id: ADR-0013
titulo: Fontes do Agent Monitor — transcrições locais agora, hooks depois
status: Proposto (aceito com o merge do PR da Fase 5)
data: 2026-10-28
decisores: LLM (proposta), humano (revisão do PR)
tags: [adr, integracoes, agentes]
---

# ADR-0013 — Fontes do Agent Monitor

## Contexto
O spike S-04 ([[TECHNICAL_SPIKES]]) avaliou de onde vêm os eventos de agentes e subagentes:
- **Claude Code — hooks (nível A):** documentados e estáveis, mas exigem escrever em `settings.json` do usuário ou do projeto. Isso é mudar configuração existente (RN-05, INV-05) e precisa de autorização explícita.
- **Claude Code — transcrições (nível B):** `~/.claude/projects/<diretório codificado>/<sessão>.jsonl` e `<sessão>/subagents/agent-<id>.jsonl` + `.meta.json`. Trazem horário, modelo, versão, `usage` por mensagem, nomes de ferramentas, `stop_reason` e o tipo do subagente.
- **Codex — sessões (nível B):** `~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl`. Trazem `session_meta` (cwd, versão, `parent_thread_id` dos subagentes), `task_started`/`task_complete`, `token_count` acumulado e chamadas de ferramenta.

## Decisão
1. O MVP usa só as **transcrições locais (nível B)**, em leitura incremental e somente leitura. Nenhuma configuração do usuário é alterada.
2. Hooks do Claude Code ficam para depois do MVP, como opção que o usuário ativa explicitamente (RN-05) → [[POST_MVP_BACKLOG]].
3. Leitura restrita por **allowlist de caminhos** (`integrations/sources/local-files.ts`, a única exceção de lint ao INV-02): só os padrões de transcrição/sessão acima. Links simbólicos são recusados e o caminho real precisa estar dentro da raiz. Credenciais e configurações (`.credentials.json`, `auth.json`, `settings.json`, `config.toml`, `history.jsonl`) nunca casam.
4. **Só metadados** são extraídos: horários, modelo, versão, tokens, nomes de ferramentas, tipo e descrição do subagente, título gerado. Prompts, respostas, raciocínio, argumentos e saídas de ferramentas são ignorados. Títulos e descrições passam pelo redator (RN-02) e são truncados.
5. O estado (`AgentRunState`) é **derivado de evidência** com limite de frescor ([[STATE_MACHINES]]). Sem evento recente, o estado é `unknown` (INV-03).
6. **Vínculo com o terminal:** ao abrir o Claude Code pela suíte, o comando fixo ganha `--session-id <uuid>` gerado pelo servidor (flag oficial). O Codex não tem flag equivalente: ele é vinculado por janela de tempo (sessão iniciada entre 2 s antes e 60 s depois do lançamento, no mesmo projeto, e só se houver um único candidato).
7. A sessão pertence a um projeto quando o `cwd` registrado é o caminho do projeto (Claude) ou fica dentro dele (Codex). O nome do diretório do Claude é ambíguo (`/a-b` e `/a/b`): o `cwd` da transcrição decide.

## Consequências
- + Funciona sem instalar nada e sem tocar em configurações; cobre Claude Code e Codex, inclusive subagentes.
- + Histórico persistido (`agent_runs`, `agent_events`) só com metadados redigidos.
- − Formato sem contrato de estabilidade (R-01): parsers tolerantes, fixtures por versão (Claude Code 2.1.312, Codex 0.165.0) e testes de contrato.
- − Transcrições não registram o fim da sessão principal: ela aparece como `waiting` e, depois de 30 min sem eventos, como `unknown`.
- − Atraso de até ~2 s (intervalo de varredura). Arquivos grandes são lidos em blocos de 4 MB ao longo de várias varreduras.
- − Só sessões dos últimos 30 dias são descobertas.
