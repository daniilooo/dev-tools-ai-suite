import type { Project, TerminalCloseCode, TerminalServerMessage, TerminalSession } from "@devtools/shared";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { AppError, badRequest, notFound } from "../../core/errors.js";
import { killProcessTree } from "../../core/process-tree.js";
import { OutputBuffer } from "./output-buffer.js";
import type { PtyBackend, PtyProcess } from "./pty-backend.js";
import type { TerminalRepository } from "./terminal.repository.js";

/** Uma conexão de navegador acompanhando um terminal. */
export interface TerminalClient {
  send(message: TerminalServerMessage): void;
  close(code: TerminalCloseCode, reason: string): void;
  /** Bytes enfileirados e ainda não enviados. */
  readonly bufferedAmount: number;
}

export interface TerminalManagerOptions {
  backend: PtyBackend | null;
  backendError?: string | null;
  repository: TerminalRepository;
  /** Tempo que uma sessão sem navegador conectado continua viva. */
  retentionMs?: number;
  /** Tempo que uma sessão encerrada continua listada (para a aba mostrar o código de saída). */
  exitedRetentionMs?: number;
  bufferLimit?: number;
  maxSessions?: number;
  /** Cliente que acumular mais que isso sem consumir é desconectado (ele reconecta com replay). */
  maxClientBacklog?: number;
  shell?: { file: string; args: string[] };
  env?: NodeJS.ProcessEnv;
}

const DEFAULTS = {
  // Longa o bastante para um agente (claude/codex) seguir trabalhando com o navegador fechado.
  retentionMs: 8 * 60 * 60_000,
  exitedRetentionMs: 10 * 60_000,
  bufferLimit: 256 * 1024,
  maxSessions: 32,
  maxClientBacklog: 4 * 1024 * 1024,
};
const FLUSH_INTERVAL_MS = 4;
export const MIN_SIZE = { cols: 2, rows: 1 };
export const MAX_SIZE = { cols: 1000, rows: 500 };

interface LiveSession {
  info: TerminalSession;
  pty: PtyProcess | null;
  buffer: OutputBuffer;
  clients: Set<TerminalClient>;
  pending: string;
  flushTimer: NodeJS.Timeout | null;
  retentionTimer: NodeJS.Timeout | null;
}

/**
 * Ciclo de vida das sessões PTY (ADR-0004, STATE_MACHINES):
 * active ⇄ disconnected (retenção com buffer) → exited.
 * Cada sessão roda no diretório do projeto; projetos não compartilham sessões.
 */
export class TerminalManager {
  private readonly sessions = new Map<string, LiveSession>();
  private readonly titleCounters = new Map<string, number>();
  private readonly options: TerminalManagerOptions & typeof DEFAULTS;

  constructor(options: TerminalManagerOptions) {
    this.options = { ...DEFAULTS, ...options };
    this.options.repository.closeStale(new Date().toISOString());
  }

  get backendName(): string | null {
    return this.options.backend?.name ?? null;
  }

  get backendError(): string | null {
    return this.options.backendError ?? null;
  }

  list(projectId: string): TerminalSession[] {
    return [...this.sessions.values()]
      .filter((session) => session.info.projectId === projectId)
      .map((session) => ({ ...session.info }));
  }

  get(id: string): TerminalSession {
    return { ...this.require(id).info };
  }

