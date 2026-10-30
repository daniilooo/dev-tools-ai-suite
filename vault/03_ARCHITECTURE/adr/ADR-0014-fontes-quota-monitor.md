---
id: ADR-0014
titulo: Fontes do Quota Monitor — status line da suíte no Claude Code e sessões locais do Codex
status: Proposto (aceito com o merge do PR da Fase 6)
data: 2026-10-29
decisores: humano (escolha da fonte do Claude no spike S-05), LLM (proposta)
tags: [adr, integracoes, cotas]
---

# ADR-0014 — Fontes do Quota Monitor

## Contexto
O spike S-05 ([[TECHNICAL_SPIKES]]) procurou fontes permitidas (RN-03) de uso e limites nos planos de assinatura:
- **Codex — sessões locais (nível B):** cada `token_count` do rollout (`~/.codex/sessions/AAAA/MM/DD/rollout-*.jsonl`) traz `rate_limits`, com o percentual usado, a duração e a renovação (`resets_at`, segundos Unix) das janelas primária (5 h) e secundária (7 dias), além do `plan_type`. Os valores vêm do serviço; o Codex só os registra.
- **Claude Code — status line (nível A):** a entrada JSON documentada da status line traz `rate_limits.five_hour` e `rate_limits.seven_day`, cada um com `used_percentage` e `resets_at`, nos planos Pro/Max. Só chega a um comando de status line configurado.
- **Claude Code — transcrições (nível B):** registram limites apenas quando uma resposta é recusada (`quotaLimits.status = "rejected"`, com `rateLimitType` e `resetsAt`).
- Sem comando oficial não interativo de uso (`/usage` só existe no modo interativo). Página de conta e APIs privadas são proibidas (RN-03).

## Decisão
1. **Claude Code:** ao abrir o Claude pela suíte, o comando fixo ganha `--settings <dados>/quota/claude-settings.json` (flag oficial). Esse arquivo, gerado pela suíte com permissão 0600, contém só `statusLine`, apontando para o script `statusline.js` da própria suíte. O script recebe a entrada da status line, grava **somente** `rate_limits` em `<dados>/quota/claude-statusline.json` (0600, gravação atômica) e imprime uma linha curta (`Opus 5.5 · 5 h: 24% · semana: 61%`). Nenhum arquivo do Claude Code é criado ou alterado (INV-05); vale apenas para sessões abertas pela suíte. Escolha do humano no spike S-05 (D-15).
2. Sessões do Claude abertas fora da suíte só aparecem quando o limite é atingido (registro `quotaLimits` nas transcrições).
3. **Codex:** último `rate_limits` com janelas preenchidas nas sessões dos últimos 8 dias. Registros sem janelas (ex.: `limit_id: "premium"` com valores nulos) são ignorados.
4. Leitura só do **último 1 MiB** de cada arquivo da allowlist, refeita quando tamanho ou data mudam. Um limite atingido que ainda importa é sempre recente, porque depois dele a sessão fica bloqueada até a renovação.
5. Todo valor tem categoria `oficial` (informado pelo provedor), fonte com nível, horário da medida e frescor: `atualizado` (≤ 15 min), `pode ter mudado` (> 15 min) ou `janela renovada` (a renovação passou depois da medida; o percentual antigo não é mostrado). Sem leitura, o resultado é `INDISPONÍVEL` com motivo (INV-03).
6. As leituras não são persistidas no banco: elas são recalculadas a cada 5 s a partir das fontes, que já ficam em disco (D-16). As mudanças são avisadas por `quota.updated` em `/ws/events`.
7. `DEVTOOLS_CLAUDE_STATUSLINE=off` desliga a status line (o lançamento volta a ser só `claude --session-id <uuid>`).

## Consequências
- + Percentual e renovação reais do Claude Code (nível A) e do Codex (nível B), sem tocar em credenciais, sem APIs privadas e sem alterar configurações do usuário.
- + Planos com chave de API, que não têm essas janelas, aparecem como `INDISPONÍVEL` com o motivo.
- − Nas sessões abertas pela suíte, a status line da suíte substitui uma status line própria do usuário (TD-15). Pode ser desligada.
- − O Codex só atualiza os limites quando recebe uma resposta do serviço; fora disso, a leitura envelhece (`pode ter mudado`).
- − Formatos nível B mudam entre versões: fixtures de contrato (Codex 0.165.0, Claude Code 2.1.312) e parsers tolerantes.
