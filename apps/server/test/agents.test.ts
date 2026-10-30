import type { AgentRun, AgentRunDetail, Project, ServerEvent, TerminalSession } from "@devtools/shared";
import { appendFileSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { openDatabase } from "../src/core/database.js";
import type { Db } from "../src/core/database.js";
import { AgentMonitor } from "../src/modules/agents/agent-monitor.js";
import { AgentsRepository } from "../src/modules/agents/agents.repository.js";
import { ProvidersService } from "../src/modules/integrations/providers.service.js";
import { AgentSources } from "../src/modules/integrations/sources/agent-sources.js";
import { LocalSourceFiles } from "../src/modules/integrations/sources/local-files.js";
import type { LocalSourceRoots } from "../src/modules/integrations/sources/local-files.js";
import { ProjectsRepository } from "../src/modules/projects/projects.repository.js";
import { ProjectsService } from "../src/modules/projects/projects.service.js";
import {
  CLAUDE_SESSION_ID,
  CLAUDE_SUBAGENT_ID,
  CODEX_MAIN_ID,
  CODEX_SUB_ID,
  FIXTURE_SECRET,
  installAgentFixtures,
} from "./agent-fixtures.js";
import { createTestApp, login, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";

type AgentRunEvent = Extract<ServerEvent, { type: "agent.run.state" }>;

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

function makeRoots(base: string): LocalSourceRoots {
  const roots = { claude: join(base, "claude"), codex: join(base, "codex") };
  mkdirSync(roots.claude);
  mkdirSync(roots.codex);
  return roots;
}

describe("AgentMonitor", () => {
  let base: string;
  let db: Db;
  let roots: LocalSourceRoots;
  let project: Project;
  let repository: AgentsRepository;
  let now: number;
  let events: AgentRunEvent[];
  let monitor: AgentMonitor;

  beforeEach(() => {
    base = realpathSync(tempDir("devtools-monitor-"));
    db = openDatabase(join(base, "db.sqlite"));
    roots = makeRoots(base);
    const projectDir = join(base, "proj");
    mkdirSync(projectDir);
    const projects = new ProjectsService(new ProjectsRepository(db));
    project = projects.create({ path: projectDir });
    installAgentFixtures(roots, project.path);
    repository = new AgentsRepository(db);
    now = Date.parse("2026-10-28T10:06:00.000Z");
    const sources = new AgentSources(new LocalSourceFiles(roots), () => now);
    monitor = new AgentMonitor({ sources, projects, repository, now: () => now });
    events = [];
    monitor.subscribe((event) => events.push(event as AgentRunEvent));
  });

  afterEach(() => {
    db.close();
    rmSync(base, { recursive: true, force: true });
  });

  const claudeRun = () => monitor.list(project.id).find((r) => r.providerId === "claude-code")!;

  it("normaliza sessões e subagentes em AgentRun, com estado derivado de evidência", () => {
    monitor.tick();
    const runs = monitor.list(project.id);
    expect(runs.map((r) => r.id).sort()).toEqual([
      `claude-code:${CLAUDE_SESSION_ID}`,
      `codex:${CODEX_MAIN_ID}`,
    ]);

    const claude = claudeRun();
    expect(claude).toMatchObject({
      projectId: project.id,
      kind: "agent",
      // Turno interrompido às 10:05:03, agora 10:06: aguardando o usuário.
      state: "waiting",
      endedAt: null,
      terminalId: null,
      source: { level: "B", description: "transcrições locais do Claude Code" },
    });
    expect(claude.subagents).toHaveLength(1);
    expect(claude.subagents[0]).toMatchObject({
      id: `claude-code:${CLAUDE_SESSION_ID}:${CLAUDE_SUBAGENT_ID}`,
      kind: "subagent",
      parentRunId: claude.id,
      agentType: "explorer",
      state: "completed",
      endedAt: "2026-10-28T10:00:59.000Z",
    });

    const codex = monitor.get(`codex:${CODEX_MAIN_ID}`);
    expect(codex).toMatchObject({
      state: "waiting",
      source: { level: "B", description: "sessões locais do Codex" },
    });
    expect(codex.subagents.map((s) => s.id)).toEqual([`codex:${CODEX_MAIN_ID}:${CODEX_SUB_ID}`]);
    expect(codex.subagents[0]!.state).toBe("completed");
  });

  it("sem eventos novos além do limite de frescor, o estado vira desconhecido (não presume ativo nem encerrado)", () => {
    monitor.tick();
    expect(claudeRun().state).toBe("waiting");
    events.length = 0;

    now = Date.parse("2026-10-28T10:40:00.000Z");
    monitor.tick();
    expect(claudeRun().state).toBe("unknown");
    expect(events.map((e) => [e.run.id, e.run.state])).toContainEqual([
      `claude-code:${CLAUDE_SESSION_ID}`,
      "unknown",
    ]);

    const stateEvents = db
      .prepare(
        "SELECT payload_redacted_json FROM agent_events WHERE run_id = ? AND type = 'state' ORDER BY id",
      )
      .all(`claude-code:${CLAUDE_SESSION_ID}`) as { payload_redacted_json: string }[];
    expect(stateEvents.map((e) => JSON.parse(e.payload_redacted_json))).toEqual([
      { state: "waiting", previous: null },
      { state: "unknown", previous: "waiting" },
    ]);
  });

  it("só publica quando algo muda", () => {
    monitor.tick();
    expect(events).toHaveLength(4);
    monitor.tick();
    expect(events).toHaveLength(4);
  });

  it("ao reiniciar, execuções que pareciam ativas ficam desconhecidas até a releitura", () => {
    monitor.tick();
    expect(claudeRun().state).toBe("waiting");
    repository.markStaleUnknown();
    expect(claudeRun().state).toBe("unknown");
    expect(claudeRun().subagents[0]!.state).toBe("completed");
  });

  it("não persiste prompts, saídas nem segredos", () => {
    monitor.tick();
    const dump = JSON.stringify([
      db.prepare("SELECT * FROM agent_runs").all(),
      db.prepare("SELECT * FROM agent_events").all(),
    ]);
    expect(dump).not.toContain(FIXTURE_SECRET);
    for (const content of ["nunca deve ser lid", "segredo.txt", "Crie a tela", "instruções do sistema"]) {
      expect(dump).not.toContain(content);
    }
    expect(dump).toContain("[REDIGIDO]");
  });

  it("mantém o vínculo com o terminal depois de reiniciar (lançamentos ficam só em memória)", () => {
    const linked = new AgentMonitor({
      sources: new AgentSources(new LocalSourceFiles(roots), () => now),
      projects: new ProjectsService(new ProjectsRepository(db)),
      repository,
      terminals: {
        terminalFor: (_p, _pr, externalId) => (externalId === CLAUDE_SESSION_ID ? "term-1" : null),
      },
      now: () => now,
    });
    linked.tick();
    expect(linked.get(`claude-code:${CLAUDE_SESSION_ID}`).terminalId).toBe("term-1");

    // Novo processo: sem lançamentos em memória, com mudança de estado publicada.
    const restarted = new AgentMonitor({
      sources: new AgentSources(new LocalSourceFiles(roots), () => now),
      projects: new ProjectsService(new ProjectsRepository(db)),
      repository,
      terminals: { terminalFor: () => null },
      now: () => now,
    });
    const published: AgentRunEvent[] = [];
    restarted.subscribe((event) => published.push(event as AgentRunEvent));
    now = Date.parse("2026-10-28T10:40:00.000Z");
    restarted.tick();
    const event = published.find((e) => e.run.id === `claude-code:${CLAUDE_SESSION_ID}`)!;
    expect(event.run).toMatchObject({ state: "unknown", terminalId: "term-1" });
    expect(restarted.get(`codex:${CODEX_MAIN_ID}`).terminalId).toBeNull();
  });

  it("isola falhas da varredura sem derrubar o servidor", () => {
    const errors: unknown[] = [];
    const broken = new AgentMonitor({
      sources: {
        scan: () => {
          throw new Error("falhou");
        },
      } as unknown as AgentSources,
      projects: new ProjectsService(new ProjectsRepository(db)),
      repository,
      onError: (error) => errors.push(error),
    });
    expect(() => broken.tick()).not.toThrow();
    expect(errors).toHaveLength(1);
  });
});

describe("rotas de agentes e /ws/events", () => {
  let ctx: TestContext;
  let host: string;
  let auth: { cookie: string; csrf: string };
  let roots: LocalSourceRoots;
  let project: Project;

  beforeEach(async () => {
    const port = await freePort();
    host = `127.0.0.1:${port}`;
    const dataDir = tempDir();
    roots = makeRoots(dataDir);
    ctx = await createTestApp(dataDir, true, {
      port,
      agentSourceRoots: roots,
      terminalOptions: { shell: { file: "/bin/bash", args: ["--norc", "--noprofile"] } },
      // Provedor falso com o mesmo vínculo do Claude Code real (--session-id).
      providers: new ProvidersService({
        adapters: [
          {
            id: "claude-code",
            label: "Claude Code",
            launchCommand: "true",
            sessionIdFlag: "--session-id",
            detect: () => Promise.reject(new Error("não usado")),
          },
        ],
      }),
    });
    await ctx.server.listen({ host: "127.0.0.1", port });
    auth = await login(ctx, host);
    const projectDir = realpathSync(tempDir("devtools-proj-"));
    project = (await api("POST", "/api/v1/projects", { path: projectDir })).json<Project>();
  });

  afterEach(async () => {
    await ctx.close();
  });

  function api(method: "GET" | "POST", url: string, payload?: object, headers: Record<string, string> = {}) {
    return ctx.server.inject({
      method,
      url,
      headers: { host, origin: `http://${host}`, cookie: auth.cookie, "x-csrf-token": auth.csrf, ...headers },
      payload,
    });
  }

  function events(headers: Record<string, string> = { origin: `http://${host}`, cookie: auth.cookie }) {
    const ws = new WebSocket(`ws://${host}/ws/events`, { headers });
    const received: AgentRunEvent[] = [];
    ws.on("message", (raw) => received.push(JSON.parse(raw.toString()) as AgentRunEvent));
    const opened = new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
      ws.once("error", reject);
    });
    return { ws, received, opened };
  }

  async function waitUntil(condition: () => boolean, timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error("condição não atingida a tempo");
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  it("lista execuções do projeto com subagentes e detalha uma execução", async () => {
    installAgentFixtures(roots, project.path);
    ctx.agents.tick();

    const list = await api("GET", `/api/v1/projects/${project.id}/agents/runs`);
    expect(list.statusCode).toBe(200);
    const runs = list.json<AgentRunDetail[]>();
    expect(runs.map((r) => r.providerId).sort()).toEqual(["claude-code", "codex"]);
    expect(runs.every((r) => r.subagents.length === 1)).toBe(true);

    const detail = await api("GET", `/api/v1/agents/runs/${encodeURIComponent(`codex:${CODEX_MAIN_ID}`)}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json<AgentRunDetail>()).toMatchObject({ providerId: "codex", model: "gpt-5.6-terra" });

    expect((await api("GET", "/api/v1/agents/runs/inexistente")).statusCode).toBe(404);
    expect((await api("GET", "/api/v1/projects/inexistente/agents/runs")).statusCode).toBe(404);
    expect(
      (await api("GET", `/api/v1/projects/${project.id}/agents/runs`, undefined, { cookie: "" })).statusCode,
    ).toBe(401);
  });

  it("vincula a sessão do Claude ao terminal da suíte em que foi aberta", async () => {
    const created = await api("POST", `/api/v1/projects/${project.id}/terminals`, { launch: "claude-code" });
    expect(created.statusCode).toBe(201);
    const terminal = created.json<TerminalSession>();
    const launches = (ctx.terminals as unknown as { launches: { externalId: string | null }[] }).launches;
    const sessionId = launches[0]!.externalId!;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    installAgentFixtures(roots, project.path, { claudeSessionId: sessionId });
    ctx.agents.tick();
    const run = ctx.agents.get(`claude-code:${sessionId}`);
    expect(run.terminalId).toBe(terminal.id);
    expect(ctx.agents.get(`codex:${CODEX_MAIN_ID}`).terminalId).toBeNull();
  });

  it("publica mudanças em /ws/events para a sessão autenticada", async () => {
    const paths = installAgentFixtures(roots, project.path);
    ctx.agents.tick();
    const client = events();
    await client.opened;

    appendFileSync(
      paths.claudeSession,
      JSON.stringify({
        type: "user",
        cwd: project.path,
        timestamp: new Date().toISOString(),
        message: { content: "x" },
      }) + "\n",
    );
    ctx.agents.tick();
    await waitUntil(() => client.received.length > 0);
    const event = client.received[0]!;
    expect(event.type).toBe("agent.run.state");
    expect(event.run).toMatchObject<Partial<AgentRun>>({
      id: `claude-code:${CLAUDE_SESSION_ID}`,
      state: "running",
    });
    client.ws.close();
  });

  it("recusa /ws/events sem sessão, sem Origin ou com Origin de outro site", async () => {
    await expect(events({ origin: `http://${host}` }).opened).rejects.toThrow("HTTP 401");
    await expect(events({ cookie: auth.cookie }).opened).rejects.toThrow("HTTP 403");
    await expect(events({ origin: "https://evil.example", cookie: auth.cookie }).opened).rejects.toThrow(
      "HTTP 403",
    );
    await expect(
      events({ origin: `http://${host}`, cookie: "devtools_session=forjado.9999999999999.assinatura" })
        .opened,
    ).rejects.toThrow("HTTP 401");
  });
});
