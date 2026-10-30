import type { ExchangeRequest, SessionResponse } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import { badRequest, unauthorized } from "../../core/errors.js";
import type { LaunchCodeStore } from "../../core/launch-codes.js";
import type { Session, SessionManager } from "../../core/sessions.js";
import { SESSION_COOKIE } from "../../core/sessions.js";

export function registerSessionRoutes(
  app: FastifyInstance,
  deps: { codes: LaunchCodeStore; sessions: SessionManager },
): void {
  // Troca do código de uso único por cookie de sessão (ADR-0007). Rota pública com rate limit simples.
  const attempts: number[] = [];
  app.post<{ Body: ExchangeRequest }>("/api/v1/session/exchange", async (request, reply) => {
    const now = Date.now();
    while (attempts.length && attempts[0]! < now - 60_000) attempts.shift();
    if (attempts.length >= 10) {
      return reply
        .code(429)
        .send({ error: { code: "TOO_MANY_ATTEMPTS", message: "Muitas tentativas. Aguarde um minuto." } });
    }
    attempts.push(now);

    const code = request.body?.code;
    if (typeof code !== "string" || code.length === 0 || code.length > 128)
      throw badRequest("Código ausente.");
    if (!deps.codes.consume(code)) throw unauthorized();

    const { cookieValue, session } = deps.sessions.create();
    reply.setCookie(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: "strict",
      secure: false, // http://127.0.0.1 — sem TLS em loopback
      path: "/",
      maxAge: deps.sessions.maxAgeSeconds,
    });
    return toResponse(session);
  });

  app.get("/api/v1/session", async (request) => {
    if (!request.session) throw unauthorized();
    return toResponse(request.session);
  });

  // Usado pelo CLI (token HMAC descartável) quando o servidor já está rodando.
  app.post("/api/v1/session/launch-code", async (request) => {
    if (!request.viaCli) throw unauthorized();
    const code = deps.codes.issue();
    return { token: code.token, short: code.short, expiresAt: new Date(code.expiresAt).toISOString() };
  });

  app.post("/api/v1/session/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}

function toResponse(session: Session): SessionResponse {
  return {
    authenticated: true,
    csrfToken: session.csrfToken,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}
