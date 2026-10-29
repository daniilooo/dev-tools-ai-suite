# Política de Segurança

A Dev Tools AI Suite expõe um terminal real (PTY) via navegador. Acesso ao PTY equivale à execução de comandos na máquina do usuário; tratamos qualquer falha nessa fronteira como crítica.

## Reportando vulnerabilidades

Não abra issue pública. Use **GitHub → Security → Report a vulnerability** (Private Vulnerability Reporting) neste repositório.

Inclua: versão, sistema operacional, passos para reproduzir e impacto.

## Escopo prioritário

- Autenticação local, sessão do navegador e WebSocket.
- Validação de `Origin`, CORS e CSRF.
- Controle de sessões PTY.
- Vazamento de segredos em logs, transcrições ou índices.
- Envio não autorizado de código para serviços externos.

## Versões suportadas

Antes de `v1.0.0`, apenas a versão mais recente publicada recebe correções.

Modelo de ameaças: `vault/07_SECURITY/SECURITY_MODEL.md`.
