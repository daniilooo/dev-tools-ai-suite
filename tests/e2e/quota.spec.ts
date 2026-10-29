import { expect, test } from "@playwright/test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_SECRET } from "../../apps/server/test/agent-fixtures";
import { fakeProvidersEnv } from "./support/fake-providers";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4418;
const FIXTURE = join(
  import.meta.dirname,
  "../../apps/server/test/fixtures/codex/0.165.0/sessions/rate-limits.jsonl",
);
let server: RunningServer;
let env: NodeJS.ProcessEnv;

/** Rollout do Codex com a estrutura da fixture, mas com horários de agora (renovações no futuro). */
function installCodexRollout(codexHome: string): void {
  const now = Date.now();
  const day = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dir = join(
    codexHome,
    "sessions",
    String(day.getFullYear()),
    pad(day.getMonth() + 1),
    pad(day.getDate()),
  );
  mkdirSync(dir, { recursive: true });
  const lines = readFileSync(FIXTURE, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      type Window = { resets_at: number } | null;
      const record = JSON.parse(line.replace("__SECRET__", FIXTURE_SECRET)) as {
        timestamp: string;
        payload?: { rate_limits?: { primary: Window; secondary: Window } };
      };
      record.timestamp = new Date(now - 60_000).toISOString();
      const limits = record.payload?.rate_limits;
      if (limits?.primary) limits.primary.resets_at = Math.floor(now / 1000) + 2 * 3600;
      if (limits?.secondary) limits.secondary.resets_at = Math.floor(now / 1000) + 3 * 86400;
      return JSON.stringify(record);
    });
  writeFileSync(join(dir, "rollout-e2e-quota.jsonl"), lines.join("\n") + "\n");
}

test.beforeAll(async () => {
  env = fakeProvidersEnv();
  installCodexRollout(env.CODEX_HOME!);
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

test("cotas mostram fonte e frescor; abrir o Claude pela suíte traz o uso dele", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  const summary = page.getByTestId("quota-summary");
  await expect(summary).toContainText("Claude Code");
  await expect(summary).toContainText("INDISPONÍVEL");
  await expect(summary).toContainText("42%");

  await page.getByRole("link", { name: "Cotas", exact: true }).click();
  await expect(page).toHaveURL(/\/cotas$/);
  const codex = page.getByRole("article", { name: "Codex CLI" });
  await expect(codex).toContainText("plano plus");
  const fiveHour = codex.getByRole("listitem", { name: "Janela de 5 h" });
  await expect(fiveHour).toContainText("42% usado");
  await expect(fiveHour).toContainText(/renova hoje às \d\d:\d\d \(em 1 h 5\d min\)|renova amanhã às/);
  await expect(fiveHour.getByTestId("quota-freshness")).toHaveText("atualizado");
  await expect(fiveHour).toContainText("oficial");
  await expect(fiveHour).toContainText("Fonte: nível B — sessões locais do Codex");
  await expect(codex.getByRole("listitem", { name: "Semanal (7 dias)" })).toContainText("15% usado");

  const claude = page.getByRole("article", { name: "Claude Code" });
  await expect(claude).toContainText("INDISPONÍVEL");
  await expect(claude).toContainText("abra o Claude Code pela suíte");
  await expect(page.locator("main")).not.toContainText(FIXTURE_SECRET);

  // Abre o Claude pela suíte: a status line da suíte grava os limites e a tela atualiza sozinha.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "devtools-e2e-quota-")));
  await page.getByRole("link", { name: "Projetos" }).click();
  await page.getByLabel("Caminho absoluto").fill(dir);
  await page.getByLabel("Nome (opcional)").fill("proj-cotas");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  await page.getByRole("link", { name: "proj-cotas" }).click();
  await page.getByRole("link", { name: "Abrir Claude Code" }).click();
  await expect(page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows')).toContainText("--settings");
  await expect(summary).toContainText("61%", { timeout: 15_000 });

  await page.getByRole("link", { name: "Cotas", exact: true }).click();
  const claudeWindows = page.getByRole("article", { name: "Claude Code" });
  await expect(claudeWindows.getByRole("listitem", { name: "Janela de 5 h" })).toContainText("23,5% usado");
  await expect(claudeWindows.getByRole("listitem", { name: "Semanal (7 dias)" })).toContainText("61% usado");
  await expect(claudeWindows).toContainText("Fonte: nível A — status line do Claude Code");

  // Nenhum arquivo de configuração do Claude Code foi criado: só a transcrição da sessão.
  expect(readdirSync(env.CLAUDE_CONFIG_DIR!)).toEqual(["projects"]);
});
