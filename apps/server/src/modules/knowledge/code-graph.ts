import type { CodeGraphImpact, CodeGraphLink, CodeGraphNode, CodeGraphQueryResponse } from "@devtools/shared";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runProcess } from "../../core/process-runner.js";
import { redact } from "../../core/redact.js";
import { exclusionFor } from "./exclusions.js";

/** Grafo compacto salvo em `<dados>/graphs/<projeto>.json`: só símbolos, arquivos e linhas. */
export interface CompactGraph {
  version: 1;
  nodes: { id: string; label: string; file: string | null; line: number | null }[];
  edges: { s: number; t: number; r: string; file: string | null; line: number | null }[];
}

interface RawNode {
  id: string;
  label?: string;
  source_file?: string;
  source_location?: string;
}
interface RawEdge {
  source: string;
  target: string;
  relation?: string;
  source_file?: string;
  source_location?: string;
}
interface RawGraph {
  nodes?: RawNode[];
  edges?: RawEdge[];
  links?: RawEdge[];
}

/** Executa o Graphify (processo externo, opcional) só com análise local de código. */
export interface GraphExtractor {
  check(): Promise<string | null>;
  extract(repoDir: string, outDir: string, signal: AbortSignal): Promise<RawGraph>;
}

export class GraphifyExtractor implements GraphExtractor {
  constructor(
    private readonly bin: string,
    private readonly homeDir: string,
  ) {}

  async check(): Promise<string | null> {
    const result = await runProcess(this.bin, ["--version"], { env: this.env(), timeoutMs: 15_000 });
    return result.spawnError === null && result.exitCode === 0
      ? null
      : "Graphify não encontrado. Instale com `pipx install graphifyy` (ou `pip install graphifyy`) e deixe `graphify` no PATH, ou defina DEVTOOLS_GRAPHIFY_BIN.";
  }

  async extract(repoDir: string, outDir: string, signal: AbortSignal): Promise<RawGraph> {
    mkdirSync(outDir, { recursive: true, mode: 0o700 });
    // --code-only: só AST local, nenhum LLM; --out: nada é gravado dentro do projeto (INV-05).
    const result = await runProcess(
      this.bin,
      ["extract", repoDir, "--code-only", "--no-cluster", "--out", outDir],
      { cwd: outDir, env: this.env(), timeoutMs: 20 * 60_000, maxOutputBytes: 64 * 1024, signal },
    );
    if (signal.aborted) throw new Error("geração do grafo cancelada");
    if (result.timedOut) throw new Error("o Graphify passou de 20 minutos");
    if (result.exitCode !== 0) {
      const detail = redact((result.stderr || result.stdout || result.spawnError || "").trim()).slice(-300);
      throw new Error(`o Graphify falhou (código ${result.exitCode}): ${detail}`);
    }
    return JSON.parse(readFileSync(join(outDir, "graphify-out", "graph.json"), "utf8")) as RawGraph;
  }

  /** Ambiente mínimo: sem chaves de API (nada de LLM) e com HOME isolado para caches e logs. */
  private env(): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH,
      HOME: this.homeDir,
      LANG: "C.UTF-8",
      GRAPHIFY_QUERY_LOG_DISABLE: "1",
    };
  }
}

/**
 * Junta os grafos de cada repositório (raiz e aninhados) com caminhos relativos ao projeto.
 * Símbolos de arquivos excluídos da indexação (segredos, dependências) ficam de fora; símbolos
 * externos (bibliotecas) são compartilhados entre os repositórios.
 */
export function mergeGraphs(parts: { repo: string; graph: RawGraph }[]): CompactGraph {
  const nodes: CompactGraph["nodes"] = [];
  const edges: CompactGraph["edges"] = [];
  const index = new Map<string, number>();
  const nested = parts.map((p) => p.repo).filter(Boolean);

  for (const { repo, graph } of parts) {
    const local = new Map<string, number>();
    for (const raw of graph.nodes ?? []) {
      const file = raw.source_file ? prefixed(repo, raw.source_file) : null;
      if (file && !keepFile(file, repo, nested)) continue;
      const key = file ? `${repo}::${raw.id}` : `ext::${raw.id}`;
      let at = index.get(key);
      if (at === undefined) {
        at = nodes.push({ id: key, label: raw.label ?? raw.id, file, line: lineOf(raw.source_location) }) - 1;
        index.set(key, at);
      }
      local.set(raw.id, at);
    }
    for (const raw of graph.edges ?? graph.links ?? []) {
      const s = local.get(raw.source);
      const t = local.get(raw.target);
      if (s === undefined || t === undefined || s === t) continue;
      edges.push({
        s,
        t,
        r: raw.relation ?? "related",
        file: raw.source_file ? prefixed(repo, raw.source_file) : null,
        line: lineOf(raw.source_location),
      });
    }
  }
  return { version: 1, nodes, edges };
}

