import { randomBytes } from "node:crypto";
import type { InstallSecret } from "./secret.js";
import { safeEqual } from "./secret.js";

export const CLI_AUTH_SCHEME = "DevtoolsCli";
const MAX_SKEW_MS = 30_000;

/**
 * Credencial do CLI local para o servidor (ADR-0007). O segredo de instalação nunca
 * trafega: o CLI envia `<timestamp>.<nonce>.<HMAC>`, válido por 30 s e uma única vez.
 * Se outro processo estiver ocupando a porta, ele recebe apenas um token descartável.
 */
export function createCliToken(secret: InstallSecret, now = Date.now()): string {
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${now}.${nonce}`;
  return `${payload}.${secret.hmac(`cli:${payload}`)}`;
}

export function cliAuthorizationHeader(secret: InstallSecret): string {
  return `${CLI_AUTH_SCHEME} ${createCliToken(secret)}`;
}

export class CliTokenVerifier {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly secret: InstallSecret,
    private readonly now: () => number = Date.now,
  ) {}

  verify(token: string): boolean {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [rawTs, nonce, signature] = parts as [string, string, string];
    const ts = Number(rawTs);
    const now = this.now();
    if (!Number.isSafeInteger(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false;
    if (!safeEqual(signature, this.secret.hmac(`cli:${rawTs}.${nonce}`))) return false;

    for (const [seenNonce, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(seenNonce);
    }
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, now + 2 * MAX_SKEW_MS);
    return true;
  }
}
