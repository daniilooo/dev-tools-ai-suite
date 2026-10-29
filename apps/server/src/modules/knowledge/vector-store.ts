import Database from "better-sqlite3";
import { rmSync } from "node:fs";
import * as sqliteVec from "sqlite-vec";
import { restrictPermissions } from "../../core/data-dir.js";

export interface VectorRef {
  path: string;
  lineStart: number;
  lineEnd: number;
  /** Começo do trecho (já redigido) para mostrar no resultado. */
  preview: string;
}

export interface VectorHit extends VectorRef {
  distance: number;
}

/**
 * Vetores de um projeto (ADR-0006, D-20): arquivo próprio `indexes/<projeto>.vec.db` (0600),
 * busca exata com `sqlite-vec`. Cada trecho é identificado pelo hash de caminho, linhas e
 * conteúdo, então uma reindexação só calcula embeddings do que mudou. Trocar de modelo
 * descarta os vetores (dimensões e espaço diferentes).
 */
export class VectorStore {
  private readonly db: Database.Database;
  private dim: number | null;

  private constructor(
    path: string,
    readonly model: string,
  ) {
    this.db = new Database(path);
    restrictPermissions(path, 0o600);
    sqliteVec.load(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS refs (
        id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, path TEXT NOT NULL,
        line_start INTEGER NOT NULL, line_end INTEGER NOT NULL, preview TEXT NOT NULL
      );
    `);
    const meta = this.meta();
    if (meta.model !== undefined && meta.model !== model) this.reset();
    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)").run(model);
    this.dim = meta.model === model && meta.dim ? Number(meta.dim) : null;
  }

  static open(path: string, model: string): VectorStore {
    return new VectorStore(path, model);
  }

  static remove(path: string): void {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(path + suffix, { force: true });
  }

  hashes(): Set<string> {
    const rows = this.db.prepare("SELECT hash FROM refs").pluck().all() as string[];
    return new Set(rows);
  }

  count(): number {
    return this.db.prepare("SELECT COUNT(*) FROM refs").pluck().get() as number;
  }

  add(items: { hash: string; ref: VectorRef; vector: Float32Array }[]): void {
    if (items.length === 0) return;
    this.ensureTable(items[0]!.vector.length);
    const insertRef = this.db.prepare(
      "INSERT INTO refs (hash, path, line_start, line_end, preview) VALUES (?, ?, ?, ?, ?)",
    );
    const insertVec = this.db.prepare("INSERT INTO vectors (rowid, embedding) VALUES (?, ?)");
    this.db.transaction(() => {
      for (const { hash, ref, vector } of items) {
        if (vector.length !== this.dim) throw new Error("dimensão do vetor diferente da do índice");
        const { lastInsertRowid } = insertRef.run(hash, ref.path, ref.lineStart, ref.lineEnd, ref.preview);
        insertVec.run(BigInt(lastInsertRowid), toBlob(vector));
      }
    })();
  }

  /** Remove os vetores de trechos que não existem mais no índice textual. */
  retain(keep: Set<string>): number {
    const gone = (
      this.db.prepare("SELECT id, hash FROM refs").all() as { id: number; hash: string }[]
    ).filter((row) => !keep.has(row.hash));
    const deleteRef = this.db.prepare("DELETE FROM refs WHERE id = ?");
    const deleteVec = this.dim ? this.db.prepare("DELETE FROM vectors WHERE rowid = ?") : null;
    this.db.transaction(() => {
      for (const { id } of gone) {
        deleteRef.run(id);
        deleteVec?.run(BigInt(id));
      }
    })();
    return gone.length;
  }

  search(vector: Float32Array, limit: number): VectorHit[] {
    if (!this.dim || vector.length !== this.dim) return [];
    return this.db
      .prepare(
        `SELECT r.path, r.line_start AS lineStart, r.line_end AS lineEnd, r.preview, v.distance
         FROM (SELECT rowid, distance FROM vectors WHERE embedding MATCH ? AND k = ?) v
         JOIN refs r ON r.id = v.rowid ORDER BY v.distance`,
      )
      .all(toBlob(vector), limit) as VectorHit[];
  }

  close(): void {
    if (this.db.open) this.db.close();
  }

  private ensureTable(dim: number): void {
    if (this.dim === dim) return;
    if (this.dim !== null) throw new Error("dimensão do vetor diferente da do índice");
    this.db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS vectors USING vec0(embedding float[${dim}] distance_metric=cosine)`,
    );
    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('dim', ?)").run(String(dim));
    this.dim = dim;
  }

  private meta(): Record<string, string> {
    const rows = this.db.prepare("SELECT key, value FROM meta").all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  private reset(): void {
    this.db.exec("DROP TABLE IF EXISTS vectors; DELETE FROM refs; DELETE FROM meta;");
  }
}

function toBlob(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}
