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
| Cross-site WebSocket hijacking | `Origin` **obrigatória** e igual à da suíte + cookie de sessão no upgrade; token do CLI não abre WS; conexão fecha quando a sessão expira | ADR-0007 |
| DNS rebinding | validação de `Host` contra allowlist local | ADR-0007 |
| Exposição na rede | bind `127.0.0.1`; mudança exige HG-12 | RN-01 |
| Segredo vazado em URL/log/bundle | código efêmero em fragmento; redator de logs | ADR-0007 |
| Outro usuário local lê segredo | arquivo 0600 no home do usuário | RN-01 |
| Injeção de comando em processos externos | `spawn` com array, sem shell | Convenções |
| Vazamento de segredos em transcrições/índices | redator + [[INDEXING_EXCLUSIONS]] | RN-02/RN-04 |
| Envio de código para fora | embeddings locais; externos só com opt-in (HG-13) | INV-04 |
| Leitura de credenciais de provedores | adapters só executam comandos oficiais; `fs` bloqueado por lint no módulo `integrations`; teste com arquivos-isca e allowlist de comandos | INV-02 |
| Leitura indevida de arquivos pelo Agent Monitor | allowlist de padrões de transcrição/sessão relativa às raízes; links simbólicos recusados; caminho real dentro da raiz; credenciais e configs nunca casam (teste com arquivos-isca e `..`) | ADR-0013 |
| Conteúdo de conversas persistido | só metadados (horários, modelo, tokens, nomes de ferramentas); títulos e descrições redigidos e truncados; teste garante que prompts, saídas e segredos das fixtures não chegam ao banco | ADR-0013, RN-02 |
| Estado de agente inventado | estado derivado só de eventos com limite de frescor; sem evidência → `unknown` | INV-03 |
| Navegador escolhendo o comando executado | `launch` aceita só ids de provedor; o texto digitado é fixo no servidor | Fase 4 |
| Dados pessoais da conta do provedor | e-mail e organização descartados da saída de `claude auth status` | RN-02 |
| Elevação de privilégio | sem `sudo`; processos com o usuário atual | G-03 |
| Processos do terminal sobrevivendo à sessão | encerramento da árvore (SIGHUP → SIGKILL) ao fechar, ao sair do shell, ao remover projeto e ao desligar o servidor | ADR-0004 |
| Esgotamento de recursos pelo terminal | máximo de 32 terminais, buffer de 256 KiB, mensagem WS ≤ 64 KiB, cliente lento desconectado | Fase 3 |
| Vazamento de configuração da suíte para o shell | variáveis `DEVTOOLS_*` removidas do ambiente do PTY; saída do terminal não vai para logs nem disco | RN-02 |
| Dependência comprometida | lockfile, `pnpm audit` no CI, revisão de deps nativas (HG-07) | CI |

## Fora de escopo do MVP
Proteção contra malware já executando como o mesmo usuário (equivale a acesso total à conta).

Política de segredos: [[SECRETS_POLICY]].
