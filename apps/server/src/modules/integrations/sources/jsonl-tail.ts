import type { LocalSourceFiles } from "./local-files.js";

/** Bytes lidos por chamada: arquivos grandes são consumidos ao longo de várias varreduras. */
const CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * Acompanha um arquivo JSONL que só cresce (transcrições), lendo apenas o trecho novo.
 * Linha incompleta no fim fica guardada até a próxima leitura; se o arquivo encolher
 * (reescrita), recomeça do início.
 */
export class JsonlTail {
  private offset = 0;
  private partial = "";
  private lastSize = -1;

  constructor(
    private readonly files: LocalSourceFiles,
    readonly path: string,
  ) {}

  /** Registros novos desde a última chamada. `reset` indica que o arquivo foi reescrito. */
  poll(): { records: unknown[]; reset: boolean; changed: boolean } {
    const stat = this.files.stat(this.path);
    if (!stat) return { records: [], reset: false, changed: false };
    let reset = false;
    if (stat.size < this.offset) {
      this.offset = 0;
      this.partial = "";
      reset = true;
    }
    if (stat.size === this.lastSize && stat.size === this.offset) {
      return { records: [], reset, changed: false };
    }
    this.lastSize = stat.size;
    if (stat.size === this.offset) return { records: [], reset, changed: reset };

    const chunk = this.files.read(this.path, this.offset, Math.min(CHUNK_BYTES, stat.size - this.offset));
    this.offset += chunk.length;
    const text = this.partial + chunk.toString("utf8");
    const lines = text.split("\n");
    this.partial = lines.pop() ?? "";
    const records: unknown[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
        // linha corrompida: ignora (formato B, sem contrato de estabilidade)
      }
    }
    return { records, reset, changed: true };
  }

  /** Ainda há bytes a ler (arquivo maior que um bloco). */
  get behind(): boolean {
    return this.lastSize > this.offset;
  }
}
