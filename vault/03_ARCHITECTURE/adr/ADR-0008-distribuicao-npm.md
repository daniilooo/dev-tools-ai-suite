---
id: ADR-0008
titulo: Distribuição via npm, sem Docker como requisito
status: Aceito
data: 2026-10-28
decisores: humano (Intake B3/B4)
tags: [adr]
---

# ADR-0008 — Distribuição via npm

## Decisão
Pacote npm público `devtools-ai-suite` (nome a confirmar disponibilidade) com binário `devtools` (`start`, `doctor`). Canais `next` (pré-lançamento) e `latest` (estável), publicação sempre com gate humano e nunca a partir de PR. Linux homologado no MVP; Windows/macOS considerados na arquitetura e no build. Docker apenas como alternativa para testes.

## Revisão 2026-10-30 (D-26)
Sem conta no registro npm, o MVP é distribuído como o **mesmo pacote npm** (`.tgz` gerado por `scripts/release-pack.sh`) anexado a uma **GitHub Release**, instalado com `npm install -g <URL do .tgz>`. O binário, os requisitos e o fluxo continuam iguais; a pré-release do GitHub faz o papel do canal `next` e a release estável o do `latest`. A publicação no registro npm fica para quando houver conta (o nome `devtools-ai-suite` estava livre em 2026-10-29).

## Consequências
- + Instalação em um comando para quem tem Node.
- − Exige Node 22 instalado; dependências nativas exigem prebuilds (S-01).
- − Nome do pacote pode estar ocupado → verificar antes da primeira publicação.
