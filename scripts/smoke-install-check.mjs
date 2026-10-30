// Jornada pela API da suíte recém-instalada (roda dentro do contêiner de scripts/smoke-install.sh).
// Sem dependências: só Node. Roda todas as verificações e sai com código 1 se alguma falhar.
import { spawn, execFileSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, relative } from "node:path";

const BASE = "http://127.0.0.1:4317";
const DATA = join(homedir(), ".dev-tools-ai-suite");
const PROJECT = join(homedir(), "loja");
let failures = 0;

function check(label, ok, detail = "") {
  console.log(`  ${ok ? "✔" : "✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Projeto Angular + Spring Boot mínimo, com segredo que não pode ser indexado. */
function createProject() {
  const files = {
    "package.json": JSON.stringify({ name: "loja-web", dependencies: { "@angular/core": "22.0.0" } }),
    "angular.json": "{}",
    "src/app/preco.service.ts":
      "export class PrecoService {\n  calcularDesconto(valor: number): number {\n    return valor * 0.9;\n  }\n}\n",
    "backend/pom.xml":
      "<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent></project>",
    "backend/src/main/java/loja/PrecoController.java": "class PrecoController { /* calcularDesconto */ }\n",
    ".env": `API_KEY=${randomBytes(24).toString("hex")}\n`,
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(PROJECT, path, ".."), { recursive: true });
    writeFileSync(join(PROJECT, path), body);
  }
  execFileSync("git", ["init", "-q", PROJECT]);
}

/** Hash de todos os arquivos do projeto (menos `.git`): a suíte não pode alterar nada (INV-05). */
function snapshot(dir = PROJECT, out = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) snapshot(full, out);
    else out[relative(PROJECT, full)] = createHash("sha256").update(readFileSync(full)).digest("hex");
  }
  return out;
}

async function startServer() {
  const child = spawn("devtools", ["start", "--no-open"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`servidor não subiu:\n${output}`)), 30_000);
    const onData = (chunk) => {
      output += chunk;
      const match = /Código de acesso[^:]*: (\S+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (status) => reject(new Error(`servidor saiu (${status}):\n${output}`)));
  });
  return { child, code };
}

async function stopServer(child) {
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGINT");
  await exited;
}

/** Mesmo formato de apps/server/src/core/cli-auth.ts. */
function cliHeaders() {
  const secret = readFileSync(join(DATA, "secret"), "utf8").trim();
  const payload = `${Date.now()}.${randomBytes(16).toString("base64url")}`;
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`cli:${payload}`)
    .digest("base64url");
  return { authorization: `DevtoolsCli ${payload}.${signature}` };
}

async function api(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    // Sem corpo, sem content-type: o Fastify recusa JSON vazio.
    headers: body === undefined ? cliHeaders() : { ...cliHeaders(), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = response.status === 204 ? null : await response.json();
  if (response.status >= 400)
    console.log(`    ${method} ${path} → ${response.status} ${JSON.stringify(json)}`);
  return { status: response.status, json };
}

async function waitIndexed(id) {
  for (let i = 0; i < 60; i++) {
    const { json } = await api("GET", `/api/v1/projects/${id}/knowledge`);
    if (json.state !== "indexing") return json;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("indexação não terminou em 30 s");
}

async function main() {
  console.log("\n== Jornada pela API");
  createProject();
  const before = snapshot();

  const report = JSON.parse(execFileSync("devtools", ["doctor", "--json"], { encoding: "utf8" }));
  for (const c of report.checks) check(`doctor: ${c.label}`, c.status === "ok", c.detail);

  // sqlite-vec só carrega quando a busca semântica é ligada: confere o binário pronto já aqui.
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  const require = createRequire(join(globalRoot, "devtools-ai-suite", "package.json"));
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  require("sqlite-vec").load(db);
  const { v } = db.prepare("SELECT vec_version() AS v").get();
  db.close();
  check("sqlite-vec carrega no better-sqlite3 instalado", typeof v === "string", v);

  let { child, code } = await startServer();
  check("servidor escuta e imprime o código de acesso", true);

  // Dashboard: HTML, estilos e 404 para arquivo inexistente.
  const page = await fetch(BASE + "/");
  const html = await page.text();
  check("GET / devolve o dashboard", page.status === 200 && html.includes("<dt-root"));
  const css = /href="(styles-[^"]+\.css)"/.exec(html)?.[1];
  const style = css ? await fetch(`${BASE}/${css}`) : null;
  check(
    "folha de estilos servida como CSS",
    style?.headers.get("content-type")?.includes("text/css") ?? false,
    css,
  );
  check("arquivo inexistente é 404", (await fetch(BASE + "/nao-existe.js")).status === 404);
  check("API sem sessão é 401", (await fetch(BASE + "/api/v1/projects")).status === 401);

  // Login do navegador: código de uso único → cookie de sessão HttpOnly.
  const exchange = await fetch(BASE + "/api/v1/session/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const cookie = exchange.headers.get("set-cookie") ?? "";
  check("código de acesso vira sessão HttpOnly", exchange.status === 200 && /HttpOnly/i.test(cookie));
  const reuse = await fetch(BASE + "/api/v1/session/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  check("código de acesso não é reutilizável", reuse.status === 401);

  // Projeto, stack e conhecimento.
  const created = await api("POST", "/api/v1/projects", { path: PROJECT, name: "loja" });
  const project = created.json;
  check("projeto cadastrado", created.status === 201, project.detectedStack?.join(", "));
  for (const stack of ["angular", "java-maven", "spring-boot"]) {
    check(`stack detectada: ${stack}`, project.detectedStack?.includes(stack));
  }
  await api("POST", `/api/v1/projects/${project.id}/knowledge/index`);
  const status = await waitIndexed(project.id);
  check(
    "projeto indexado",
    status.state === "indexed",
    `${status.state}: ${status.files} arquivos, ${status.chunks} trechos${status.error ? ` (${status.error})` : ""}`,
  );
  const query = await api("POST", `/api/v1/projects/${project.id}/knowledge/query`, {
    query: "calcularDesconto",
  });
  const hit = query.json.hits?.find((h) => h.filePath === "src/app/preco.service.ts");
  check(
    "consulta cita arquivo e linhas",
    hit?.lineStart === 1 && hit?.lineEnd >= 2,
    hit && `${hit.filePath}:${hit.lineStart}`,
  );
  check(".env fora do índice", !query.json.hits?.some((h) => h.filePath === ".env"));

  // Reinício: projeto, índice e segredo de instalação continuam.
  const secretBefore = readFileSync(join(DATA, "secret"), "utf8");
  await stopServer(child);
  ({ child } = await startServer());
  const projects = (await api("GET", "/api/v1/projects")).json;
  check(
    "projeto persiste após reinício",
    projects.some((p) => p.id === project.id),
  );
  const again = await api("GET", `/api/v1/projects/${project.id}/knowledge`);
  check("índice persiste após reinício", again.json.state === "indexed", again.json.state);
  check("segredo de instalação mantido", readFileSync(join(DATA, "secret"), "utf8") === secretBefore);
  await stopServer(child);

  // Permissões e projeto intocado.
  const mode = (path) => (statSync(path).mode & 0o777).toString(8);
  check("diretório de dados 0700", mode(DATA) === "700");
  check("segredo 0600", mode(join(DATA, "secret")) === "600");
  check("banco 0600", mode(join(DATA, "devtools.db")) === "600");
  check("projeto do usuário não foi alterado", JSON.stringify(snapshot()) === JSON.stringify(before));

  console.log(failures === 0 ? "\n== Tudo certo." : `\n== ${failures} verificação(ões) falharam.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
