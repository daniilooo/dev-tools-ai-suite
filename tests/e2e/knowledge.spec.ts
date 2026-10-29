import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_SECRET } from "../../apps/server/test/agent-fixtures";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4420;
let server: RunningServer;

test.beforeAll(async () => {
  server = await startServer(PORT);
});
test.afterAll(async () => server?.stop());

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
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-know-")));
  execFileSync("git", ["-C", dir, "init", "-q"]);
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "src", "reserva.service.ts"),
    "export class ReservaService {\n  agendarRecorrencia() {\n    return true;\n  }\n}\n",
  );
  writeFileSync(join(dir, ".env"), `TOKEN=${FIXTURE_SECRET}\nsegredoDoAmbiente=1\n`);

  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill("proj-conhecimento");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await expect(page.getByRole("link", { name: "proj-conhecimento" })).toBeVisible();

  await page.getByRole("link", { name: "Conhecimento", exact: true }).click();
  await expect(page.getByTestId("index-state")).toHaveText("não indexado");
  await expect(page.getByText("Busca semântica INDISPONÍVEL")).toBeVisible();
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
