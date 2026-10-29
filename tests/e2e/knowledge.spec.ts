import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_SECRET } from "../../apps/server/test/agent-fixtures";
import { FAKE_EMBED_MODEL, fakeGraphifyBin, startFakeOllama } from "./support/fake-knowledge";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4420;
let server: RunningServer;
let ollama: Awaited<ReturnType<typeof startFakeOllama>>;

test.beforeAll(async () => {
  // Embeddings e grafo com ferramentas falsas: o E2E não depende do Ollama nem do Graphify da máquina.
  ollama = await startFakeOllama();
  const dataDir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-")));
  server = await startServer(PORT, dataDir, {
    ...process.env,
    CLAUDE_CONFIG_DIR: join(dataDir, "no-claude"),
    CODEX_HOME: join(dataDir, "no-codex"),
    DEVTOOLS_OLLAMA_URL: ollama.url,
    DEVTOOLS_OLLAMA_EMBED_MODEL: FAKE_EMBED_MODEL,
    DEVTOOLS_GRAPHIFY_BIN: fakeGraphifyBin(),
  });
});
test.afterAll(async () => {
  await server?.stop();
  await ollama?.stop();
});

async function addProject(page: Page, name: string): Promise<string> {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-know-")));
  execFileSync("git", ["-C", dir, "init", "-q"]);
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "src", "reserva.service.ts"),
    "export class ReservaService {\n  agendarRecorrencia() {\n    return true;\n  }\n}\n",
  );
  writeFileSync(
    join(dir, "src", "fatura.ts"),
    "// Emissão da fatura mensal do condomínio com multa por atraso\nexport const fatura = 1;\n",
  );
  writeFileSync(join(dir, ".env"), `TOKEN=${FIXTURE_SECRET}\nsegredoDoAmbiente=1\n`);

  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill(name);
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
  await page.getByRole("link", { name: "Conhecimento", exact: true }).click();
  await page.getByRole("combobox").first().selectOption({ label: name });
  return dir;
}

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  (page as unknown as { __problems: string[] }).__problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __problems: string[] }).__problems).toEqual([]);
});

test("indexa o projeto e consulta com arquivo e linhas, sem segredos", async ({ page }) => {
  await addProject(page, "proj-conhecimento");
  await expect(page.getByTestId("index-state")).toHaveText("não indexado");
  await expect(page.getByTestId("semantic-state")).toHaveText("desligada");
  await page.getByRole("button", { name: "Indexar projeto" }).click();
  await expect(page.getByTestId("index-state")).toHaveText("indexado", { timeout: 15_000 });
  await expect(page.getByTestId("skipped")).toContainText("1 sensíveis");

  await page.getByLabel("Consulta").fill("agendarRecorrencia");
  await page.getByRole("button", { name: "Buscar" }).click();
  const hit = page.getByTestId("knowledge-hit").first();
  await expect(hit).toContainText("src/reserva.service.ts:1–5");
  await expect(hit.locator("span.rounded")).toHaveText("agendarRecorrencia");

  await page.getByLabel("Consulta").fill("segredoDoAmbiente");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Nada encontrado")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(FIXTURE_SECRET);

  await page.getByRole("button", { name: "Remover índice" }).click();
  await expect(page.getByTestId("index-state")).toHaveText("não indexado");
});

test("liga a busca semântica e analisa o impacto pelo grafo", async ({ page }) => {
  await addProject(page, "proj-semantico");
  await page.getByRole("button", { name: "Indexar projeto" }).click();
  await expect(page.getByTestId("index-state")).toHaveText("indexado", { timeout: 15_000 });

  // Ollama falso disponível: ligar é uma escolha explícita do humano.
  await expect(page.getByRole("radio", { name: /Ollama/ })).toBeChecked();
  await page.getByRole("button", { name: "Ligar busca semântica" }).click();
  await expect(page.getByTestId("semantic-state")).toHaveText("pronta", { timeout: 15_000 });

  await page.getByLabel("Consulta").fill("multa por atraso na fatura");
  await page.getByLabel("Tipo de busca").selectOption("semantic");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("busca semântica", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("knowledge-hit").first()).toContainText("src/fatura.ts:1–2");

  await page.getByRole("button", { name: "Gerar grafo" }).click();
  await expect(page.getByTestId("graph-state")).toHaveText("gerado", { timeout: 15_000 });
  await page.getByLabel("Símbolo").fill("ReservaService");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByTestId("graph-result")).toContainText("src/reserva.service.ts:1");
  await expect(page.getByTestId("graph-dependent")).toContainText("ReservaController");
  await expect(page.getByTestId("graph-dependent")).toContainText("src/reserva.controller.ts:7");
  await expect(page.getByTestId("graph-impact")).toHaveText([/ReservaController/, /AppModule/]);

  await page.getByRole("button", { name: "Desligar" }).click();
  await expect(page.getByTestId("semantic-state")).toHaveText("desligada");
  await page.getByRole("button", { name: "Remover grafo" }).click();
  await expect(page.getByTestId("graph-state")).toHaveText("não gerado");
});
