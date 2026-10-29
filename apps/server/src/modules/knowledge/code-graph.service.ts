import type { CodeGraphQueryResponse, CodeGraphState, CodeGraphStatus } from "@devtools/shared";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../../core/database.js";
import { AppError, badRequest } from "../../core/errors.js";
import type { ProjectsService } from "../projects/projects.service.js";
import { CodeGraphIndex, mergeGraphs } from "./code-graph.js";
import type { CompactGraph, GraphExtractor } from "./code-graph.js";
import { nestedRepos } from "./indexer.js";

const CHECK_TTL_MS = 30_000;

interface Row {
  state: CodeGraphState;
  nodes: number;
  edges: number;
  repos: number;
  built_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

/**
 * Grafo de código opcional (ADR-0006, D-20): o Graphify externo analisa cada repositório
 * (raiz e aninhados) só por AST, com saída no diretório de dados, e a suíte guarda um grafo
 * compacto por projeto em `graphs/<projeto>.json` (0600) para perguntas de impacto.
 */
export class CodeGraphService {
  private readonly running = new Map<string, { job: Promise<void>; abort: AbortController }>();
  private readonly cache = new Map<string, { mtimeMs: number; index: CodeGraphIndex }>();
  private availability: { at: number; reason: string | null } | null = null;

  constructor(
    private readonly db: Db,
    private readonly projects: ProjectsService,
    private readonly graphsDir: string,
    private readonly extractor: GraphExtractor,
    private readonly now: () => Date = () => new Date(),
  ) {
    mkdirSync(graphsDir, { recursive: true, mode: 0o700 });
    this.db
      .prepare("UPDATE knowledge_graphs SET state = 'failed', error = ? WHERE state = 'building'")
      .run("geração do grafo interrompida: o servidor foi reiniciado");
  }

  graphPath(projectId: string): string {
    return join(this.graphsDir, `${projectId}.json`);
  }

  async status(projectId: string): Promise<CodeGraphStatus> {
    const project = this.projects.get(projectId);
    const row = this.row(projectId);
    let reason = await this.check();
    if (!reason && !existsSync(join(project.path, ".git"))) {
      reason =
        "O grafo de código exige um repositório git (o Graphify segue o .gitignore de cada repositório).";
    }
    return {
      available: reason === null,
      reason,
      state: row?.state ?? "not_built",
      nodes: row?.nodes ?? 0,
      edges: row?.edges ?? 0,
      repos: row?.repos ?? 0,
      builtAt: row?.built_at ?? null,
      durationMs: row?.duration_ms ?? null,
      error: row?.error ?? null,
    };
  }

  async start(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    const status = await this.status(projectId);
    if (!status.available)
      throw new AppError("GRAPH_UNAVAILABLE", 409, status.reason ?? "Grafo indisponível.");
    if (this.running.has(projectId)) return;
    const abort = new AbortController();
    const startedAt = Date.now();
    this.save(projectId, { state: "building", error: null });
    const workDir = join(this.graphsDir, `${projectId}.work`);
    const job = (async () => {
      try {
        rmSync(workDir, { recursive: true, force: true });
        const repos = ["", ...nestedRepos(project.path)];
        const parts = [];
        for (const [i, repo] of repos.entries()) {
          const repoDir = repo ? join(project.path, repo) : project.path;
          parts.push({
            repo,
            graph: await this.extractor.extract(repoDir, join(workDir, String(i)), abort.signal),
          });
        }
        const graph = mergeGraphs(parts);
        const target = this.graphPath(projectId);
        writeFileSync(`${target}.tmp`, JSON.stringify(graph), { mode: 0o600 });
        renameSync(`${target}.tmp`, target);
        this.cache.delete(projectId);
        this.save(projectId, {
          state: "built",
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          repos: repos.length,
          builtAt: this.now().toISOString(),
          durationMs: Date.now() - startedAt,
          error: null,
        });
      } catch (error) {
        if (this.row(projectId)) {
          this.save(projectId, { state: "failed", error: `falha no grafo: ${(error as Error).message}` });
        }
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    })().finally(() => this.running.delete(projectId));
    this.running.set(projectId, { job, abort });
  }

  async query(projectId: string, symbol: string, depth = 2): Promise<CodeGraphQueryResponse> {
    this.projects.get(projectId);
    const name = symbol.trim().slice(0, 300);
    if (!name) throw badRequest("Informe o nome de uma classe, função ou arquivo.");
    const index = this.load(projectId);
    if (!index) throw new AppError("GRAPH_NOT_BUILT", 409, "O grafo deste projeto ainda não foi gerado.");
    return index.query(name, Math.min(Math.max(Math.trunc(depth) || 2, 1), 4));
  }

  async remove(projectId: string, { checkProject = true } = {}): Promise<void> {
    if (checkProject) this.projects.get(projectId);
    const current = this.running.get(projectId);
    current?.abort.abort();
    await current?.job;
    rmSync(this.graphPath(projectId), { force: true });
    this.cache.delete(projectId);
    this.db.prepare("DELETE FROM knowledge_graphs WHERE project_id = ?").run(projectId);
  }

  async idle(projectId?: string): Promise<void> {
    const jobs = projectId ? [this.running.get(projectId)] : [...this.running.values()];
    await Promise.all(jobs.map((j) => j?.job));
  }

  /** Desligamento: encerra os processos do Graphify em andamento. */
  async shutdown(): Promise<void> {
    for (const { abort } of this.running.values()) abort.abort();
    await this.idle();
  }

  private load(projectId: string): CodeGraphIndex | null {
    const path = this.graphPath(projectId);
    if (!existsSync(path)) return null;
    const mtimeMs = statSync(path).mtimeMs;
    const cached = this.cache.get(projectId);
    if (cached?.mtimeMs === mtimeMs) return cached.index;
    const index = new CodeGraphIndex(JSON.parse(readFileSync(path, "utf8")) as CompactGraph);
    this.cache.set(projectId, { mtimeMs, index });
    return index;
  }

  private async check(): Promise<string | null> {
    if (this.availability && Date.now() - this.availability.at < CHECK_TTL_MS)
      return this.availability.reason;
    const reason = await this.extractor.check();
    this.availability = { at: Date.now(), reason };
    return reason;
  }

  private row(projectId: string): Row | undefined {
    return this.db.prepare("SELECT * FROM knowledge_graphs WHERE project_id = ?").get(projectId) as
      Row | undefined;
  }

  private save(
    projectId: string,
    patch: Partial<{
      state: CodeGraphState;
      nodes: number;
      edges: number;
      repos: number;
      builtAt: string;
      durationMs: number;
      error: string | null;
    }>,
  ): void {
    const current = this.row(projectId);
    this.db
      .prepare(
        `INSERT INTO knowledge_graphs (project_id, state, nodes, edges, repos, built_at, duration_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET state = excluded.state, nodes = excluded.nodes,
           edges = excluded.edges, repos = excluded.repos, built_at = excluded.built_at,
           duration_ms = excluded.duration_ms, error = excluded.error`,
      )
      .run(
        projectId,
        patch.state ?? current?.state ?? "not_built",
        patch.nodes ?? current?.nodes ?? 0,
        patch.edges ?? current?.edges ?? 0,
        patch.repos ?? current?.repos ?? 0,
        patch.builtAt ?? current?.built_at ?? null,
        patch.durationMs ?? current?.duration_ms ?? null,
        patch.error === undefined ? (current?.error ?? null) : patch.error,
      );
  }
}
