# Skill: release

Fluxo completo em `.ai/workflow/DEPLOY.md`. **Cada passo de publicação exige gate humano.**

1. Verificar CI verde em `release`.
2. Propor versão SemVer (pré-1.0: `0.MINOR.PATCH`; pré-lançamento `0.1.0-next.N`).
3. Gerar notas de release a partir dos commits desde a última tag.
4. `HUMAN_GATE_START` → aguardar aprovação explícita.
5. Publicar com `--tag next`; validar instalação limpa com `devtools doctor`.
6. Novo gate → merge `release → main`, tag, promoção para `latest`.
7. Atualizar `vault/12_RELEASES/RELEASES.md`, `PROJECT_STATUS.md` e HANDOFF.
