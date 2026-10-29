import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import type { ApiErrorBody } from "@devtools/shared";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./core/config.js";
import type { DataDirLayout } from "./core/data-dir.js";
import type { Db } from "./core/database.js";
import { CliTokenVerifier } from "./core/cli-auth.js";
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
import { AgentMonitor } from "./modules/agents/agent-monitor.js";
import { AgentsRepository } from "./modules/agents/agents.repository.js";
import { registerAgentRoutes } from "./modules/agents/agents.routes.js";
import { registerProviderRoutes } from "./modules/integrations/providers.routes.js";
import { AgentSources } from "./modules/integrations/sources/agent-sources.js";
import { defaultRoots, LocalSourceFiles } from "./modules/integrations/sources/local-files.js";
import type { LocalSourceRoots } from "./modules/integrations/sources/local-files.js";
import { ProvidersService } from "./modules/integrations/providers.service.js";
import { QuotaSources } from "./modules/integrations/sources/quota-sources.js";
import { prepareClaudeStatusLine, readClaudeStatusLine } from "./modules/quota/claude-statusline.js";
import { QuotaMonitor } from "./modules/quota/quota-monitor.js";
import { registerQuotaRoutes } from "./modules/quota/quota.routes.js";
import { registerEventRoutes } from "./modules/system/events.routes.js";
import { registerSystemRoutes } from "./modules/system/system.routes.js";
import { loadPtyBackend } from "./modules/terminal/pty-backend.js";
import type { PtyBackendStatus } from "./modules/terminal/pty-backend.js";
import { TerminalManager } from "./modules/terminal/terminal-manager.js";
import type { TerminalManagerOptions } from "./modules/terminal/terminal-manager.js";
import { TerminalRepository } from "./modules/terminal/terminal.repository.js";
import { MAX_WS_MESSAGE_BYTES, registerTerminalRoutes } from "./modules/terminal/terminal.routes.js";

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
  /** Backend de PTY (testes podem injetar um falso). Padrão: carrega a biblioteca nativa. */
  pty?: PtyBackendStatus;
  /** Raízes das transcrições/sessões dos provedores (testes apontam para fixtures). */
  agentSourceRoots?: LocalSourceRoots;
  /** Intervalo da varredura do Agent Monitor; 0 desliga a varredura automática (testes). */
  agentScanIntervalMs?: number;
  /** Intervalo da releitura de cotas; 0 desliga a releitura automática (testes). */
  quotaScanIntervalMs?: number;
  /** Detecção de provedores (testes injetam adapters falsos). */
  providers?: ProvidersService;
  /** Ajustes do gerenciador de terminais (retenção, limites) — usado em testes. */
  terminalOptions?: Partial<Omit<TerminalManagerOptions, "backend" | "backendError" | "repository">>;
}

export interface App {
  server: FastifyInstance;
  codes: LaunchCodeStore;
  terminals: TerminalManager;
  agents: AgentMonitor;
  quota: QuotaMonitor;
}

export async function buildApp(deps: AppDeps): Promise<App> {
  const codes = deps.codes ?? new LaunchCodeStore();
  const sessions = new SessionManager(deps.secret);

  const server = Fastify({
    logger: {
      level: deps.config.logLevel,
      stream: redactingStream(deps.logStream ?? process.stdout, () => [deps.secret.redactionValue()]),
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
  await server.register(fastifyWebsocket, { options: { maxPayload: MAX_WS_MESSAGE_BYTES } });
  registerSecurity(server, {
    port: deps.config.port,
    cliTokens: new CliTokenVerifier(deps.secret),
    sessions,
  });

  const pty = deps.pty ?? (await loadPtyBackend());
  const terminals = new TerminalManager({
    ...deps.terminalOptions,
    backend: pty.backend,
    backendError: pty.error,
    repository: new TerminalRepository(deps.db),
  });
  // Nenhum processo do terminal pode sobreviver ao servidor.
  server.addHook("onClose", async () => terminals.shutdown());

  const projects = new ProjectsService(new ProjectsRepository(deps.db));
  const providers = deps.providers ?? new ProvidersService();
  registerSessionRoutes(server, { codes, sessions });
  registerSystemRoutes(server, { layout: deps.layout, db: deps.db, terminals, providers });
  registerProviderRoutes(server, providers);
  registerProjectRoutes(server, projects, { onRemoved: (id) => terminals.closeProject(id) });
  registerTerminalRoutes(server, { terminals, projects, providers });

  const agents = new AgentMonitor({
    sources: new AgentSources(new LocalSourceFiles(deps.agentSourceRoots ?? defaultRoots())),
    projects,
    repository: new AgentsRepository(deps.db),
    terminals,
    intervalMs: deps.agentScanIntervalMs || 2_000,
    onError: (error) => server.log.warn({ err: error }, "falha na varredura do Agent Monitor"),
  });
  registerAgentRoutes(server, agents);
  if (deps.agentScanIntervalMs !== 0) server.addHook("onReady", async () => agents.start());
  server.addHook("onClose", async () => agents.stop());

  // Cotas (ADR-0014): status line da suíte nas sessões do Claude abertas por ela + arquivos locais.
  const statusLine = deps.config.claudeStatusLine ? prepareClaudeStatusLine(deps.layout) : null;
  if (statusLine) providers.setLaunchArgs("claude-code", statusLine.launchArgs);
  const quota = new QuotaMonitor({
    sources: new QuotaSources(new LocalSourceFiles(deps.agentSourceRoots ?? defaultRoots())),
    statusLine: statusLine && { read: () => readClaudeStatusLine(statusLine.snapshotPath) },
    intervalMs: deps.quotaScanIntervalMs || 5_000,
    onError: (error) => server.log.warn({ err: error }, "falha na leitura de cotas"),
  });
  registerQuotaRoutes(server, quota);
  if (deps.quotaScanIntervalMs !== 0) server.addHook("onReady", async () => quota.start());
  server.addHook("onClose", async () => quota.stop());

  registerEventRoutes(server, [agents, quota]);

  const publicDir = deps.publicDir === undefined ? defaultPublicDir() : deps.publicDir;
  if (publicDir && existsSync(publicDir)) {
    await server.register(fastifyStatic, { root: publicDir, index: ["index.html"] });
    // SPA: rotas que não são API nem arquivo devolvem o index.html.
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/ws/") || request.method !== "GET") {
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

  return { server, codes, terminals, agents, quota };
}

/** dist/public no pacote publicado; em desenvolvimento (tsx), o build de apps/web. */
function defaultPublicDir(): string | null {
  const candidates = [
    new URL("./public", import.meta.url),
    new URL("../../web/dist/web/browser", import.meta.url),
  ];
  return candidates.map((url) => fileURLToPath(url)).find((dir) => existsSync(dir)) ?? null;
}
