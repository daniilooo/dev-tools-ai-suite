import type { HealthResponse } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { DataDirLayout } from "../../core/data-dir.js";
import type { Db } from "../../core/database.js";
import { VERSION } from "../../version.js";
import type { TerminalManager } from "../terminal/terminal-manager.js";
import { runDoctor } from "./doctor.js";

export function registerSystemRoutes(
  app: FastifyInstance,
  deps: { layout: DataDirLayout; db: Db; terminals: TerminalManager },
): void {
  app.get("/api/v1/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    version: VERSION,
    modules: {
      core: "ok",
      projects: "ok",
      terminal: deps.terminals.backendName ? "ok" : "not_available",
      integrations: "planned",
      agents: "planned",
      quota: "planned",
      knowledge: "planned",
      telemetry: "planned",
    },
  }));

  app.get("/api/v1/doctor", async () => runDoctor(deps.layout, deps.db, ptyStatusOf(deps.terminals)));
}

function ptyStatusOf(terminals: TerminalManager) {
  return { backend: terminals.backendName, error: terminals.backendError };
}
