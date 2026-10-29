import type {
  ProviderQuota,
  QuotaFreshness,
  QuotaResponse,
  QuotaWindow,
  ServerEvent,
  SupportLevel,
} from "@devtools/shared";
import type { QuotaObservation, QuotaSources } from "../integrations/sources/quota-sources.js";
import { QUOTA_LOOKBACK_MS } from "../integrations/sources/quota-sources.js";
import type { StatusLineSnapshot } from "../../statusline.js";

/** Medida mais antiga que isso: o uso pode ter mudado desde então. */
export const QUOTA_STALE_MS = 15 * 60_000;

const WINDOW_LABEL: Record<string, string> = {
  five_hour: "Janela de 5 h",
  seven_day: "Semanal (7 dias)",
  seven_day_opus: "Semanal — Opus",
  seven_day_sonnet: "Semanal — Sonnet",
};
const WINDOW_ORDER = ["five_hour", "seven_day"];

const SOURCES = {
  claudeStatusLine: { level: "A", description: "status line do Claude Code nas sessões abertas pela suíte" },
  claudeTranscript: { level: "B", description: "transcrições locais do Claude Code (limite atingido)" },
  codex: { level: "B", description: "sessões locais do Codex (limites informados pelo serviço)" },
} satisfies Record<string, { level: SupportLevel; description: string }>;

export interface QuotaInputs {
  claudeStatusLine: { enabled: boolean; snapshot: StatusLineSnapshot | null };
  claudeLimitHit: QuotaObservation | null;
  codex: QuotaObservation | null;
}

/**
 * Monta a resposta de cotas a partir das leituras observadas (RN-03, INV-03): todo valor
 * leva fonte, horário, categoria e frescor; sem leitura, `INDISPONÍVEL` com motivo.
 */
export function buildQuota(inputs: QuotaInputs, now: number): QuotaResponse {
  const claudeWindows: QuotaWindow[] = [];
  const snapshot = inputs.claudeStatusLine.snapshot;
  if (snapshot) {
    for (const [id, w] of Object.entries(snapshot.rateLimits)) {
      claudeWindows.push(
        toWindow(
          { id, usedPercent: w.usedPercent, limitReached: w.usedPercent >= 100, resetsAt: w.resetsAt },
          snapshot.observedAt,
          SOURCES.claudeStatusLine,
          now,
        ),
      );
    }
  }
  for (const w of inputs.claudeLimitHit?.windows ?? []) {
    const hit = toWindow(w, inputs.claudeLimitHit!.observedAt, SOURCES.claudeTranscript, now);
    // Limite atingido que já renovou não diz mais nada.
    if (hit.freshness === "reset") continue;
    const index = claudeWindows.findIndex((c) => c.id === hit.id);
    if (index === -1) claudeWindows.push(hit);
    else if (hit.observedAt > claudeWindows[index]!.observedAt) claudeWindows[index] = hit;
  }

  const claudeNotes = inputs.claudeStatusLine.enabled
    ? [
        "O percentual vem da status line das sessões do Claude Code abertas pela suíte. Sessões abertas fora dela só aparecem aqui quando o limite é atingido.",
      ]
    : [
        "Status line da suíte desligada (DEVTOOLS_CLAUDE_STATUSLINE=off): só aparece o limite atingido registrado nas transcrições.",
      ];

  const providers: ProviderQuota[] = [
    finish({
      providerId: "claude-code",
      label: "Claude Code",
      plan: null,
      windows: claudeWindows.filter((w) => now - Date.parse(w.observedAt) <= QUOTA_LOOKBACK_MS),
      notes: claudeNotes,
      emptyReason: inputs.claudeStatusLine.enabled
        ? "Nenhuma leitura ainda: abra o Claude Code pela suíte e envie uma mensagem. Os limites só são informados em planos de assinatura (Pro/Max); login por chave de API não tem essas janelas."
        : "Nenhum limite atingido registrado nas transcrições dos últimos 8 dias.",
    }),
    finish({
      providerId: "codex",
      label: "Codex CLI",
      plan: inputs.codex?.plan ?? null,
      windows: (inputs.codex?.windows ?? []).map((w) =>
        toWindow(w, inputs.codex!.observedAt, SOURCES.codex, now),
      ),
      notes: ["O Codex registra os limites nas sessões locais a cada resposta do serviço."],
      emptyReason: "Nenhuma sessão do Codex com limites registrados nos últimos 8 dias.",
    }),
  ];
  return { generatedAt: new Date(now).toISOString(), providers };
}

