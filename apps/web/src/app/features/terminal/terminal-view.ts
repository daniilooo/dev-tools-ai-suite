import type { ElementRef } from "@angular/core";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";
import { Router } from "@angular/router";
import type { TerminalClientMessage, TerminalServerMessage, TerminalSession } from "@devtools/shared";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import type { ITheme } from "@xterm/xterm";
import { ThemeService } from "../../core/theme.service";

export type ConnectionState = "connecting" | "open" | "reconnecting" | "exited" | "closed";

/** Códigos que encerram de vez a conexão (ver TerminalCloseCode em @devtools/shared). */
const FINAL_CLOSE_CODES = new Set([4401, 4404, 4410]);
const MAX_BACKOFF_MS = 5000;

const THEMES: Record<"dark" | "light", ITheme> = {
  dark: {
    background: "#0d1117",
    foreground: "#e6edf3",
    cursor: "#7c9cff",
    selectionBackground: "#7c9cff55",
  },
  light: {
    background: "#f6f8fb",
    foreground: "#1b2430",
    cursor: "#3c5fd6",
    selectionBackground: "#3c5fd633",
    black: "#1b2430",
    white: "#8b98a9",
    brightWhite: "#5d6b7c",
    yellow: "#a86f0c",
    brightYellow: "#8a5a08",
  },
};

/**
 * Um terminal xterm.js ligado a uma sessão PTY por WebSocket.
 * Reconecta sozinho com backoff; o servidor reenvia a saída recente (replay).
 */
@Component({
  selector: "dt-terminal-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block h-full w-full" },
  template: `<div #host class="h-full w-full" data-testid="terminal"></div>`,
})
export class TerminalView {
  readonly sessionId = input.required<string>();
  readonly active = input(true);
  readonly connection = output<ConnectionState>();
  readonly exited = output<number | null>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>("host");
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  private terminal: Terminal | null = null;
  private fit: FitAddon | null = null;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private disposed = false;
  private observer: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => this.open());

    effect(() => {
      const theme = this.theme.theme();
      if (this.terminal) this.terminal.options.theme = THEMES[theme];
    });

    // Aba escondida não tem tamanho: ajusta ao ficar visível e devolve o foco.
    effect(() => {
      if (this.active() && this.terminal) {
        requestAnimationFrame(() => {
          this.fitAndReport();
          this.terminal?.focus();
        });
      }
    });

    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  focus(): void {
    this.terminal?.focus();
  }

  private open(): void {
    const terminal = new Terminal({
      cursorBlink: true,
      // Nerd Fonts primeiro: prompts como powerlevel10k/starship usam os ícones delas.
      fontFamily:
        '"MesloLGS NF", "JetBrainsMono Nerd Font", "FiraCode Nerd Font", "Hack Nerd Font", "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: THEMES[this.theme.theme()],
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(
      new WebLinksAddon((_event, uri) => {
        // Abre links em nova aba sem dar à página aberta acesso a esta janela.
        window.open(uri, "_blank", "noopener,noreferrer");
      }),
    );
    terminal.open(this.host().nativeElement);
    this.terminal = terminal;
    this.fit = fit;

    terminal.onData((data) => this.send({ type: "input", data }));
    terminal.onResize(({ cols, rows }) => this.send({ type: "resize", cols, rows }));

    const observer = new ResizeObserver(() => {
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.fitAndReport(), 50);
    });
    observer.observe(this.host().nativeElement);
    this.observer = observer;

    this.fitAndReport();
    this.connect();
  }

  private fitAndReport(): void {
    const element = this.host().nativeElement;
    if (!this.fit || !this.terminal || element.offsetWidth === 0 || element.offsetHeight === 0) return;
    try {
      this.fit.fit();
    } catch {
      // elemento ainda sem dimensões
    }
  }

  private connect(): void {
    if (this.disposed) return;
    this.connection.emit(this.attempts === 0 ? "connecting" : "reconnecting");
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${scheme}://${location.host}/ws/terminal/${encodeURIComponent(this.sessionId())}`,
    );
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.connection.emit("open");
      // Informa o tamanho atual: o PTY pode ter sido criado com outro.
      if (this.terminal) this.send({ type: "resize", cols: this.terminal.cols, rows: this.terminal.rows });
    };
    socket.onmessage = (event: MessageEvent<string>) => this.onMessage(JSON.parse(event.data));
    socket.onclose = (event) => {
      if (this.socket !== socket || this.disposed) return;
      this.socket = null;
      if (event.code === 4401) {
        void this.router.navigateByUrl("/acesso");
        return;
      }
      if (FINAL_CLOSE_CODES.has(event.code)) {
        this.connection.emit("closed");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private onMessage(message: TerminalServerMessage): void {
    const terminal = this.terminal;
    if (!terminal) return;
    switch (message.type) {
      case "replay":
        terminal.reset();
        terminal.write(message.data);
        this.applySession(message.session);
        break;
      case "output":
        terminal.write(message.data);
        break;
      case "exit":
        terminal.write(
          `\r\n\x1b[2m[processo encerrado${message.exitCode === null ? "" : ` com código ${message.exitCode}`}]\x1b[0m\r\n`,
        );
        this.connection.emit("exited");
        this.exited.emit(message.exitCode);
        break;
    }
  }

  private applySession(session: TerminalSession): void {
    if (session.state === "exited") this.connection.emit("exited");
  }

  private scheduleReconnect(): void {
    this.attempts++;
    this.connection.emit("reconnecting");
    const delay = Math.min(MAX_BACKOFF_MS, 250 * 2 ** Math.min(this.attempts, 5));
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(message: TerminalClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.observer?.disconnect();
    this.socket?.close();
    this.socket = null;
    this.terminal?.dispose();
    this.terminal = null;
  }
}
