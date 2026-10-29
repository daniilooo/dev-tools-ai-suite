import type {
  KnowledgeSemanticRequest,
  SemanticProviderId,
  SemanticProviderInfo,
  SemanticState,
  SemanticStatus,
} from "@devtools/shared";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Db } from "../../core/database.js";
import { AppError, badRequest } from "../../core/errors.js";
import { describe } from "./embeddings.js";
import type { EmbeddingProvider } from "./embeddings.js";
import { KnowledgeIndexReader } from "./knowledge-index.js";
import { VectorStore } from "./vector-store.js";
import type { VectorHit, VectorRef } from "./vector-store.js";

const BATCH = 16;
const PREVIEW_CHARS = 400;
const CHECK_TTL_MS = 10_000;

interface Row {
  provider: SemanticProviderId;
  model: string;
  state: SemanticState;
  embedded: number;
  total: number;
  updated_at: string | null;
  error: string | null;
}

/**
 * Busca semântica opcional (ADR-0006, D-20). Só existe para projetos em que o humano a ligou;
 * os vetores ficam em `indexes/<projeto>.vec.db` e são calculados em segundo plano a partir
 * dos trechos do índice textual, reaproveitando os que não mudaram.
 */
export class SemanticService {
  private readonly running = new Map<string, { job: Promise<void>; abort: AbortController }>();
  private readonly checks = new Map<SemanticProviderId, { at: number; reason: string | null }>();

  constructor(
    private readonly db: Db,
    private readonly providers: EmbeddingProvider[],
    private readonly indexesDir: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.db
      .prepare("UPDATE knowledge_semantic SET state = 'failed', error = ? WHERE state = 'indexing'")
      .run("cálculo dos vetores interrompido: o servidor foi reiniciado");
  }

  vectorPath(projectId: string): string {
    return join(this.indexesDir, `${projectId}.vec.db`);
  }

  async catalog(): Promise<SemanticProviderInfo[]> {
    return Promise.all(this.providers.map((p) => describe(p)));
  }

  async status(projectId: string): Promise<SemanticStatus> {
    const row = this.row(projectId);
    if (!row) {
      const reasons = await Promise.all(this.providers.map((p) => this.check(p)));
      const available = reasons.some((r) => r === null);
      return {
        available,
        reason: available
          ? null
          : `Busca semântica INDISPONÍVEL: nenhum mecanismo de embeddings local pronto. ${reasons.join(" ")}`,
        enabled: false,
        provider: null,
        model: null,
        state: "off",
        embedded: 0,
        total: 0,
        updatedAt: null,
        error: null,
      };
    }
    const provider = this.providers.find((p) => p.id === row.provider);
    const reason = provider ? await this.check(provider) : "Mecanismo de embeddings desconhecido.";
    return {
      available: reason === null,
      reason,
      enabled: true,
      provider: row.provider,
      model: row.model,
      state: row.state,
      embedded: row.embedded,
      total: row.total,
      updatedAt: row.updated_at,
      error: row.error,
    };
  }

  /** Liga (com consentimento, se o modelo for baixado) ou desliga a busca semântica do projeto. */
  async configure(projectId: string, request: KnowledgeSemanticRequest, indexPath: string): Promise<void> {
    if (!request.enabled) return this.disable(projectId);
    const provider = this.providers.find((p) => p.id === request.provider);
    if (!provider) throw badRequest("Escolha o mecanismo de embeddings (ollama ou transformers).");
    if (provider.downloadsModel && request.consentModelDownload !== true) {
      throw badRequest(`Confirme o download do modelo ${provider.model} para ligar a busca semântica.`);
    }
    this.checks.delete(provider.id);
    const reason = await this.check(provider);
    if (reason) throw new AppError("SEMANTIC_UNAVAILABLE", 409, reason);
    const reader = KnowledgeIndexReader.open(indexPath);
    if (!reader) {
      throw new AppError("KNOWLEDGE_NOT_INDEXED", 409, "Indexe o projeto antes de ligar a busca semântica.");
    }
    reader.close();
    const row = this.row(projectId);
    if (row && (row.provider !== provider.id || row.model !== provider.model)) await this.disable(projectId);
    this.save(projectId, { provider: provider.id, model: provider.model, state: "indexing", error: null });
    this.start(projectId, indexPath);
  }

  /** Recalcula os vetores depois de uma (re)indexação textual, se a busca estiver ligada. */
  start(projectId: string, indexPath: string): void {
    const row = this.row(projectId);
    const provider = row && this.providers.find((p) => p.id === row.provider);
    if (!row || !provider) return;
    const previous = this.running.get(projectId);
    previous?.abort.abort();
    const abort = new AbortController();
    this.save(projectId, { state: "indexing", error: null });
    const job = (async () => {
      await previous?.job;
      if (abort.signal.aborted) return;
      try {
        await this.embedAll(projectId, provider, indexPath, abort.signal);
        if (!abort.signal.aborted)
          this.save(projectId, { state: "ready", updatedAt: this.now().toISOString() });
      } catch (error) {
        if (!abort.signal.aborted && this.row(projectId)) {
          this.save(projectId, {
            state: "failed",
            error: `falha nos embeddings: ${(error as Error).message}`,
          });
        }
      }
    })().finally(() => {
      if (this.running.get(projectId)?.abort === abort) this.running.delete(projectId);
    });
    this.running.set(projectId, { job, abort });
  }

