import { join } from "node:path";
import type { LocalSourceFiles } from "./local-files.js";

/**
 * Só o fim de cada arquivo é lido: o registro de limite que ainda importa é sempre
 * recente (depois de atingir o limite, a sessão fica bloqueada até a renovação).
 */
const TAIL_BYTES = 1024 * 1024;
/** Janela mais longa conhecida (semanal) + folga: arquivos mais antigos não informam nada atual. */
export const QUOTA_LOOKBACK_MS = 8 * 24 * 60 * 60_000;
const SESSION_FILE = /^[0-9a-f-]{36}\.jsonl$/;
const ROLLOUT_FILE = /^rollout-.+\.jsonl$/;

export interface ObservedWindow {
  /** `five_hour`, `seven_day` ou `window_<min>m`. */
  id: string;
  usedPercent: number | null;
  limitReached: boolean;
  resetsAt: string | null;
}

export interface QuotaObservation {
  /** Horário do registro em que o provedor informou os limites. */
  observedAt: string;
  plan: string | null;
  windows: ObservedWindow[];
}

/**
 * Leituras de limites de uso nos arquivos locais dos provedores (nível B, ADR-0014):
 * - Codex: `token_count.rate_limits` das sessões (`sessions/…/rollout-*.jsonl`);
 * - Claude Code: registros de limite atingido (`quotaLimits`) nas transcrições.
 * Só os campos de limite são lidos; o resto da linha é descartado.
 */
export class QuotaSources {
  /** Resultado por arquivo, refeito só quando tamanho ou data mudam. */
  private readonly cache = new Map<
    string,
    { size: number; mtimeMs: number; value: QuotaObservation | null }
  >();

  constructor(
    private readonly files: LocalSourceFiles,
    private readonly now: () => number = Date.now,
  ) {}

  /** Leitura mais recente registrada pelo Codex. */
  codex(): QuotaObservation | null {
    const root = join(this.files.roots.codex, "sessions");
    const paths: string[] = [];
    for (let daysAgo = 0; daysAgo * 24 * 60 * 60_000 <= QUOTA_LOOKBACK_MS; daysAgo++) {
      const day = new Date(this.now() - daysAgo * 24 * 60 * 60_000);
      const dir = join(
        root,
        String(day.getFullYear()),
        String(day.getMonth() + 1).padStart(2, "0"),
        String(day.getDate()).padStart(2, "0"),
      );
      for (const name of this.files.list(dir)) if (ROLLOUT_FILE.test(name)) paths.push(join(dir, name));
    }
    return this.latest(paths, '"rate_limits"', parseCodexRecord);
  }

  /** Limite atingido mais recente registrado pelo Claude Code, em qualquer projeto. */
  claudeLimitHit(): QuotaObservation | null {
    const root = join(this.files.roots.claude, "projects");
    const paths: string[] = [];
    for (const project of this.files.list(root)) {
      const dir = join(root, project);
      for (const name of this.files.list(dir)) if (SESSION_FILE.test(name)) paths.push(join(dir, name));
    }
    return this.latest(paths, '"quotaLimits"', parseClaudeRecord);
  }

  private latest(
    paths: string[],
    marker: string,
    parse: (record: unknown) => QuotaObservation | null,
  ): QuotaObservation | null {
    const seen = new Set(paths);
    for (const path of this.cache.keys()) if (!seen.has(path)) this.cache.delete(path);
    let best: QuotaObservation | null = null;
    for (const path of paths) {
      const value = this.readFile(path, marker, parse);
      if (value && (!best || value.observedAt > best.observedAt)) best = value;
    }
    return best;
  }

  private readFile(
    path: string,
    marker: string,
    parse: (record: unknown) => QuotaObservation | null,
  ): QuotaObservation | null {
    const stat = this.files.stat(path);
    if (!stat || this.now() - stat.mtimeMs > QUOTA_LOOKBACK_MS) return null;
    const cached = this.cache.get(path);
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.value;

    const start = Math.max(0, stat.size - TAIL_BYTES);
    const lines = this.files
      .read(path, start, stat.size - start)
      .toString("utf8")
      .split("\n");
    if (start > 0) lines.shift(); // primeira linha cortada no meio
    let value: QuotaObservation | null = null;
    for (let i = lines.length - 1; i >= 0 && !value; i--) {
      const line = lines[i]!;
      if (!line.includes(marker)) continue;
      try {
        value = parse(JSON.parse(line));
      } catch {
        // linha incompleta ou corrompida (formato B, sem contrato de estabilidade)
      }
    }
    this.cache.set(path, { size: stat.size, mtimeMs: stat.mtimeMs, value });
    return value;
  }
}

/** `event_msg` do tipo `token_count` com `rate_limits` (Codex 0.165.x). */
export function parseCodexRecord(raw: unknown): QuotaObservation | null {
  const record = asObject(raw);
  const payload = asObject(record?.payload);
  if (record?.type !== "event_msg" || payload?.type !== "token_count") return null;
  const limits = asObject(payload.rate_limits);
  const observedAt = isoOf(record.timestamp);
  if (!limits || !observedAt) return null;
  const windows: ObservedWindow[] = [];
  for (const key of ["primary", "secondary"]) {
    const w = asObject(limits[key]);
    if (!w || typeof w.used_percent !== "number" || !Number.isFinite(w.used_percent)) continue;
    const minutes = typeof w.window_minutes === "number" ? w.window_minutes : null;
    const resetsAt =
      epochIso(w.resets_at) ??
      (typeof w.resets_in_seconds === "number"
        ? new Date(Date.parse(observedAt) + w.resets_in_seconds * 1000).toISOString()
        : null);
    windows.push({
      id: windowId(minutes, key),
      usedPercent: clampPercent(w.used_percent),
      limitReached: w.used_percent >= 100,
      resetsAt,
    });
  }
  // Registros sem janelas (ex.: `limit_id: "premium"` com valores nulos) não informam nada.
  if (windows.length === 0) return null;
  return {
    observedAt,
    plan: typeof limits.plan_type === "string" ? limits.plan_type.slice(0, 40) : null,
    windows,
  };
}

/** Resposta recusada por limite (`quotaLimits.status = "rejected"`, Claude Code 2.1.x). */
export function parseClaudeRecord(raw: unknown): QuotaObservation | null {
  const record = asObject(raw);
  const limits = asObject(record?.quotaLimits);
  const observedAt = isoOf(record?.timestamp);
  if (!limits || !observedAt || limits.status !== "rejected") return null;
  const type = typeof limits.rateLimitType === "string" ? limits.rateLimitType : null;
  if (!type || !/^[a-z0-9_]{1,40}$/.test(type)) return null;
  return {
    observedAt,
    plan: null,
    windows: [{ id: type, usedPercent: null, limitReached: true, resetsAt: epochIso(limits.resetsAt) }],
  };
}

function windowId(minutes: number | null, fallback: string): string {
  if (minutes === 300) return "five_hour";
  if (minutes === 7 * 24 * 60) return "seven_day";
  return minutes ? `window_${minutes}m` : fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isoOf(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

/** Segundos Unix (formato dos dois provedores); milissegundos também são aceitos. */
function epochIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value < 1e12 ? value * 1000 : value).toISOString();
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
