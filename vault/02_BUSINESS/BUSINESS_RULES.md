---
tags: [negocio, regras]
---

# Regras de Negócio

## RN-01 — Acesso à plataforma e ao terminal
- Bind padrão `127.0.0.1`; nenhuma exposição automática em rede (exposição = gate humano).
- Segredo aleatório criptograficamente seguro gerado na instalação; armazenado com permissão restrita ao usuário (0600).
- Autenticação exigida em **todas** as APIs e conexões WebSocket.
- Proteção contra conexões originadas de outras páginas: validação de `Origin` (e `Host`), CSRF quando aplicável, CORS restritivo.
- Proibida execução remota anônima de comandos.
- Segredo nunca em URL, log ou bundle JavaScript. O mecanismo de sessão do navegador é decisão do Architect → [[ADR-0007-seguranca-local]].
- Processos com permissões do usuário atual; sem elevação automática.
- Multiusuário e acesso remoto: fora do MVP.

## RN-02 — Credenciais dos provedores
Permitido: detectar ferramentas instaladas; identificar versões e capacidades; verificar autenticação por mecanismos **documentados**; executar as ferramentas localmente.
Proibido: extrair tokens de arquivos de configuração; usar credenciais em APIs privadas/não documentadas; armazenar credenciais; enviá-las a serviços externos.
Obrigatório: redigir segredos que apareçam acidentalmente em logs ou transcrições.
Os processos oficiais dos provedores usam suas próprias credenciais normalmente dentro do terminal.

## RN-03 — Fontes de dados do Agent Monitor e Quota Monitor
Permitidas: hooks oficiais do Claude Code · transcrições e arquivos de sessão locais acessíveis ao usuário (respeitando formato/versão) · eventos e protocolos documentados · saídas de comandos oficiais de diagnóstico/uso · métricas de processos controlados pela suíte.
Proibidas: scraping de páginas de conta · engenharia reversa de autenticação · APIs privadas · interceptação de tráfego de autenticação · modificação de arquivos internos dos provedores.
- Arquivo local acessível **não** é API estável: cada integração é classificada por nível de suporte e risco → [[INTEGRATIONS]].
- Todo dado exibido possui: provedor de origem · horário da última atualização · categoria (`oficial`, `calculado`, `estimado`, `indisponível`) · frescor/validade · tratamento de falha e incompatibilidade.
- O Agent Monitor diferencia **agentes com terminal próprio** de **subagentes que só emitem eventos**.

## RN-04 — Privacidade, RAG e embeddings
- Documentos e código permanecem na máquina; índices vetoriais locais; embeddings gerados localmente.
- Nenhum conteúdo enviado automaticamente para indexação externa.
- Exclusões configuráveis (segredos, sensíveis, build, dependências) → [[INDEXING_EXCLUSIONS]].
- Índices isolados por projeto; o usuário pode remover e reconstruir.
- `EmbeddingProvider` abstrai mecanismos locais (ONNX/Transformers.js preferencial; Ollama opcional). Ollama **não** é dependência obrigatória.
- Sem mecanismo de embeddings configurado, o RAG semântico fica desabilitado até a configuração; o resto funciona.
- Para aprovar o MVP, ao menos um mecanismo local deve estar funcionando e validado.
- Provedores externos de embeddings: pós-MVP, mediante opt-in explícito e indicação clara dos dados transmitidos.
- Uso deliberado de Claude Code/Codex para desenvolver é operação distinta da indexação RAG.

## RN-05 — Escrita nos projetos do usuário
- Dados globais em `~/.dev-tools-ai-suite/` (config, SQLite, índices, embeddings, histórico, logs, observabilidade, módulos, metadados de projetos).
- `projeto/.devtools/config.yaml` é **opcional** e criado somente com autorização.
- Alterações em `.claude/settings.json`, `AGENTS.md`, configs de MCP ou hooks seguem o procedimento:
  1. detectar configuração existente;
  2. mostrar alterações propostas (diff);
  3. solicitar autorização explícita;
  4. preservar configurações não relacionadas;
  5. backup/rollback quando aplicável;
  6. aplicar de forma idempotente;
  7. registrar a alteração;
  8. permitir desativação/reversão sem remover configurações do usuário.
- Nunca sobrescrever integralmente configurações existentes.
- Comandos e agentes executados pelo usuário no terminal podem alterar arquivos conforme suas próprias permissões; a regra acima vale para alterações **automáticas da suíte**.

## RN-06 — Módulos opcionais e degradação
- Ausência de Ollama, Graphify ou embeddings não impede terminal e dashboard.
- Processos externos com ciclo de vida gerenciado, timeout, logs e tratamento de falhas.
- Módulos de IA desacoplados da execução do terminal.

Estados e transições: [[STATE_MACHINES]] · Invariantes: [[BUSINESS_INVARIANTS]]
