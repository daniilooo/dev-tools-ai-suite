import type { FastifyInstance } from "fastify";
import type { AgentMonitor } from "./agent-monitor.js";

export function registerAgentRoutes(app: FastifyInstance, monitor: AgentMonitor): void {
  app.get<{ Params: { id: string } }>("/api/v1/projects/:id/agents/runs", async (request) =>
    monitor.list(request.params.id),
  );

  app.get<{ Params: { id: string } }>("/api/v1/agents/runs/:id", async (request) =>
    monitor.get(request.params.id),
  );
}
