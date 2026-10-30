import type { Project, TerminalServerMessage, TerminalSession } from "@devtools/shared";
import { mkdirSync, realpathSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { isAlive } from "../src/core/process-tree.js";
import { ProvidersService } from "../src/modules/integrations/providers.service.js";
import { createTestApp, login, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/** Cliente WS de teste que acumula a saída do terminal. */
class TerminalSocket {
  output = "";
  messages: TerminalServerMessage[] = [];
  closeCode: number | null = null;
  private readonly ws: WebSocket;
  readonly opened: Promise<void>;
  readonly closed: Promise<number>;

  constructor(url: string, headers: Record<string, string>) {
    this.ws = new WebSocket(url, { headers });
    this.opened = new Promise((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
      this.ws.once("error", reject);
    });
    this.closed = new Promise((resolve) => this.ws.once("close", (code) => resolve((this.closeCode = code))));
    this.ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as TerminalServerMessage;
      this.messages.push(message);
      if (message.type === "replay" || message.type === "output") this.output += message.data;
    });
  }

  send(data: string): void {
    this.ws.send(JSON.stringify({ type: "input", data }));
  }

  resize(cols: number, rows: number): void {
    this.ws.send(JSON.stringify({ type: "resize", cols, rows }));
  }

  async waitFor(pattern: RegExp, timeoutMs = 5000): Promise<RegExpMatchArray> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const match = pattern.exec(this.output);
      if (match) return match;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`tempo esgotado esperando ${pattern}; saída: ${JSON.stringify(this.output.slice(-500))}`);
  }

  close(): void {
    this.ws.close();
  }
}

