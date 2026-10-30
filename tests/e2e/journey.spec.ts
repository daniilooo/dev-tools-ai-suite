import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { FIXTURE_SECRET } from "../../apps/server/test/agent-fixtures";
import { FAKE_EMBED_MODEL, fakeGraphifyBin, startFakeOllama } from "./support/fake-knowledge";
import { fakeProvidersEnv } from "./support/fake-providers";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4422;
let server: RunningServer;
let ollama: Awaited<ReturnType<typeof startFakeOllama>>;
let env: NodeJS.ProcessEnv;
/** Durante o reinício proposital do servidor, a reconexão do `/ws/events` é recusada: esperado. */
let restarting = false;

test.beforeAll(async () => {
  ollama = await startFakeOllama();
  env = {
    ...fakeProvidersEnv(),
    DEVTOOLS_OLLAMA_URL: ollama.url,
    DEVTOOLS_OLLAMA_EMBED_MODEL: FAKE_EMBED_MODEL,
    DEVTOOLS_GRAPHIFY_BIN: fakeGraphifyBin(),
  };
  server = await startServer(PORT, undefined, env);
});
test.afterAll(async () => {
  await server?.stop();
  await ollama?.stop();
});

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (restarting && /ERR_CONNECTION_REFUSED/.test(message.text())) return;
    problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  (page as unknown as { __problems: string[] }).__problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __problems: string[] }).__problems).toEqual([]);
});

/** Projeto guarda-chuva como os reais: Angular em `frontend/`, Spring Boot em `backend/`. */
function umbrellaProject(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-journey-")));
  const files: Record<string, string> = {
    "frontend/package.json": JSON.stringify({ dependencies: { "@angular/core": "22.0.0" } }),
    "frontend/angular.json": "{}",
    "frontend/src/app/preco.service.ts":
      "export class PrecoService {\n  calcularDesconto(valor: number) {\n    return valor * 0.9;\n  }\n}\n",
    "backend/pom.xml": "<parent><artifactId>spring-boot-starter-parent</artifactId></parent>",
    "backend/src/main/java/loja/PrecoController.java": "class PrecoController {}\n",
    ".env": `TOKEN=${FIXTURE_SECRET}\n`,
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  execFileSync("git", ["-C", dir, "init", "-q"]);
  return dir;
}

/** Conteúdo de todos os arquivos do projeto (menos `.git`): a suíte não pode alterá-los (INV-05). */
function snapshot(root: string, dir = root, out: Record<string, string> = {}): Record<string, string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) snapshot(root, full, out);
    else out[relative(root, full)] = createHash("sha256").update(readFileSync(full)).digest("hex");
  }
  return out;
}

const visibleRows = (page: Page) => page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows');

test("jornada completa sem terminal externo: projeto, terminal, Claude, agentes, cotas e conhecimento", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const dir = umbrellaProject();
  const before = snapshot(dir);

  // 1. Abre pelo link do `devtools start` e cadastra o projeto: stack achada nas subpastas.
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill("loja");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  const item = page.getByRole("listitem").filter({ hasText: "loja" });
  await expect(item.getByText("Angular")).toBeVisible();
  await expect(item.getByText("Spring Boot")).toBeVisible();

  // 2. Terminal real no diretório do projeto.
  await page.getByRole("link", { name: "loja" }).click();
  await page.getByRole("link", { name: "Abrir terminal" }).click();
  await expect(page.getByRole("tab", { name: "Terminal 1" })).toBeVisible();
  await page.locator('[role="tabpanel"]:not(.invisible) .xterm').click();
  await page.keyboard.type("ls backend; git rev-parse --is-inside-work-tree");
  await page.keyboard.press("Enter");
  await expect(visibleRows(page)).toContainText("pom.xml");
  await expect(visibleRows(page)).toContainText("true");

  // 3. Claude Code aberto pela suíte, no mesmo projeto.
  await page.getByRole("button", { name: "Abrir Claude Code neste projeto" }).click();
  await expect(visibleRows(page)).toContainText("claude-falso-interativo");

  // 4. Agent Monitor acha a sessão aberta pela suíte e leva de volta ao terminal dela.
  await page.getByRole("link", { name: "Agentes" }).click();
  await page.locator("select").selectOption({ label: "loja" });
  const run = page.locator("article").first();
  await expect(run).toContainText("Claude Code", { timeout: 10_000 });
  await expect(run.getByRole("link", { name: "Ver terminal" })).toBeVisible();

  // 5. Cotas: a status line da suíte trouxe o uso do Claude, com fonte.
  await expect(page.getByTestId("quota-summary")).toContainText("61%", { timeout: 15_000 });
  await page.getByRole("link", { name: "Cotas", exact: true }).click();
  const claude = page.getByRole("article", { name: "Claude Code" });
  await expect(claude.getByRole("listitem", { name: "Janela de 5 h" })).toContainText("23,5% usado");
  await expect(claude).toContainText("Fonte: nível A — status line do Claude Code");

  // 6. Conhecimento: índice local e consulta com arquivo e linhas, sem o segredo do .env.
  await page.getByRole("link", { name: "Conhecimento", exact: true }).click();
  await page.getByRole("combobox").first().selectOption({ label: "loja" });
  await page.getByRole("button", { name: "Indexar projeto" }).click();
  await expect(page.getByTestId("index-state")).toHaveText("indexado", { timeout: 15_000 });
  await page.getByLabel("Consulta").fill("calcularDesconto");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("knowledge-hit").first()).toContainText(
    "frontend/src/app/preco.service.ts:1–5",
  );
  await expect(page.locator("main")).not.toContainText(FIXTURE_SECRET);

  // 7. Diagnóstico da instalação.
  await page.getByRole("link", { name: "Diagnóstico" }).click();
  await expect(page.getByText("Banco SQLite")).toBeVisible();
  await expect(page.getByText("Graphify")).toBeVisible();

  // 8. Reinício do servidor: sessão, projeto e índice continuam.
  restarting = true;
  await server.stop();
  server = await startServer(PORT, server.dataDir, env);
  await page.getByRole("link", { name: "Conhecimento", exact: true }).click();
  await page.getByRole("combobox").first().selectOption({ label: "loja" });
  await expect(page.getByTestId("index-state")).toHaveText("indexado");
  restarting = false;

  // Nada no projeto do usuário mudou durante toda a jornada.
  expect(snapshot(dir)).toEqual(before);
});
