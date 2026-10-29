import type {
  CodeGraphQueryRequest,
  KnowledgeQueryMode,
  KnowledgeQueryRequest,
  KnowledgeSemanticRequest,
} from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import { badRequest } from "../../core/errors.js";
import type { KnowledgeService } from "./knowledge.service.js";

const MODES: KnowledgeQueryMode[] = ["lexical", "semantic", "hybrid"];

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
      if (body.mode !== undefined && !MODES.includes(body.mode)) {
        throw badRequest("Modo de busca inválido (use lexical, semantic ou hybrid).");
      }
      return knowledge.query(
        request.params.id,
        typeof body.query === "string" ? body.query : "",
        typeof body.limit === "number" ? body.limit : undefined,
        body.mode,
      );
    },
  );

  // Busca semântica (ADR-0006, D-20): mecanismos disponíveis e liga/desliga por projeto.
  app.get("/api/v1/knowledge/semantic/providers", async () => knowledge.semantic.catalog());

  app.put<{ Params: { id: string }; Body: KnowledgeSemanticRequest }>(
    "/api/v1/projects/:id/knowledge/semantic",
    async (request) => {
      const body = request.body ?? ({} as KnowledgeSemanticRequest);
      if (typeof body.enabled !== "boolean") throw badRequest("Informe se a busca semântica fica ligada.");
      await knowledge.configureSemantic(request.params.id, body);
      request.log.info(
        { projectId: request.params.id, enabled: body.enabled, provider: body.provider },
        "busca semântica configurada",
      );
      return knowledge.status(request.params.id);
    },
  );

  // Grafo de código via Graphify externo, também em segundo plano.
  app.post<{ Params: { id: string } }>("/api/v1/projects/:id/knowledge/graph", async (request, reply) => {
    await knowledge.graph.start(request.params.id);
    request.log.info({ projectId: request.params.id }, "geração do grafo iniciada");
    return reply.code(202).send(await knowledge.status(request.params.id));
  });

  app.delete<{ Params: { id: string } }>("/api/v1/projects/:id/knowledge/graph", async (request, reply) => {
    await knowledge.graph.remove(request.params.id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: CodeGraphQueryRequest }>(
    "/api/v1/projects/:id/knowledge/graph/query",
    async (request) => {
      const body = request.body ?? ({} as CodeGraphQueryRequest);
      return knowledge.graph.query(
        request.params.id,
        typeof body.symbol === "string" ? body.symbol : "",
        typeof body.depth === "number" ? body.depth : undefined,
      );
    },
  );
}
