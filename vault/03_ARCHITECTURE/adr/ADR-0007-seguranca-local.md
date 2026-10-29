---
id: ADR-0007
titulo: Segurança local — bind, segredo de instalação e sessão do navegador
status: Proposto (validação na Fase 2 com Security Engineer + gate humano)
data: 2026-10-28
decisores: humano (Intake B2) + Architect
tags: [adr, seguranca]
---

# ADR-0007 — Segurança local

## Contexto
Acesso ao PTY = execução de comandos (G-08). Requisitos: bind `127.0.0.1`; segredo forte gerado na instalação (0600); auth em todas as APIs e WS; validação de `Origin`; CSRF; CORS restritivo; segredo nunca em URL, log ou bundle.

Ameaças específicas de servidores locais: páginas maliciosas fazendo requisições a `127.0.0.1` (CSRF), **cross-site WebSocket hijacking**, **DNS rebinding**, outros usuários locais da mesma máquina.

## Opções para a sessão do navegador
1. **Código de inicialização de uso único** — `devtools start` gera um código efêmero (aleatório, expira em ~60 s, uso único, derivado do segredo mas **não** é o segredo) e abre o navegador em `http://127.0.0.1:<porta>/#code=<código>`. A SPA envia o código via `POST /api/v1/session/exchange` e recebe cookie `HttpOnly; SameSite=Strict; Path=/`. O fragmento `#` não é enviado ao servidor nem a logs de acesso e é removido da barra de endereço após a troca.
2. **Código digitado** — o CLI mostra um código curto e o usuário digita no dashboard. Mais atrito, nenhum dado em URL.
3. **Token na query string** — rejeitado (viola RN-01).

## Decisão proposta
Opção 1, com a opção 2 como fallback (quando o navegador não puder ser aberto automaticamente). Complementos:
- Validar `Host` ∈ {`127.0.0.1:<porta>`, `localhost:<porta>`} → mitiga DNS rebinding.
- Validar `Origin` em toda requisição com efeito colateral e em todo upgrade WebSocket.
- CORS desabilitado (sem `Access-Control-Allow-Origin`).
- Cookie de sessão + header anti-CSRF (double submit) em métodos não idempotentes.
- Rate limit na troca de código.
- Segredo e sessões rotacionáveis (`devtools auth rotate`).

## Consequências
- + Nenhum segredo de longa duração em URL, log ou bundle.
- − Fluxo de primeiro acesso depende de o CLI abrir o navegador (fallback cobre).
- Mudanças futuras neste ADR exigem gate humano (HG-05/HG-06).
