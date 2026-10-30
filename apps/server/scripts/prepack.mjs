// Roda antes de `pnpm pack`/`npm publish`: recusa empacotar um build incompleto ou de
// desenvolvimento e coloca a licença do repositório dentro do pacote.
import { copyFileSync, existsSync, readdirSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const publicDir = new URL("public/", dist);

function fail(message) {
  console.error(`[prepack] ${message}`);
  process.exit(1);
}

if (!existsSync(new URL("cli.js", dist))) fail("dist/cli.js ausente. Rode `pnpm build` na raiz.");
if (!existsSync(new URL("index.html", publicDir))) {
  fail("dashboard ausente em dist/public. Rode `pnpm build` na raiz (não só o do servidor).");
}
// O build de produção do Angular não gera source maps; o de desenvolvimento (watcher) gera.
const maps = readdirSync(publicDir, { recursive: true }).filter((file) => String(file).endsWith(".map"));
if (maps.length > 0) {
  fail(
    "dist/public tem source maps: é o build de desenvolvimento do dashboard. Use `scripts/release-pack.sh`.",
  );
}

copyFileSync(new URL("../../../LICENSE", import.meta.url), new URL("../LICENSE", import.meta.url));
console.log("[prepack] build de produção conferido; LICENSE incluída");
