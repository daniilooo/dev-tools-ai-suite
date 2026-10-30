---
tags: [seguranca, revisao]
atualizado: 2026-10-29
---

# Revisão de segurança completa — Fase 8

Escopo: todo o servidor (`apps/server/src`), não só o diff. Checklist: `.ai/skills/security-review.md`. Modelo de ameaças: [[SECURITY_MODEL]].

## Resultado do checklist

| Item | Resultado | Evidência |
|---|---|---|
| Toda rota HTTP e todo upgrade WebSocket exigem sessão | **Falhava; corrigido** (S-01) | `security.test.ts` — caminhos codificados |
| `Origin` e `Host` validados (anti CSWSH e DNS rebinding) | OK | `security.test.ts` (Host, Origin, WS sem Origin) |
| CORS restritivo; CSRF em métodos com efeito colateral | OK | sem `Access-Control-*`; header anti-CSRF; E2E com cookie sem token |
| Bind padrão `127.0.0.1` | OK | `DEVTOOLS_HOST` só aceita loopback (`config.ts`); `server.test.ts` |
| Segredo 0600, fora de URL, log e bundle | OK | `secret.ts` (`wx`, 0600); código de uso único só no fragmento `#code=`; E2E procura o segredo no bundle; logger redige cookie, `authorization` e `x-csrf-token` |
| Processos externos sem shell | OK | só `spawn`/`spawnSync` com array; nenhum `shell: true` nem `exec` de string; Graphify com ambiente mínimo |
| Nenhuma leitura de credenciais dos provedores | OK | `local-files.ts`: allowlist de transcrições, recusa links simbólicos e caminhos fora das raízes |
| Redação em logs, eventos e índices | OK | `redact.test.ts`, `knowledge.test.ts`, `agents.test.ts` |
| Exclusões de indexação | OK | `exclusions.ts`; arquivos via `lstat` (links simbólicos fora); pastas linkadas não são seguidas |
| Nenhum código sai da máquina sem consentimento | OK | únicas chamadas de rede: Ollama em loopback e download do modelo do Transformers.js após consentimento explícito (`semantic.service.ts`) |

Extras verificados: travessia de caminho nos arquivos estáticos (`/../`, `%2e%2e`) devolve 403/404; `pnpm audit --prod --audit-level high` sem vulnerabilidades; instalação limpa confere permissões 0700/0600 (`scripts/smoke-install.sh`).

## Achados

### S-01 — Desvio de autenticação com caminho codificado (bloqueante, corrigido)
- **O quê:** o hook de segurança decidia pela URL crua (`startsWith("/api/")`), mas o roteador decodifica o caminho. `GET /%61pi/v1/projects` respondia 200 e `POST` criava projeto, sem sessão e sem token anti-CSRF.
- **Impacto:** Host e Origin barravam o navegador, mas qualquer processo ou usuário da máquina podia usar a API toda, inclusive pedir um código de acesso (`launch-code`), ganhar sessão e abrir um terminal, ou seja, executar comandos. Violava INV-01 ("nenhuma pessoa ou aplicação externa deverá conseguir executar comandos…").
- **Correção:** a decisão usa a rota casada pelo roteador (`request.routeOptions.url`) além do caminho cru, e a lista de rotas públicas compara a rota casada. Teste de regressão falha sem a correção (`security.test.ts`).
- **Exposição:** presente desde a Fase 2; nenhuma versão publicada (`v0.0.0`).

### S-02 — Arquivo estático inexistente respondia `index.html` (baixo, corrigido)
O fallback da SPA devolvia HTML para `/styles.css` ausente e escondia build quebrado. Agora caminhos com extensão recebem 404.

### S-03 — Limite de tentativas da troca de código é global (baixo, aceito)
Dez tentativas por minuto para todos: um processo local pode atrasar o login do navegador por até um minuto. Força bruta segue inviável (código de 8 caracteres, uso único, 60 s). Registrado como TD-21.

### S-04 — Vulnerabilidade do vite só em desenvolvimento (informativo)
Vem pelo vitest; não entra no pacote (`audit --prod` limpo). Atualizar em chore separado.
