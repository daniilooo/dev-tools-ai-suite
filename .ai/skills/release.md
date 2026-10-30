# Skill: release

Fluxo completo em `.ai/workflow/DEPLOY.md`. **Cada passo de publicação exige gate humano.**

1. Verificar CI verde em `release`.
2. Propor versão SemVer (pré-1.0: `0.MINOR.PATCH`).
3. Gerar notas de release a partir dos commits desde a última tag (`CHANGELOG.md`).
4. Merge `release → main` pelo humano (HG-01).
5. `scripts/release-pack.sh` em `main`; `HUMAN_GATE_START` (HG-02) → aguardar aprovação explícita.
6. Tag e GitHub pré-release com o `.tgz`; validar com `scripts/smoke-install.sh <URL>`.
7. Marcar como estável; atualizar `vault/12_RELEASES/RELEASES.md`, `PROJECT_STATUS.md` e HANDOFF.

Registro npm (HG-03) só quando houver conta (D-26).