  async disable(projectId: string): Promise<void> {
    await this.cancel(projectId);
    VectorStore.remove(this.vectorPath(projectId));
    this.db.prepare("DELETE FROM knowledge_semantic WHERE project_id = ?").run(projectId);
  }

  /** Vetores mais próximos da consulta; null quando a busca semântica não está utilizável. */
  async search(projectId: string, query: string, limit: number): Promise<VectorHit[] | null> {
    const row = this.row(projectId);
    const provider = row && this.providers.find((p) => p.id === row.provider);
    if (!row || !provider || row.embedded === 0) return null;
    const [vector] = await provider.embed([query], "query");
    const store = VectorStore.open(this.vectorPath(projectId), modelKey(provider));
    try {
      return store.search(vector!, limit);
    } finally {
      store.close();
    }
  }

  usable(projectId: string): boolean {
    const row = this.row(projectId);
    return !!row && row.embedded > 0;
  }

  async idle(projectId?: string): Promise<void> {
    const jobs = projectId ? [this.running.get(projectId)] : [...this.running.values()];
    await Promise.all(jobs.map((j) => j?.job));
  }

  /** Desligamento: interrompe os cálculos em andamento. */
  async shutdown(): Promise<void> {
    for (const { abort } of this.running.values()) abort.abort();
    await this.idle();
  }

  private async cancel(projectId: string): Promise<void> {
    const current = this.running.get(projectId);
    current?.abort.abort();
    await current?.job;
  }

  private async embedAll(
    projectId: string,
    provider: EmbeddingProvider,
    indexPath: string,
    signal: AbortSignal,
  ): Promise<void> {
    const reader = KnowledgeIndexReader.open(indexPath);
    if (!reader) throw new Error("o projeto não tem índice textual");
    const store = VectorStore.open(this.vectorPath(projectId), modelKey(provider));
    try {
      const chunks = [...reader.chunks()].map((chunk) => ({ hash: hashOf(chunk), chunk }));
      const keep = new Set(chunks.map((c) => c.hash));
      store.retain(keep);
      const existing = store.hashes();
      const pending = chunks.filter((c) => !existing.has(c.hash));
      let embedded = chunks.length - pending.length;
      this.save(projectId, { embedded, total: chunks.length });
      for (let i = 0; i < pending.length; i += BATCH) {
        if (signal.aborted) return;
        const batch = pending.slice(i, i + BATCH);
        const vectors = await provider.embed(
          batch.map((b) => b.chunk.body),
          "passage",
        );
        if (signal.aborted) return;
        store.add(batch.map((b, k) => ({ hash: b.hash, ref: refOf(b.chunk), vector: vectors[k]! })));
        embedded += batch.length;
        this.save(projectId, { embedded });
      }
    } finally {
      store.close();
      reader.close();
    }
  }

  private async check(provider: EmbeddingProvider): Promise<string | null> {
    const cached = this.checks.get(provider.id);
    if (cached && Date.now() - cached.at < CHECK_TTL_MS) return cached.reason;
    const reason = await provider.check();
    this.checks.set(provider.id, { at: Date.now(), reason });
    return reason;
  }

  private row(projectId: string): Row | undefined {
    return this.db.prepare("SELECT * FROM knowledge_semantic WHERE project_id = ?").get(projectId) as
      Row | undefined;
  }

  private save(
    projectId: string,
    patch: Partial<{
      provider: SemanticProviderId;
      model: string;
      state: SemanticState;
      embedded: number;
      total: number;
      updatedAt: string;
      error: string | null;
    }>,
  ): void {
    const current = this.row(projectId);
    const provider = patch.provider ?? current?.provider;
    const model = patch.model ?? current?.model;
    if (!provider || !model) return; // desligada no meio do caminho
    this.db
      .prepare(
        `INSERT INTO knowledge_semantic (project_id, provider, model, state, embedded, total, updated_at, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET provider = excluded.provider, model = excluded.model,
           state = excluded.state, embedded = excluded.embedded, total = excluded.total,
           updated_at = excluded.updated_at, error = excluded.error`,
      )
      .run(
        projectId,
        provider,
        model,
        patch.state ?? current?.state ?? "indexing",
        patch.embedded ?? current?.embedded ?? 0,
        patch.total ?? current?.total ?? 0,
        patch.updatedAt ?? current?.updated_at ?? null,
        patch.error === undefined ? (current?.error ?? null) : patch.error,
      );
  }
}

function modelKey(provider: EmbeddingProvider): string {
  return `${provider.id}:${provider.model}`;
}

function hashOf(chunk: { path: string; lineStart: number; lineEnd: number; body: string }): string {
  return createHash("sha256")
    .update(`${chunk.path}\0${chunk.lineStart}\0${chunk.lineEnd}\0${chunk.body}`)
    .digest("hex")
    .slice(0, 32);
}

function refOf(chunk: { path: string; lineStart: number; lineEnd: number; body: string }): VectorRef {
  // O corpo começa com o caminho do arquivo (contexto para as buscas); a prévia mostra só o código.
  const body = chunk.body.startsWith(`${chunk.path}\n`)
    ? chunk.body.slice(chunk.path.length + 1)
    : chunk.body;
  return {
    path: chunk.path,
    lineStart: chunk.lineStart,
    lineEnd: chunk.lineEnd,
    preview: body.slice(0, PREVIEW_CHARS),
  };
}
