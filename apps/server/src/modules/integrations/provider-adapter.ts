import type { ProviderAuth, ProviderCapability, ProviderId, ProviderInfo } from "@devtools/shared";
import { homedir } from "node:os";
import { runProcess } from "../../core/process-runner.js";
import type { RunResult } from "../../core/process-runner.js";

/**
 * Porta de integração com um provedor de IA (ADR-0001, INTEGRATIONS).
 * Regras: só executa comandos oficiais documentados; nunca lê arquivos do provedor
 * (o módulo é proibido de importar `node:fs` pelo ESLint — INV-02); falha vira
 * `unavailable` com motivo, nunca exceção.
 */
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly label: string;
  /** Comando digitado no shell para iniciar o provedor interativo; null = não lançável. */
  readonly launchCommand: string | null;
  /** Flag oficial para fixar o id da sessão ao lançar (liga o terminal à transcrição). */
  readonly sessionIdFlag?: string;
  detect(context: DetectContext): Promise<ProviderInfo>;
}

export interface DetectContext {
  env: NodeJS.ProcessEnv;
  now: () => Date;
  /** Para provedores com API HTTP local documentada (Ollama). */
  fetch: typeof fetch;
}

export interface CommandSpec {
  command: string;
  args: string[];
}

/** Executa um comando oficial do provedor fora de qualquer projeto (cwd = home). */
export function runOfficial(
  spec: CommandSpec,
  context: DetectContext,
  timeoutMs = 5_000,
): Promise<RunResult> {
  return runProcess(spec.command, spec.args, {
    cwd: homedir(),
    env: context.env,
    timeoutMs,
    maxOutputBytes: 16 * 1024,
  });
}

export function commandLabel(spec: CommandSpec): string {
  return [spec.command, ...spec.args].join(" ");
}

export async function detectVersion(
  spec: CommandSpec,
  context: DetectContext,
): Promise<{ installed: boolean; version: string | null }> {
  const result = await runOfficial(spec, context);
  const installed = result.spawnError === null && !result.timedOut && result.exitCode === 0;
  return { installed, version: installed ? extractVersion(result.stdout || result.stderr) : null };
}

/** Versões cobertas por testes de contrato: compara major.minor. */
export function versionSupport(
  version: string | null,
  testedMajorMinor: string[],
): ProviderInfo["versionSupport"] {
  if (!version) return "unknown";
  const majorMinor = version.split(".").slice(0, 2).join(".");
  return testedMajorMinor.includes(majorMinor) ? "tested" : "untested";
}

export function unavailableAuth(
  context: DetectContext,
  reason: string,
  source: string | null = null,
): ProviderAuth {
  return {
    state: "unavailable",
    method: null,
    plan: null,
    category: "unavailable",
    source,
    fetchedAt: context.now().toISOString(),
    reason,
  };
}

export function notInstalled(
  base: Pick<ProviderInfo, "id" | "label" | "testedVersions" | "capabilities">,
  context: DetectContext,
): ProviderInfo {
  return {
    ...base,
    installed: false,
    version: null,
    versionSupport: "unknown",
    auth: unavailableAuth(context, "ferramenta não instalada"),
    launchable: false,
    notes: [],
  };
}

export function untestedNote(info: Pick<ProviderInfo, "versionSupport" | "testedVersions">): string[] {
  return info.versionSupport === "untested"
    ? [
        `Versão não coberta pelos testes de contrato (testadas: ${info.testedVersions}). Funções podem degradar.`,
      ]
    : [];
}

export function extractVersion(output: string): string | null {
  const match = /\d+\.\d+(\.\d+)?([-.][0-9A-Za-z.]+)?/.exec(output);
  return match ? match[0] : null;
}

export type { ProviderCapability };
