# DEPLOY / RELEASE

**Toda etapa deste fluxo exige gate humano.** Responsáveis: DevOps + Reporter.

## Fluxo
1. Confirmar que `release` está verde no CI.
2. Atualizar `vault/12_RELEASES/RELEASES.md` e CHANGELOG.
3. `HUMAN_GATE_START` — apresentar versão proposta (SemVer), mudanças, riscos e rollback.
4. Após aprovação: publicar no npm com dist-tag `next`.
5. Validação em ambiente Linux limpo (`devtools doctor`).
6. `HUMAN_GATE_START` — promoção: merge `release → main`, tag `vX.Y.Z`, dist-tag `latest`.
7. Atualizar `PROJECT_STATUS.md` e HANDOFF.

## Rollback
- npm: `npm dist-tag add devtools-ai-suite@<versão-anterior> latest` (nunca `unpublish` sem gate).
- git: reverter via PR em `release`; nunca reescrever histórico de `main`.

Detalhes: `vault/06_INFRASTRUCTURE/DISTRIBUTION.md`.
