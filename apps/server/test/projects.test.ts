import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestApp, HOST, login, ORIGIN, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";
import { detectStack } from "../src/modules/projects/stack-detection.js";

const contexts: TestContext[] = [];
afterEach(async () => {
  while (contexts.length) await contexts.pop()!.close();
});

async function setup(dataDir?: string, cleanup = true) {
  const ctx = await createTestApp(dataDir, cleanup);
  contexts.push(ctx);
  const auth = await login(ctx);
  const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: unknown) =>
    ctx.server.inject({
      method,
      url,
      payload: payload as Record<string, unknown> | undefined,
      headers: { host: HOST, origin: ORIGIN, cookie: auth.cookie, "x-csrf-token": auth.csrf },
    });
  return { ctx, call };
}

function fakeProject(files: Record<string, string>): string {
  const dir = tempDir("devtools-project-");
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

describe("projetos", () => {
  it("detecta stack em subpastas (backend/ e frontend/), ignorando dependências e pastas ocultas", () => {
    const root = tempDir("devtools-umbrella-");
    const files: Record<string, string> = {
      "backend/service/pom.xml": "<artifactId>spring-boot-starter-parent</artifactId>",
      "frontend/app/angular.json": "{}",
      "frontend/app/package.json": JSON.stringify({ dependencies: { "@angular/core": "22.0.0" } }),
      "node_modules/lib/go.mod": "module x",
      ".cache/Cargo.toml": "",
      "a/b/c/pyproject.toml": "",
    };
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), content);
    }
    expect(detectStack(root)).toEqual(["angular", "java-maven", "node", "spring-boot"]);
  });

  it("cadastra diretório, detecta stack Angular + Spring Boot e lista", async () => {
    const { call } = await setup();
    const path = fakeProject({
      "package.json": JSON.stringify({ dependencies: { "@angular/core": "22.0.0" } }),
      "tsconfig.json": "{}",
      "pom.xml": "<artifactId>spring-boot-starter-parent</artifactId>",
    });
    const created = await call("POST", "/api/v1/projects", { path, name: "Meu App" });
    expect(created.statusCode).toBe(201);
    const project = created.json();
    expect(project.name).toBe("Meu App");
    expect(project.detectedStack).toEqual(["angular", "java-maven", "node", "spring-boot", "typescript"]);

    const list = await call("GET", "/api/v1/projects");
    expect(list.json()).toHaveLength(1);
    expect((await call("GET", `/api/v1/projects/${project.id}`)).json().path).toBe(path);
  });

  it("não cria nem altera arquivos no diretório do projeto (INV-05)", async () => {
    const { call } = await setup();
    const path = fakeProject({ "package.json": "{}" });
    const before = readdirSync(path).sort();
    await call("POST", "/api/v1/projects", { path });
    expect(readdirSync(path).sort()).toEqual(before);
  });

  it("valida caminho relativo, inexistente e duplicado", async () => {
    const { call } = await setup();
    expect((await call("POST", "/api/v1/projects", { path: "relativo/dir" })).statusCode).toBe(400);
    expect((await call("POST", "/api/v1/projects", { path: "/nao/existe/xyz" })).statusCode).toBe(400);
    const path = fakeProject({});
    expect((await call("POST", "/api/v1/projects", { path })).statusCode).toBe(201);
    const dup = await call("POST", "/api/v1/projects", { path: path + "/." });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("PROJECT_ALREADY_EXISTS");
  });

  it("remove apenas o cadastro, preservando os arquivos", async () => {
    const { call } = await setup();
    const path = fakeProject({ "go.mod": "module x" });
    const { id } = (await call("POST", "/api/v1/projects", { path })).json();
    expect((await call("DELETE", `/api/v1/projects/${id}`)).statusCode).toBe(204);
    expect((await call("GET", `/api/v1/projects/${id}`)).statusCode).toBe(404);
    expect(readdirSync(path)).toContain("go.mod");
  });

  it("persiste após reinicializar o servidor", async () => {
    const dataDir = tempDir();
    const first = await setup(dataDir, false);
    const path = fakeProject({ "Cargo.toml": "" });
    await first.call("POST", "/api/v1/projects", { path, name: "persistente" });
    await first.ctx.close();
    contexts.pop();

    const second = await setup(dataDir);
    const list = (await second.call("GET", "/api/v1/projects")).json();
    expect(list.map((p: { name: string }) => p.name)).toEqual(["persistente"]);
  });

  it("redetecta a stack após mudanças no projeto", async () => {
    const { call } = await setup();
    const path = fakeProject({});
    const { id, detectedStack } = (await call("POST", "/api/v1/projects", { path })).json();
    expect(detectedStack).toEqual([]);
    mkdirSync(join(path, "src"));
    writeFileSync(join(path, "pyproject.toml"), "");
    expect((await call("POST", `/api/v1/projects/${id}/redetect`)).json().detectedStack).toEqual(["python"]);
    rmSync(path, { recursive: true, force: true });
  });
});
