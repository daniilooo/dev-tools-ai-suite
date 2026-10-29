import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const FAKE_EMBED_MODEL = "fake-embed";

/** Vetor determinístico por saco de palavras: textos com as mesmas palavras ficam próximos. */
function vectorize(text: string): number[] {
  const v = new Array<number>(64).fill(0);
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
}

/** Ollama falso em loopback com a API documentada (`/api/tags`, `/api/embed`). */
export async function startFakeOllama(): Promise<{ url: string; stop(): Promise<void> }> {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/api/tags") {
        response.end(JSON.stringify({ models: [{ name: `${FAKE_EMBED_MODEL}:latest` }] }));
      } else if (request.url === "/api/embed") {
        const { input } = JSON.parse(body) as { input: string[] };
        response.end(JSON.stringify({ embeddings: input.map(vectorize) }));
      } else {
        response.statusCode = 404;
        response.end("{}");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Graphify falso: grava um grafo fixo em `--out`, como o real faz com `extract --code-only`. */
export function fakeGraphifyBin(): string {
  const dir = mkdtempSync(join(tmpdir(), "devtools-e2e-graphify-"));
  const bin = join(dir, "graphify");
  const graph = {
    nodes: [
      { id: "rs", label: "ReservaService", source_file: "src/reserva.service.ts", source_location: "L1" },
      {
        id: "ag",
        label: ".agendarRecorrencia()",
        source_file: "src/reserva.service.ts",
        source_location: "L2",
      },
      {
        id: "rc",
        label: "ReservaController",
        source_file: "src/reserva.controller.ts",
        source_location: "L3",
      },
      { id: "app", label: "AppModule", source_file: "src/app.module.ts", source_location: "L1" },
    ],
    edges: [
      {
        source: "rs",
        target: "ag",
        relation: "method",
        source_file: "src/reserva.service.ts",
        source_location: "L2",
      },
      {
        source: "rc",
        target: "rs",
        relation: "references",
        source_file: "src/reserva.controller.ts",
        source_location: "L7",
      },
      {
        source: "app",
        target: "rc",
        relation: "imports",
        source_file: "src/app.module.ts",
        source_location: "L2",
      },
    ],
  };
  writeFileSync(
    bin,
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo "graphify 0.9.97"; exit 0; fi
while [ "$1" != "--out" ]; do shift; done
mkdir -p "$2/graphify-out"
cat > "$2/graphify-out/graph.json" <<'JSON'
${JSON.stringify(graph)}
JSON
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}
