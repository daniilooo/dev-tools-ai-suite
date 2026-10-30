# apps/web — dashboard

Angular 22 com componentes standalone, signals e OnPush, além de TypeScript strict e Tailwind CSS 4. O tema escuro é o padrão e há tema claro.

```text
src/app/
├── core/        AuthService (código #code → cookie HttpOnly), interceptor anti-CSRF, ApiService, tema
├── layout/      shell com navegação (itens das próximas fases desabilitados)
└── features/
    ├── access/  digitação do código curto
    ├── projects/ lista, cadastro, detalhe e detecção de stack
    └── system/  diagnóstico (doctor)
```

- O token anti-CSRF fica **apenas em memória**. O cookie de sessão é HttpOnly.
- **Design tokens:** variáveis CSS em `src/styles.css`, mapeadas para o Tailwind via `@theme inline`.
- `inlineCritical` fica desligado no build de produção para manter a CSP sem scripts inline.
- **Comandos:** `pnpm build`, `pnpm watch`, `pnpm test` (Vitest) e `pnpm typecheck`.

O dashboard é servido pelo `apps/server` em `127.0.0.1`. Não há dev server separado, porque Host e Origin são validados.