async function waitUntil(condition: () => boolean | Promise<boolean>, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error("condição não atingida a tempo");
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("terminal (PTY real + WebSocket)", () => {
  let ctx: TestContext;
  let host: string;
  let auth: { cookie: string; csrf: string };
  let project: Project;
  let projectDir: string;

  beforeEach(async () => {
    const port = await freePort();
    host = `127.0.0.1:${port}`;
    ctx = await createTestApp(tempDir(), true, {
      port,
      terminalOptions: { shell: { file: "/bin/bash", args: ["--norc", "--noprofile"] } },
      // Provedor falso: o comando "lançado" só ecoa um marcador.
      providers: new ProvidersService({
        adapters: [
          {
            id: "claude-code",
            label: "Claude Code",
            launchCommand: "echo lancou-$((40+2))",
            detect: () => Promise.reject(new Error("não usado")),
          },
        ],
      }),
    });
    await ctx.server.listen({ host: "127.0.0.1", port });
    auth = await login(ctx, host);
    projectDir = realpathSync(tempDir("devtools-proj-"));
    mkdirSync(join(projectDir, "src"));
    project = (await api("POST", "/api/v1/projects", { path: projectDir })).json<Project>();
  });

  afterEach(async () => {
    await ctx.close();
  });

  function api(method: "GET" | "POST" | "DELETE", url: string, payload?: object) {
    return ctx.server.inject({
      method,
      url,
      headers: { host, origin: `http://${host}`, cookie: auth.cookie, "x-csrf-token": auth.csrf },
      payload,
    });
  }

  async function createTerminal(projectId = project.id): Promise<TerminalSession> {
    const response = await api("POST", `/api/v1/projects/${projectId}/terminals`, { cols: 100, rows: 30 });
    expect(response.statusCode).toBe(201);
    return response.json<TerminalSession>();
  }

  function connect(id: string, headers: Record<string, string> = {}): TerminalSocket {
    return new TerminalSocket(`ws://${host}/ws/terminal/${id}`, {
      origin: `http://${host}`,
      cookie: auth.cookie,
      ...headers,
    });
  }

  it("executa comandos no diretório do projeto", async () => {
    const terminal = await createTerminal();
    expect(terminal).toMatchObject({ projectId: project.id, title: "Terminal 1", cols: 100, rows: 30 });

    const socket = connect(terminal.id);
    await socket.opened;
    socket.send("echo resultado-$((20+22)); pwd\r");
    await socket.waitFor(/resultado-42/);
    await socket.waitFor(new RegExp(projectDir.replace(/[/.]/g, "\\$&")));
    socket.close();
  });

  it("inicia um provedor no shell do projeto e recusa provedor desconhecido", async () => {
    const response = await api("POST", `/api/v1/projects/${project.id}/terminals`, { launch: "claude-code" });
    expect(response.statusCode).toBe(201);
    const terminal = response.json<TerminalSession>();
    expect(terminal.title).toBe("Claude 1");
    const socket = connect(terminal.id);
    await socket.opened;
    await socket.waitFor(/lancou-42/);
    socket.send("pwd\r");
    await socket.waitFor(new RegExp(projectDir.replace(/[/.]/g, "\\$&")));
    socket.close();

    for (const launch of ["codex", "rm -rf /", "ollama"]) {
      const refused = await api("POST", `/api/v1/projects/${project.id}/terminals`, { launch });
      expect(refused.statusCode).toBe(400);
    }
  });

  it("recusa WebSocket sem sessão, sem Origin ou com Origin de outro site", async () => {
    const terminal = await createTerminal();
    await expect(connect(terminal.id, { cookie: "" }).opened).rejects.toThrow("HTTP 401");
    await expect(connect(terminal.id, { origin: "https://evil.example" }).opened).rejects.toThrow("HTTP 403");
    await expect(
      new TerminalSocket(`ws://${host}/ws/terminal/${terminal.id}`, { cookie: auth.cookie }).opened,
    ).rejects.toThrow("HTTP 403");
    await expect(
      connect(terminal.id, { cookie: "devtools_session=forjado.9999999999999.assinatura" }).opened,
    ).rejects.toThrow("HTTP 401");
  });

  it("reconexão reenvia a saída recente e mantém o processo vivo", async () => {
    const terminal = await createTerminal();
    const first = connect(terminal.id);
    await first.opened;
    first.send("export MARCA=persistiu; echo antes-da-queda\r");
    await first.waitFor(/antes-da-queda\r?\n/);
    first.close();
    await first.closed;
    await waitUntil(async () => {
      const listed = (await api("GET", `/api/v1/projects/${project.id}/terminals`)).json<TerminalSession[]>();
      return listed[0]?.state === "disconnected";
    });

    const second = connect(terminal.id);
    await second.opened;
    await second.waitFor(/antes-da-queda/);
    expect(second.messages[0]?.type).toBe("replay");
    second.send("echo valor=$MARCA\r");
    await second.waitFor(/valor=persistiu/);
    second.close();
  });

  it("isola terminais por projeto e recusa terminal inexistente", async () => {
    const otherDir = realpathSync(tempDir("devtools-proj-"));
    const other = (await api("POST", "/api/v1/projects", { path: otherDir })).json<Project>();
    const mine = await createTerminal();
    await createTerminal(other.id);

    const listed = (await api("GET", `/api/v1/projects/${project.id}/terminals`)).json<TerminalSession[]>();
    expect(listed.map((t) => t.id)).toEqual([mine.id]);

    const ghost = connect("00000000-0000-0000-0000-000000000000");
    await ghost.opened;
    expect(await ghost.closed).toBe(4404);
  });

  it("redimensiona o PTY", async () => {
    const terminal = await createTerminal();
    const socket = connect(terminal.id);
    await socket.opened;
    socket.resize(132, 40);
    socket.send("stty size\r");
    await socket.waitFor(/40 132/);
    socket.close();
  });

  it("encerrar o terminal mata toda a árvore de processos", async () => {
    const terminal = await createTerminal();
    const socket = connect(terminal.id);
    await socket.opened;
    socket.send("sleep 300 & echo pid-filho=$!\r");
    const [, rawPid] = await socket.waitFor(/pid-filho=(\d+)/);
    const childPid = Number(rawPid);
    expect(isAlive(childPid)).toBe(true);

    expect((await api("DELETE", `/api/v1/terminals/${terminal.id}`)).statusCode).toBe(204);
    expect(await socket.closed).toBe(4410);
    await waitUntil(() => !isAlive(childPid));
    expect((await api("GET", `/api/v1/projects/${project.id}/terminals`)).json()).toEqual([]);
  });

  it("saída do shell encerra a sessão e mata processos em segundo plano", async () => {
    const terminal = await createTerminal();
    const socket = connect(terminal.id);
    await socket.opened;
    socket.send("sleep 300 & echo pid-filho=$!\r");
    const childPid = Number((await socket.waitFor(/pid-filho=(\d+)/))[1]);
    socket.send("exit 3\r");
    await waitUntil(() => socket.messages.some((m) => m.type === "exit"));
    expect(socket.messages.find((m) => m.type === "exit")).toMatchObject({ exitCode: 3 });
    await waitUntil(() => !isAlive(childPid));

    const listed = (await api("GET", `/api/v1/projects/${project.id}/terminals`)).json<TerminalSession[]>();
    expect(listed[0]).toMatchObject({ state: "exited", exitCode: 3 });
    socket.close();
  });

  it("desligar o servidor não deixa processos órfãos", async () => {
    const terminal = await createTerminal();
    const socket = connect(terminal.id);
    await socket.opened;
    socket.send("sleep 300 & echo pid-filho=$!\r");
    const childPid = Number((await socket.waitFor(/pid-filho=(\d+)/))[1]);
    await ctx.server.close();
    await waitUntil(() => !isAlive(childPid));
  });

  it("remover o projeto encerra os terminais dele", async () => {
    const terminal = await createTerminal();
    const socket = connect(terminal.id);
    await socket.opened;
    expect((await api("DELETE", `/api/v1/projects/${project.id}`)).statusCode).toBe(204);
    expect(await socket.closed).toBe(4410);
    expect((await api("DELETE", `/api/v1/terminals/${terminal.id}`)).statusCode).toBe(404);
  });

  it("o ambiente do shell não recebe variáveis da suíte", async () => {
    process.env.DEVTOOLS_TESTE_VAZAMENTO = "nao-deveria-aparecer";
    try {
      const terminal = await createTerminal();
      const socket = connect(terminal.id);
      await socket.opened;
      socket.send('echo "[${DEVTOOLS_TESTE_VAZAMENTO:-vazio}] $TERM"\r');
      await socket.waitFor(/\[vazio\] xterm-256color/);
      socket.close();
    } finally {
      delete process.env.DEVTOOLS_TESTE_VAZAMENTO;
    }
  });
});

describe("terminal sem biblioteca de PTY", () => {
  it("responde 503 e o health indica o módulo indisponível", async () => {
    const ctx = await createTestApp(tempDir(), true, { pty: { backend: null, error: "binário ausente" } });
    const auth = await login(ctx);
    const headers = {
      host: "127.0.0.1:4317",
      origin: "http://127.0.0.1:4317",
      cookie: auth.cookie,
      "x-csrf-token": auth.csrf,
    };
    const dir = realpathSync(tempDir("devtools-proj-"));
    const project = (
      await ctx.server.inject({ method: "POST", url: "/api/v1/projects", headers, payload: { path: dir } })
    ).json<Project>();
    const response = await ctx.server.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/terminals`,
      headers,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: "TERMINAL_UNAVAILABLE" } });
    const health = await ctx.server.inject({ method: "GET", url: "/api/v1/health", headers });
    expect(health.json()).toMatchObject({ modules: { terminal: "not_available" } });
    await ctx.close();
  });
});
