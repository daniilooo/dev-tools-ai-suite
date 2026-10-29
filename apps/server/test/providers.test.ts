import type { ProvidersResponse } from "@devtools/shared";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClaudeAuthStatus } from "../src/modules/integrations/claude-code.adapter.js";
import { parseCodexLoginStatus } from "../src/modules/integrations/codex.adapter.js";
import type { DetectContext } from "../src/modules/integrations/provider-adapter.js";
import { versionSupport } from "../src/modules/integrations/provider-adapter.js";
import { ProvidersService } from "../src/modules/integrations/providers.service.js";
import { createTestApp, HOST, login, ORIGIN, tempDir } from "./helpers.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const NOW = new Date("2026-10-28T12:00:00.000Z");
const context: DetectContext = { env: {}, now: () => NOW, fetch };

const fixture = (path: string) => readFileSync(join(FIXTURES, path), "utf8");

/**
 * Cria binários falsos que respondem com as fixtures de uma versão e registram cada
 * invocação. Também cria um HOME com arquivos de credencial "isca".
 */
function fakeInstall(options: { claude?: boolean; codex?: boolean; ollama?: boolean } = {}) {
  const root = tempDir("devtools-providers-");
  const bin = join(root, "bin");
  const home = join(root, "home");
  const calls = join(root, "calls.log");
  mkdirSync(bin);
  mkdirSync(join(home, ".claude"), { recursive: true });
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(join(home, ".claude", ".credentials.json"), '{"token":"ISCA-CREDENCIAL-CLAUDE"}');
  writeFileSync(join(home, ".codex", "auth.json"), '{"token":"ISCA-CREDENCIAL-CODEX"}');

  const script = (name: string, cases: string) => {
    const file = join(bin, name);
    writeFileSync(
      file,
      `#!/bin/sh\necho "${name} $*" >> "${calls}"\ncase "$*" in\n${cases}\n  *) echo "uso inválido" >&2; exit 2;;\nesac\n`,
    );
    chmodSync(file, 0o755);
  };
  if (options.claude !== false) {
    script(
      "claude",
      `  "--version") cat "${FIXTURES}/claude-code/2.1.312/version.txt";;\n  "auth status --json") cat "${FIXTURES}/claude-code/2.1.312/auth-status.json";;`,
    );
  }
  if (options.codex !== false) {
    script(
      "codex",
      `  "--version") cat "${FIXTURES}/codex/0.165.0/version.txt";;\n  "login status") cat "${FIXTURES}/codex/0.165.0/login-status.txt";;`,
    );
  }
  if (options.ollama !== false) {
    script("ollama", `  "--version") cat "${FIXTURES}/ollama/0.40.0/version.txt";;`);
  }

  const env = { PATH: `${bin}:/usr/bin:/bin`, HOME: home };
  return { env, calls: () => readFileSync(calls, "utf8").trim().split("\n") };
}

const offlineFetch = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;

describe("contrato: claude auth status --json (2.1.312)", () => {
  it("aproveita só login, método e plano — sem e-mail nem organização", () => {
    const auth = parseClaudeAuthStatus(fixture("claude-code/2.1.312/auth-status.json"), context);
    expect(auth).toEqual({
      state: "authenticated",
      method: "claude.ai",
      plan: "pro",
      category: "official",
      source: "claude auth status --json",
      fetchedAt: NOW.toISOString(),
    });
    expect(JSON.stringify(auth)).not.toMatch(/example\.com|Organization|0000-0000/);
  });

  it("deslogado e saídas inesperadas", () => {
    expect(parseClaudeAuthStatus('{"loggedIn":false,"authMethod":"none"}', context)).toMatchObject({
      state: "unauthenticated",
      method: null,
      category: "official",
    });
    expect(parseClaudeAuthStatus("Error: algo", context)).toMatchObject({
      state: "unavailable",
      category: "unavailable",
      reason: "saída do comando não é JSON",
    });
    expect(parseClaudeAuthStatus('{"status":"ok"}', context)).toMatchObject({
      state: "unavailable",
      reason: "formato de saída desconhecido",
    });
  });
});

