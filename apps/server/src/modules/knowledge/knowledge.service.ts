import type {
  KnowledgeHit,
  KnowledgeIndexState,
  KnowledgeQueryResponse,
  KnowledgeSkipped,
  KnowledgeStatus,
} from "@devtools/shared";
import { lstatSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../../core/database.js";
import { AppError, badRequest } from "../../core/errors.js";
import type { ProjectsService } from "../projects/projects.service.js";
import { indexFiles, listProjectFiles } from "./indexer.js";
import { KnowledgeIndexReader, KnowledgeIndexWriter, searchTerms } from "./knowledge-index.js";

const EMPTY_SKIPPED: KnowledgeSkipped = { sensitive: 0, noise: 0, large: 0, binary: 0 };
/** Embeddings locais aguardam o spike S-03 e a aprovação da dependência nativa (HG-07). */
const SEMANTIC_UNAVAILABLE =
  "Busca semântica INDISPONÍVEL: nenhum mecanismo de embeddings local configurado ainda. A busca textual funciona.";

interface Row {
  project_id: string;
  state: KnowledgeIndexState;
  files: number;
  chunks: number;
  skipped_json: string;
  indexed_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

/**
 * Conhecimento local (RN-04): indexa o projeto em um índice textual próprio, sem nenhuma
 * chamada de rede, e responde consultas com arquivo e linhas. Uma indexação por projeto
 * de cada vez; o índice anterior segue consultável até a nova terminar.
 */
export class KnowledgeService {
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly db: Db,
    private readonly projects: ProjectsService,
    private readonly indexesDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    mkdirSync(indexesDir, { recursive: true, mode: 0o700 });
    // Indexação interrompida por reinício do servidor.
    this.db
      .prepare("UPDATE knowledge_indexes SET state = 'failed', error = ? WHERE state = 'indexing'")
      .run("indexação interrompida: o servidor foi reiniciado");
  }

  indexPath(projectId: string): string {
    return join(this.indexesDir, `${projectId}.db`);
  }

  async status(projectId: string): Promise<KnowledgeStatus> {
    const project = this.projects.get(projectId);
    const row = this.row(projectId);
    const base: KnowledgeStatus = {
      projectId,
      state: row?.state ?? "not_indexed",
      files: row?.files ?? 0,
      chunks: row?.chunks ?? 0,
      skipped: row ? (JSON.parse(row.skipped_json) as KnowledgeSkipped) : EMPTY_SKIPPED,
      indexedAt: row?.indexed_at ?? null,
      durationMs: row?.duration_ms ?? null,
      changedFiles: 0,
      error: row?.error ?? null,
      semantic: { available: false, reason: SEMANTIC_UNAVAILABLE },
    };
    if (base.state !== "indexed") return base;
    const changed = await this.changedFiles(project.path, projectId);
    return changed > 0 ? { ...base, state: "outdated", changedFiles: changed } : base;
  }

  /** Inicia (ou reinicia) a indexação em segundo plano. */
  start(projectId: string): KnowledgeStatus["state"] {
    const project = this.projects.get(projectId);
    if (this.running.has(projectId)) return "indexing";
    const startedAt = Date.now();
    this.save(projectId, { state: "indexing", error: null });
    const job = (async () => {
      const writer = new KnowledgeIndexWriter(this.indexPath(projectId));
      try {
        const listed = await listProjectFiles(project.path);
        const result = await indexFiles(project.path, listed, writer);
        writer.commit();
        this.save(projectId, {
          state: "indexed",
          files: result.files,
          chunks: result.chunks,
          skipped: result.skipped,
          indexedAt: this.now().toISOString(),
          durationMs: Date.now() - startedAt,
          error: null,
        });
      } catch (error) {
        writer.abort();
        this.save(projectId, { state: "failed", error: `falha na indexação: ${(error as Error).message}` });
      }
    })().finally(() => this.running.delete(projectId));
    this.running.set(projectId, job);
    return "indexing";
  }

  /** Aguarda a indexação em andamento (testes e desligamento). */
  async idle(projectId?: string): Promise<void> {
    const jobs = projectId ? [this.running.get(projectId)] : [...this.running.values()];
    await Promise.all(jobs.filter(Boolean));
  }

  /** Remove o índice do projeto; o código do projeto não é tocado. */
  async remove(projectId: string, { checkProject = true } = {}): Promise<void> {
    if (checkProject) this.projects.get(projectId);
    await this.idle(projectId);
    rmSync(this.indexPath(projectId), { force: true });
    this.db.prepare("DELETE FROM knowledge_indexes WHERE project_id = ?").run(projectId);
  }

  async query(projectId: string, text: string, limit = 20): Promise<KnowledgeQueryResponse> {
    const project = this.projects.get(projectId);
    const query = text.trim().slice(0, 500);
    if (!query) throw badRequest("Informe o que procurar.");
    const reader = KnowledgeIndexReader.open(this.indexPath(projectId));
    if (!reader) {
      throw new AppError("KNOWLEDGE_NOT_INDEXED", 409, "Este projeto ainda não foi indexado.");
    }
    try {
      const indexed = new Map(reader.files().map((f) => [f.path, f]));
      const hits: KnowledgeHit[] = reader
        .search(searchTerms(query), Math.min(Math.max(limit, 1), 50))
        .map((hit) => ({
          filePath: hit.path,
          lineStart: hit.lineStart,
          lineEnd: hit.lineEnd,
          snippet: hit.snippet,
          stale: isStale(project.path, indexed.get(hit.path)),
        }));
      return { query, mode: "lexical", hits };
    } finally {
      reader.close();
    }
  }

  private async changedFiles(root: string, projectId: string): Promise<number> {
    const reader = KnowledgeIndexReader.open(this.indexPath(projectId));
    if (!reader) return 0;
    try {
      const indexed = new Map(reader.files().map((f) => [f.path, f]));
      const current = await listProjectFiles(root);
      let changed = 0;
      for (const file of current.files) {
        const before = indexed.get(file.path);
        if (!before || before.mtimeMs !== file.mtimeMs || before.size !== file.size) changed++;
        indexed.delete(file.path);
      }
      // O que sobrou no índice foi removido do projeto (ou passou a ser ignorado).
      return changed + indexed.size;
    } finally {
      reader.close();
    }
  }

  private row(projectId: string): Row | undefined {
    return this.db.prepare("SELECT * FROM knowledge_indexes WHERE project_id = ?").get(projectId) as
      Row | undefined;
  }

  private save(
    projectId: string,
    patch: Partial<{
      state: KnowledgeIndexState;
      files: number;
      chunks: number;
      skipped: KnowledgeSkipped;
      indexedAt: string;
      durationMs: number;
      error: string | null;
    }>,
  ): void {
    const current = this.row(projectId);
    const next = {
      state: patch.state ?? current?.state ?? "not_indexed",
      files: patch.files ?? current?.files ?? 0,
      chunks: patch.chunks ?? current?.chunks ?? 0,
      skipped: JSON.stringify(patch.skipped ?? (current ? JSON.parse(current.skipped_json) : EMPTY_SKIPPED)),
      indexedAt: patch.indexedAt ?? current?.indexed_at ?? null,
      durationMs: patch.durationMs ?? current?.duration_ms ?? null,
      error: patch.error === undefined ? (current?.error ?? null) : patch.error,
    };
    this.db
      .prepare(
        `INSERT INTO knowledge_indexes (project_id, state, files, chunks, skipped_json, indexed_at, duration_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET state = excluded.state, files = excluded.files,
           chunks = excluded.chunks, skipped_json = excluded.skipped_json, indexed_at = excluded.indexed_at,
           duration_ms = excluded.duration_ms, error = excluded.error`,
      )
      .run(
        projectId,
        next.state,
        next.files,
        next.chunks,
        next.skipped,
        next.indexedAt,
        next.durationMs,
        next.error,
      );
  }
}

function isStale(root: string, file: { path: string; size: number; mtimeMs: number } | undefined): boolean {
  if (!file) return true;
  try {
    const stat = lstatSync(join(root, file.path));
    return stat.size !== file.size || stat.mtimeMs !== file.mtimeMs;
  } catch {
    return true;
  }
}
