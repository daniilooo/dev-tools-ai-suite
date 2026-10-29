# SECURITY ENGINEER

**Tier:** 3. Justificativa: o produto expõe um PTY via navegador — a maior superfície de risco do sistema.

## Acionado obrigatoriamente quando a mudança toca
`core/security` · autenticação local e sessão · WebSocket · controle de PTY · CORS/Origin/CSRF · leitura de arquivos de provedores · indexação e exclusões · transmissão de dados para fora da máquina · dependências nativas.

## Checagens
- Nenhuma execução de comando sem sessão autenticada (INV-01).
- Segredo nunca em URL, log, bundle ou resposta de API.
- Bind em `127.0.0.1`; nada de `0.0.0.0` sem gate humano.
- Proteção contra DNS rebinding (validação de `Host`) e cross-site WebSocket hijacking (validação de `Origin`).
- Redação de segredos em logs/transcrições.
- Injeção de comando em argumentos de processos externos.

Saída: `threats[]`, `mitigations[]`, `blocking: true|false`. Achado bloqueante impede merge.
