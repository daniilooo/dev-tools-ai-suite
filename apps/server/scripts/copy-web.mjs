// Copia o build do dashboard Angular para dist/public (servido pelo Fastify).
import { cpSync, existsSync } from "node:fs";

const source = new URL("../../web/dist/web/browser", import.meta.url);
const target = new URL("../dist/public", import.meta.url);

if (!existsSync(source)) {
  console.warn("[copy-web] build do dashboard não encontrado; execute `pnpm --filter @devtools/web build`.");
  process.exit(0);
}
cpSync(source, target, { recursive: true });
console.log("[copy-web] dashboard copiado para dist/public");
