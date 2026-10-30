import type { FastifyInstance, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "./errors.js";
import type { CliTokenVerifier } from "./cli-auth.js";
import { CLI_AUTH_SCHEME } from "./cli-auth.js";
import type { Session, SessionManager } from "./sessions.js";
import { SESSION_COOKIE } from "./sessions.js";
import { safeEqual } from "./secret.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CSRF_HEADER = "x-csrf-token";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Rotas de API acessíveis sem sessão. */
const PUBLIC_API_ROUTES = new Set(["POST /api/v1/session/exchange"]);

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
    /** true quando autenticado pelo CLI local (token HMAC descartável). */
    viaCli: boolean;
  }
}

export interface SecurityOptions {
  port: number;
  cliTokens: CliTokenVerifier;
  sessions: SessionManager;
}

/**
 * Proteções do servidor local (ADR-0007):
 * - Host restrito a 127.0.0.1/localhost na porta configurada (anti DNS rebinding);
 * - Origin, quando presente, deve ser a própria origem (anti CSRF / CSWSH);
 * - toda rota /api exige sessão (cookie assinado) ou token descartável do CLI local;
 * - todo upgrade /ws exige Origin da própria suíte e sessão do navegador;
 * - métodos com efeito colateral via cookie exigem header anti-CSRF.
 * Sem CORS: nenhum header Access-Control-* é emitido.
 */
export function registerSecurity(app: FastifyInstance, options: SecurityOptions): void {
  const allowedHosts = new Set([`127.0.0.1:${options.port}`, `localhost:${options.port}`]);
  const allowedOrigins = new Set([...allowedHosts].map((host) => `http://${host}`));

  app.decorateRequest("session", null);
  app.decorateRequest("viaCli", false);

  app.addHook("onRequest", async (request, reply) => {
    const host = request.headers.host;
    if (!host || !allowedHosts.has(host.toLowerCase())) {
      throw forbidden("Host não permitido.");
    }

    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin.toLowerCase())) {
      throw forbidden("Origem não permitida.");
    }
    if (
      origin === undefined &&
      UNSAFE_METHODS.has(request.method) &&
      request.headers["sec-fetch-site"] === "cross-site"
    ) {
      throw forbidden("Origem não permitida.");
    }

    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);

    // Decide pela rota que o roteador casou, não só pela URL crua: `/%61pi/...` é decodificado
    // pelo roteador e casaria `/api/...` sem passar pela autenticação.
    const route = request.routeOptions.url ?? "";
    const path = request.url.split("?")[0]!;
    if (route.startsWith("/ws/") || path.startsWith("/ws/")) {
      // WebSocket não passa por CORS nem por header anti-CSRF: exige Origin da própria
      // suíte (anti cross-site WebSocket hijacking) e sessão do navegador. O CLI não abre WS.
      if (origin === undefined) throw forbidden("Origem obrigatória para WebSocket.");
      const session = options.sessions.verify(request.cookies[SESSION_COOKIE]);
      if (!session) throw unauthorized();
      request.session = session;
      return;
    }

    if (!route.startsWith("/api/") && !path.startsWith("/api/")) return;

    const routeKey = `${request.method} ${route}`;
    if (PUBLIC_API_ROUTES.has(routeKey)) return;

    const cliToken = cliTokenOf(request);
    if (cliToken !== null) {
      if (!options.cliTokens.verify(cliToken)) throw unauthorized();
      request.viaCli = true;
      return;
    }

    const session = options.sessions.verify(request.cookies[SESSION_COOKIE]);
    if (!session) throw unauthorized();
    request.session = session;

    if (UNSAFE_METHODS.has(request.method)) {
      const token = request.headers[CSRF_HEADER];
      if (typeof token !== "string" || !safeEqual(token, session.csrfToken)) {
        throw forbidden("Token anti-CSRF ausente ou inválido.");
      }
    }
  });
}

function cliTokenOf(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  if (!header.startsWith(`${CLI_AUTH_SCHEME} `)) return "";
  return header.slice(CLI_AUTH_SCHEME.length + 1).trim();
}
