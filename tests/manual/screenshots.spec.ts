import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FIXTURE_SECRET,
  installAgentFixtures,
  installQuotaFixtures,
} from "../../apps/server/test/agent-fixtures";
import { fakeGraphifyBin, startFakeOllama } from "../e2e/support/fake-knowledge";
import { fakeProvidersEnv } from "../e2e/support/fake-providers";
import { startServer } from "../e2e/support/server";
import type { RunningServer } from "../e2e/support/server";

/**
 * Prints do manual do usuário. Mesmo cenário do E2E: servidor real compilado (`pnpm build`),
 * diretório de dados descartável, Claude/Codex/Ollama/Graphify simulados e projetos de exemplo.
 * Nenhum dado da máquina (projetos, transcrições, cotas) aparece nas imagens.
 *
 * Uso: pnpm manual:screenshots
 */
const OUT = join(import.meta.dirname, "../../docs/manual/img");
const PORT = 4433;
/** Caminhos fixos e legíveis nas imagens (recriados a cada execução). */
const HOME = join(realpathSync(tmpdir()), "devtools-manual");
let server: RunningServer;
let ollama: Awaited<ReturnType<typeof startFakeOllama>>;

function writeProject(name: string, files: Record<string, string>): string {
  const dir = join(HOME, "projetos", name);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  execFileSync("git", ["-C", dir, "init", "-q"]);
  return dir;
}

const reservas = () =>
  writeProject("reservas", {
    "package.json": JSON.stringify({ dependencies: { "@angular/core": "22.0.0" } }),
    "angular.json": "{}",
    "src/reserva.service.ts":
      "export class ReservaService {\n  agendarRecorrencia(sala: string, semanas: number) {\n    // cria uma reserva por semana\n    return Array.from({ length: semanas }, (_, i) => ({ sala, semana: i + 1 }));\n  }\n}\n",
    "src/reserva.controller.ts":
      "import { ReservaService } from './reserva.service';\n\nexport class ReservaController {\n  constructor(private readonly reservas: ReservaService) {}\n\n  agendar(sala: string) {\n    return this.reservas.agendarRecorrencia(sala, 4);\n  }\n}\n",
    "src/app.module.ts":
      "import { ReservaController } from './reserva.controller';\nexport const AppModule = { controllers: [ReservaController] };\n",
    "src/fatura.ts":
      "// multa por atraso na fatura: 2% mais juros de 1% ao mês\nexport const multa = (valor: number, meses: number) => valor * 0.02 + valor * 0.01 * meses;\n",
    "README.md": "# Reservas\n\nAgenda de salas com reservas recorrentes e faturamento.\n",
    ".env": `TOKEN=${FIXTURE_SECRET}\n`,
  });

const pagamentos = () =>
  writeProject("api-pagamentos", {
    "pom.xml": "<parent><artifactId>spring-boot-starter-parent</artifactId></parent>",
    "src/main/java/pagamentos/PagamentoController.java": "class PagamentoController {}\n",
    Dockerfile: "FROM eclipse-temurin:21\n",
  });

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
}

const visibleRows = (page: Page) => page.locator('[role="tabpanel"]:not(.invisible) .xterm-rows');

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  rmSync(HOME, { recursive: true, force: true });
  ollama = await startFakeOllama("embeddinggemma");
});
test.afterAll(async () => {
  await server?.stop();
  await ollama?.stop();
});

