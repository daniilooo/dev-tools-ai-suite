import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./support/server";
import type { RunningServer } from "./support/server";

const PORT = 4410;
let server: RunningServer;
/** Durante o reinício proposital do servidor, a reconexão do `/ws/events` é recusada: esperado. */
let restarting = false;

test.beforeAll(async () => {
  server = await startServer(PORT);
});
test.afterAll(async () => server?.stop());

// Nenhum erro de console nem violação de CSP em nenhuma página.
test.beforeEach(async ({ page }, testInfo) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    // 401/403 são recusas de autorização esperadas nos testes; CSP ("Refused to ...") e erros de JS não.
    if (message.type() !== "error" || /status of 40[13]/.test(message.text())) return;
    if (restarting && /ERR_CONNECTION_REFUSED/.test(message.text())) return;
    problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  testInfo.annotations.push({ type: "console", description: "monitorado" });
  (page as unknown as { __problems: string[] }).__problems = problems;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __problems: string[] }).__problems).toEqual([]);
});

function angularSpringProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "devtools-e2e-proj-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { "@angular/core": "22.0.0" } }));
  writeFileSync(join(dir, "angular.json"), "{}");
  writeFileSync(join(dir, "pom.xml"), "<artifactId>spring-boot-starter-parent</artifactId>");
  return dir;
}

test("sem sessão o dashboard pede o código e recusa código inválido", async ({ page }) => {
  await page.goto(server.base);
  await expect(page).toHaveURL(/\/acesso$/);
  await page.getByLabel("Código de acesso").fill("AAAA-BBBB");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Código inválido ou expirado.");
});

test("código curto do terminal dá acesso ao dashboard", async ({ page }) => {
  await page.goto(`${server.base}/acesso`);
  await page.getByLabel("Código de acesso").fill(server.shortCode.toLowerCase());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();
});

test("jornada: abrir pelo link, cadastrar projeto, recarregar e reiniciar o servidor", async ({
  page,
  context,
}) => {
  const token = await server.launchToken();
  await page.goto(`${server.base}/#code=${token}`);
  await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();
  expect(page.url()).not.toContain("code=");

  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "devtools_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");

  const path = angularSpringProject();
  await page.getByLabel("Caminho absoluto").fill(path);
  await page.getByLabel("Nome (opcional)").fill("app-e2e");
  await page.getByRole("button", { name: "Adicionar projeto" }).click();
  const item = page.getByRole("listitem").filter({ hasText: "app-e2e" });
  await expect(item).toBeVisible();
  await expect(item.getByText("Angular")).toBeVisible();
  await expect(item.getByText("Spring Boot")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "app-e2e" })).toBeVisible();

  // Reinicia o servidor no mesmo diretório de dados: sessão assinada e projeto persistem.
  const dataDir = server.dataDir;
  restarting = true;
  await server.stop();
  server = await startServer(PORT, dataDir);
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "app-e2e" })).toBeVisible();
  restarting = false;

  await page.getByRole("link", { name: "app-e2e" }).click();
  await expect(page.getByRole("heading", { name: "app-e2e" })).toBeVisible();
});

test("diagnóstico, tema e ausência do segredo no bundle", async ({ page, request }) => {
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await page.getByRole("link", { name: "Diagnóstico" }).click();
  await expect(page.getByText("Banco SQLite")).toBeVisible();
  await expect(page.getByText("Git", { exact: true })).toBeVisible();

  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  expect(before).toBe("dark");
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");

  const secret = server.secret();
  const index = await (await request.get(server.base)).text();
  expect(index).not.toContain(secret);
  const scripts = [...index.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]!);
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    expect(await (await request.get(`${server.base}/${script}`)).text()).not.toContain(secret);
  }
});

test("API recusa mutação sem token anti-CSRF mesmo com cookie de sessão", async ({ page }) => {
  await page.goto(`${server.base}/#code=${await server.launchToken()}`);
  await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();
  // Simula uma requisição que carrega o cookie (HttpOnly) mas não conhece o token anti-CSRF.
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/tmp" }),
    });
    return response.status;
  });
  expect(status).toBe(403);
});
