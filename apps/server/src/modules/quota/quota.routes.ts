import type { FastifyInstance } from "fastify";
import type { QuotaMonitor } from "./quota-monitor.js";

export function registerQuotaRoutes(app: FastifyInstance, monitor: QuotaMonitor): void {
  app.get("/api/v1/quota", async () => monitor.current());
}
