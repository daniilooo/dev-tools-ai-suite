---
id: ADR-0002
titulo: Backend Node.js + TypeScript + Fastify
status: Aceito
data: 2026-10-28
decisores: humano (Intake B3)
tags: [adr]
---

# ADR-0002 — Backend Node.js + TypeScript + Fastify

## Contexto
O backend precisa de PTY real, WebSocket, execução de processos externos e distribuição sem JVM.

## Opções consideradas
1. **Java/Spring Boot + pty4j** — familiar ao mantenedor, mas PTY menos maduro e distribuição pesada (JVM/GraalVM).
2. **Node.js + Fastify** — `node-pty` maduro (base do VS Code), contratos TS compartilhados com o frontend, distribuição via npm.

## Decisão
Node.js 22 + TypeScript strict + Fastify + `ws`. Processos auxiliares em outras linguagens (ex.: Python/Graphify) via processo externo.

## Consequências
- + Ecossistema ideal para terminal e processos; um único runtime.
- − `node-pty` é nativo → prebuilds/toolchain (risco R-03, spike S-01).
