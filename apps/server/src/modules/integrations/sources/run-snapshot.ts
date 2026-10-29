import type { AgentRunKind, AgentRunState, AgentTokenUsage } from "@devtools/shared";

/**
 * Fase observada de uma execução, extraída dos registros do provedor:
 * `turn` trabalhando · `idle` turno encerrado, aguardando o usuário ·
 * `done` subagente terminou · `error` último evento foi um erro.
 */
export type ObservedPhase = "none" | "turn" | "idle" | "done" | "error";

/** Resumo de uma sessão/subagente: só metadados, nunca prompts, código ou saídas. */
export interface RunSnapshot {
  externalId: string;
  kind: AgentRunKind;
  parentExternalId: string | null;
  title: string | null;
  agentType: string | null;
  model: string | null;
  providerVersion: string | null;
  cwd: string | null;
  startedAt: string | null;
  lastEventAt: string | null;
  tokens: AgentTokenUsage | null;
  toolCalls: Record<string, number>;
  phase: ObservedPhase;
  error: string | null;
}

export function emptySnapshot(
  externalId: string,
  kind: AgentRunKind,
  parent: string | null = null,
): RunSnapshot {
  return {
    externalId,
    kind,
    parentExternalId: parent,
    title: null,
    agentType: null,
    model: null,
    providerVersion: null,
    cwd: null,
    startedAt: null,
    lastEventAt: null,
    tokens: null,
    toolCalls: {},
    phase: "none",
    error: null,
  };
}

export function touch(snapshot: RunSnapshot, timestamp: unknown): void {
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) return;
  if (!snapshot.startedAt || timestamp < snapshot.startedAt) snapshot.startedAt = timestamp;
  if (!snapshot.lastEventAt || timestamp > snapshot.lastEventAt) snapshot.lastEventAt = timestamp;
}

export function addTokens(snapshot: RunSnapshot, usage: Partial<AgentTokenUsage>): void {
  const current = snapshot.tokens ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  snapshot.tokens = {
    input: current.input + (usage.input ?? 0),
    output: current.output + (usage.output ?? 0),
    cacheRead: current.cacheRead + (usage.cacheRead ?? 0),
    cacheWrite: current.cacheWrite + (usage.cacheWrite ?? 0),
  };
}

/** Limites de frescor (STATE_MACHINES): sem eventos além disso, o estado vira `unknown`. */
export const FRESHNESS = {
  /** Turno em andamento sem nenhum registro novo. */
  turnMs: 5 * 60_000,
  /** Sessão aguardando o usuário: depois disso pode ter sido fechada (não há evento de fim). */
  idleMs: 30 * 60_000,
};

export function deriveState(snapshot: RunSnapshot, now: number): AgentRunState {
  const last = snapshot.lastEventAt ? Date.parse(snapshot.lastEventAt) : null;
  const age = last === null ? Infinity : now - last;
  switch (snapshot.phase) {
    case "none":
      // Sessão aberta sem turnos: depois do limite, pode ter sido fechada sem evento de fim.
      return age <= FRESHNESS.idleMs ? "detected" : "unknown";
    case "done":
      return "completed";
    case "error":
      return "failed";
    case "turn":
      return age <= FRESHNESS.turnMs ? "running" : "unknown";
    case "idle":
      return age <= FRESHNESS.idleMs ? "waiting" : "unknown";
  }
}

export function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
