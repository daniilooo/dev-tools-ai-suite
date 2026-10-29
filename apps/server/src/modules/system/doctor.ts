import type { DoctorCheck, DoctorReport, DoctorTool, ProviderInfo } from "@devtools/shared";
import { existsSync } from "node:fs";
import { permissionsOf } from "../../core/data-dir.js";
import type { DataDirLayout } from "../../core/data-dir.js";
import type { Db } from "../../core/database.js";
import { runProcess } from "../../core/process-runner.js";
import { extractVersion } from "../integrations/provider-adapter.js";

const MIN_NODE = [22, 22, 3] as const;

interface ToolSpec {
  id: DoctorTool["id"];
  label: string;
  command: string;
  args: string[];
  optional: boolean;
}

/** Ferramentas que não são provedores de IA. Os provedores vêm do módulo `providers`. */
const TOOLS: ToolSpec[] = [
  { id: "git", label: "Git", command: "git", args: ["--version"], optional: false },
  { id: "graphify", label: "Graphify", command: "graphify", args: ["--version"], optional: true },
];

const PROVIDER_TOOL_IDS: Record<ProviderInfo["id"], DoctorTool["id"]> = {
  "claude-code": "claude",
  codex: "codex",
  ollama: "ollama",
};

/**
 * Diagnóstico da instalação. Detecta ferramentas apenas executando `--version`;
 * nunca lê arquivos de configuração ou credenciais dos provedores (INV-02).
 */
export interface PtyStatus {
  backend: string | null;
  error: string | null;
}

export async function runDoctor(
  layout: DataDirLayout,
  db: Db | null,
  pty: PtyStatus,
  providers: ProviderInfo[],
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [nodeCheck(), ...dataDirChecks(layout), databaseCheck(db), ptyCheck(pty)];
  const [git, graphify] = await Promise.all(TOOLS.map(detectTool));
  const tools = [git!, ...providers.map(providerTool), graphify!];
  return { generatedAt: new Date().toISOString(), checks, tools };
}

function providerTool(provider: ProviderInfo): DoctorTool {
  return {
    id: PROVIDER_TOOL_IDS[provider.id],
    label: provider.label,
    installed: provider.installed,
    version: provider.version,
    auth: provider.installed && provider.launchable ? provider.auth : null,
    optional: true,
  };
}

function nodeCheck(): DoctorCheck {
  const current = process.versions.node.split(".").map(Number);
  const ok = compareVersions(current, MIN_NODE) >= 0;
  return {
    id: "node",
    label: "Node.js",
    status: ok ? "ok" : "error",
    detail: `v${process.versions.node}`,
    hint: ok ? undefined : `Atualize para Node.js ${MIN_NODE.join(".")} ou superior.`,
  };
}

function dataDirChecks(layout: DataDirLayout): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const posix = process.platform !== "win32";
  const dirMode = existsSync(layout.root) ? permissionsOf(layout.root) : null;
  checks.push({
    id: "data-dir",
    label: "Diretório de dados",
    status: dirMode === null ? "error" : posix && (dirMode & 0o077) !== 0 ? "warning" : "ok",
    detail: dirMode === null ? `${layout.root} não existe` : `${layout.root} (${modeString(dirMode)})`,
    hint:
      posix && dirMode !== null && (dirMode & 0o077) !== 0 ? `Execute: chmod 700 ${layout.root}` : undefined,
  });
  const secretMode = existsSync(layout.secretFile) ? permissionsOf(layout.secretFile) : null;
  checks.push({
    id: "secret",
    label: "Segredo de instalação",
    status: secretMode === null ? "error" : posix && secretMode !== 0o600 ? "warning" : "ok",
    detail: secretMode === null ? "ausente" : `presente (${modeString(secretMode)})`,
    hint: secretMode === null ? "Execute `devtools start` para gerar." : undefined,
  });
  return checks;
}

function databaseCheck(db: Db | null): DoctorCheck {
  if (!db) return { id: "database", label: "Banco SQLite", status: "error", detail: "não inicializado" };
  try {
    const { v } = db.prepare("SELECT sqlite_version() AS v").get() as { v: string };
    const { m } = db.prepare("SELECT MAX(version) AS m FROM schema_migrations").get() as { m: number };
    return { id: "database", label: "Banco SQLite", status: "ok", detail: `SQLite ${v}, migração ${m}` };
  } catch (error) {
    return { id: "database", label: "Banco SQLite", status: "error", detail: (error as Error).message };
  }
}

function ptyCheck(pty: PtyStatus): DoctorCheck {
  if (pty.backend) {
    return { id: "pty", label: "Terminal (PTY)", status: "ok", detail: `backend ${pty.backend}` };
  }
  return {
    id: "pty",
    label: "Terminal (PTY)",
    status: "error",
    detail: pty.error ?? "biblioteca de PTY não carregou",
    hint: "Reinstale a suíte. Se persistir, instale build-essential e python3 e rode `npm install -g node-pty`.",
  };
}

async function detectTool(spec: ToolSpec): Promise<DoctorTool> {
  const result = await runProcess(spec.command, spec.args, { timeoutMs: 5_000, maxOutputBytes: 4_096 });
  const installed = result.spawnError === null && !result.timedOut && result.exitCode === 0;
  const version = installed ? extractVersion(result.stdout || result.stderr) : null;
  return { id: spec.id, label: spec.label, installed, version, auth: null, optional: spec.optional };
}

function compareVersions(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function modeString(mode: number): string {
  return `0${mode.toString(8)}`;
}
