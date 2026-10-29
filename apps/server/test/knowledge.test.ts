import type { KnowledgeQueryResponse, KnowledgeStatus, Project } from "@devtools/shared";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { Socket } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exclusionFor } from "../src/modules/knowledge/exclusions.js";
import { listProjectFiles } from "../src/modules/knowledge/indexer.js";
import { KnowledgeService } from "../src/modules/knowledge/knowledge.service.js";
import { FIXTURE_SECRET } from "./agent-fixtures.js";
import { createTestApp, HOST, login, ORIGIN, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";

/** Projeto git com código, segredos, ruído, binário, arquivo grande e um repositório aninhado ignorado pela raiz. */
function makeProject(): string {
  const root = realpathSync(tempDir("devtools-know-"));
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });
  git(root, "init", "-q");
  writeFileSync(join(root, ".gitignore"), "*.log\n/backend/\n");
  mkdirSync(join(root, "src"));
  writeFileSync(
    join(root, "src", "pedido.service.ts"),
    [
      "// Serviço de pedidos",
      "export class PedidoService {",
      "  calcularTotalComDesconto(itens: number[]): number {",
      "    return itens.reduce((a, b) => a + b, 0) * 0.9;",
      "  }",
      "}",
      `const chave = "${FIXTURE_SECRET}";`,
    ].join("\n"),
  );
  writeFileSync(join(root, "README.md"), "# Projeto\n\nDocumentação da reserva recorrente.\n");
  writeFileSync(join(root, ".env"), `API_TOKEN=${FIXTURE_SECRET}\nsenhaDoBanco=palavraSecretaDoEnv\n`);
  writeFileSync(join(root, ".env.example"), "API_TOKEN=\n");
  mkdirSync(join(root, "secrets"));
  writeFileSync(join(root, "secrets", "chave.txt"), "conteudoDaPastaSecrets\n");
  writeFileSync(join(root, "servidor.pem"), "-----BEGIN CERTIFICATE-----\n");
  writeFileSync(join(root, "debug.log"), "linhaDeLogIgnorada\n");
  writeFileSync(join(root, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]));
  writeFileSync(join(root, "dados.bin.txt"), Buffer.from([0x41, 0, 0x42]));
  writeFileSync(join(root, "grande.txt"), "x".repeat(1024 * 1024 + 1));
  mkdirSync(join(root, "node_modules", "lib"), { recursive: true });
  writeFileSync(join(root, "node_modules", "lib", "index.js"), "dependenciaDeTerceiros();\n");
  const nested = join(root, "backend", "api");
  mkdirSync(join(nested, "src"), { recursive: true });
  git(nested, "init", "-q");
  writeFileSync(
    join(nested, "src", "ReservaController.java"),
    "public class ReservaController {\n  // agendaRecorrente\n}\n",
  );
  return root;
}

describe("exclusões de indexação", () => {
  it("segue a lista padrão do Vault", () => {
    for (const path of [
      ".env",
      "config/.env.local",
      "a/b/id_rsa",
      "k.pem",
      "secrets/x.ts",
      ".claude/settings.json",
      "credentials.json",
      "gh_token.json",
      ".npmrc",
    ]) {
      expect(exclusionFor(path), path).toBe("sensitive");
    }
    for (const path of [
      "node_modules/a.js",
      "dist/main.js",
      "app.min.js",
      "pnpm-lock.yaml",
      "foto.PNG",
      "a/target/x.class",
    ]) {
      expect(exclusionFor(path), path).toBe("noise");
    }
    for (const path of [".env.example", "src/app.ts", "docs/tokens.md", "README.md"]) {
      expect(exclusionFor(path), path).toBeNull();
    }
  });

  it("lista o projeto respeitando .gitignore, exclusões e repositórios aninhados", async () => {
    const root = makeProject();
    const { files, skipped } = await listProjectFiles(root);
    expect(files.map((f) => f.path).sort()).toEqual([
      ".env.example",
      ".gitignore",
      "README.md",
      "backend/api/src/ReservaController.java",
      "dados.bin.txt",
      "src/pedido.service.ts",
    ]);
    expect(skipped).toEqual({ sensitive: 3, noise: 2, large: 1, binary: 0 });
  });
});

