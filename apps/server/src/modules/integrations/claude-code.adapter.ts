import type { ProviderAuth, ProviderCapability, ProviderInfo } from "@devtools/shared";
import type { DetectContext, ProviderAdapter } from "./provider-adapter.js";
import {
  commandLabel,
  detectVersion,
  notInstalled,
  runOfficial,
  unavailableAuth,
  untestedNote,
  versionSupport,
} from "./provider-adapter.js";

const VERSION_CMD = { command: "claude", args: ["--version"] };
const AUTH_CMD = { command: "claude", args: ["auth", "status", "--json"] };
const TESTED = ["2.1"];

const CAPABILITIES: ProviderCapability[] = [
  { id: "terminal", label: "Sessão interativa no terminal", level: "A" },
  { id: "auth-status", label: "Status de login (claude auth status)", level: "A" },
  { id: "hooks", label: "Hooks oficiais (eventos de agentes)", level: "A", phase: 5 },
  { id: "transcripts", label: "Transcrições locais (.jsonl)", level: "B" },
  { id: "usage", label: "Uso e limites (status line da suíte nas sessões abertas por ela)", level: "A" },
];

/**
 * Campos aproveitados de `claude auth status --json`. E-mail, organização e
 * diretórios ficam de fora: não são necessários e são dados pessoais.
 */
export function parseClaudeAuthStatus(output: string, context: DetectContext): ProviderAuth {
  const source = commandLabel(AUTH_CMD);
  let data: unknown;
  try {
    data = JSON.parse(output);
  } catch {
    return unavailableAuth(context, "saída do comando não é JSON", source);
  }
  const record = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (typeof record.loggedIn !== "boolean") {
    return unavailableAuth(context, "formato de saída desconhecido", source);
  }
  return {
    state: record.loggedIn ? "authenticated" : "unauthenticated",
    method: record.loggedIn && typeof record.authMethod === "string" ? record.authMethod : null,
    plan: record.loggedIn && typeof record.subscriptionType === "string" ? record.subscriptionType : null,
    category: "official",
    source,
    fetchedAt: context.now().toISOString(),
  };
}

export const claudeCodeAdapter: ProviderAdapter = {
  id: "claude-code",
  label: "Claude Code",
  launchCommand: "claude",
  sessionIdFlag: "--session-id",

  async detect(context): Promise<ProviderInfo> {
    const base = { id: this.id, label: this.label, testedVersions: "2.1.x", capabilities: CAPABILITIES };
    const { installed, version } = await detectVersion(VERSION_CMD, context);
    if (!installed) return notInstalled(base, context);

    const result = await runOfficial(AUTH_CMD, context);
    // Deslogado, o comando pode sair com código ≠ 0 e ainda imprimir o JSON.
    const auth =
      result.spawnError || result.timedOut || !result.stdout.trim()
        ? unavailableAuth(
            context,
            result.timedOut ? "comando expirou" : "comando sem saída",
            commandLabel(AUTH_CMD),
          )
        : parseClaudeAuthStatus(result.stdout, context);

    const support = versionSupport(version, TESTED);
    return {
      ...base,
      installed,
      version,
      versionSupport: support,
      auth,
      launchable: true,
      notes: untestedNote({ versionSupport: support, testedVersions: base.testedVersions }),
    };
  },
};
