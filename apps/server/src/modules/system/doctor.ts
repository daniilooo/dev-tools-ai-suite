import type { DoctorCheck, DoctorReport, DoctorTool } from "@devtools/shared";
import { existsSync } from "node:fs";
import { permissionsOf } from "../../core/data-dir.js";
import type { DataDirLayout } from "../../core/data-dir.js";
import type { Db } from "../../core/database.js";
import { runProcess } from "../../core/process-runner.js";

const MIN_NODE = [22, 22, 3] as const;

interface ToolSpec {
  id: DoctorTool["id"];
  label: string;
  command: string;
  args: string[];
  optional: boolean;
}

const TOOLS: ToolSpec[] = [
  { id: "git", label: "Git", command: "git", args: ["--version"], optional: false },
  { id: "claude", label: "Claude Code", command: "claude", args: ["--version"], optional: true },
  { id: "codex", label: "Codex CLI", command: "codex", args: ["--version"], optional: true },
  { id: "ollama", label: "Ollama", command: "ollama", args: ["--version"], optional: true },
  { id: "graphify", label: "Graphify", command: "graphify", args: ["--version"], optional: true },
];

/**
 * Diagnóstico da instalação. Detecta ferramentas apenas executando `--version`;
 * nunca lê arquivos de configuração ou credenciais dos provedores (INV-02).
 */
export async function runDoctor(layout: DataDirLayout, db: Db | null): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [nodeCheck(), ...dataDirChecks(layout), databaseCheck(db)];
  const tools = await Promise.all(TOOLS.map(detectTool));
  return { generatedAt: new Date().toISOString(), checks, tools };
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

async function detectTool(spec: ToolSpec): Promise<DoctorTool> {
  const result = await runProcess(spec.command, spec.args, { timeoutMs: 5_000, maxOutputBytes: 4_096 });
  const installed = result.spawnError === null && !result.timedOut && result.exitCode === 0;
  const version = installed ? extractVersion(result.stdout || result.stderr) : null;
  // Estado de autenticação via mecanismos documentados entra na Fase 4: até lá, INDISPONÍVEL (INV-03).
  return { id: spec.id, label: spec.label, installed, version, auth: "unavailable", optional: spec.optional };
}

export function extractVersion(output: string): string | null {
  const match = /\d+\.\d+(\.\d+)?([-.][0-9A-Za-z.]+)?/.exec(output);
  return match ? match[0] : null;
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