  create(project: Project, size: { cols?: number; rows?: number } = {}): TerminalSession {
    const backend = this.options.backend;
    if (!backend) {
      throw new AppError(
        "TERMINAL_UNAVAILABLE",
        503,
        "Terminal indisponível: biblioteca de PTY não carregou.",
        {
          reason: this.backendError,
        },
      );
    }
    if (this.sessions.size >= this.options.maxSessions) {
      throw new AppError(
        "TERMINAL_LIMIT",
        409,
        `Limite de ${this.options.maxSessions} terminais abertos atingido. Feche algum para abrir outro.`,
      );
    }
    if (!existsSync(project.path) || !statSync(project.path).isDirectory()) {
      throw badRequest("O diretório do projeto não existe mais.", { path: project.path });
    }
    const cols = clamp(size.cols ?? 80, MIN_SIZE.cols, MAX_SIZE.cols);
    const rows = clamp(size.rows ?? 24, MIN_SIZE.rows, MAX_SIZE.rows);
    const shell = this.options.shell ?? defaultShell();

    const counter = (this.titleCounters.get(project.id) ?? 0) + 1;
    this.titleCounters.set(project.id, counter);

    const info: TerminalSession = {
      id: randomUUID(),
      projectId: project.id,
      title: `Terminal ${counter}`,
      shell: shell.file,
      state: "disconnected",
      cols,
      rows,
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitCode: null,
    };

    let pty: PtyProcess;
    try {
      pty = backend.spawn(shell.file, shell.args, {
        cwd: project.path,
        cols,
        rows,
        env: terminalEnv(this.options.env ?? process.env),
      });
    } catch (error) {
      throw new AppError("TERMINAL_SPAWN_FAILED", 500, "Não foi possível iniciar o terminal.", {
        reason: (error as Error).message,
      });
    }

    const session: LiveSession = {
      info,
      pty,
      buffer: new OutputBuffer(this.options.bufferLimit),
      clients: new Set(),
      pending: "",
      flushTimer: null,
      retentionTimer: null,
    };
    this.sessions.set(info.id, session);
    this.options.repository.insert(info);

    pty.onData((data) => this.onOutput(session, data));
    pty.onExit(({ exitCode, signal }) => this.onExit(session, exitCode, signal ?? null));
    // Até o navegador conectar, a sessão conta como desconectada (com retenção).
    this.scheduleRetention(session, this.options.retentionMs);
    return { ...info };
  }

  attach(id: string, client: TerminalClient): void {
    const session = this.sessions.get(id);
    if (!session) {
      client.close(4404, "Terminal não encontrado.");
      return;
    }
    this.flush(session);
    client.send({ type: "replay", data: session.buffer.snapshot(), session: { ...session.info } });
    if (session.info.state === "exited") {
      client.send({ type: "exit", exitCode: session.info.exitCode, signal: null });
    } else {
      this.setState(session, "active");
      this.clearRetention(session);
    }
    session.clients.add(client);
  }

