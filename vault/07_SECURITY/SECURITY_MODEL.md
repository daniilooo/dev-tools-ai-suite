---
tags: [seguranca]
---

# Modelo de Segurança e Ameaças

## Ativos
1. Capacidade de executar comandos (PTY) — **crítico**.
2. Código-fonte e documentação dos projetos.
3. Segredo de instalação e sessões.
4. Credenciais dos provedores (a suíte não deve tocar).
5. Histórico de sessões e eventos.

## Ameaças e mitigações
| Ameaça | Mitigação | Referência |
|---|---|---|
| Página web maliciosa chama API local (CSRF) | cookie `SameSite=Strict`, token anti-CSRF, validação de `Origin` | ADR-0007 |
| Cross-site WebSocket hijacking | validação de `Origin` + sessão no upgrade | ADR-0007 |
| DNS rebinding | validação de `Host` contra allowlist local | ADR-0007 |
| Exposição na rede | bind `127.0.0.1`; mudança exige HG-12 | RN-01 |
| Segredo vazado em URL/log/bundle | código efêmero em fragmento; redator de logs | ADR-0007 |
| Outro usuário local lê segredo | arquivo 0600 no home do usuário | RN-01 |
| Injeção de comando em processos externos | `spawn` com array, sem shell | Convenções |
| Vazamento de segredos em transcrições/índices | redator + [[INDEXING_EXCLUSIONS]] | RN-02/RN-04 |
| Envio de código para fora | embeddings locais; externos só com opt-in (HG-13) | INV-04 |
| Leitura de credenciais de provedores | allowlist de caminhos lidos por adapter | INV-02 |
| Elevação de privilégio | sem `sudo`; processos com o usuário atual | G-03 |
| Dependência comprometida | lockfile, `pnpm audit` no CI, revisão de deps nativas (HG-07) | CI |

## Fora de escopo do MVP
Proteção contra malware já executando como o mesmo usuário (equivale a acesso total à conta).

Política de segredos: [[SECRETS_POLICY]].
