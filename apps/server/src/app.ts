import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import type { ApiErrorBody } from "@devtools/shared";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./core/config.js";
import type { DataDirLayout } from "./core/data-dir.js";
import type { Db } from "./core/database.js";
import { AppError } from "./core/errors.js";
import { LaunchCodeStore } from "./core/launch-codes.js";
import { redactingStream } from "./core/redact.js";
import type { InstallSecret } from "./core/secret.js";
import { registerSecurity } from "./core/security.js";
import { SessionManager } from "./core/sessions.js";
import { ProjectsRepository } from "./modules/projects/projects.repository.js";
import { registerProjectRoutes } from "./modules/projects/projects.routes.js";
import { ProjectsService } from "./modules/projects/projects.service.js";
import { registerSessionRoutes } from "./modules/session/session.routes.js";
import { registerSystemRoutes } from "./modules/system/system.routes.js";

export interface AppDeps {
  config: AppConfig;
  layout: DataDirLayout;
  secret: InstallSecret;
  db: Db;
  /** Destino dos logs (já redigidos). Padrão: stdout. */
  logStream?: { write(chunk: string): unknown };
  /** Diretório do dashboard compilado. Padrão: dist/public ao lado deste arquivo. */
  publicDir?: string | null;
  codes?: LaunchCodeStore;
}

export interface App {
  server: FastifyInstance;
  codes: LaunchCodeStore;
}

export async function buildApp(deps: AppDeps): Promise<App> {
  const codes = deps.codes ?? new LaunchCodeStore();
  const sessions = new SessionManager(deps.secret);

  const server = Fastify({
    logger: {
      level: deps.config.logLevel,
      stream: redactingStream(deps.logStream ?? process.stdout, () => [deps.secret.toBearer()]),
      redact: ["req.headers.cookie", "req.headers.authorization", "req.headers['x-csrf-token']"],
    },
    trustProxy: false,
    bodyLimit: 64 * 1024,
  });

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, details: error.details },
      };
      return reply.code(error.statusCode).send(body);
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: { code: "BAD_REQUEST", message: "Requisição inválida." } });
    }
    request.log.error({ err: error }, "erro não tratado");
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Erro interno." } });
  });

  await server.register(fastifyCookie);
  registerSecurity(server, { port: deps.config.port, secret: deps.secret, sessions });

  registerSessionRoutes(server, { codes, sessions });
  registerSystemRoutes(server, { layout: deps.layout, db: deps.db });
  registerProjectRoutes(server, new ProjectsService(new ProjectsRepository(deps.db)));

  const publicDir =
    deps.publicDir === undefined ? fileURLToPath(new URL("./public", import.meta.url)) : deps.publicDir;
  if (publicDir && existsSync(publicDir)) {
    await server.register(fastifyStatic, { root: publicDir, index: ["index.html"] });
    // SPA: rotas que não são API nem arquivo devolvem o index.html.
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/") || request.method !== "GET") {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Recurso não encontrado." } });
      }
      return reply.sendFile("index.html");
    });
  } else {
    server.get("/", async (_request, reply) =>
      reply
        .type("text/html; charset=utf-8")
        .send(
          "<!doctype html><meta charset=utf-8><title>Dev Tools AI Suite</title><p>Dashboard não compilado. Execute <code>pnpm build</code>.</p>",
        ),
    );
  }

  return { server, codes };
}
