import { chmodSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { expect } from "vitest";
import { buildApp } from "../src/app.js";
import type { App, AppDeps } from "../src/app.js";
import { loadConfig } from "../src/core/config.js";
import { ensureDataDir } from "../src/core/data-dir.js";
import type { DataDirLayout } from "../src/core/data-dir.js";
import { openDatabase } from "../src/core/database.js";
import type { Db } from "../src/core/database.js";
import { InstallSecret } from "../src/core/secret.js";

export const PORT = 4317;
export const HOST = `127.0.0.1:${PORT}`;
export const ORIGIN = `http://${HOST}`;

export interface TestContext extends App {
  dataDir: string;
  layout: DataDirLayout;
  secret: InstallSecret;
  db: Db;
  logs: string[];
  close(): Promise<void>;
}

export const IS_WINDOWS = process.platform === "win32";

/** Permissões POSIX; no Windows não há bits de modo (vale a ACL do perfil — ADR-0015). */
export function expectMode(path: string, mode: number): void {
  if (!IS_WINDOWS) expect(statSync(path).mode & 0o777).toBe(mode);
}

/**
 * Executável falso multiplataforma: `source` é um módulo Node (ESM) que recebe os argumentos
 * em `process.argv.slice(2)`. Chamado por um shim `sh` ou `.cmd` (formato dos shims do npm).
 */
export function writeFakeBin(dir: string, name: string, source: string): void {
  const script = join(dir, `${name}.fake.mjs`);
  writeFileSync(script, source);
  if (IS_WINDOWS) {
    writeFileSync(join(dir, `${name}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
  } else {
    writeFileSync(join(dir, name), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
    chmodSync(join(dir, name), 0o755);
  }
}

/** PATH mínimo: os falsos primeiro e só o sistema (no Windows, o System32 e o git do runner). */
export function fakePath(bin: string): string {
  return IS_WINDOWS
    ? [bin, process.env.Path ?? process.env.PATH ?? ""].join(delimiter)
    : `${bin}:/usr/bin:/bin`;
}

/** Shell dos testes de terminal: bash sem rc no Linux, PowerShell sem perfil no Windows. */
export const TEST_SHELL = IS_WINDOWS
  ? { file: "powershell.exe", args: ["-NoLogo", "-NoProfile"] }
  : { file: "/bin/bash", args: ["--norc", "--noprofile"] };

export function tempDir(prefix = "devtools-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  // No Windows o TEMP do runner vem em nome curto (RUNNER~1); a suíte guarda o nome longo.
  return IS_WINDOWS ? realpathSync.native(dir) : dir;
}

export interface TestAppOptions {
  port?: number;
  pty?: AppDeps["pty"];
  terminalOptions?: AppDeps["terminalOptions"];
  providers?: AppDeps["providers"];
  agentSourceRoots?: AppDeps["agentSourceRoots"];
  agentScanIntervalMs?: AppDeps["agentScanIntervalMs"];
  /** Embeddings e grafo falsos; por padrão nenhum (testes não tocam o Ollama nem o Graphify reais). */
  embeddings?: AppDeps["embeddings"];
  graphExtractor?: AppDeps["graphExtractor"];
  /** Pasta do dashboard; por padrão nenhuma. */
  publicDir?: string;
  /** Variáveis lidas pela configuração (ex.: DEVTOOLS_CLAUDE_STATUSLINE). */
  env?: NodeJS.ProcessEnv;
}

export async function createTestApp(
  dataDir = tempDir(),
  cleanup = true,
  options: TestAppOptions = {},
): Promise<TestContext> {
  const config = loadConfig(options.env ?? {}, { port: options.port ?? PORT, dataDir });
  const layout = ensureDataDir(config.dataDir);
  const secret = InstallSecret.loadOrCreate(layout.secretFile);
  const db = openDatabase(layout.database);
  const logs: string[] = [];
  const app = await buildApp({
    config: { ...config, logLevel: "debug" },
    layout,
    secret,
    db,
    publicDir: options.publicDir ?? null,
    logStream: { write: (chunk: string) => logs.push(chunk) },
    pty: options.pty,
    terminalOptions: options.terminalOptions,
    providers: options.providers,
    // Testes não varrem o ~/.claude real: raízes vazias por padrão.
    agentSourceRoots: options.agentSourceRoots ?? {
      claude: join(dataDir, "no-claude"),
      codex: join(dataDir, "no-codex"),
    },
    agentScanIntervalMs: options.agentScanIntervalMs ?? 0,
    quotaScanIntervalMs: 0,
    embeddings: options.embeddings ?? [],
    graphExtractor: options.graphExtractor ?? {
      check: async () => "Graphify não instalado (teste).",
      extract: async () => {
        throw new Error("Graphify não instalado (teste).");
      },
    },
  });
  await app.server.ready();
  return {
    ...app,
    dataDir,
    layout,
    secret,
    db,
    logs,
    async close() {
      await app.server.close();
      db.close();
      if (cleanup) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Autentica via código de uso único e devolve cookie + token anti-CSRF. */
export async function login(ctx: TestContext, host = HOST): Promise<{ cookie: string; csrf: string }> {
  const code = ctx.codes.issue();
  const response = await ctx.server.inject({
    method: "POST",
    url: "/api/v1/session/exchange",
    headers: { host, origin: `http://${host}` },
    payload: { code: code.token },
  });
  if (response.statusCode !== 200) throw new Error(`login falhou: ${response.statusCode}`);
  const cookie = String(response.headers["set-cookie"]).split(";")[0]!;
  return { cookie, csrf: response.json<{ csrfToken: string }>().csrfToken };
}
