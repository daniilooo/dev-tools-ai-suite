---
id: ADR-0004
titulo: Terminal web com xterm.js + node-pty + WebSocket
status: Aceito
data: 2026-10-28
decisores: humano (Intake B3)
tags: [adr]
---

# ADR-0004 — Terminal web: xterm.js + node-pty + WebSocket

## Decisão
PTY real no sistema do usuário via `node-pty`, renderizado com `xterm.js`, transportado por WebSocket autenticado. Sessões sobrevivem à desconexão do navegador por janela de retenção com buffer limitado (reconexão).

## Consequências
- + Suporta processos interativos (`claude`, `codex`, `vim`).
- + Mesma base tecnológica do VS Code.
- − PTY exposto via web é a maior superfície de risco → [[ADR-0007-seguranca-local]], gate humano para mudanças.
- − Docker não é caminho principal: PTY em container não enxerga as ferramentas do host.
