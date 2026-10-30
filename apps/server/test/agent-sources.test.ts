import {
  appendFileSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSources } from "../src/modules/integrations/sources/agent-sources.js";
import type { Observation } from "../src/modules/integrations/sources/agent-sources.js";
import { ClaudeTranscriptParser } from "../src/modules/integrations/sources/claude-transcript.js";
import { JsonlTail } from "../src/modules/integrations/sources/jsonl-tail.js";
import {
  claudeProjectDirName,
  defaultRoots,
  LocalSourceFiles,
} from "../src/modules/integrations/sources/local-files.js";
import type { LocalSourceRoots } from "../src/modules/integrations/sources/local-files.js";
import { deriveState, emptySnapshot, FRESHNESS } from "../src/modules/integrations/sources/run-snapshot.js";
import {
  CLAUDE_SESSION_ID,
  CLAUDE_SUBAGENT_ID,
  CODEX_MAIN_ID,
  CODEX_SUB_ID,
  FIXTURE_NOW,
  FIXTURE_SECRET,
  installAgentFixtures,
} from "./agent-fixtures.js";
import { tempDir } from "./helpers.js";

const UUID = "11111111-2222-3333-4444-555555555555";

let base: string;
let roots: LocalSourceRoots;
let files: LocalSourceFiles;

