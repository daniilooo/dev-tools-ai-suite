import type { LaunchableProviderId, ProviderId, ProviderInfo, ProvidersResponse } from "@devtools/shared";
import { badRequest } from "../../core/errors.js";
import { claudeCodeAdapter } from "./claude-code.adapter.js";
import { codexAdapter } from "./codex.adapter.js";
import { ollamaAdapter } from "./ollama.adapter.js";
import type { DetectContext, ProviderAdapter } from "./provider-adapter.js";
import { unavailableAuth } from "./provider-adapter.js";

export const DEFAULT_ADAPTERS: ProviderAdapter[] = [claudeCodeAdapter, codexAdapter, ollamaAdapter];
const CACHE_TTL_MS = 60_000;

export interface ProvidersServiceOptions {
  adapters?: ProviderAdapter[];
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  fetch?: typeof fetch;
}

/**
 * Detecta os provedores com cache curto (os comandos oficiais levam centenas de ms).
 * Detecções concorrentes compartilham a mesma execução.
 */
export class ProvidersService {
  private readonly adapters: ProviderAdapter[];
  private readonly context: DetectContext;
  private cache: { at: number; value: ProvidersResponse } | null = null;
  private inFlight: Promise<ProvidersResponse> | null = null;

  constructor(options: ProvidersServiceOptions = {}) {
    this.adapters = options.adapters ?? DEFAULT_ADAPTERS;
    this.context = {
      env: options.env ?? process.env,
      now: options.now ?? (() => new Date()),
      fetch: options.fetch ?? fetch,
    };
  }

  async list(refresh = false): Promise<ProvidersResponse> {
    const now = this.context.now().getTime();
    if (!refresh && this.cache && now - this.cache.at < CACHE_TTL_MS) return this.cache.value;
    this.inFlight ??= this.detectAll().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  /** Comando a digitar no shell para iniciar o provedor. Só provedores conhecidos e lançáveis. */
  launchCommand(id: string): string {
    const adapter = this.adapters.find((a) => a.id === id);
    if (!adapter?.launchCommand) throw badRequest("Provedor inválido para iniciar no terminal.", { id });
    return adapter.launchCommand;
  }

  isLaunchable(id: string): id is LaunchableProviderId {
    return !!this.adapters.find((a) => a.id === id)?.launchCommand;
  }

  private async detectAll(): Promise<ProvidersResponse> {
    const providers = await Promise.all(this.adapters.map((adapter) => this.detectSafely(adapter)));
    const value: ProvidersResponse = { generatedAt: this.context.now().toISOString(), providers };
    this.cache = { at: this.context.now().getTime(), value };
    return value;
  }

  /** Falha de um adapter nunca derruba a listagem (INTEGRATIONS). */
  private async detectSafely(adapter: ProviderAdapter): Promise<ProviderInfo> {
    try {
      return await adapter.detect(this.context);
    } catch (error) {
      return {
        id: adapter.id as ProviderId,
        label: adapter.label,
        installed: false,
        version: null,
        versionSupport: "unknown",
        testedVersions: "—",
        auth: unavailableAuth(this.context, `falha na detecção: ${(error as Error).message}`),
        capabilities: [],
        launchable: false,
        notes: ["Detecção falhou; tente atualizar."],
      };
    }
  }
}
