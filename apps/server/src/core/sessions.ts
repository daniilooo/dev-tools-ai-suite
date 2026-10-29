import { randomBytes } from "node:crypto";
import type { InstallSecret } from "./secret.js";
import { safeEqual } from "./secret.js";

export const SESSION_COOKIE = "devtools_session";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Session {
  id: string;
  expiresAt: number;
  csrfToken: string;
}

/**
 * Sessões sem estado, assinadas com HMAC do segredo de instalação: sobrevivem ao
 * reinício do servidor e são todas invalidadas ao rotacionar o segredo.
 * Formato do cookie: `<id>.<expiresAt>.<assinatura>`.
 */
export class SessionManager {
  constructor(
    private readonly secret: InstallSecret,
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  create(): { cookieValue: string; session: Session } {
    const id = randomBytes(24).toString("base64url");
    const expiresAt = this.now() + this.ttlMs;
    const payload = `${id}.${expiresAt}`;
    const cookieValue = `${payload}.${this.secret.hmac(`session:${payload}`)}`;
    return { cookieValue, session: this.toSession(id, expiresAt) };
  }

  verify(cookieValue: string | undefined): Session | null {
    if (!cookieValue) return null;
    const parts = cookieValue.split(".");
    if (parts.length !== 3) return null;
    const [id, rawExpires, signature] = parts as [string, string, string];
    const expiresAt = Number(rawExpires);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now()) return null;
    const expected = this.secret.hmac(`session:${id}.${rawExpires}`);
    if (!safeEqual(signature, expected)) return null;
    return this.toSession(id, expiresAt);
  }

  get maxAgeSeconds(): number {
    return Math.floor(this.ttlMs / 1000);
  }

  private toSession(id: string, expiresAt: number): Session {
    return { id, expiresAt, csrfToken: this.secret.hmac(`csrf:${id}`) };
  }
}
