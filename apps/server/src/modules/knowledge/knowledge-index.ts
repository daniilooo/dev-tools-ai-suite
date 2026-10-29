import Database from "better-sqlite3";
import { existsSync, renameSync, rmSync } from "node:fs";
import { restrictPermissions } from "../../core/data-dir.js";

export interface IndexedFile {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface Chunk {
  path: string;
  lineStart: number;
  lineEnd: number;
  body: string;
}

export interface LexicalHit {
  path: string;
  lineStart: number;
  lineEnd: number;
  snippet: string;
}

const SCHEMA = `
  CREATE TABLE files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime_ms REAL NOT NULL);
  CREATE VIRTUAL TABLE chunks USING fts5(
    path UNINDEXED, line_start UNINDEXED, line_end UNINDEXED, body,
    tokenize = "unicode61 remove_diacritics 2 tokenchars '_'"
  );
`;

/**
 * Índice textual de um projeto: um arquivo SQLite próprio (`indexes/<projeto>.db`, 0600),
 * isolado dos outros projetos e removível sem tocar no banco principal. A escrita vai para
 * um arquivo temporário que só substitui o índice anterior quando termina.
 */
export class KnowledgeIndexWriter {
  private readonly db: Database.Database;
  private readonly insertFile: Database.Statement;
  private readonly insertChunk: Database.Statement;

  constructor(private readonly target: string) {
    rmSync(this.tempPath, { force: true });
    this.db = new Database(this.tempPath);
    restrictPermissions(this.tempPath, 0o600);
    // Arquivo temporário refeito do zero se algo falhar: dispensa diário e fsync.
    this.db.pragma("journal_mode = OFF");
    this.db.pragma("synchronous = OFF");
    this.db.exec(SCHEMA);
    this.insertFile = this.db.prepare("INSERT INTO files (path, size, mtime_ms) VALUES (?, ?, ?)");
    this.insertChunk = this.db.prepare(
      "INSERT INTO chunks (path, line_start, line_end, body) VALUES (?, ?, ?, ?)",
    );
  }

  private get tempPath(): string {
    return `${this.target}.tmp`;
  }

  add(file: IndexedFile, chunks: Chunk[]): void {
    this.db.transaction(() => {
      this.insertFile.run(file.path, file.size, file.mtimeMs);
      for (const c of chunks) this.insertChunk.run(c.path, c.lineStart, c.lineEnd, c.body);
    })();
  }

  commit(): void {
    this.db.exec("INSERT INTO chunks(chunks) VALUES('optimize')");
    this.db.close();
    renameSync(this.tempPath, this.target);
  }

  abort(): void {
    if (this.db.open) this.db.close();
    rmSync(this.tempPath, { force: true });
  }
}

export class KnowledgeIndexReader {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path, { readonly: true, fileMustExist: true });
  }

  static open(path: string): KnowledgeIndexReader | null {
    return existsSync(path) ? new KnowledgeIndexReader(path) : null;
  }

  files(): IndexedFile[] {
    return this.db.prepare("SELECT path, size, mtime_ms AS mtimeMs FROM files").all() as IndexedFile[];
  }

  /** Busca por termos (todos precisam aparecer), ordenada por relevância (BM25). */
  search(terms: string[], limit: number): LexicalHit[] {
    if (terms.length === 0) return [];
    const match = terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(" ");
    return this.db
      .prepare(
        `SELECT path, line_start AS lineStart, line_end AS lineEnd,
                snippet(chunks, 3, '«', '»', '…', 24) AS snippet
         FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks) LIMIT ?`,
      )
      .all(match, limit) as LexicalHit[];
  }

  close(): void {
    this.db.close();
  }
}

/** Termos de busca: palavras e identificadores, sem operadores do FTS5. */
export function searchTerms(query: string): string[] {
  return [...new Set(query.match(/[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 12);
}