  detach(id: string, client: TerminalClient): void {
    const session = this.sessions.get(id);
    if (!session || !session.clients.delete(client)) return;
    if (session.clients.size === 0 && session.info.state === "active") {
      this.setState(session, "disconnected");
      this.scheduleRetention(session, this.options.retentionMs);
    }
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session?.pty && session.info.state !== "exited") session.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session?.pty || session.info.state === "exited") return;
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) return;
    session.info.cols = clamp(cols, MIN_SIZE.cols, MAX_SIZE.cols);
    session.info.rows = clamp(rows, MIN_SIZE.rows, MAX_SIZE.rows);
    try {
      session.pty.resize(session.info.cols, session.info.rows);
    } catch {
      // o processo pode ter acabado de sair
    }
  }

  /** Encerra a sessão e toda a árvore de processos. */
  async close(id: string): Promise<void> {
    const session = this.require(id);
    await this.terminate(session, 4410, "Terminal encerrado.");
  }

  async closeProject(projectId: string): Promise<void> {
    const targets = [...this.sessions.values()].filter((s) => s.info.projectId === projectId);
    await Promise.all(targets.map((s) => this.terminate(s, 4410, "Projeto removido.")));
  }

  /** Desligamento do servidor: nenhum processo pode ficar órfão. */
  async shutdown(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((s) => this.terminate(s, 4410, "Servidor encerrado.")));
  }

  private require(id: string): LiveSession {
    const session = this.sessions.get(id);
    if (!session) throw notFound("Terminal não encontrado.");
    return session;
  }

  private async terminate(session: LiveSession, code: TerminalCloseCode, reason: string): Promise<void> {
    this.sessions.delete(session.info.id);
    this.clearRetention(session);
    if (session.flushTimer) clearTimeout(session.flushTimer);
    for (const client of session.clients) client.close(code, reason);
    session.clients.clear();
    const pty = session.pty;
    session.pty = null;
    if (session.info.state !== "exited") {
      session.info.state = "exited";
      session.info.endedAt = new Date().toISOString();
      this.options.repository.updateState(session.info);
    }
    if (pty) await killProcessTree(pty.pid);
  }

  private onOutput(session: LiveSession, data: string): void {
    session.buffer.append(data);
    if (session.clients.size === 0) return;
    // Agrupa rajadas de saída (ex.: htop) em poucas mensagens.
    session.pending += data;
    session.flushTimer ??= setTimeout(() => this.flush(session), FLUSH_INTERVAL_MS);
  }

  private flush(session: LiveSession): void {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    session.flushTimer = null;
    if (!session.pending) return;
    const data = session.pending;
    session.pending = "";
    for (const client of session.clients) {
      if (client.bufferedAmount > this.options.maxClientBacklog) {
        session.clients.delete(client);
        client.close(4429, "Conexão lenta: reconecte para receber o estado atual.");
        continue;
      }
      client.send({ type: "output", data });
    }
    if (session.clients.size === 0 && session.info.state === "active") {
      this.setState(session, "disconnected");
      this.scheduleRetention(session, this.options.retentionMs);
    }
  }

  private onExit(session: LiveSession, exitCode: number, signal: number | null): void {
    if (!this.sessions.has(session.info.id)) return;
    this.flush(session);
    // O shell saiu, mas filhos em segundo plano podem ter sobrado: encerra a árvore.
    const pid = session.pty?.pid;
    session.pty = null;
    if (pid !== undefined) void killProcessTree(pid, { graceMs: 1000, includeRoot: false });
    session.info.state = "exited";
    session.info.exitCode = exitCode;
    session.info.endedAt = new Date().toISOString();
    this.options.repository.updateState(session.info);
    for (const client of session.clients) client.send({ type: "exit", exitCode, signal });
    this.scheduleRetention(session, this.options.exitedRetentionMs);
  }

  private setState(session: LiveSession, state: TerminalSession["state"]): void {
    if (session.info.state === state) return;
    session.info.state = state;
    this.options.repository.updateState(session.info);
  }

  private scheduleRetention(session: LiveSession, ms: number): void {
    this.clearRetention(session);
    session.retentionTimer = setTimeout(() => {
      void this.terminate(session, 4410, "Terminal encerrado por inatividade.");
    }, ms);
    session.retentionTimer.unref();
  }

  private clearRetention(session: LiveSession): void {
    if (session.retentionTimer) clearTimeout(session.retentionTimer);
    session.retentionTimer = null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function defaultShell(): { file: string; args: string[] } {
  if (process.platform === "win32") {
    return { file: process.env.COMSPEC ?? "powershell.exe", args: [] };
  }
  const candidates = [process.env.SHELL, "/bin/bash", "/bin/sh"];
  const file = candidates.find((c): c is string => !!c && c.startsWith("/") && existsSync(c)) ?? "/bin/sh";
  return { file, args: [] };
}

/**
 * Ambiente do shell: o do usuário, sem as variáveis de configuração da suíte.
 * O segredo de instalação vive só em arquivo e nunca entra no ambiente.
 */
export function terminalEnv(base: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || key.startsWith("DEVTOOLS_")) continue;
    env[key] = value;
  }
  env.TERM = "xterm-256color";
  env.COLORTERM = "truecolor";
  env.TERM_PROGRAM = "devtools-ai-suite";
  return env;
}
