import type { HealthResponse } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { DataDirLayout } from "../../core/data-dir.js";
import type { Db } from "../../core/database.js";
import { VERSION } from "../../version.js";
import { runDoctor } from "./doctor.js";

export function registerSystemRoutes(app: FastifyInstance, deps: { layout: DataDirLayout; db: Db }): void {
  app.get("/api/v1/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    version: VERSION,
    modules: {
      core: "ok",
      projects: "ok",
      terminal: "planned",
      integrations: "planned",
      agents: "planned",
      quota: "planned",
      knowledge: "planned",
      telemetry: "planned",
    },
  }));

  app.get("/api/v1/doctor", async () => runDoctor(deps.layout, deps.db));
}
