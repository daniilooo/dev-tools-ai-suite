import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DataDirLayout } from "../../core/data-dir.js";
import type { StatusLineSnapshot } from "../../statusline.js";

const SNAPSHOT_MAX_BYTES = 64 * 1024;

export interface ClaudeStatusLine {
  /** Arquivo de configuração passado com `--settings` ao abrir o Claude pela suíte. */
  settingsPath: string;
  /** Onde a status line grava os limites informados pelo Claude Code. */
  snapshotPath: string;
  /** Argumentos acrescentados ao comando `claude`, já escapados para o shell. */
  launchArgs: string;
}

/**
 * Prepara a status line da suíte para as sessões do Claude Code abertas por ela (ADR-0014):
 * grava em `<dados>/quota/` um arquivo de configuração só com `statusLine`, carregado via
 * `claude --settings`. Nenhum arquivo do Claude Code é criado ou alterado.
 */
export function prepareClaudeStatusLine(
  layout: DataDirLayout,
  nodePath: string = process.execPath,
): ClaudeStatusLine | null {
  const script = statusLineScript();
  if (!script) return null;
  const dir = join(layout.root, "quota");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const snapshotPath = join(dir, "claude-statusline.json");
  const settingsPath = join(dir, "claude-settings.json");
  const settings = {
    statusLine: {
      type: "command",
      command: [nodePath, script, snapshotPath].map(shellQuote).join(" "),
      padding: 0,
    },
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
  return { settingsPath, snapshotPath, launchArgs: `--settings ${shellQuote(settingsPath)}` };
}

/** Script compilado (`dist/statusline.js`) ou, em desenvolvimento, o fonte executado pelo Node. */
function statusLineScript(): string | null {
  for (const name of ["statusline.js", "statusline.ts"]) {
    const path = fileURLToPath(new URL(`../../${name}`, import.meta.url));
    if (existsSync(path)) return path;
  }
  return null;
}

/** Última leitura gravada pela status line; formato inválido é ignorado. */
export function readClaudeStatusLine(path: string): StatusLineSnapshot | null {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > SNAPSHOT_MAX_BYTES) return null;
    const data = JSON.parse(readFileSync(path, "utf8")) as Partial<StatusLineSnapshot>;
    if (typeof data.observedAt !== "string" || Number.isNaN(Date.parse(data.observedAt))) return null;
    if (typeof data.rateLimits !== "object" || data.rateLimits === null) return null;
    const rateLimits: StatusLineSnapshot["rateLimits"] = {};
    for (const [key, w] of Object.entries(data.rateLimits)) {
      if (!/^[a-z0-9_]{1,40}$/.test(key) || typeof w?.usedPercent !== "number") continue;
      rateLimits[key] = {
        usedPercent: Math.min(100, Math.max(0, w.usedPercent)),
        resetsAt: typeof w.resetsAt === "string" && !Number.isNaN(Date.parse(w.resetsAt)) ? w.resetsAt : null,
      };
    }
    return { observedAt: data.observedAt, version: data.version ?? null, rateLimits };
  } catch {
    return null;
  }
}

/** Aspas simples POSIX: o caminho é digitado no shell do terminal. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
