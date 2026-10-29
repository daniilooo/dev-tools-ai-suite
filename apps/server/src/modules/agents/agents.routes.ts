import type { ServerEvent } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { AgentMonitor } from "./agent-monitor.js";

export function registerAgentRoutes(app: FastifyInstance, monitor: AgentMonitor): void {
  app.get<{ Params: { id: string } }>("/api/v1/projects/:id/agents/runs", async (request) =>
    monitor.list(request.params.id),
  );

  app.get<{ Params: { id: string } }>("/api/v1/agents/runs/:id", async (request) =>
    monitor.get(request.params.id),
  );

  // Canal de eventos do servidor. Autenticação, Host e Origin no hook de segurança (ADR-0007).
  app.get("/ws/events", { websocket: true }, (socket: WebSocket, request) => {
    const unsubscribe = monitor.subscribe((event: ServerEvent) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
    });
    const expiresIn = (request.session?.expiresAt ?? 0) - Date.now();
    const expiry = setTimeout(() => socket.close(4401, "Sessão expirada."), Math.max(0, expiresIn));
    expiry.unref();
    socket.on("close", () => {
      clearTimeout(expiry);
      unsubscribe();
    });
  });
}