describe("contrato: codex login status (0.165.0)", () => {
  it("interpreta login, ausência de login e formato desconhecido", () => {
    expect(parseCodexLoginStatus(fixture("codex/0.165.0/login-status.txt"), context)).toMatchObject({
      state: "authenticated",
      method: "ChatGPT",
      category: "official",
      source: "codex login status",
    });
    expect(parseCodexLoginStatus("Logged in using an API key - sk-***", context)).toMatchObject({
      method: "an API key - sk-***",
    });
    expect(parseCodexLoginStatus("Not logged in\n", context)).toMatchObject({ state: "unauthenticated" });
    expect(parseCodexLoginStatus("???", context)).toMatchObject({ state: "unavailable" });
  });
});

describe("versionSupport", () => {
  it("compara major.minor com as versões testadas", () => {
    expect(versionSupport("2.1.312", ["2.1"])).toBe("tested");
    expect(versionSupport("2.2.0", ["2.1"])).toBe("untested");
    expect(versionSupport(null, ["2.1"])).toBe("unknown");
  });
});

describe("ProvidersService com binários falsos", () => {
  it("detecta versões e login executando apenas comandos oficiais", async () => {
    const install = fakeInstall();
    const service = new ProvidersService({ env: install.env, now: () => NOW, fetch: offlineFetch });
    const { providers } = await service.list();

    const byId = Object.fromEntries(providers.map((p) => [p.id, p]));
    expect(byId["claude-code"]).toMatchObject({
      installed: true,
      version: "2.1.312",
      versionSupport: "tested",
      launchable: true,
      auth: { state: "authenticated", method: "claude.ai", plan: "pro" },
    });
    expect(byId.codex).toMatchObject({
      installed: true,
      version: "0.165.0",
      auth: { state: "authenticated", method: "ChatGPT" },
    });
    expect(byId.ollama).toMatchObject({ installed: true, version: "0.40.0", launchable: false });
    expect(byId.ollama?.notes[0]).toContain("parado");

    // Allowlist de comandos executados; nenhum arquivo de credencial aparece na resposta.
    expect(install.calls().sort()).toEqual(
      [
        "claude --version",
        "claude auth status --json",
        "codex --version",
        "codex login status",
        "ollama --version",
      ].sort(),
    );
    const serialized = JSON.stringify(providers);
    expect(serialized).not.toContain("ISCA-CREDENCIAL");
    expect(serialized).not.toContain("usuario@example.com");
  });

  it("ferramenta ausente aparece como ausente, sem erro", async () => {
    const install = fakeInstall({ claude: false, codex: false, ollama: false });
    const { providers } = await new ProvidersService({ env: install.env, fetch: offlineFetch }).list();
    for (const provider of providers) {
      expect(provider).toMatchObject({
        installed: false,
        version: null,
        launchable: false,
        auth: { state: "unavailable", reason: "ferramenta não instalada" },
      });
    }
  });

  it("falha de um adapter não derruba a listagem e o cache evita reexecuções", async () => {
    let detections = 0;
    const service = new ProvidersService({
      adapters: [
        {
          id: "codex",
          label: "Codex CLI",
          launchCommand: "codex",
          detect: () => {
            detections++;
            return Promise.reject(new Error("quebrou"));
          },
        },
      ],
    });
    const first = await service.list();
    expect(first.providers[0]).toMatchObject({ installed: false, auth: { state: "unavailable" } });
    await service.list();
    expect(detections).toBe(1);
    await service.list(true);
    expect(detections).toBe(2);
  });
});

describe("GET /api/v1/providers", () => {
  it("exige sessão e devolve a detecção", async () => {
    const install = fakeInstall();
    const ctx = await createTestApp(tempDir(), true, {
      providers: new ProvidersService({ env: install.env, fetch: offlineFetch }),
    });
    const anonymous = await ctx.server.inject({
      method: "GET",
      url: "/api/v1/providers",
      headers: { host: HOST, origin: ORIGIN },
    });
    expect(anonymous.statusCode).toBe(401);

    const { cookie } = await login(ctx);
    const response = await ctx.server.inject({
      method: "GET",
      url: "/api/v1/providers",
      headers: { host: HOST, origin: ORIGIN, cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<ProvidersResponse>();
    expect(body.providers.map((p) => p.id)).toEqual(["claude-code", "codex", "ollama"]);

    const doctor = await ctx.server.inject({
      method: "GET",
      url: "/api/v1/doctor",
      headers: { host: HOST, origin: ORIGIN, cookie },
    });
    const claude = doctor
      .json<{ tools: { id: string; auth: unknown }[] }>()
      .tools.find((t) => t.id === "claude");
    expect(claude?.auth).toMatchObject({ state: "authenticated", category: "official" });
    await ctx.close();
  });
});
