import { expect, test } from "@playwright/test";
import { appendFileSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_SECRET, installAgentFixtures } from "../../apps/server/test/agent-fixtures";
import { fakeProvidersEnv } from "./support/fake-providers";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4416;
let server: RunningServer;
let env: NodeJS.ProcessEnv;

test.beforeAll(async () => {
  env = fakeProvidersEnv();
  server = await startServer(PORT, undefined, env);
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

test("monitor de agentes mostra sessões, subagentes, telemetria e atualiza ao vivo", async ({ page }) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-agents-")));
  const roots = { claude: env.CLAUDE_CONFIG_DIR!, codex: env.CODEX_HOME! };
  const paths = installAgentFixtures(roots, dir, { codexDay: new Date() });

  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill("proj-agentes");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await page.getByRole("link", { name: "proj-agentes" }).click();

  const card = page.getByLabel("Agentes do projeto");
  await expect(card).toContainText("2 sessões");
  await card.getByRole("link", { name: "Ver agentes" }).click();
  await expect(page).toHaveURL(/\/agentes\?projeto=/);

  const claude = page.getByRole("article", { name: "Tela de agentes [REDIGIDO]" });
  // Último evento há muito tempo: a suíte não presume que segue ativa nem encerrada.
  await expect(claude.getByTestId("agent-state").first()).toHaveText("desconhecido");
  await expect(claude).toContainText("claude-opus-5-5 · v2.1.312");
  await expect(claude).toContainText("(entrada 40 · saída 20 · cache lido 400 · cache gravado 200)");
  await expect(claude).toContainText("Bash 1");
  await expect(claude).toContainText("Fonte: nível B — transcrições locais do Claude Code");
  await claude.getByText("1 subagente").click();
  await expect(claude).toContainText("explorer Localizar rotas");
  await expect(claude.getByTestId("agent-state").nth(1)).toHaveText("concluído");

  const codex = page.getByRole("article", { name: "Sessão 019a2b3c" });
  await expect(codex).toContainText("gpt-5.6-terra · v0.165.0");
  await expect(codex).toContainText("apply_patch 1");
  await expect(codex).toContainText("Fonte: nível B — sessões locais do Codex");

  await expect(page.locator("main")).not.toContainText(FIXTURE_SECRET);
  await expect(page.locator("main")).not.toContainText("Crie a tela");
  await expect(page.getByText("atualização ao vivo")).toBeVisible();

  // Nova mensagem do usuário na sessão: em poucos segundos aparece como "executando".
  appendFileSync(
    paths.claudeSession,
    JSON.stringify({
      type: "user",
      cwd: dir,
      timestamp: new Date().toISOString(),
      message: { role: "user", content: "continue" },
    }) + "\n",
  );
  await expect(claude.getByTestId("agent-state").first()).toHaveText("executando", { timeout: 10_000 });
});

test("ver terminal abre só o terminal do agente, sem as abas do projeto", async ({ page }) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-agterm-")));
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill("proj-agente-terminal");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await page.getByRole("link", { name: "proj-agente-terminal" }).click();

  // Abre também um terminal comum, que não deve aparecer na tela do agente.
  await page.getByRole("link", { name: "Abrir terminal" }).click();
  await expect(page.getByRole("tab", { name: "Terminal 1" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir Claude Code neste projeto" }).click();
  await expect(page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows')).toContainText(
    "claude-falso-interativo",
  );

  await page.getByRole("link", { name: "Agentes" }).click();
  await page.locator("select").selectOption({ label: "proj-agente-terminal" });
  const run = page.locator("article").first();
  await run.getByRole("link", { name: "Ver terminal" }).click({ timeout: 10_000 });

  await expect(page).toHaveURL(/\/agentes\/claude-code(:|%3A)[0-9a-f-]{36}\/terminal$/);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.locator(".xterm-rows")).toHaveCount(1);
  await expect(page.locator(".xterm-rows")).toContainText("claude-falso-interativo");
  await expect(page.getByTestId("agent-state")).toBeVisible();

  // O terminal é interativo: segue no shell do projeto depois do provedor.
  await page.locator(".xterm").click();
  await page.keyboard.type("echo terminal-do-agente");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("terminal-do-agente");

  await page.getByRole("link", { name: "← Agentes" }).click();
  await expect(page).toHaveURL(/\/agentes\?projeto=/);
});
