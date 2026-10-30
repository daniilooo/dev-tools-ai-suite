import type { QuotaResponse, ServerEvent } from "@devtools/shared";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { ProvidersService } from "../src/modules/integrations/providers.service.js";
import { LocalSourceFiles } from "../src/modules/integrations/sources/local-files.js";
import type { LocalSourceRoots } from "../src/modules/integrations/sources/local-files.js";
import {
  parseClaudeRecord,
  parseCodexRecord,
  QuotaSources,
} from "../src/modules/integrations/sources/quota-sources.js";
import { readClaudeStatusLine, shellQuote } from "../src/modules/quota/claude-statusline.js";
import { buildQuota, freshnessOf } from "../src/modules/quota/quota-monitor.js";
import type { QuotaInputs } from "../src/modules/quota/quota-monitor.js";
import { extractRateLimits, renderLine } from "../src/statusline.js";
import { FIXTURE_NOW, FIXTURE_SECRET, installQuotaFixtures, statusLineInput } from "./agent-fixtures.js";
import { createTestApp, login, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";

const SCRIPT = fileURLToPath(new URL("../src/statusline.ts", import.meta.url));
const at = (iso: string) => Date.parse(iso);

function makeRoots(base: string): LocalSourceRoots {
  const roots = { claude: join(base, "claude"), codex: join(base, "codex") };
  mkdirSync(roots.claude, { recursive: true });
  mkdirSync(roots.codex, { recursive: true });
  return roots;
}

describe("status line da suíte", () => {
  it("guarda só os limites da entrada documentada e mostra uma linha curta", () => {
    const input = statusLineInput();
    const snapshot = extractRateLimits(input, new Date(FIXTURE_NOW));
    expect(snapshot).toEqual({
      observedAt: new Date(FIXTURE_NOW).toISOString(),
      version: "2.1.312",
      rateLimits: {
        five_hour: { usedPercent: 23.5, resetsAt: "2026-10-28T15:30:00.000Z" },
        seven_day: { usedPercent: 61, resetsAt: "2026-11-01T18:00:00.000Z" },
      },
    });
    expect(renderLine(input, snapshot)).toBe("Opus 5.5 · 5 h: 24% · semana: 61%");
    // Sem `rate_limits` (login por chave de API, antes da 1ª resposta): nada a gravar.
    expect(extractRateLimits({ model: { display_name: "Opus 5.5" } }, new Date())).toBeNull();
    expect(renderLine({ model: { display_name: "Opus 5.5" } }, null)).toBe("Opus 5.5");
  });

  it("executada como o Claude Code faria, grava o arquivo 0600 sem caminhos, custo ou sessão", () => {
    const out = join(tempDir(), "quota", "claude-statusline.json");
    const line = execFileSync(process.execPath, [SCRIPT, out], {
      input: JSON.stringify(statusLineInput()),
      encoding: "utf8",
    });
    expect(line).toBe("Opus 5.5 · 5 h: 24% · semana: 61%");
    expect(statSync(out).mode & 0o777).toBe(0o600);
    const saved = readFileSync(out, "utf8");
    for (const leaked of ["/home/pessoa", "transcript", "total_cost_usd", "session", "Opus"]) {
      expect(saved).not.toContain(leaked);
    }
    expect(readClaudeStatusLine(out)?.rateLimits.five_hour?.usedPercent).toBe(23.5);
    expect(readdirSync(join(out, ".."))).toEqual(["claude-statusline.json"]);
  });

  it("entrada inválida não quebra o Claude Code nem grava nada", () => {
    const out = join(tempDir(), "claude-statusline.json");
    expect(execFileSync(process.execPath, [SCRIPT, out], { input: "não é json", encoding: "utf8" })).toBe("");
    expect(existsSync(out)).toBe(false);
  });

  it("arquivo gravado com formato estranho é ignorado", () => {
    const path = join(tempDir(), "claude-statusline.json");
    writeFileSync(path, JSON.stringify({ observedAt: "ontem", rateLimits: {} }));
    expect(readClaudeStatusLine(path)).toBeNull();
    expect(readClaudeStatusLine(join(tempDir(), "inexistente.json"))).toBeNull();
  });

  it("escapa caminhos para o shell", () => {
    expect(shellQuote("/tmp/it's here")).toBe(`'/tmp/it'\\''s here'`);
  });
});

describe("QuotaSources", () => {
  it("lê os limites mais recentes do Codex e o limite atingido do Claude, sem conteúdo", () => {
    const roots = makeRoots(tempDir());
    installQuotaFixtures(roots, "/home/pessoa/projeto");
    const sources = new QuotaSources(new LocalSourceFiles(roots), () => FIXTURE_NOW);

    const codex = sources.codex();
    expect(codex).toEqual({
      observedAt: "2026-10-28T11:00:10.000Z",
      plan: "plus",
      windows: [
        { id: "five_hour", usedPercent: 42, limitReached: false, resetsAt: "2026-10-28T14:00:00.000Z" },
        { id: "seven_day", usedPercent: 15, limitReached: false, resetsAt: "2026-11-02T09:00:00.000Z" },
      ],
    });
    expect(sources.claudeLimitHit()).toEqual({
      observedAt: "2026-10-28T11:00:30.000Z",
      plan: null,
      windows: [
        { id: "five_hour", usedPercent: null, limitReached: true, resetsAt: "2026-10-28T13:00:00.000Z" },
      ],
    });
    expect(JSON.stringify([codex, sources.claudeLimitHit()])).not.toContain(FIXTURE_SECRET);
  });

  it("ignora arquivos antigos, fora da allowlist e registros sem janelas", () => {
    const roots = makeRoots(tempDir());
    installQuotaFixtures(roots, "/home/pessoa/projeto");
    // Nove dias depois: nada informa o estado atual.
    const later = new QuotaSources(new LocalSourceFiles(roots), () => FIXTURE_NOW + 9 * 24 * 60 * 60_000);
    expect(later.codex()).toBeNull();

    const decoy = join(roots.claude, "projects", "x");
    mkdirSync(decoy, { recursive: true });
    writeFileSync(join(decoy, "settings.json"), '{"quotaLimits":{"status":"rejected"}}');
    expect(
      parseCodexRecord({
        type: "event_msg",
        timestamp: "2026-10-28T11:00:00Z",
        payload: { type: "token_count", rate_limits: { primary: null } },
      }),
    ).toBeNull();
    expect(
      parseClaudeRecord({
        timestamp: "2026-10-28T11:00:00Z",
        quotaLimits: { status: "allowed", rateLimitType: "five_hour" },
      }),
    ).toBeNull();
    expect(
      parseCodexRecord({
        type: "event_msg",
        timestamp: "2026-10-28T11:00:00Z",
        payload: {
          type: "token_count",
          rate_limits: { primary: { used_percent: 100, window_minutes: 60, resets_in_seconds: 600 } },
        },
      }),
    ).toEqual({
      observedAt: "2026-10-28T11:00:00.000Z",
      plan: null,
      windows: [
        { id: "window_60m", usedPercent: 100, limitReached: true, resetsAt: "2026-10-28T11:10:00.000Z" },
      ],
    });
  });
});

describe("buildQuota", () => {
  const codex = {
    observedAt: "2026-10-28T11:00:10.000Z",
    plan: "plus",
    windows: [
      { id: "five_hour", usedPercent: 42, limitReached: false, resetsAt: "2026-10-28T14:00:00.000Z" },
    ],
  };
  const statusLine = {
    observedAt: "2026-10-28T10:30:00.000Z",
    version: "2.1.312",
    rateLimits: {
      five_hour: { usedPercent: 80, resetsAt: "2026-10-28T13:00:00.000Z" },
      seven_day: { usedPercent: 61, resetsAt: "2026-11-01T18:00:00.000Z" },
    },
  };
  const limitHit = {
    observedAt: "2026-10-28T11:00:30.000Z",
    plan: null,
    windows: [
      { id: "five_hour", usedPercent: null, limitReached: true, resetsAt: "2026-10-28T13:00:00.000Z" },
    ],
  };
  const inputs = (over: Partial<QuotaInputs> = {}): QuotaInputs => ({
    claudeStatusLine: { enabled: true, snapshot: statusLine },
    claudeLimitHit: limitHit,
    codex,
    ...over,
  });

  it("todo valor leva fonte, horário, categoria e frescor", () => {
    const quota = buildQuota(inputs(), FIXTURE_NOW);
    const windows = quota.providers.flatMap((p) => p.windows);
    expect(windows.length).toBe(3);
    for (const w of windows) {
      expect(w.category).toBe("official");
      expect(w.source.description).toBeTruthy();
      expect(Date.parse(w.observedAt)).not.toBeNaN();
      expect(["fresh", "stale", "reset"]).toContain(w.freshness);
    }
    const [claude, codexQuota] = quota.providers;
    // O limite atingido (11:00:30) é mais novo que a status line (10:30): prevalece.
    expect(claude!.windows[0]).toMatchObject({
      id: "five_hour",
      usedPercent: null,
      limitReached: true,
      freshness: "fresh",
      source: { level: "B" },
    });
    expect(claude!.windows[1]).toMatchObject({
      id: "seven_day",
      label: "Semanal (7 dias)",
      usedPercent: 61,
      freshness: "stale",
      source: { level: "A" },
    });
    expect(codexQuota).toMatchObject({ plan: "plus", unavailableReason: null });
    expect(codexQuota!.windows[0]).toMatchObject({
      label: "Janela de 5 h",
      usedPercent: 42,
      freshness: "fresh",
    });
  });

  it("janela que renovou depois da medida fica marcada; limite atingido já renovado some", () => {
    const quota = buildQuota(inputs(), at("2026-10-28T13:30:00Z"));
    const claude = quota.providers[0]!;
    expect(claude.windows.map((w) => [w.id, w.freshness, w.source.level])).toEqual([
      ["five_hour", "reset", "A"],
      ["seven_day", "stale", "A"],
    ]);
    expect(freshnessOf("2026-10-28T11:00:00Z", null, at("2026-10-28T11:10:00Z"))).toBe("fresh");
    expect(freshnessOf("2026-10-28T11:00:00Z", null, at("2026-10-28T11:16:00Z"))).toBe("stale");
  });

  it("sem leitura: INDISPONÍVEL com motivo, nunca valor inventado", () => {
    const quota = buildQuota(
      inputs({ claudeStatusLine: { enabled: true, snapshot: null }, claudeLimitHit: null, codex: null }),
      FIXTURE_NOW,
    );
    for (const provider of quota.providers) {
      expect(provider.windows).toEqual([]);
      expect(provider.unavailableReason).toBeTruthy();
    }
    expect(quota.providers[0]!.unavailableReason).toContain("abra o Claude Code pela suíte");

    const off = buildQuota(
      inputs({ claudeStatusLine: { enabled: false, snapshot: null }, claudeLimitHit: null }),
      FIXTURE_NOW,
    );
    expect(off.providers[0]!.notes[0]).toContain("DEVTOOLS_CLAUDE_STATUSLINE=off");
  });
});

describe("Quota Monitor no servidor", () => {
  let ctx: TestContext | null = null;
  afterEach(async () => {
    await ctx?.close();
    ctx = null;
  });

  async function freePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = createServer().listen(0, "127.0.0.1", () => {
        const port = (server.address() as { port: number }).port;
        server.close(() => resolve(port));
      });
    });
  }

  it("abre o Claude com a status line da suíte sem tocar nos arquivos do Claude Code", async () => {
    const dataDir = tempDir();
    const roots = makeRoots(dataDir);
    const providers = new ProvidersService();
    ctx = await createTestApp(dataDir, true, { agentSourceRoots: roots, providers });

    const settingsPath = join(dataDir, "quota", "claude-settings.json");
    const command = providers.launchSpec("claude-code").command;
    expect(command).toMatch(/^claude --session-id [0-9a-f-]{36} --settings '.+claude-settings\.json'$/);
    expect(command).toContain(shellQuote(settingsPath));
    expect(providers.launchSpec("codex").command).toBe("codex");

    expect(statSync(settingsPath).mode & 0o777).toBe(0o600);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as { statusLine: { command: string } };
    expect(Object.keys(settings)).toEqual(["statusLine"]);
    expect(settings.statusLine.command).toContain("statusline.ts");
    expect(settings.statusLine.command).toContain(join(dataDir, "quota", "claude-statusline.json"));
    // A raiz do Claude Code continua vazia: nada é criado ou alterado lá.
    expect(readdirSync(roots.claude)).toEqual([]);
  });

  it("DEVTOOLS_CLAUDE_STATUSLINE=off não altera o lançamento", async () => {
    const dataDir = tempDir();
    const providers = new ProvidersService();
    ctx = await createTestApp(dataDir, true, {
      agentSourceRoots: makeRoots(dataDir),
      providers,
      env: { DEVTOOLS_CLAUDE_STATUSLINE: "off" },
    });
    expect(providers.launchSpec("claude-code").command).toMatch(/^claude --session-id [0-9a-f-]{36}$/);
    expect(existsSync(join(dataDir, "quota", "claude-settings.json"))).toBe(false);
    const quota = ctx.quota.current();
    expect(quota.providers[0]!.notes[0]).toContain("desligada");
  });

  it("GET /quota exige sessão e /ws/events avisa quando a status line grava uma leitura", async () => {
    const port = await freePort();
    const host = `127.0.0.1:${port}`;
    const dataDir = tempDir();
    const roots = makeRoots(dataDir);
    installQuotaFixtures(roots, "/home/pessoa/projeto", { codexDay: new Date() });
    ctx = await createTestApp(dataDir, true, { port, agentSourceRoots: roots });
    await ctx.server.listen({ host: "127.0.0.1", port });
    const auth = await login(ctx, host);
    const get = (cookie: string) =>
      ctx!.server.inject({
        method: "GET",
        url: "/api/v1/quota",
        headers: { host, origin: `http://${host}`, cookie },
      });

    expect((await get("")).statusCode).toBe(401);
    const response = await get(auth.cookie);
    expect(response.statusCode).toBe(200);
    const quota = response.json<QuotaResponse>();
    expect(quota.providers.map((p) => p.providerId)).toEqual(["claude-code", "codex"]);
    expect(quota.providers[1]!.windows.map((w) => w.usedPercent)).toEqual([42, 15]);
    expect(response.body).not.toContain(FIXTURE_SECRET);

    const ws = new WebSocket(`ws://${host}/ws/events`, {
      headers: { origin: `http://${host}`, cookie: auth.cookie },
    });
    const received: ServerEvent[] = [];
    ws.on("message", (raw) => received.push(JSON.parse(raw.toString()) as ServerEvent));
    await new Promise((resolve, reject) => ws.once("open", resolve).once("error", reject));

    execFileSync(process.execPath, [SCRIPT, join(dataDir, "quota", "claude-statusline.json")], {
      input: JSON.stringify(statusLineInput()),
    });
    ctx.quota.scan();
    const deadline = Date.now() + 3000;
    while (!received.some((e) => e.type === "quota.updated") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    ws.close();
    const event = received.find((e) => e.type === "quota.updated");
    expect(
      event?.type === "quota.updated" && event.quota.providers[0]!.windows.map((w) => w.usedPercent),
    ).toEqual([23.5, 61]);
  });
});
