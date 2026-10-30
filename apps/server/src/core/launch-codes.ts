import { randomBytes, randomInt } from "node:crypto";

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para o código digitado. */
const SHORT_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DEFAULT_TTL_MS = 60_000;
const MAX_PENDING = 20;

export interface LaunchCode {
  /** Código longo para o fragmento `#code=` da URL. */
  token: string;
  /** Código curto para digitação manual (fallback). */
  short: string;
  expiresAt: number;
}

/**
 * Códigos de inicialização de uso único (ADR-0007). Não derivam do segredo de
 * instalação, expiram rapidamente e são consumidos na primeira troca.
 */
export class LaunchCodeStore {
  private readonly pending = new Map<string, LaunchCode>();

  constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  issue(): LaunchCode {
    this.prune();
    if (this.pending.size >= MAX_PENDING) {
      const oldest = this.pending.keys().next().value;
      if (oldest !== undefined) this.pending.delete(oldest);
    }
    const code: LaunchCode = {
      token: randomBytes(32).toString("base64url"),
      short: shortCode(),
      expiresAt: this.now() + this.ttlMs,
    };
    this.pending.set(code.token, code);
    return code;
  }

  /** Consome o código (longo ou curto). Retorna true somente uma vez por código válido. */
  consume(candidate: string): boolean {
    this.prune();
    const normalized = candidate.trim();
    const shortForm = normalized.toUpperCase().replace(/[^A-Z0-9]/g, "");
    for (const [token, code] of this.pending) {
      if (token === normalized || code.short.replace("-", "") === shortForm) {
        this.pending.delete(token);
        return true;
      }
    }
    return false;
  }

  private prune(): void {
    const now = this.now();
    for (const [token, code] of this.pending) {
      if (code.expiresAt <= now) this.pending.delete(token);
    }
  }
}

function shortCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += SHORT_ALPHABET[randomInt(SHORT_ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
