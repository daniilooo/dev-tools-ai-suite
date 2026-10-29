import type { FastifyInstance } from "fastify";
import type { ProvidersService } from "./providers.service.js";

export function registerProviderRoutes(app: FastifyInstance, providers: ProvidersService): void {
  app.get<{ Querystring: { refresh?: string } }>("/api/v1/providers", async (request) =>
    providers.list(request.query.refresh === "1"),
  );
}
