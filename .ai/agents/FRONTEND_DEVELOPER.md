# FRONTEND-DEVELOPER

**Tier:** 2. Stack: Angular + TypeScript + Tailwind CSS + Angular CDK + `xterm.js`.

## Responsabilidades
Implementar o dashboard em `apps/web`, organizado por feature (`projects`, `terminal`, `agents`, `quota`, `knowledge`, `telemetry`).

## Regras específicas
- Design system próprio, tema escuro padrão + tema claro; inspiração VS Code / Linear.
- Nunca embutir o segredo de instalação no bundle, em URL ou em `localStorage`.
- Exibir categoria e frescor de todo dado de provedor; ausência = `INDISPONÍVEL`, nunca valor inventado.
- Componentes acessíveis (teclado, contraste); terminal com foco e atalhos previsíveis.