describe("conhecimento no servidor", () => {
  let ctx: TestContext;
  let auth: { cookie: string; csrf: string };
  let project: Project;

  beforeEach(async () => {
    ctx = await createTestApp();
    auth = await login(ctx);
    project = (await api("POST", "/api/v1/projects", { path: makeProject() })).json<Project>();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await ctx.close();
  });

  function api(method: "GET" | "POST" | "DELETE", url: string, payload?: object, cookie = auth.cookie) {
    return ctx.server.inject({
      method,
      url,
      headers: { host: HOST, origin: ORIGIN, cookie, "x-csrf-token": auth.csrf },
      payload,
    });
  }
  const base = () => `/api/v1/projects/${project.id}/knowledge`;
  const query = async (text: string) =>
    (await api("POST", `${base()}/query`, { query: text })).json<KnowledgeQueryResponse>();

  async function indexNow(): Promise<KnowledgeStatus> {
    const started = await api("POST", `${base()}/index`);
    expect(started.statusCode).toBe(202);
    await ctx.knowledge.idle(project.id);
    return (await api("GET", base())).json<KnowledgeStatus>();
  }

  it("indexa sem rede e responde com arquivo e linhas que existem", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const connectSpy = vi.spyOn(Socket.prototype, "connect");
    expect((await api("GET", base())).json<KnowledgeStatus>()).toMatchObject({ state: "not_indexed" });

    const status = await indexNow();
    expect(status).toMatchObject({
      state: "indexed",
      files: 5,
      skipped: { sensitive: 3, noise: 2, large: 1, binary: 1 },
      semantic: { available: false },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();

    const result = await query("calcularTotalComDesconto");
    expect(result.mode).toBe("lexical");
    const hit = result.hits[0]!;
    expect(hit).toMatchObject({ filePath: "src/pedido.service.ts", lineStart: 1, stale: false });
    expect(hit.snippet).toContain("«calcularTotalComDesconto»");
    const lines = readFileSync(join(project.path, hit.filePath), "utf8").split("\n");
    expect(lines.slice(hit.lineStart - 1, hit.lineEnd).join("\n")).toContain("calcularTotalComDesconto");
    expect(hit.lineEnd).toBeLessThanOrEqual(lines.length);
    expect((await query("agendaRecorrente")).hits[0]).toMatchObject({ lineStart: 1, lineEnd: 3 });

    // Repositório aninhado entra; acentos e maiúsculas não atrapalham.
    expect((await query("agendaRecorrente")).hits[0]?.filePath).toBe(
      "backend/api/src/ReservaController.java",
    );
    expect((await query("documentacao RESERVA")).hits[0]?.filePath).toBe("README.md");
  });

  it("segredos e arquivos excluídos nunca chegam ao índice", async () => {
    await indexNow();
    for (const term of [
      "palavraSecretaDoEnv",
      "conteudoDaPastaSecrets",
      "linhaDeLogIgnorada",
      "dependenciaDeTerceiros",
      "api03",
    ]) {
      expect((await query(term)).hits, term).toEqual([]);
    }
    const index = ctx.knowledge.indexPath(project.id);
    expect(readFileSync(index).includes(FIXTURE_SECRET)).toBe(false);
    expect(statSync(index).mode & 0o777).toBe(0o600);
    expect((await query("chave")).hits[0]?.snippet).toContain("[REDIGIDO]");
  });

  it("detecta mudanças depois da indexação e marca trechos desatualizados", async () => {
    await indexNow();
    appendFileSync(join(project.path, "src", "pedido.service.ts"), "\n// alterado\n");
    writeFileSync(join(project.path, "novo.md"), "arquivo novo\n");
    expect((await api("GET", base())).json<KnowledgeStatus>()).toMatchObject({
      state: "outdated",
      changedFiles: 2,
    });
    expect((await query("PedidoService")).hits[0]).toMatchObject({ stale: true });

    await indexNow();
    expect((await api("GET", base())).json<KnowledgeStatus>()).toMatchObject({ state: "indexed", files: 6 });
  });

  it("isola índices por projeto e remove o índice sem tocar no código", async () => {
    await indexNow();
    const other = (
      await api("POST", "/api/v1/projects", { path: realpathSync(tempDir("devtools-know-b-")) })
    ).json<Project>();
    expect(
      (await api("POST", `/api/v1/projects/${other.id}/knowledge/query`, { query: "PedidoService" }))
        .statusCode,
    ).toBe(409);

    expect((await api("DELETE", `${base()}/index`)).statusCode).toBe(204);
    expect(existsSync(ctx.knowledge.indexPath(project.id))).toBe(false);
    expect(existsSync(join(project.path, "src", "pedido.service.ts"))).toBe(true);
    expect((await api("GET", base())).json<KnowledgeStatus>()).toMatchObject({ state: "not_indexed" });

    await indexNow();
    expect((await api("DELETE", `/api/v1/projects/${project.id}`)).statusCode).toBe(204);
    expect(existsSync(ctx.knowledge.indexPath(project.id))).toBe(false);
  });

  it("exige sessão e valida a consulta", async () => {
    expect((await api("GET", base(), undefined, "")).statusCode).toBe(401);
    expect((await api("POST", `${base()}/index`, undefined, "")).statusCode).toBe(401);
    expect((await api("POST", `${base()}/query`, { query: "   " })).statusCode).toBe(400);
    expect((await api("POST", `${base()}/query`, { query: "x" })).statusCode).toBe(409);
    expect((await api("GET", "/api/v1/projects/inexistente/knowledge")).statusCode).toBe(404);
    // Operadores do FTS5 viram texto comum, nunca erro de sintaxe.
    await indexNow();
    expect((await api("POST", `${base()}/query`, { query: 'NEAR(" OR *) AND -"' })).statusCode).toBe(200);
  });

  it("indexação interrompida por reinício vira falha com motivo", () => {
    ctx.db
      .prepare("INSERT INTO knowledge_indexes (project_id, state) VALUES (?, 'indexing')")
      .run(project.id);
    new KnowledgeService(ctx.db, { get: () => project } as never, ctx.layout.indexes);
    const row = ctx.db
      .prepare("SELECT state, error FROM knowledge_indexes WHERE project_id = ?")
      .get(project.id);
    expect(row).toMatchObject({ state: "failed", error: expect.stringContaining("reiniciado") });
  });
});