beforeEach(() => {
  base = realpathSync(tempDir("devtools-agents-"));
  roots = { claude: join(base, "claude"), codex: join(base, "codex") };
  mkdirSync(roots.claude);
  mkdirSync(roots.codex);
  files = new LocalSourceFiles(roots);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("LocalSourceFiles (allowlist)", () => {
  it("permite só transcrições e sessões, nunca credenciais ou configurações", () => {
    const projectDir = join(roots.claude, "projects", "-proj");
    mkdirSync(join(projectDir, UUID, "subagents"), { recursive: true });
    const sessionDir = join(roots.codex, "sessions", "2026", "10", "28");
    mkdirSync(sessionDir, { recursive: true });
    const allowed = [
      join(projectDir, `${UUID}.jsonl`),
      join(projectDir, UUID, "subagents", "agent-abc123.jsonl"),
      join(projectDir, UUID, "subagents", "agent-abc123.meta.json"),
      join(sessionDir, "rollout-2026-10-28T11-00-00-abc.jsonl"),
    ];
    const denied = [
      join(roots.claude, ".credentials.json"),
      join(roots.claude, "settings.json"),
      join(roots.claude, "history.jsonl"),
      join(projectDir, "notas.jsonl"),
      join(roots.codex, "auth.json"),
      join(roots.codex, "config.toml"),
      join(roots.codex, "history.jsonl"),
      join(base, "fora.jsonl"),
    ];
    for (const path of [...allowed, ...denied]) writeFileSync(path, "{}\n");

    for (const path of allowed) expect(files.isAllowed(path), path).toBe(true);
    for (const path of denied) {
      expect(files.isAllowed(path), path).toBe(false);
      expect(files.stat(path)).toBeNull();
      expect(() => files.read(path, 0, 10)).toThrow("allowlist");
    }
  });

  it("recusa links simbólicos e caminhos com ..", () => {
    const projectDir = join(roots.claude, "projects", "-proj");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(roots.claude, ".credentials.json"), '{"token":"x"}');
    const link = join(projectDir, `${UUID}.jsonl`);
    symlinkSync(join(roots.claude, ".credentials.json"), link);
    expect(files.isAllowed(link)).toBe(false);
    expect(() => files.read(link, 0, 100)).toThrow("allowlist");

    const escape = join(roots.claude, "projects", "-proj", "..", "..", ".credentials.json");
    expect(files.isAllowed(escape)).toBe(false);
  });

  it("lista só diretórios dentro das raízes", () => {
    writeFileSync(join(base, "segredo.txt"), "x");
    expect(files.list(base)).toEqual([]);
    expect(files.list(join(roots.claude, "inexistente"))).toEqual([]);
  });

  it("respeita CLAUDE_CONFIG_DIR e CODEX_HOME", () => {
    expect(defaultRoots({ CLAUDE_CONFIG_DIR: "/c", CODEX_HOME: "/x" })).toEqual({
      claude: "/c",
      codex: "/x",
    });
    expect(claudeProjectDirName("/home/ana/meu_projeto.v2")).toBe("-home-ana-meu-projeto-v2");
  });
});

describe("JsonlTail", () => {
  it("lê incrementalmente, guarda linha incompleta, ignora linha corrompida e recomeça se o arquivo encolher", () => {
    const dir = join(roots.claude, "projects", "-p");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${UUID}.jsonl`);
    writeFileSync(path, '{"a":1}\n{"b":');
    const tail = new JsonlTail(files, path);

    expect(tail.poll()).toEqual({ records: [{ a: 1 }], reset: false, changed: true });
    expect(tail.poll()).toEqual({ records: [], reset: false, changed: false });

    appendFileSync(path, '2}\nlixo{\n{"c":3}\n');
    expect(tail.poll().records).toEqual([{ b: 2 }, { c: 3 }]);

    truncateSync(path, 0);
    writeFileSync(path, '{"d":4}\n');
    expect(tail.poll()).toEqual({ records: [{ d: 4 }], reset: true, changed: true });
  });
});

describe("deriveState (nunca presume estado)", () => {
  const at = (phase: ReturnType<typeof emptySnapshot>["phase"], lastEventAt: string | null) => ({
    ...emptySnapshot("x", "agent"),
    phase,
    lastEventAt,
  });
  const t = Date.parse("2026-10-28T10:00:00.000Z");
  const iso = new Date(t).toISOString();

  it("mapeia fases observadas e aplica o limite de frescor", () => {
    expect(deriveState(at("none", iso), t + FRESHNESS.idleMs)).toBe("detected");
    expect(deriveState(at("none", iso), t + FRESHNESS.idleMs + 1)).toBe("unknown");
    expect(deriveState(at("none", null), t)).toBe("unknown");
    expect(deriveState(at("done", iso), t + 10 * FRESHNESS.idleMs)).toBe("completed");
    expect(deriveState(at("error", iso), t + 10 * FRESHNESS.idleMs)).toBe("failed");
    expect(deriveState(at("turn", iso), t + FRESHNESS.turnMs)).toBe("running");
    expect(deriveState(at("turn", iso), t + FRESHNESS.turnMs + 1)).toBe("unknown");
    expect(deriveState(at("idle", iso), t + FRESHNESS.idleMs)).toBe("waiting");
    expect(deriveState(at("idle", iso), t + FRESHNESS.idleMs + 1)).toBe("unknown");
    expect(deriveState(at("turn", null), t)).toBe("unknown");
  });
});

describe("ClaudeTranscriptParser", () => {
  it("marca erro registrado e volta a trabalhar quando o usuário envia nova mensagem", () => {
    const parser = new ClaudeTranscriptParser(UUID, "agent");
    parser.feed([
      { type: "system", level: "error", timestamp: "2026-10-28T10:00:00.000Z", content: "falha" },
    ]);
    expect(parser.snapshot.phase).toBe("error");
    expect(parser.snapshot.error).toBe("erro registrado pelo Claude Code");
    parser.feed([
      { type: "user", isMeta: true, timestamp: "2026-10-28T10:00:01.000Z", message: { content: "x" } },
    ]);
    expect(parser.snapshot.phase).toBe("error");
    parser.feed([{ type: "user", timestamp: "2026-10-28T10:00:02.000Z", message: { content: "de novo" } }]);
    expect(parser.snapshot.phase).toBe("turn");
    expect(parser.snapshot.lastEventAt).toBe("2026-10-28T10:00:02.000Z");
  });
});

describe("AgentSources (fixtures Claude Code 2.1.312 e Codex 0.165.0)", () => {
  let project: string;

  function scan(sources = new AgentSources(files, () => FIXTURE_NOW)): Observation[] {
    return sources.scan([{ id: "p1", path: project }]);
  }
  const find = (obs: Observation[], id: string) => obs.find((o) => o.snapshot.externalId === id)!.snapshot;

  beforeEach(() => {
    project = join(base, "meu-projeto");
    mkdirSync(project);
    installAgentFixtures(roots, project);
  });

  it("extrai metadados da sessão do Claude sem prompts, saídas ou segredos", () => {
    const observations = scan();
    expect(observations).toHaveLength(4);
    const main = find(observations, CLAUDE_SESSION_ID);
    expect(main).toMatchObject({
      kind: "agent",
      parentExternalId: null,
      title: "Tela de agentes [REDIGIDO]",
      model: "claude-opus-5-5",
      providerVersion: "2.1.312",
      cwd: project,
      startedAt: "2026-10-28T10:00:00.000Z",
      lastEventAt: "2026-10-28T10:05:03.000Z",
      // Interrompido pelo usuário: turno encerrado, aguardando.
      phase: "idle",
      // Quatro mensagens (msg_01 repetida em dois blocos conta uma vez).
      tokens: { input: 40, output: 20, cacheRead: 400, cacheWrite: 200 },
      toolCalls: { Bash: 1, Agent: 1, Read: 1 },
      error: null,
    });
    const serialized = JSON.stringify(observations);
    expect(serialized).not.toContain(FIXTURE_SECRET);
    for (const content of [
      "nunca deve ser lid",
      "segredo.txt",
      "Crie a tela",
      "saída da ferramenta",
      "Pronto.",
    ]) {
      expect(serialized).not.toContain(content);
    }
  });

  it("distingue o subagente do Claude e aplica tipo e descrição do meta", () => {
    const sub = find(scan(), CLAUDE_SUBAGENT_ID);
    expect(sub).toMatchObject({
      kind: "subagent",
      parentExternalId: CLAUDE_SESSION_ID,
      agentType: "explorer",
      title: "Localizar rotas",
      model: "claude-haiku-5-5",
      phase: "done",
      tokens: { input: 7, output: 16, cacheRead: 50, cacheWrite: 0 },
      toolCalls: { Grep: 1 },
    });
  });

  it("lê sessões do Codex (tokens acumulados, ferramentas, subagente por parent_thread_id)", () => {
    const observations = scan();
    expect(find(observations, CODEX_MAIN_ID)).toMatchObject({
      kind: "agent",
      model: "gpt-5.6-terra",
      providerVersion: "0.165.0",
      phase: "idle",
      title: null,
      tokens: { input: 2000, output: 300, cacheRead: 1500, cacheWrite: 10 },
      toolCalls: { exec_command: 1, apply_patch: 1 },
    });
    expect(find(observations, CODEX_SUB_ID)).toMatchObject({
      kind: "subagent",
      parentExternalId: CODEX_MAIN_ID,
      title: "Explorer",
      model: "gpt-5.6-mini",
      phase: "done",
      tokens: { input: 300, output: 40, cacheRead: 100, cacheWrite: 0 },
    });
    expect(JSON.stringify(observations)).not.toContain("instruções do sistema");
  });

  it("acompanha o crescimento do arquivo e marca mudança só quando há bytes novos", () => {
    const sources = new AgentSources(files, () => FIXTURE_NOW);
    const paths = installAgentFixtures(roots, project);
    scan(sources);
    expect(scan(sources).every((o) => !o.changed)).toBe(true);

    appendFileSync(
      paths.claudeSession,
      JSON.stringify({
        type: "user",
        cwd: project,
        timestamp: "2026-10-28T10:06:00.000Z",
        message: { content: "continue" },
      }) + "\n",
    );
    const after = scan(sources);
    expect(after.filter((o) => o.changed).map((o) => o.snapshot.externalId)).toEqual([CLAUDE_SESSION_ID]);
    expect(find(after, CLAUDE_SESSION_ID).phase).toBe("turn");
  });

  it("ignora transcrição de outro diretório com o mesmo nome codificado e sessões do Codex de outros projetos", () => {
    // "/base/meu-projeto" e "/base/meu/projeto" geram o mesmo nome de diretório no Claude Code.
    const other = join(base, "meu", "projeto");
    mkdirSync(other, { recursive: true });
    expect(claudeProjectDirName(other)).toBe(claudeProjectDirName(project));
    rmSync(roots.claude, { recursive: true });
    rmSync(roots.codex, { recursive: true });
    installAgentFixtures(roots, other);

    expect(scan()).toEqual([]);
  });

  it("não lê nada sem projetos cadastrados", () => {
    expect(new AgentSources(files, () => FIXTURE_NOW).scan([])).toEqual([]);
  });
});
