---
tags: [operacoes]
atualizado: 2026-10-29
---

# Operações (usuário final)

Passo a passo com prints de cada tela: [manual do usuário](../../docs/manual/README.md).

Guia de instalação e operação do pacote `devtools-ai-suite`, distribuído pelas [GitHub Releases](https://github.com/daniilooo/dev-tools-ai-suite/releases) (D-26). Instalação validada em contêiner Debian 12 limpo, sem compilador (`scripts/smoke-install.sh`, também no CI).

## Requisitos
- Linux homologado (glibc, x64) · Node.js **22.22.3** ou superior · `git`.
- Opcionais: Claude Code, Codex CLI, Ollama, Graphify, Transformers.js. A suíte funciona sem eles e mostra o que falta em **Diagnóstico**.
- Não precisa de compilador nem de python: os módulos nativos (`better-sqlite3`, `sqlite-vec`, `@lydell/node-pty`) vêm prontos.

## Instalar e iniciar
| Tarefa | Como |
|---|---|
| Instalar | `npm install -g devtools-ai-suite` (alternativa: `npm install -g <URL do .tgz>` da [release no GitHub](https://github.com/daniilooo/dev-tools-ai-suite/releases)) |
| Iniciar | `devtools start` abre o navegador já autenticado. Opções: `--port`, `--data-dir`, `--no-open` |
| Entrar sem o navegador automático | abrir `http://127.0.0.1:4317` e digitar o **código curto** mostrado no terminal (uso único, 60 s) |
| Novo código de acesso | rodar `devtools start` de novo: com a suíte já rodando, só gera outro código |
| Parar | Ctrl+C no terminal do `devtools start`. Encerra também os terminais abertos pela suíte |
| Diagnóstico | `devtools doctor` (ou `--json`); no dashboard, tela **Diagnóstico**. Sai com código 1 se alguma verificação falhar |

## Uso diário
| Tarefa | Como |
|---|---|
| Projetos | **Projetos** → caminho absoluto. A stack é detectada pelos manifestos na raiz e até 2 níveis abaixo (`frontend/`, `backend/`) |
| Terminal | **Abrir terminal** no projeto. Fechar o navegador não encerra o terminal (fica vivo por 8 h); fechar a aba (×) ou parar a suíte encerra os processos |
| Claude Code e Codex | **Abrir Claude Code/Codex** no projeto ou no terminal. Login sempre pelos comandos oficiais (`claude auth login`, `codex login`); a suíte não lê nem guarda credenciais |
| Agentes | **Agentes** mostra sessões das transcrições locais (só metadados) |
| Cotas | **Cotas** mostra uso com fonte e frescor, ou INDISPONÍVEL com o motivo. O Claude só informa uso nas sessões abertas pela suíte |
| Conhecimento | **Conhecimento** → indexar; busca semântica e grafo são opcionais (ver README, seção "Conhecimento") |

## Configuração (variáveis de ambiente)
| Variável | Padrão | Efeito |
|---|---|---|
| `DEVTOOLS_PORT` | `4317` | Porta local (1024–65535) |
| `DEVTOOLS_HOST` | `127.0.0.1` | Só aceita loopback (`127.0.0.1`/`localhost`); expor na rede exige HG-12 |
| `DEVTOOLS_DATA_DIR` | `~/.dev-tools-ai-suite` | Diretório de dados |
| `DEVTOOLS_LOG_LEVEL` | `info` | Nível do log em `logs/server.log` |
| `DEVTOOLS_CLAUDE_STATUSLINE` | ligado | `off` desliga a status line da suíte nas sessões do Claude (as cotas do Claude ficam INDISPONÍVEL) |
| `DEVTOOLS_OLLAMA_URL` | `http://127.0.0.1:11434` | Só loopback: o código nunca vai para um Ollama remoto |
| `DEVTOOLS_OLLAMA_EMBED_MODEL` | `embeddinggemma` | Modelo de embeddings no Ollama |
| `DEVTOOLS_TRANSFORMERS_MODEL` | `Xenova/multilingual-e5-small` | Modelo do Transformers.js |
| `DEVTOOLS_GRAPHIFY_BIN` | `graphify` | Executável do Graphify |

## Dados
```text
~/.dev-tools-ai-suite/          (0700)
├── secret                      (0600) segredo de instalação
├── devtools.db                 (0600) projetos, sessões, estados
├── indexes/<projeto>.db        índice textual (0600) · <projeto>.vec.db vetores (0600)
├── graphs/<projeto>.json       grafo de código (0600)
├── quota/                      leituras da status line do Claude
├── addons/ · models/           Transformers.js e modelos, só se você instalar/consentir
└── logs/                       server.log (redigido)
```
Nada é gravado dentro dos projetos (INV-05).

## Manutenção
| Tarefa | Como |
|---|---|
| Backup | parar a suíte e copiar o diretório de dados |
| Atualizar | `npm install -g devtools-ai-suite@latest`; as migrações do banco rodam sozinhas ao iniciar (só aditivas) |
| Voltar de versão | não suportado sobre os mesmos dados: um banco de versão mais nova é recusado sem alteração (D-23). Restaure o backup feito antes da atualização |
| Rotacionar segredo e sessões | parar a suíte e remover `secret` (comando dedicado previsto — TD-02) |
| Remover índice ou grafo de um projeto | **Conhecimento** → Remover índice / Remover grafo; remover o projeto apaga também os índices |
| Desinstalar | `npm uninstall -g devtools-ai-suite`; os dados ficam até você remover o diretório |

## Problemas comuns
| Sintoma | Causa e solução |
|---|---|
| `Erro: O banco de dados é da migração N, mais nova…` | Suíte mais antiga que os dados: atualize a suíte ou restaure o backup |
| Terminal (PTY) com erro no doctor | Reinstale a suíte; se persistir, instale `build-essential` e `python3` |
| Provedor "não encontrado" mas abre no terminal | O PATH do servidor difere do PATH do shell (TD-09): inicie a suíte num shell com o PATH completo |
| Porta ocupada | Se for a própria suíte, `devtools start` só gera um novo código; senão use `--port` |
| Busca semântica lenta | Embeddings na CPU (TD-19); prefira o Ollama ou deixe rodando em segundo plano |
