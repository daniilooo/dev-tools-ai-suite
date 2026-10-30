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

const VERSION_CMD = { command: "codex", args: ["--version"] };
const AUTH_CMD = { command: "codex", args: ["login", "status"] };
const TESTED = ["0.165"];

const CAPABILITIES: ProviderCapability[] = [
  { id: "terminal", label: "Sessão interativa no terminal", level: "A" },
  { id: "auth-status", label: "Status de login (codex login status)", level: "A" },
  { id: "sessions", label: "Arquivos de sessão locais", level: "B" },
  { id: "usage", label: "Uso e limites (registrados nas sessões locais)", level: "B" },
];

/** Interpreta `codex login status`: "Logged in using <método>" ou "Not logged in". */
export function parseCodexLoginStatus(output: string, context: DetectContext): ProviderAuth {
  const source = commandLabel(AUTH_CMD);
  const fetchedAt = context.now().toISOString();
  const loggedIn = /^Logged in using (.+?)\s*$/m.exec(output);
  if (loggedIn) {
    return {
      state: "authenticated",
      method: loggedIn[1]!,
      plan: null,
      category: "official",
      source,
      fetchedAt,
    };
  }
  if (/not logged in/i.test(output)) {
    return { state: "unauthenticated", method: null, plan: null, category: "official", source, fetchedAt };
  }
  return unavailableAuth(context, "formato de saída desconhecido", source);
}

export const codexAdapter: ProviderAdapter = {
  id: "codex",
  label: "Codex CLI",
  launchCommand: "codex",

  async detect(context): Promise<ProviderInfo> {
    const base = { id: this.id, label: this.label, testedVersions: "0.165.x", capabilities: CAPABILITIES };
    const { installed, version } = await detectVersion(VERSION_CMD, context);
    if (!installed) return notInstalled(base, context);

    const result = await runOfficial(AUTH_CMD, context);
    const output = `${result.stdout}\n${result.stderr}`;
    const auth =
      result.spawnError || result.timedOut
        ? unavailableAuth(
            context,
            result.timedOut ? "comando expirou" : "falha ao executar",
            commandLabel(AUTH_CMD),
          )
        : parseCodexLoginStatus(output, context);

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
