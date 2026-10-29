import type {
  CodeGraphQueryResponse,
  KnowledgeQueryResponse,
  KnowledgeStatus,
  Project,
  SemanticProviderInfo,
} from "@devtools/shared";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/core/config.js";
import { CodeGraphIndex, GraphifyExtractor, mergeGraphs } from "../src/modules/knowledge/code-graph.js";
import type { GraphExtractor } from "../src/modules/knowledge/code-graph.js";
import type { EmbeddingProvider } from "../src/modules/knowledge/embeddings.js";
import { SemanticService } from "../src/modules/knowledge/semantic.service.js";
import { FIXTURE_SECRET } from "./agent-fixtures.js";
import { createTestApp, HOST, login, ORIGIN, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";
import { makeProject } from "./knowledge-fixtures.js";

/** Embeddings falsos e determinísticos: saco de palavras em 64 dimensões. */
class FakeEmbeddings implements EmbeddingProvider {
  readonly label = "Falso";
  readonly model = "falso-64";
  calls: string[][] = [];
  reason: string | null = null;

  constructor(
    readonly id: "ollama" | "transformers" = "ollama",
    readonly downloadsModel = false,
  ) {}

  async check(): Promise<string | null> {
    return this.reason;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    this.calls.push(texts);
    return texts.map((text) => {
      const v = new Float32Array(64);
      for (const word of text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)) {
        let h = 2166136261;
        for (const c of word) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
        v[(h >>> 0) % 64]! += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  }
}

/** Graphify falso: devolve um grafo por repositório, como o real faria só com AST. */
function fakeGraph(): GraphExtractor & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    check: async () => null,
    extract: async (repoDir) => {
      calls.push(repoDir);
      if (repoDir.endsWith(join("backend", "api"))) {
        return {
          nodes: [
            {
              id: "rc",
              label: "ReservaController",
              source_file: "src/ReservaController.java",
              source_location: "L1",
            },
            { id: "ext_list", label: "java.util.List" },
          ],
          edges: [
            {
              source: "rc",
              target: "ext_list",
              relation: "references",
              source_file: "src/ReservaController.java",
              source_location: "L2",
            },
          ],
        };
      }
      return {
        nodes: [
          { id: "ps", label: "PedidoService", source_file: "src/pedido.service.ts", source_location: "L2" },
          {
            id: "calc",
            label: ".calcularTotalComDesconto()",
            source_file: "src/pedido.service.ts",
            source_location: "L3",
          },
          { id: "cc", label: "CheckoutController", source_file: "src/checkout.ts", source_location: "L5" },
          { id: "fa", label: "Fachada", source_file: "src/fachada.ts", source_location: "L1" },
          { id: "seg", label: "ChaveSecreta", source_file: "secrets/chave.ts", source_location: "L1" },
          { id: "dup", label: "Duplicado", source_file: "backend/api/src/X.java", source_location: "L1" },
          { id: "ext_list", label: "java.util.List" },
        ],
        // O real usa "links" quando agrupa e "edges" sem agrupamento: os dois são aceitos.
        links: [
          {
            source: "ps",
            target: "calc",
            relation: "method",
            source_file: "src/pedido.service.ts",
            source_location: "L3",
          },
          {
            source: "cc",
            target: "ps",
            relation: "references",
            source_file: "src/checkout.ts",
            source_location: "L9",
          },
          {
            source: "fa",
            target: "cc",
            relation: "calls",
            source_file: "src/fachada.ts",
            source_location: "L4",
          },
          {
            source: "seg",
            target: "ps",
            relation: "calls",
            source_file: "secrets/chave.ts",
            source_location: "L2",
          },
          {
            source: "ps",
            target: "ext_list",
            relation: "imports",
            source_file: "src/pedido.service.ts",
            source_location: "L1",
          },
        ],
      };
    },
  };
}

describe("busca semântica e grafo de código", () => {
  let ctx: TestContext;
  let auth: { cookie: string; csrf: string };
  let project: Project;
  let embeddings: FakeEmbeddings;
  let downloader: FakeEmbeddings;
  let graph: ReturnType<typeof fakeGraph>;

  beforeEach(async () => {
    embeddings = new FakeEmbeddings();
    downloader = new FakeEmbeddings("transformers", true);
    graph = fakeGraph();
    ctx = await createTestApp(undefined, true, {
      embeddings: [embeddings, downloader],
      graphExtractor: graph,
    });
    auth = await login(ctx);
    project = (await api("POST", "/api/v1/projects", { path: makeProject() })).json<Project>();
  });
  afterEach(async () => ctx.close());

  function api(method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) {
    return ctx.server.inject({
      method,
      url,
      headers: { host: HOST, origin: ORIGIN, cookie: auth.cookie, "x-csrf-token": auth.csrf },
      payload,
    });
  }
  const base = () => `/api/v1/projects/${project.id}/knowledge`;
  const status = async () => (await api("GET", base())).json<KnowledgeStatus>();
  const query = async (text: string, mode?: string) =>
    (await api("POST", `${base()}/query`, { query: text, mode })).json<KnowledgeQueryResponse>();
  async function settle(): Promise<KnowledgeStatus> {
    await ctx.knowledge.idle(project.id);
    return status();
  }
  async function enable(): Promise<KnowledgeStatus> {
    await api("POST", `${base()}/index`);
    await ctx.knowledge.idle(project.id);
    const response = await api("PUT", `${base()}/semantic`, { enabled: true, provider: "ollama" });
    expect(response.statusCode).toBe(200);
    return settle();
  }

  it("fica desligada por padrão e só liga com índice textual e mecanismo disponível", async () => {
    expect((await status()).semantic).toMatchObject({ enabled: false, state: "off", available: true });
    const providers = (await api("GET", "/api/v1/knowledge/semantic/providers")).json<
      SemanticProviderInfo[]
    >();
    expect(providers.map((p) => [p.id, p.downloadsModel])).toEqual([
      ["ollama", false],
      ["transformers", true],
    ]);

    expect((await api("PUT", `${base()}/semantic`, { enabled: true, provider: "ollama" })).statusCode).toBe(
      409,
    );
    await api("POST", `${base()}/index`);
    await ctx.knowledge.idle(project.id);
    // Modelo baixado da internet só com consentimento explícito.
    const noConsent = await api("PUT", `${base()}/semantic`, { enabled: true, provider: "transformers" });
    expect(noConsent.statusCode).toBe(400);
    embeddings.reason = "Rode `ollama pull falso`.";
    const unavailable = await api("PUT", `${base()}/semantic`, { enabled: true, provider: "ollama" });
    expect(unavailable.statusCode).toBe(409);
    expect(unavailable.json<{ error: { message: string } }>().error.message).toContain("ollama pull");
    expect(existsSync(ctx.knowledge.semantic.vectorPath(project.id))).toBe(false);
    expect((await api("POST", `${base()}/query`, { query: "x", mode: "semantic" })).statusCode).toBe(409);
  });

  it("calcula vetores, responde por semelhança e junta com a busca textual", async () => {
    const s = await enable();
    expect(s.semantic).toMatchObject({
      enabled: true,
      provider: "ollama",
      model: "falso-64",
      state: "ready",
    });
    expect(s.semantic.embedded).toBe(s.chunks);
    expect(s.semantic.total).toBe(s.chunks);

    const vec = ctx.knowledge.semantic.vectorPath(project.id);
    expect(statSync(vec).mode & 0o777).toBe(0o600);
    expect(readFileSync(vec).includes(FIXTURE_SECRET)).toBe(false);

    const semantic = await query("total com desconto dos itens do pedido", "semantic");
    expect(semantic.mode).toBe("semantic");
    expect(semantic.hits[0]).toMatchObject({
      filePath: "src/pedido.service.ts",
      lineStart: 1,
      matchedBy: ["semantic"],
    });
    expect(semantic.hits[0]!.snippet).toContain("calcularTotalComDesconto");

    // Sem modo: híbrida quando há vetores; o trecho achado pelas duas buscas sobe.
    const hybrid = await query("calcularTotalComDesconto");
    expect(hybrid.mode).toBe("hybrid");
    expect(hybrid.hits[0]).toMatchObject({
      filePath: "src/pedido.service.ts",
      matchedBy: ["lexical", "semantic"],
    });
    expect((await query("calcularTotalComDesconto", "lexical")).hits[0]!.matchedBy).toEqual(["lexical"]);
  });

  it("reindexação recalcula só os trechos que mudaram", async () => {
    const first = await enable();
    const embeddedTexts = embeddings.calls.flat().length;
    expect(embeddedTexts).toBe(first.chunks);

    appendFileSync(join(project.path, "README.md"), "\nNova seção sobre cancelamento.\n");
    embeddings.calls = [];
    await api("POST", `${base()}/index`);
    const second = await settle();
    expect(second.semantic.state).toBe("ready");
    expect(embeddings.calls.flat()).toHaveLength(1);
    expect(embeddings.calls.flat()[0]).toContain("cancelamento");
    expect(second.semantic.embedded).toBe(second.chunks);
  });

  it("desligar ou remover o índice apaga os vetores; reinício vira falha", async () => {
    await enable();
    const vec = ctx.knowledge.semantic.vectorPath(project.id);
    expect(
      (await api("PUT", `${base()}/semantic`, { enabled: false })).json<KnowledgeStatus>().semantic,
    ).toMatchObject({
      enabled: false,
      state: "off",
    });
    expect(existsSync(vec)).toBe(false);

    await api("PUT", `${base()}/semantic`, { enabled: true, provider: "ollama" });
    await ctx.knowledge.idle(project.id);
    expect(existsSync(vec)).toBe(true);
    expect((await api("DELETE", `${base()}/index`)).statusCode).toBe(204);
    expect(existsSync(vec)).toBe(false);
    expect((await status()).semantic.enabled).toBe(false);

    ctx.db
      .prepare(
        "INSERT INTO knowledge_semantic (project_id, provider, model, state) VALUES (?, 'ollama', 'falso-64', 'indexing')",
      )
      .run(project.id);
    new SemanticService(ctx.db, [embeddings], ctx.layout.indexes);
    expect((await status()).semantic).toMatchObject({
      state: "failed",
      error: expect.stringContaining("reiniciado"),
    });
  });

  it("gera o grafo por repositório e responde dependentes e impacto com arquivo e linha", async () => {
    expect((await status()).graph).toMatchObject({ available: true, state: "not_built" });
    expect((await api("POST", `${base()}/graph/query`, { symbol: "PedidoService" })).statusCode).toBe(409);

    expect((await api("POST", `${base()}/graph`)).statusCode).toBe(202);
    const built = (await settle()).graph;
    expect(built).toMatchObject({ state: "built", repos: 2 });
    expect(graph.calls).toEqual([project.path, join(project.path, "backend", "api")]);
    const file = ctx.knowledge.graph.graphPath(project.id);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    // Exclusões valem para o grafo; a raiz não duplica o repositório aninhado.
    const raw = readFileSync(file, "utf8");
    expect(raw).not.toContain("ChaveSecreta");
    expect(raw).not.toContain("Duplicado");
    expect(readdirSync(join(ctx.layout.graphs)).filter((n) => n.includes(".work"))).toEqual([]);

    const result = (
      await api("POST", `${base()}/graph/query`, { symbol: "pedidoservice", depth: 2 })
    ).json<CodeGraphQueryResponse>();
    expect(result.node).toMatchObject({ label: "PedidoService", filePath: "src/pedido.service.ts", line: 2 });
    expect(result.dependents).toEqual([
      expect.objectContaining({ relation: "references", filePath: "src/checkout.ts", line: 9 }),
    ]);
    expect(result.impact.map((i) => [i.node.label, i.depth])).toEqual([
      ["CheckoutController", 1],
      ["Fachada", 2],
    ]);
    expect(result.dependencies.map((d) => d.node.label).sort()).toEqual([
      ".calcularTotalComDesconto()",
      "java.util.List",
    ]);

    const nested = (
      await api("POST", `${base()}/graph/query`, { symbol: "ReservaController" })
    ).json<CodeGraphQueryResponse>();
    expect(nested.node?.filePath).toBe("backend/api/src/ReservaController.java");
    // Método achado sem ponto e parênteses.
    expect(
      (
        await api("POST", `${base()}/graph/query`, { symbol: "calcularTotalComDesconto" })
      ).json<CodeGraphQueryResponse>().node?.label,
    ).toBe(".calcularTotalComDesconto()");

    expect((await api("DELETE", `${base()}/graph`)).statusCode).toBe(204);
    expect(existsSync(file)).toBe(false);
    expect((await status()).graph.state).toBe("not_built");
  });

  it("grafo indisponível sem Graphify ou fora do git; remoção do projeto apaga tudo", async () => {
    const plain = (
      await api("POST", "/api/v1/projects", { path: realpathSync(tempDir("devtools-plain-")) })
    ).json<Project>();
    const plainStatus = (await api("GET", `/api/v1/projects/${plain.id}/knowledge`)).json<KnowledgeStatus>();
    expect(plainStatus.graph).toMatchObject({ available: false, reason: expect.stringContaining("git") });
    expect((await api("POST", `/api/v1/projects/${plain.id}/knowledge/graph`)).statusCode).toBe(409);

    await enable();
    await api("POST", `${base()}/graph`);
    await ctx.knowledge.idle(project.id);
    expect((await api("DELETE", `/api/v1/projects/${project.id}`)).statusCode).toBe(204);
    expect(existsSync(ctx.knowledge.semantic.vectorPath(project.id))).toBe(false);
    expect(existsSync(ctx.knowledge.graph.graphPath(project.id))).toBe(false);
  });
});

describe("Graphify externo", () => {
  it("roda só com AST, sem chaves de API, com HOME isolado e sem gravar no projeto", async () => {
    const dir = realpathSync(tempDir("devtools-graphify-"));
    const envDump = join(dir, "env.txt");
    const bin = join(dir, "graphify");
    writeFileSync(
      bin,
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "graphify 0.9.97"; exit 0; fi
env > "${envDump}"
echo "$@" >> "${envDump}"
while [ "$1" != "--out" ]; do shift; done
mkdir -p "$2/graphify-out"
echo '{"nodes":[{"id":"a","label":"A","source_file":"a.ts","source_location":"L3"}],"edges":[]}' > "$2/graphify-out/graph.json"
`,
    );
    chmodSync(bin, 0o755);
    const repo = makeProject();
    const before = readdirSync(repo).sort();
    const extractor = new GraphifyExtractor(bin, join(dir, "home"));
    expect(await extractor.check()).toBeNull();

    process.env.ANTHROPIC_API_KEY = FIXTURE_SECRET;
    try {
      const graph = await extractor.extract(repo, join(dir, "out"), new AbortController().signal);
      expect(graph.nodes?.[0]).toMatchObject({ label: "A" });
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
    const env = readFileSync(envDump, "utf8");
    expect(env).not.toContain("ANTHROPIC_API_KEY");
    expect(env).not.toContain(FIXTURE_SECRET);
    expect(env).toContain(`HOME=${join(dir, "home")}`);
    expect(env).toContain("GRAPHIFY_QUERY_LOG_DISABLE=1");
    expect(env).toContain(`extract ${repo} --code-only --no-cluster --out ${join(dir, "out")}`);
    expect(readdirSync(repo).sort()).toEqual(before);

    expect(await new GraphifyExtractor(join(dir, "nao-existe"), dir).check()).toContain(
      "pipx install graphifyy",
    );
  });

  it("junta repositórios e encontra símbolos por id ou nome", () => {
    const merged = mergeGraphs([
      {
        repo: "",
        graph: {
          nodes: [
            { id: "x", label: "X", source_file: "x.ts" },
            { id: "lib", label: "Lib" },
          ],
        },
      },
      {
        repo: "api",
        graph: {
          nodes: [
            { id: "x", label: "X", source_file: "x.java" },
            { id: "lib", label: "Lib" },
          ],
        },
      },
    ]);
    expect(merged.nodes.map((n) => [n.id, n.file])).toEqual([
      ["::x", "x.ts"],
      ["ext::lib", null],
      ["api::x", "api/x.java"],
    ]);
    const index = new CodeGraphIndex(merged);
    expect(index.query("X", 2).candidates).toHaveLength(1);
    expect(index.query("api::x", 2).node?.filePath).toBe("api/x.java");
    expect(index.query("Inexistente", 2).node).toBeNull();
  });
});

describe("configuração do conhecimento", () => {
  it("aceita Ollama só em loopback", () => {
    expect(loadConfig({}).knowledge.ollamaUrl).toBe("http://127.0.0.1:11434");
    expect(loadConfig({ DEVTOOLS_OLLAMA_URL: "http://localhost:9999/" }).knowledge.ollamaUrl).toBe(
      "http://localhost:9999",
    );
    expect(() => loadConfig({ DEVTOOLS_OLLAMA_URL: "http://192.168.0.10:11434" })).toThrow(/local/);
    expect(() => loadConfig({ DEVTOOLS_OLLAMA_URL: "https://api.exemplo.com" })).toThrow(/local/);
  });
});
