---
id: ADR-0015
titulo: Suporte nativo ao Windows x64
status: Proposto (aceito com o merge do PR da Fase 10)
data: 2026-11-05
decisores: humano (escopo, shell, arquitetura e homologação — D-28), LLM (proposta)
tags: [adr, plataforma, windows]
---

# ADR-0015 — Suporte nativo ao Windows x64

## Contexto
O MVP foi homologado só em Linux ([[ADR-0008-distribuicao-npm]], [[DISTRIBUTION]]), com Windows e macOS "considerados" na arquitetura. As dependências nativas já trazem binários para `win32-x64` (`@lydell/node-pty`, `better-sqlite3`, `sqlite-vec` — [[ADR-0012-dependencias-nativas]]), e parte do código já tinha ramos para `win32` (navegador, `taskkill`, permissões). Uma revisão encontrou pontos que impediam o uso real no Windows:
- O Claude Code e o Codex instalados pelo npm são shims `.cmd`. O `spawn` sem shell não os encontra, e o Node recusa executar `.cmd` sem shell. Os dois apareceriam como "não instalados".
- O comando digitado no terminal (`claude --settings '…'`) e a status line usavam aspas POSIX.
- `taskkill /T` na raiz de um terminal que já saiu podia atingir outro processo que reaproveitou o PID.
- As transcrições comparavam caminhos com `===`, e no Windows os caminhos não distinguem maiúsculas. Um caminho em outro drive escapava da verificação da allowlist.
- `cmd /c start` quebra URLs que contêm `&`.
- Os testes usavam binários falsos em `sh`, e o CI rodava só em Linux.

## Decisão
1. **Escopo:** Windows **nativo**, só **x64** (D-28). A suíte enxerga o Claude e o Codex instalados no Windows. O WSL2 fica documentado como alternativa: dentro dele a suíte é Linux.
2. **Diferenças de plataforma concentradas em `apps/server/src/core/platform.ts`:**
   - `findExecutable`: busca no `PATH` com as extensões do `PATHEXT` e ignora `.ps1`.
   - `batchCommandLine`: executa `.cmd`/`.bat` via `cmd.exe /d /s /c`. Recusa argumentos com metacaracteres do cmd (`" % ! ^ & | < >`, quebras de linha), então não há injeção. Os argumentos são sempre montados pelo servidor.
   - `samePath`/`isPathWithin`: comparam sem distinguir maiúsculas nem `/` e `\`.
   - `relativeInside`/`escapesBase`: tratam outro drive como fora da base.
   - `quoteForTerminal`: aplica as aspas do shell dos terminais.
3. **Terminal:** o shell no Windows é sempre o **PowerShell**: o `pwsh` 7 se estiver no PATH, senão o Windows PowerShell 5.1 do sistema. O lançamento do Claude e do Codex chama o executável pelo caminho resolvido (`& 'C:\…\claude.cmd' …`), para não cair no shim `.ps1`, que a política de execução padrão bloqueia.
4. **Status line do Claude:** quem executa o comando é o próprio Claude Code, que no Windows usa o Git Bash (ou o cmd). Por isso o comando vai com aspas duplas e `/`, formato aceito pelos dois. Caminhos do Windows não contêm `"`.
5. **Encerrar processos:** `taskkill /T /F` apenas quando a raiz ainda é o processo da suíte. Se o shell já saiu, nada é encerrado e o ConPTY fecha o console.
6. **Permissões:** no Windows, `chmod` não tem efeito. O diretório de dados fica em `%USERPROFILE%\.dev-tools-ai-suite`, protegido pela ACL do perfil, que dá acesso só ao usuário, ao SYSTEM e aos administradores. O `doctor` não cobra 0700/0600 no Windows.
7. **Navegador:** usa `rundll32 url.dll,FileProtocolHandler <url>`, sem shell.
8. **Qualidade:**
   - Novo job **"Validação (Windows)"** no CI (`windows-2025`): testes, build, E2E e instalação limpa do `.tgz` (`scripts/smoke-install.ps1`), com a mesma jornada pela API do Linux.
   - Os provedores falsos dos testes passam a ser um script Node chamado por um shim `sh` ou `.cmd`, o mesmo formato do npm.
   - `.gitattributes` fixa LF.
   - A homologação manual (terminal interativo, Claude, Codex e cotas) é feita pelo humano numa máquina Windows.

## Consequências
- \+ Instalação com `npm install -g devtools-ai-suite` também no Windows, sem compilador.
- \+ Um só lugar concentra as regras de plataforma, com testes unitários que simulam o Windows no Linux.
- − O CI fica mais longo (job paralelo).
- − Itens que só a homologação manual confirma:
  - a execução da status line pelo Claude Code no Windows (o Git Bash é necessário para o Claude);
  - a digitação antecipada no ConPTY e no PowerShell.
- − No Windows, filhos que se desligaram do console não são encerrados ao fechar a aba (equivalente ao `setsid` no Linux).
- **Fora do escopo:** Windows arm64, macOS e instalador `.msi`. Continuam em [[POST_MVP_BACKLOG]].
