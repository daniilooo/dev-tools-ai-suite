import type { CreateProjectRequest } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { ProjectsService } from "./projects.service.js";

export function registerProjectRoutes(
  app: FastifyInstance,
  service: ProjectsService,
  hooks: { onRemoved?: (id: string) => Promise<void> } = {},
): void {
  app.get("/api/v1/projects", async () => service.list());

  app.get<{ Params: { id: string } }>("/api/v1/projects/:id", async (request) =>
    service.get(request.params.id),
  );

  app.post<{ Body: CreateProjectRequest }>("/api/v1/projects", async (request, reply) => {
    const body = request.body ?? ({} as CreateProjectRequest);
    const project = service.create({
      path: String(body.path ?? ""),
      name: body.name ? String(body.name) : undefined,
    });
    return reply.code(201).send(project);
  });

  app.post<{ Params: { id: string } }>("/api/v1/projects/:id/redetect", async (request) =>
    service.redetect(request.params.id),
  );

  app.delete<{ Params: { id: string } }>("/api/v1/projects/:id", async (request, reply) => {
    service.remove(request.params.id);
    await hooks.onRemoved?.(request.params.id);
    return reply.code(204).send();
  });
}
