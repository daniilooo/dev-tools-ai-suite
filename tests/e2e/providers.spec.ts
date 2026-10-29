import { expect, test } from "@playwright/test";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeProvidersEnv } from "./support/fake-providers";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4414;
let server: RunningServer;

test.beforeAll(async () => {
  server = await startServer(PORT, undefined, fakeProvidersEnv());
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

test("tela de provedores mostra versão, login com fonte oficial e Ollama ausente", async ({ page }) => {
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByRole("link", { name: "Provedores" }).click();

  const claude = page.getByRole("article", { name: "Claude Code" });
  await expect(claude).toContainText("v2.1.312");
  await expect(claude).toContainText("versão testada");
  await expect(claude).toContainText("conectado · claude.ai, plano pro");
  await expect(claude).not.toContainText("example.com");

  const codex = page.getByRole("article", { name: "Codex CLI" });
  await expect(codex).toContainText("conectado · ChatGPT");

  const ollama = page.getByRole("article", { name: "Ollama" });
  await expect(ollama).toContainText("não instalado");
});

test("abrir Claude Code e Codex no diretório do projeto", async ({ page }) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-prov-")));
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill("proj-provedores");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await page.getByRole("link", { name: "proj-provedores" }).click();

  await page.getByRole("link", { name: "Abrir Claude Code" }).click();
  await expect(page.getByRole("tab", { name: "Claude 1" })).toHaveAttribute("aria-selected", "true");
  const rows = page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows');
  await expect(rows).toContainText("claude-falso-interativo");
  expect(page.url()).not.toContain("abrir=");

  // Depois que o provedor termina, o usuário continua no shell do projeto.
  await page.locator('[role="tabpanel"]:not(.invisible) .xterm').click();
  await page.keyboard.type("pwd");
  await page.keyboard.press("Enter");
  await expect(rows).toContainText(dir);

  await page.getByRole("button", { name: "Abrir Codex CLI neste projeto" }).click();
  await expect(page.getByRole("tab", { name: "Codex 2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows')).toContainText(
    "codex-falso-interativo",
  );

  // Recarregar não abre outro provedor.
  await page.reload();
  await expect(page.getByRole("tab")).toHaveCount(2);
});
