# REVISÃO

Responsável: Reviewer (+ Security Engineer em mudanças sensíveis).

## Entrada mínima (não enviar mais que isso)
- Diff (`git diff release...HEAD`).
- Objetivo e critérios de aceite.
- Trechos relevantes de arquitetura/regras.
- Resultado dos testes.

## Procurar
Bugs · regressões · violação de limites de módulo · violação de invariantes · segurança (auth, Origin, PTY, segredos, injeção de comando) · complexidade desnecessária · duplicação · testes ausentes · comportamento inesperado em falha de provedor.

## Saída
Achados classificados: `bloqueante`, `importante`, `sugestão`. Bloqueantes impedem merge em `release`.
