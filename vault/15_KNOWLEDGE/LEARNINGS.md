---
tags: [conhecimento]
---

# Aprendizados

Registrar o que evita investigação futura: comportamentos inesperados de ferramentas, armadilhas de PTY, diferenças entre versões de provedores.

| Data | Aprendizado | Contexto |
|---|---|---|
| 2026-10-28 | O repositório GitHub foi criado vazio; `main` só passa a existir após o primeiro push. | Bootstrap |
| 2026-10-28 | Shell padrão do ambiente é zsh: scripts com arrays associativos devem ser executados explicitamente com `bash`. | Bootstrap |
| 2026-10-28 | `node-pty` 1.1.0 não publica binário para Linux; compila com node-gyp. `@lydell/node-pty` traz binários prontos. | Spike S-01 |
| 2026-10-28 | `better-sqlite3` 13 já inclui binários em `prebuilds/` — não roda script de instalação. | Fase 2 |
| 2026-10-28 | pnpm 12 usa `allowBuilds` (mapa) em `pnpm-workspace.yaml`; `onlyBuiltDependencies` não é mais aceito. | Fase 2 |
| 2026-10-28 | Angular 22 e typescript-eslint 8 exigem TypeScript `>=6.0 <6.1` — não atualizar para TS 7 ainda. | Fase 2 |
| 2026-10-28 | O `inlineCritical` do Angular injeta `<script>` inline; incompatível com CSP `script-src 'self'`. Desligado. | Fase 2 |
| 2026-10-28 | Merge de PR pela LLM pode ser bloqueado pela política de permissões do Claude Code; o humano faz o merge. | Fase 2 |
| 2026-10-28 | Filhos de um shell que saiu são reparentados para o init: procurar só por PPID não os encontra. A sessão POSIX (`/proc/<pid>/stat`, campo 6) continua igual ao PID do PTY e localiza todos. | Fase 3 |
| 2026-10-28 | Hooks `onRequest` do Fastify rodam no upgrade do `@fastify/websocket`: erro lançado vira resposta HTTP (401/403) antes do handshake. | Fase 3 |
| 2026-10-28 | `claude auth status --json` (2.1.x) e `codex login status` (0.165.x) informam o login sem a suíte tocar em credenciais; a saída do Claude inclui e-mail e organização — descartar. | Fase 4 |
| 2026-10-28 | O type-check de templates do Angular é mais estrito que o `tsc --noEmit`: tipos estreitados (`LaunchableProviderId`) só aparecem no `ng build`. | Fase 4 |
| 2026-10-28 | Em E2E que abre provedores, usar binários falsos e `/bin/sh` como shell: o rc do usuário (zsh/bash) pode recolocar o binário real no PATH. | Fase 4 |
