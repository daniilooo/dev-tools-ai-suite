# DEPLOY / RELEASE

**Toda etapa deste fluxo exige gate humano.** Responsáveis: DevOps + Reporter.

## Fluxo (D-26: GitHub Release; registro npm quando houver conta)
1. Confirmar que `release` está verde no CI.
2. Atualizar `CHANGELOG.md`, `vault/12_RELEASES/RELEASES.md` e a versão em `apps/server/package.json`.
3. Merge `release → main` (HG-01, pelo humano).
4. `scripts/release-pack.sh <saída>` em `main`: worktree limpo → build → `.tgz` → instalação limpa; anotar o SHA-256.
5. `HUMAN_GATE_START` (HG-02) — apresentar versão, mudanças, riscos e rollback.
6. Após aprovação: tag `vX.Y.Z` em `main` e GitHub **pré-release** com o `.tgz` e as notas (`gh release create … --prerelease`).
7. Validar a instalação pela URL num ambiente limpo: `scripts/smoke-install.sh <URL do .tgz>`.
8. Marcar a release como estável (`gh release edit vX.Y.Z --prerelease=false --latest`).
9. Atualizar `PROJECT_STATUS.md` e HANDOFF.

## Rollback
- Release com problema: voltar a marcar como pré-release (`gh release edit … --prerelease`) e publicar a correção como nova versão PATCH; nunca substituir o `.tgz` de uma versão já publicada.
- git: reverter via PR em `release`; nunca reescrever histórico de `main` nem mover tags.

Detalhes: `vault/06_INFRASTRUCTURE/DISTRIBUTION.md`.