function toWindow(
  w: { id: string; usedPercent: number | null; limitReached: boolean; resetsAt: string | null },
  observedAt: string,
  source: { level: SupportLevel; description: string },
  now: number,
): QuotaWindow {
  return {
    id: w.id,
    label: WINDOW_LABEL[w.id] ?? labelFor(w.id),
    usedPercent: w.usedPercent,
    limitReached: w.limitReached,
    resetsAt: w.resetsAt,
    freshness: freshnessOf(observedAt, w.resetsAt, now),
    category: "official",
    observedAt,
    source,
  };
}

export function freshnessOf(observedAt: string, resetsAt: string | null, now: number): QuotaFreshness {
  if (resetsAt && Date.parse(resetsAt) <= now) return "reset";
  return now - Date.parse(observedAt) > QUOTA_STALE_MS ? "stale" : "fresh";
}

function labelFor(id: string): string {
  const minutes = /^window_(\d+)m$/.exec(id)?.[1];
  if (minutes) {
    const m = Number(minutes);
    return m % 1440 === 0
      ? `Janela de ${m / 1440} d`
      : m % 60 === 0
        ? `Janela de ${m / 60} h`
        : `Janela de ${m} min`;
  }
  return id.replace(/_/g, " ");
}

function finish(p: Omit<ProviderQuota, "unavailableReason"> & { emptyReason: string }): ProviderQuota {
  const { emptyReason, ...rest } = p;
  const order = (id: string) => (WINDOW_ORDER.includes(id) ? WINDOW_ORDER.indexOf(id) : WINDOW_ORDER.length);
  rest.windows.sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));
  return { ...rest, unavailableReason: rest.windows.length === 0 ? emptyReason : null };
}

export interface QuotaMonitorOptions {
  sources: QuotaSources;
  /** Status line da suíte (null = desligada). */
  statusLine: { read(): StatusLineSnapshot | null } | null;
  intervalMs: number;
  now?: () => number;
  onError?: (error: unknown) => void;
}

/** Relê as fontes periodicamente e avisa `/ws/events` quando algo muda (inclusive o frescor). */
export class QuotaMonitor {
  private readonly listeners = new Set<(event: ServerEvent) => void>();
  private last: { fingerprint: string; value: QuotaResponse } | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: QuotaMonitorOptions) {}

  start(): void {
    this.scan();
    this.timer = setInterval(() => this.scan(), this.options.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Estado atual, recalculado na hora (o frescor depende do relógio). */
  current(): QuotaResponse {
    return this.scan();
  }

  scan(): QuotaResponse {
    const now = (this.options.now ?? Date.now)();
    // Falha de uma fonte vira ausência de leitura dela (INDISPONÍVEL), nunca erro na tela.
    const safe = <T>(read: () => T | null): T | null => {
      try {
        return read();
      } catch (error) {
        this.options.onError?.(error);
        return null;
      }
    };
    const value = buildQuota(
      {
        claudeStatusLine: {
          enabled: this.options.statusLine !== null,
          snapshot: safe(() => this.options.statusLine?.read() ?? null),
        },
        claudeLimitHit: safe(() => this.options.sources.claudeLimitHit()),
        codex: safe(() => this.options.sources.codex()),
      },
      now,
    );
    const fingerprint = JSON.stringify(value.providers);
    if (this.last?.fingerprint !== fingerprint) {
      this.last = { fingerprint, value };
      for (const listener of this.listeners) listener({ type: "quota.updated", quota: value });
    }
    return value;
  }
}
