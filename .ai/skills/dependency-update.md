# Skill: dependency-update

1. Listar desatualizadas: `pnpm outdated`. Verificar vulnerabilidades: `pnpm audit`.
2. Atualizar em lotes pequenos, por grupo (ex.: Angular, Fastify, tooling).
3. Ler changelog de majors; nunca atualizar major sem plano.
4. Rodar typecheck, testes e build.
5. Dependência **nativa** nova ou substituída (ex.: `node-pty`, `sqlite-vec`, `onnxruntime`) → gate humano.
6. Commit: `build(deps): atualiza <grupo>`.
