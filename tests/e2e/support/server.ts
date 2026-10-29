import { createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dirname, "../../../apps/server/dist/cli.js");

export interface RunningServer {
  base: string;
  dataDir: string;
  shortCode: string;
  process: ChildProcess;
  stop(): Promise<void>;
  /** Pede um novo código de uso único como o CLI faz (token HMAC descartável). */
  launchToken(): Promise<string>;
  secret(): string;
}

/** Inicia o servidor real compilado (`pnpm build`) em uma porta e diretório de dados isolados. */
export async function startServer(
  port: number,
  dataDir = mkdtempSync(join(tmpdir(), "devtools-e2e-")),
  env: NodeJS.ProcessEnv = process.env,
): Promise<RunningServer> {
  const child = spawn(
    process.execPath,
    [CLI, "start", "--no-open", "--port", String(port), "--data-dir", dataDir],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    },
  );
  let output = "";
  const shortCode = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`servidor não iniciou:\n${output}`)), 15_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = /([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(output);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => reject(new Error(`servidor encerrou (${code}):\n${output}`)));
  });

  const base = `http://127.0.0.1:${port}`;
  const secret = () => readFileSync(join(dataDir, "secret"), "utf8");
  return {
    base,
    dataDir,
    shortCode,
    process: child,
    secret,
    async stop() {
      if (child.exitCode !== null) return;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
    },
    async launchToken() {
      const response = await fetch(`${base}/api/v1/session/launch-code`, {
        method: "POST",
        headers: { authorization: cliAuthorization(secret()) },
      });
      if (!response.ok) throw new Error(`launch-code falhou: ${response.status}`);
      return ((await response.json()) as { token: string }).token;
    },
  };
}

/** Mesmo formato de apps/server/src/core/cli-auth.ts. */
export function cliAuthorization(secretHex: string): string {
  const payload = `${Date.now()}.${randomBytes(16).toString("base64url")}`;
  const signature = createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(`cli:${payload}`)
    .digest("base64url");
  return `DevtoolsCli ${payload}.${signature}`;
}
