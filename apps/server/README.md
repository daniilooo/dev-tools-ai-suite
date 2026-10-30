# Dev Tools AI Suite

Ambiente local para desenvolvimento assistido por IA. Reúne terminal, Claude Code, Codex, monitor de agentes, cotas de uso e busca no código num dashboard que roda só na sua máquina.

- **Terminal real no navegador**, no diretório de cada projeto, inclusive para aplicações interativas.
- **Claude Code e Codex** abertos pela suíte, no projeto certo, com o login feito pelos comandos oficiais de cada um.
- **Monitor de agentes:** sessões, subagentes, ferramentas e tokens, lidos das transcrições locais. Só metadados: nenhum prompt, código ou resposta é guardado.
- **Cotas:** uso e renovação informados pelos próprios provedores, com fonte e frescor. Sem dado verificável, aparece **INDISPONÍVEL** com o motivo; nada é estimado.
- **Conhecimento:** índice local do projeto com respostas citando arquivo e linhas. Busca semântica (Ollama local ou Transformers.js) e grafo de código (Graphify) são opcionais.

## Requisitos

- Linux (x64, glibc) e Node.js 22.22.3 ou superior.
- `git`.
- Opcionais: Claude Code, Codex CLI, Ollama, Graphify. Sem eles a suíte funciona e mostra o que falta.

Não precisa de compilador: os módulos nativos vêm prontos.

## Instalar e usar

```bash
npm install -g devtools-ai-suite@next
devtools start      # sobe em 127.0.0.1:4317 e abre o dashboard já autenticado
devtools doctor     # diagnóstico da instalação e das ferramentas
```

Se o navegador não abrir, acesse `http://127.0.0.1:4317` e digite o código curto mostrado no terminal (uso único, expira em 60 s). Rodar `devtools start` de novo com a suíte no ar só gera outro código.

Opções: `--port`, `--data-dir`, `--no-open`. Variáveis de ambiente, dados, backup e problemas comuns: [guia de operação](https://github.com/daniilooo/dev-tools-ai-suite/blob/main/vault/09_OPERATIONS/OPERATIONS.md).

## Segurança e privacidade

- Escuta só em `127.0.0.1`; cada acesso exige sessão local (código de uso único → cookie `HttpOnly`), com proteção de Host, Origin e CSRF.
- Não lê, copia nem transmite credenciais de Claude, Codex ou outros provedores.
- Nada é gravado dentro dos seus projetos. Os dados ficam em `~/.dev-tools-ai-suite/` (0700, arquivos sensíveis 0600).
- Código não sai da máquina: o Ollama precisa ser local, e o modelo do Transformers.js só é baixado depois da sua confirmação.

## Atualizar e remover

```bash
npm install -g devtools-ai-suite@next   # migrações do banco rodam sozinhas
npm uninstall -g devtools-ai-suite      # os dados ficam até você apagar ~/.dev-tools-ai-suite
```

Esta é uma versão de pré-lançamento (`next`) do MVP. Código-fonte, arquitetura e decisões: [github.com/daniilooo/dev-tools-ai-suite](https://github.com/daniilooo/dev-tools-ai-suite). Licença Apache-2.0.
