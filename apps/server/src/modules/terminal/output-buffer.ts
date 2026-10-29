/**
 * Guarda a saída recente de um terminal para reenviar na reconexão.
 * Limite em caracteres; ao exceder, descarta o início em blocos inteiros.
 */
export class OutputBuffer {
  private chunks: string[] = [];
  private size = 0;

  constructor(private readonly limit: number) {}

  append(data: string): void {
    if (data.length >= this.limit) {
      this.chunks = [data.slice(data.length - this.limit)];
      this.size = this.limit;
      return;
    }
    this.chunks.push(data);
    this.size += data.length;
    while (this.size > this.limit) {
      const first = this.chunks[0]!;
      const excess = this.size - this.limit;
      if (first.length <= excess) {
        this.chunks.shift();
        this.size -= first.length;
      } else {
        this.chunks[0] = first.slice(excess);
        this.size -= excess;
      }
    }
  }

  snapshot(): string {
    if (this.chunks.length > 1) this.chunks = [this.chunks.join("")];
    return this.chunks[0] ?? "";
  }

  get length(): number {
    return this.size;
  }
}
