---
id: ADR-0012
titulo: Dependências nativas — biblioteca de PTY e driver SQLite
status: Aceito (HG-07 aprovado em 2026-10-28 — PTY híbrido + better-sqlite3)
data: 2026-10-28
decisores: Architect (spike S-01) + humano
tags: [adr, dependencias]
---

# ADR-0012 — Dependências nativas: PTY e SQLite

## Contexto
Requisito: `npm install -g` simples, sem toolchain, Linux homologado e Windows/macOS considerados (ADR-0008). Resultado do spike S-01 em 2026-10-28 (Ubuntu 24.04, Node 22.23.3, x64):

| Biblioteca | Versão | Binário pronto Linux | Instalação | Teste funcional |
|---|---|---|---|---|
| `node-pty` (Microsoft) | 1.1.0 | **Não** (só darwin/win32) → compila com node-gyp (g++, make, Python, headers baixados de nodejs.org) | ~12 s | OK (`/dev/pts`, exit code) |
| `@lydell/node-pty` (fork) | 1.2.0-beta.18 | **Sim** (linux x64/arm64, darwin, win32 via optionalDependencies) | ~1 s | OK |
| `node:sqlite` (embutido) | Node 22.23 | n/a (sem dependência) | — | OK, mas emite `ExperimentalWarning` |
| `better-sqlite3` | 13.0.3 | **Sim** (download de binário) | <1 s | OK (SQLite 3.53.4) |

## Opções — PTY
1. `node-pty` oficial: mantido pela Microsoft (base do VS Code); exige toolchain no Linux (`build-essential`), quebrando o "Linux limpo".
2. `@lydell/node-pty`: mesma API, binários prontos; versão **beta** e mantenedor individual (risco de supply chain/manutenção).
3. Híbrido: `@lydell/node-pty` com versão **exata** fixada e fallback para `node-pty` se o binário pré-compilado não carregar; `devtools doctor` informa qual backend está ativo. Reavaliar na Fase 8.

## Opções — SQLite
1. `node:sqlite`: zero dependência nativa; API experimental no Node 22 (risco de mudança), aviso em runtime.
2. `better-sqlite3`: maduro, binários prontos para Node LTS, suporta `loadExtension` (necessário para `sqlite-vec`).

## Recomendação do Architect
- **PTY:** opção 3 (híbrido), isolada atrás de uma interface interna mínima `PtyBackend` no módulo `terminal`.
- **SQLite:** `better-sqlite3`, com acesso concentrado em uma camada de repositório do `core` (permite migrar para `node:sqlite` quando estabilizar).

## Consequências
- + Instalação sem toolchain no Linux nos casos normais.
- − Dependência de fork beta → versão exata, `pnpm audit`, revisão a cada atualização (skill `dependency-update`, HG-07).
