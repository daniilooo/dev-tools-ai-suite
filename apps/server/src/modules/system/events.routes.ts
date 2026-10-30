import type { ServerEvent } from "@devtools/shared";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

export interface EventPublisher {
  subscribe(listener: (event: ServerEvent) => void): () => void;
}

/**
 * Canal de eventos do servidor (`/ws/events`): reúne os eventos dos módulos (agentes, cotas).
 * Autenticação, Host e Origin no hook de segurança (ADR-0007).
 */
export function registerEventRoutes(app: FastifyInstance, publishers: EventPublisher[]): void {
  app.get("/ws/events", { websocket: true }, (socket: WebSocket, request) => {
    const unsubscribes = publishers.map((publisher) =>
      publisher.subscribe((event) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
      }),
    );
    const expiresIn = (request.session?.expiresAt ?? 0) - Date.now();
    const expiry = setTimeout(() => socket.close(4401, "Sessão expirada."), Math.max(0, expiresIn));
    expiry.unref();
    socket.on("close", () => {
      clearTimeout(expiry);
      for (const unsubscribe of unsubscribes) unsubscribe();
    });
  });
}
