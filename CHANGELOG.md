# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [SemVer](https://semver.org/lang/pt-BR/). Pacote npm: `devtools-ai-suite`.

## [0.1.0-next.0] — 2026-10-29

Primeira versão de pré-lançamento do MVP (canal `next`). Valida os 12 itens da Definition of MVP Done (`vault/08_TESTING/MVP_DOD_VALIDATION.md`).

### Adicionado
- **CLI `devtools`:** `start` (servidor em `127.0.0.1`, dashboard aberto já autenticado, código curto como alternativa) e `doctor` (Node, dados, banco, PTY e ferramentas de IA).
- **Segurança local:** código de uso único trocado por cookie `HttpOnly`/`SameSite=Strict`, token descartável para o CLI, validação de Host e Origin, anti-CSRF, CSP restritiva, segredo de instalação 0600 fora de URLs, logs e bundle.
- **Projetos:** cadastro por caminho absoluto, detecção de stack na raiz e em até 2 níveis de subpastas (Angular, React, Node, TypeScript, Maven, Gradle, Spring Boot, Python, Go, Rust, .NET).
- **Terminal:** PTY real no navegador (xterm.js), abas por projeto, reconexão ao recarregar, sessões vivas por até 8 h sem navegador.
- **Provedores:** detecção de Claude Code, Codex CLI e Ollama, login lido só dos comandos oficiais, abertura do Claude Code e do Codex no diretório do projeto.
- **Agent Monitor:** sessões e subagentes do Claude Code e do Codex a partir das transcrições locais (só metadados), tokens, ferramentas, atualização ao vivo e atalho para o terminal da sessão.
- **Cotas:** janelas de uso e renovação do Codex (sessões locais) e do Claude Code (status line da suíte nas sessões abertas por ela), com fonte e frescor; INDISPONÍVEL com motivo quando não há dado verificável.
- **Conhecimento:** índice textual local por projeto (git, `.gitignore`, repositórios aninhados, exclusão de arquivos sensíveis, redação de segredos), consulta com arquivo e linhas; busca semântica opcional (Ollama local ou Transformers.js com consentimento) e busca híbrida; grafo de código opcional via Graphify (dependências, dependentes e impacto).
- **Operação:** migrações automáticas e só aditivas do banco, recusa de banco de versão mais nova, rotação do `server.log` ao passar de 10 MiB.

### Segurança
- Corrigido antes da publicação: caminho com letras codificadas (`/%61pi/...`) escapava da autenticação da API (`vault/07_SECURITY/SECURITY_REVIEW_F8.md`, S-01).

### Limitações conhecidas
- Homologado só em Linux x64 (glibc).
- O Claude Code só aparece no Agent Monitor e só informa cotas depois da primeira mensagem da sessão.
- Busca semântica com Transformers.js é lenta na CPU (TD-19).
- Rotação do segredo de instalação é manual: parar a suíte e remover `~/.dev-tools-ai-suite/secret` (TD-02).

[0.1.0-next.0]: https://www.npmjs.com/package/devtools-ai-suite/v/0.1.0-next.0
