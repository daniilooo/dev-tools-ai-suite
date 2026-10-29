import type { KnowledgeQueryRequest } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { KnowledgeService } from "./knowledge.service.js";

export function registerKnowledgeRoutes(app: FastifyInstance, knowledge: KnowledgeService): void {
  app.get<{ Params: { id: string } }>("/api/v1/projects/:id/knowledge", async (request) =>
    knowledge.status(request.params.id),
  );

  // Indexação em segundo plano: a resposta volta na hora e o estado é acompanhado pelo GET.
  app.post<{ Params: { id: string } }>("/api/v1/projects/:id/knowledge/index", async (request, reply) => {
    knowledge.start(request.params.id);
    request.log.info({ projectId: request.params.id }, "indexação iniciada");
    return reply.code(202).send(await knowledge.status(request.params.id));
  });

  app.delete<{ Params: { id: string } }>("/api/v1/projects/:id/knowledge/index", async (request, reply) => {
    await knowledge.remove(request.params.id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: KnowledgeQueryRequest }>(
    "/api/v1/projects/:id/knowledge/query",
    async (request) => {
      const body = request.body ?? ({} as KnowledgeQueryRequest);
      return knowledge.query(
        request.params.id,
        typeof body.query === "string" ? body.query : "",
        typeof body.limit === "number" ? body.limit : undefined,
      );
    },
  );
}
