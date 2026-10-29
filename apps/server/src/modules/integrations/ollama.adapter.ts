import type { ProviderCapability, ProviderInfo } from "@devtools/shared";
import type { ProviderAdapter } from "./provider-adapter.js";
import { detectVersion, notInstalled, untestedNote, versionSupport } from "./provider-adapter.js";

const VERSION_CMD = { command: "ollama", args: ["--version"] };
/** API HTTP local documentada; só o endereço padrão em loopback é consultado. */
const LOCAL_API = "http://127.0.0.1:11434/api/version";
const TESTED = ["0.40"];

/** Ollama é opcional (RN-04): só detecção nesta fase; embeddings na Fase 7. */
export const ollamaAdapter: ProviderAdapter = {
  id: "ollama",
  label: "Ollama",
  launchCommand: null,

  async detect(context): Promise<ProviderInfo> {
    const { installed, version } = await detectVersion(VERSION_CMD, context);
    const capabilities: ProviderCapability[] = [
      { id: "local-api", label: "API HTTP local", level: "A" },
      { id: "embeddings", label: "Embeddings locais (opcional)", level: "A", phase: 7 },
    ];
    const base = { id: this.id, label: this.label, testedVersions: "0.40.x", capabilities };
    if (!installed) return notInstalled(base, context);

    const running = await context
      .fetch(LOCAL_API, { signal: AbortSignal.timeout(1_500) })
      .then((response) => response.ok)
      .catch(() => false);

    const support = versionSupport(version, TESTED);
    return {
      ...base,
      installed,
      version,
      versionSupport: support,
      // Ollama local não tem login: autenticação não se aplica.
      auth: {
        state: "unavailable",
        method: null,
        plan: null,
        category: "unavailable",
        source: null,
        fetchedAt: context.now().toISOString(),
        reason: "não se aplica (modelo local)",
      },
      launchable: false,
      notes: [
        running ? "Serviço local respondendo em 127.0.0.1:11434." : "Serviço local parado (`ollama serve`).",
        ...untestedNote({ versionSupport: support, testedVersions: base.testedVersions }),
      ],
    };
  },
};
