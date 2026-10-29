import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4412;
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

async function openProjectTerminal(page: Page, name: string): Promise<string> {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-term-")));
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill(name);
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await page.getByRole("link", { name }).click();
  await page.getByRole("link", { name: "Abrir terminal" }).click();
  await expect(page.getByRole("tab", { name: "Terminal 1" })).toBeVisible();
  return dir;
}

async function typeCommand(page: Page, command: string): Promise<void> {
  const terminal = page.locator('[role="tabpanel"]:not(.invisible) .xterm');
  await terminal.click();
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
}

const visibleRows = (page: Page) => page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows');

test("terminal executa no diretório do projeto e sobrevive ao recarregar a página", async ({ page }) => {
  const dir = await openProjectTerminal(page, "proj-terminal");

  await typeCommand(page, "echo e2e-$((6*7)); pwd");
  await expect(visibleRows(page)).toContainText("e2e-42");
  await expect(visibleRows(page)).toContainText(dir);

  // Recarregar reconecta à mesma sessão e recebe a saída recente.
  await page.reload();
  await expect(page.getByRole("tab", { name: "Terminal 1" })).toBeVisible();
  await expect(visibleRows(page)).toContainText("e2e-42");
  await typeCommand(page, "echo depois-do-reload");
  await expect(visibleRows(page)).toContainText("depois-do-reload");
});

test("abas: abrir um segundo terminal e encerrar com confirmação", async ({ page }) => {
  await openProjectTerminal(page, "proj-abas");
  await typeCommand(page, "echo primeira-aba");
  await expect(visibleRows(page)).toContainText("primeira-aba");

  await page.getByRole("button", { name: "Novo terminal" }).click();
  const second = page.getByRole("tab", { name: "Terminal 2" });
  await expect(second).toHaveAttribute("aria-selected", "true");
  await typeCommand(page, "echo segunda-aba");
  await expect(visibleRows(page)).toContainText("segunda-aba");
  await expect(visibleRows(page)).not.toContainText("primeira-aba");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Fechar Terminal 2" }).click();
  await expect(second).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Terminal 1" })).toHaveAttribute("aria-selected", "true");
  await expect(visibleRows(page)).toContainText("primeira-aba");
});