function prefixed(repo: string, file: string): string {
  return repo ? `${repo}/${file}` : file;
}

/** A raiz não repete arquivos de repositórios aninhados; exclusões valem também para o grafo. */
function keepFile(file: string, repo: string, nested: string[]): boolean {
  if (exclusionFor(file)) return false;
  return repo !== "" || !nested.some((n) => file.startsWith(`${n}/`));
}

function lineOf(location: string | undefined): number | null {
  const match = /L(\d+)/.exec(location ?? "");
  return match ? Number(match[1]) : null;
}

/** Relações seguidas ao contrário para estimar impacto (quem usa quem usa…). */
const IMPACT_RELATIONS = new Set([
  "calls",
  "indirect_call",
  "references",
  "imports",
  "imports_from",
  "dynamic_import",
  "re_exports",
  "inherits",
  "extends",
  "implements",
  "uses",
  "mixes_in",
  "embeds",
  "requires",
]);
/** Relações estruturais (arquivo contém classe, classe tem método) não são "quem usa". */
const STRUCTURAL = new Set(["contains", "method", "defines"]);
const MAX_LINKS = 100;
const MAX_IMPACT = 200;

export class CodeGraphIndex {
  private readonly outgoing: number[][];
  private readonly incoming: number[][];
  private readonly byLabel = new Map<string, number[]>();
  private readonly byId = new Map<string, number>();

  constructor(private readonly graph: CompactGraph) {
    this.outgoing = graph.nodes.map(() => []);
    this.incoming = graph.nodes.map(() => []);
    graph.edges.forEach((edge, i) => {
      this.outgoing[edge.s]!.push(i);
      this.incoming[edge.t]!.push(i);
    });
    graph.nodes.forEach((node, i) => {
      this.byId.set(node.id, i);
      const key = normalize(node.label);
      this.byLabel.set(key, [...(this.byLabel.get(key) ?? []), i]);
    });
  }

  query(symbol: string, depth: number): CodeGraphQueryResponse {
    const exact = this.byId.get(symbol);
    const candidates = exact !== undefined ? [exact] : this.rank(this.byLabel.get(normalize(symbol)) ?? []);
    const at = candidates[0];
    if (at === undefined) {
      return { symbol, node: null, candidates: [], dependencies: [], dependents: [], impact: [] };
    }
    return {
      symbol,
      node: this.node(at),
      candidates: candidates.slice(1, 20).map((i) => this.node(i)),
      dependencies: this.outgoing[at]!.slice(0, MAX_LINKS).map((e) => this.link(e, "t")),
      dependents: this.incoming[at]!.filter((e) => !STRUCTURAL.has(this.graph.edges[e]!.r))
        .slice(0, MAX_LINKS)
        .map((e) => this.link(e, "s")),
      impact: this.impact(at, depth),
    };
  }

  /** Busca em largura pelos dependentes, subindo de um método para a classe que o contém. */
  private impact(start: number, depth: number): CodeGraphImpact[] {
    const seen = new Set([start]);
    const result: CodeGraphImpact[] = [];
    let frontier = [start];
    for (let level = 1; level <= depth && frontier.length > 0; level++) {
      const next: number[] = [];
      for (const at of frontier) {
        for (const e of this.incoming[at]!) {
          const edge = this.graph.edges[e]!;
          if (!IMPACT_RELATIONS.has(edge.r) || seen.has(edge.s)) continue;
          seen.add(edge.s);
          next.push(edge.s);
          result.push({ node: this.node(edge.s), relation: edge.r, depth: level });
          if (result.length >= MAX_IMPACT) return result;
        }
      }
      frontier = next;
    }
    return result;
  }

  /** Prefere símbolos do projeto (com arquivo) e mais conectados. */
  private rank(indices: number[]): number[] {
    const degree = (i: number) => this.outgoing[i]!.length + this.incoming[i]!.length;
    return [...indices].sort((a, b) => {
      const local = Number(this.graph.nodes[b]!.file !== null) - Number(this.graph.nodes[a]!.file !== null);
      return local !== 0 ? local : degree(b) - degree(a);
    });
  }

  private node(i: number): CodeGraphNode {
    const { id, label, file, line } = this.graph.nodes[i]!;
    return { id, label, filePath: file, line };
  }

  private link(e: number, side: "s" | "t"): CodeGraphLink {
    const edge = this.graph.edges[e]!;
    return { relation: edge.r, node: this.node(edge[side]), filePath: edge.file, line: edge.line };
  }
}

/** `.revokeAll()` e `revokeAll` são o mesmo símbolo para quem pergunta. */
function normalize(label: string): string {
  return label.trim().replace(/^\./, "").replace(/\(\)$/, "").toLowerCase();
}
