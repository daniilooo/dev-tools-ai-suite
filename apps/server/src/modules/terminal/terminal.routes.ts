import type { CreateTerminalRequest, TerminalClientMessage, TerminalServerMessage } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ProjectsService } from "../projects/projects.service.js";
import type { ProvidersService } from "../integrations/providers.service.js";
import type { TerminalClient, TerminalManager } from "./terminal-manager.js";

const LAUNCH_TITLES: Record<string, string> = { "claude-code": "Claude", codex: "Codex" };

/** Maior mensagem aceita do navegador (colagens grandes chegam em várias mensagens). */
export const MAX_WS_MESSAGE_BYTES = 64 * 1024;

export function registerTerminalRoutes(
  app: FastifyInstance,
  deps: { terminals: TerminalManager; projects: ProjectsService; providers: ProvidersService },
): void {
  const { terminals, projects, providers } = deps;

  app.get<{ Params: { id: string } }>("/api/v1/projects/:id/terminals", async (request) =>
    terminals.list(projects.get(request.params.id).id),
  );

  app.post<{ Params: { id: string }; Body: CreateTerminalRequest | undefined }>(
    "/api/v1/projects/:id/terminals",
    async (request, reply) => {
      const project = projects.get(request.params.id);
      const body = request.body ?? {};
      // Só comandos fixos de provedores conhecidos: o navegador nunca escolhe o texto executado.
      const launch =
        body.launch === undefined
          ? undefined
          : {
              title: LAUNCH_TITLES[body.launch] ?? "Terminal",
              command: providers.launchCommand(String(body.launch)),
            };
      const session = terminals.create(
        project,
        {
          cols: typeof body.cols === "number" ? body.cols : undefined,
          rows: typeof body.rows === "number" ? body.rows : undefined,
        },
        launch,
      );
      request.log.info({ terminalId: session.id, projectId: project.id }, "terminal criado");
      return reply.code(201).send(session);
    },
  );

  app.delete<{ Params: { id: string } }>("/api/v1/terminals/:id", async (request, reply) => {
    await terminals.close(request.params.id);
    request.log.info({ terminalId: request.params.id }, "terminal encerrado");
    return reply.code(204).send();
  });

  // Autenticação, Host e Origin do upgrade são validados no hook de segurança (ADR-0007).
  app.get<{ Params: { id: string } }>(
    "/ws/terminal/:id",
    { websocket: true },
    (socket: WebSocket, request) => {
      const id = request.params.id;
      const client: TerminalClient = {
        send: (message: TerminalServerMessage) => {
          if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
        },
        close: (code, reason) => socket.close(code, reason),
        get bufferedAmount() {
          return socket.bufferedAmount;
        },
      };

      // A sessão do navegador tem validade: a conexão não pode sobreviver a ela.
      const expiresIn = (request.session?.expiresAt ?? 0) - Date.now();
      const expiry = setTimeout(() => socket.close(4401, "Sessão expirada."), Math.max(0, expiresIn));
      expiry.unref();

      socket.on("message", (raw, isBinary) => {
        if (isBinary) return;
        const message = parseClientMessage(raw.toString());
        if (!message) return;
        if (message.type === "input") terminals.write(id, message.data);
        else terminals.resize(id, message.cols, message.rows);
      });
      socket.on("close", () => {
        clearTimeout(expiry);
        terminals.detach(id, client);
      });
      terminals.attach(id, client);
    },
  );
}

export function parseClientMessage(raw: string): TerminalClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message.type === "input" && typeof message.data === "string") {
    return { type: "input", data: message.data };
  }
  if (message.type === "resize" && typeof message.cols === "number" && typeof message.rows === "number") {
    return { type: "resize", cols: message.cols, rows: message.rows };
  }
  return null;
}
