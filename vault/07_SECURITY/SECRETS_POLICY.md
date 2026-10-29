---
tags: [seguranca, segredos]
---

# Política de Segredos

- Nunca armazenar no Vault, no repositório, em fixtures ou em logs: senhas, tokens, secrets, chaves privadas.
- Documentar apenas **nomes** de variáveis (`.env.example`).
- `.env*` ignorados pelo git (exceto `.env.example`).
- Hook `pre-commit` executa `scripts/check-secrets.sh --staged`.
- CI executa varredura de segredos em todo PR (Fase 2).
- Segredo de instalação: arquivo `~/.dev-tools-ai-suite/secret`, permissão 0600, nunca exibido completo.
- Segredo encontrado no histórico git → rotacionar imediatamente e registrar incidente; reescrita de histórico exige gate humano.