test("prints do manual", async ({ page }) => {
  test.setTimeout(180_000);
  const reservasDir = reservas();
  const pagamentosDir = pagamentos();
  const env: NodeJS.ProcessEnv = {
    ...fakeProvidersEnv(),
    DEVTOOLS_OLLAMA_URL: ollama.url,
    DEVTOOLS_GRAPHIFY_BIN: fakeGraphifyBin(),
  };
  // Histórico de agentes: transcrições anonimizadas do Claude Code e do Codex no projeto de exemplo.
  const roots = { claude: env.CLAUDE_CONFIG_DIR!, codex: env.CODEX_HOME! };
  installAgentFixtures(roots, reservasDir, { codexDay: new Date() });
  // Só os limites do Codex: a transcrição de limite do Claude fica fora da raiz lida pela suíte.
  installQuotaFixtures({ claude: join(HOME, "descartado"), codex: roots.codex }, reservasDir, {
    codexDay: new Date(),
  });
  // A aba do Claude simulado mostra um aviso neutro em vez do marcador dos testes.
  const claudeBin = join(env.PATH!.split(":")[0]!, "claude");
  writeFileSync(
    claudeBin,
    readFileSync(claudeBin, "utf8").replaceAll(
      'echo "claude-falso-interativo"',
      'printf "\\n  Claude Code (simulado para o manual) aberto em %s\\n\\n" "$PWD"',
    ),
  );
  server = await startServer(PORT, join(HOME, ".dev-tools-ai-suite"), env);

  // 1. Acesso com o código curto do terminal.
  await page.goto(`${server.base}/acesso`);
  await page.getByRole("textbox").first().fill(server.shortCode);
  await shot(page, "01-acesso");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/projetos/);

  // 2. Projetos.
  await shot(page, "02-projetos-vazio");
  for (const [dir, name] of [
    [reservasDir, "reservas"],
    [pagamentosDir, "api-pagamentos"],
  ] as const) {
    await page.getByLabel("Caminho absoluto").fill(dir);
    await page.getByLabel("Nome (opcional)").fill(name);
    await page.getByRole("button", { name: "Adicionar projeto" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  await shot(page, "03-projetos");

  await page.getByRole("link", { name: "reservas" }).click();
  // 3. Terminal e Claude Code no projeto.
  await page.getByRole("link", { name: "Abrir terminal" }).click();
  await page.locator('[role="tabpanel"]:not(.invisible) .xterm').click();
  await page.keyboard.type("ls src");
  await page.keyboard.press("Enter");
  await expect(visibleRows(page)).toContainText("reserva.service.ts");
  await shot(page, "05-terminal");
  await page.getByRole("button", { name: "Abrir Claude Code neste projeto" }).click();
  await expect(visibleRows(page)).toContainText("Claude Code (simulado");
  await shot(page, "06-terminal-claude");

  await page.getByRole("link", { name: "Terminal", exact: true }).click();
  await expect(page.getByText("Abrir", { exact: true }).first()).toBeVisible();
  await shot(page, "07-terminais");

  // 4. Provedores.
  await page.getByRole("link", { name: "Provedores" }).click();
  await expect(page.getByRole("article", { name: "Claude Code" })).toBeVisible();
  await shot(page, "08-provedores", true);

  // 5. Agentes.
  await page.getByRole("link", { name: "Agentes" }).click();
  await page.locator("select").first().selectOption({ label: "reservas" });
  await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 });
  await shot(page, "09-agentes", true);

  // 6. Cotas.
  await expect(page.getByTestId("quota-summary")).toContainText("61%", { timeout: 15_000 });
  await page.getByRole("link", { name: "Cotas", exact: true }).click();
  await expect(page.getByRole("article", { name: "Claude Code" })).toBeVisible();
  await shot(page, "10-cotas", true);

  await page.getByRole("link", { name: "Projetos" }).click();
  await page.getByRole("link", { name: "reservas" }).click();
  await expect(page.getByRole("heading", { name: "Stack detectada" })).toBeVisible();
  await expect(page.getByText("Nenhuma sessão")).toBeHidden();
  await shot(page, "04-projeto-detalhe");

  // 7. Conhecimento: índice, busca textual, busca semântica e grafo.
  await page.getByRole("link", { name: "Conhecimento", exact: true }).click();
  await page.getByRole("combobox").first().selectOption({ label: "reservas" });
  await expect(page.getByTestId("index-state")).toHaveText("não indexado");
  await shot(page, "11-conhecimento-inicio", true);
  await page.getByRole("button", { name: "Indexar projeto" }).click();
  await expect(page.getByTestId("index-state")).toHaveText("indexado", { timeout: 15_000 });
  await page.getByLabel("Consulta").fill("agendarRecorrencia");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("knowledge-hit").first()).toBeVisible();
  await shot(page, "12-conhecimento-busca", true);

  await page.getByRole("button", { name: "Ligar busca semântica" }).click();
  await expect(page.getByTestId("semantic-state")).toHaveText("pronta", { timeout: 15_000 });
  await page.getByLabel("Consulta").fill("multa por atraso na fatura");
  await page.getByLabel("Tipo de busca").selectOption("semantic");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("knowledge-hit").first()).toContainText("src/fatura.ts");
  await shot(page, "13-conhecimento-semantica", true);

  await page.getByRole("button", { name: "Gerar grafo" }).click();
  await expect(page.getByTestId("graph-state")).toHaveText("gerado", { timeout: 15_000 });
  await page.getByLabel("Símbolo").fill("ReservaService");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByTestId("graph-dependent").first()).toBeVisible();
  await page.getByTestId("graph-result").scrollIntoViewIfNeeded();
  await shot(page, "14-conhecimento-grafo", true);

  // 8. Diagnóstico.
  await page.getByRole("link", { name: "Diagnóstico" }).click();
  await expect(page.getByText("Banco SQLite")).toBeVisible();
  await shot(page, "15-diagnostico", true);

  await expect(page.locator("main")).not.toContainText(FIXTURE_SECRET);
});
