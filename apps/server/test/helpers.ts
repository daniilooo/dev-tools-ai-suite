import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

export function tempDir(prefix = "devtools-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export interface TestAppOptions {
  port?: number;
  pty?: AppDeps["pty"];
  terminalOptions?: AppDeps["terminalOptions"];
  providers?: AppDeps["providers"];
  agentSourceRoots?: AppDeps["agentSourceRoots"];
  agentScanIntervalMs?: AppDeps["agentScanIntervalMs"];
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
    publicDir: null,
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
