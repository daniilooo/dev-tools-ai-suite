import type { AgentRun, AgentRunState, AgentTokenUsage, LaunchableProviderId } from "@devtools/shared";

export const STATE_LABEL: Record<AgentRunState, string> = {
  detected: "detectado",
  running: "executando",
  waiting: "aguardando você",
  completed: "concluído",
  failed: "falhou",
  unknown: "desconhecido",
};

/** Explicação de cada estado: o que foi observado para chegar nele (INV-03). */
export const STATE_HINT: Record<AgentRunState, string> = {
  detected: "Sessão aberta há menos de 30 min, ainda sem turnos de trabalho.",
  running: "Houve atividade do agente nos últimos 5 minutos.",
  waiting: "O turno terminou e o agente aguarda uma mensagem sua (sessão sem eventos há menos de 30 min).",
  completed: "O subagente terminou o trabalho.",
  failed: "O último evento registrado foi um erro.",
  unknown: "Sem eventos recentes: a sessão pode ter sido fechada ou estar parada. A suíte não presume.",
};

export const STATE_DOT: Record<AgentRunState, string> = {
  detected: "bg-muted",
  running: "bg-accent animate-pulse",
  waiting: "bg-warn",
  completed: "bg-ok",
  failed: "bg-err",
  unknown: "bg-muted",
};

export const PROVIDER_LABEL: Record<LaunchableProviderId, string> = {
  "claude-code": "Claude Code",
  codex: "Codex CLI",
};

/** Execuções que ainda podem mudar sozinhas. */
export function isActive(run: AgentRun): boolean {
  return run.state === "running" || run.state === "waiting" || run.state === "detected";
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(value);
}

export function totalTokens(tokens: AgentTokenUsage): number {
  return tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

export function formatAgo(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (ms < 60_000) return "agora";
  return `há ${formatDuration(ms)}`;
}

/** Ferramentas mais usadas primeiro. */
export function topTools(toolCalls: Record<string, number>, limit = 4): { name: string; count: number }[] {
  return Object.entries(toolCalls)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function toolTotal(toolCalls: Record<string, number>): number {
  return Object.values(toolCalls).reduce((sum, n) => sum + n, 0);
}
