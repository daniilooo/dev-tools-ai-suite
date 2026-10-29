import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export const DEFAULT_PORT = 4317;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface AppConfig {
  host: "127.0.0.1";
  port: number;
  dataDir: string;
  logLevel: LogLevel;
  /**
   * Status line da suíte nas sessões do Claude Code abertas por ela (fonte das cotas).
   * `DEVTOOLS_CLAUDE_STATUSLINE=off` desliga.
   */
  claudeStatusLine: boolean;
}

export interface ConfigOverrides {
  port?: number;
  dataDir?: string;
}

/**
 * Lê a configuração do ambiente. O bind é sempre 127.0.0.1 (RN-01); qualquer outro
 * host é recusado — expor na rede exige gate humano HG-12 e mudança de código.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: ConfigOverrides = {}): AppConfig {
  const host = env.DEVTOOLS_HOST ?? "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `DEVTOOLS_HOST=${host} não é permitido: a suíte escuta apenas em 127.0.0.1 (exposição na rede exige aprovação humana).`,
    );
  }

  const port = overrides.port ?? parsePort(env.DEVTOOLS_PORT);
  const dataDir = expandHome(overrides.dataDir ?? env.DEVTOOLS_DATA_DIR ?? "~/.dev-tools-ai-suite");
  const logLevel = parseLogLevel(env.DEVTOOLS_LOG_LEVEL);

  const claudeStatusLine = env.DEVTOOLS_CLAUDE_STATUSLINE !== "off";

  return { host: "127.0.0.1", port, dataDir, logLevel, claudeStatusLine };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`DEVTOOLS_PORT inválida: ${raw} (use um inteiro entre 1024 e 65535).`);
  }
  return port;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const levels: LogLevel[] = ["error", "warn", "info", "debug"];
  return levels.includes(raw as LogLevel) ? (raw as LogLevel) : "info";
}

export function expandHome(path: string): string {
  const expanded = path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}
