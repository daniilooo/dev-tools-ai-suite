import { Injectable, signal } from "@angular/core";
import type { ServerEvent } from "@devtools/shared";

type Listener = (event: ServerEvent) => void;

/**
 * Canal `/ws/events` (eventos do servidor). Abre sob demanda quando há assinantes,
 * reconecta com espera crescente e fecha quando o último assinante sai.
 * Autenticação pelo cookie de sessão e Origin (ADR-0007); nada de token na URL.
 */
@Injectable({ providedIn: "root" })
export class ServerEventsService {
  /** `true` enquanto o canal está aberto: sem ele, a tela avisa que pode estar desatualizada. */
  readonly connected = signal(false);
  private readonly listeners = new Set<Listener>();
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (!this.socket && !this.retryTimer) this.open();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.shutdown();
    };
  }

  private open(): void {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/ws/events`);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.connected.set(true);
    };
    socket.onmessage = (message) => {
      let event: ServerEvent;
      try {
        event = JSON.parse(String(message.data)) as ServerEvent;
      } catch {
        return;
      }
      for (const listener of this.listeners) listener(event);
    };
    socket.onclose = (close) => {
      // Fechamento de um socket antigo (já substituído após um novo subscribe): ignora.
      if (this.socket !== socket) return;
      this.socket = null;
      this.connected.set(false);
      // 4401: sessão expirou — o próximo pedido HTTP leva à tela de acesso.
      if (this.listeners.size === 0 || close.code === 4401) return;
      const delay = Math.min(30_000, 1_000 * 2 ** this.attempt++);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.listeners.size > 0) this.open();
      }, delay);
    };
  }

  private shutdown(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }
}
