// Roda antes de `pnpm pack`/`npm publish`: recusa empacotar um build incompleto ou de
// desenvolvimento e coloca a licença do repositório dentro do pacote.
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";

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
// O build de desenvolvimento do Angular (watcher) gera source maps e carrega `main.js` sem hash.
const maps = readdirSync(publicDir, { recursive: true }).filter((file) => String(file).endsWith(".map"));
const unhashed = /src="main\.js"/.test(readFileSync(new URL("index.html", publicDir), "utf8"));
if (maps.length > 0 || unhashed) {
  fail(
    "dist/public é o build de desenvolvimento do dashboard (source maps ou main.js sem hash). Use `scripts/release-pack.sh`.",
  );
}

copyFileSync(new URL("../../../LICENSE", import.meta.url), new URL("../LICENSE", import.meta.url));
console.log("[prepack] build de produção conferido; LICENSE incluída");
