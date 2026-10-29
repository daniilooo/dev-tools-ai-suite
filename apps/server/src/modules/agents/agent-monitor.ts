import type { AgentRun, AgentRunDetail, LaunchableProviderId, ServerEvent } from "@devtools/shared";
import { notFound } from "../../core/errors.js";
import type { AgentSources, Observation } from "../integrations/sources/agent-sources.js";
import { deriveState } from "../integrations/sources/run-snapshot.js";
import type { ProjectsService } from "../projects/projects.service.js";
import type { AgentsRepository } from "./agents.repository.js";

const SOURCES: Record<LaunchableProviderId, AgentRun["source"]> = {
  "claude-code": { level: "B", description: "transcrições locais do Claude Code" },
  codex: { level: "B", description: "sessões locais do Codex" },
};

export interface TerminalLinker {
  /** Terminal da suíte em que este agente foi aberto, se houver. */
  terminalFor(
    providerId: LaunchableProviderId,
    projectId: string,
    externalId: string,
    startedAt: string,
  ): string | null;
}

export interface AgentMonitorOptions {
  sources: AgentSources;
  projects: ProjectsService;
  repository: AgentsRepository;
  terminals?: TerminalLinker;
  intervalMs?: number;
  now?: () => number;
  onError?: (error: unknown) => void;
}

/**
 * Agent Monitor (SUG01): varre as fontes periodicamente, normaliza em `AgentRun`,
 * persiste o histórico e publica mudanças em `/ws/events`. O estado vem só de
 * eventos observados e do limite de frescor — nunca é presumido (INV-03).
 */
export class AgentMonitor {
  private readonly listeners = new Set<(event: ServerEvent) => void>();
  private readonly last = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;
  private readonly now: () => number;

  constructor(private readonly options: AgentMonitorOptions) {
    this.now = options.now ?? Date.now;
  }

  start(): void {
    if (this.timer) return;
    this.options.repository.markStaleUnknown();
    this.tick();
    this.timer = setInterval(() => this.tick(), this.options.intervalMs ?? 2_000);
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

  /** Uma varredura completa. Falhas são isoladas: o monitor nunca derruba o servidor. */
  tick(): void {
    let observations: Observation[];
    try {
      observations = this.options.sources.scan(this.options.projects.list());
    } catch (error) {
      this.options.onError?.(error);
      return;
    }
    for (const observation of observations) {
      try {
        this.apply(observation);
      } catch (error) {
        this.options.onError?.(error);
      }
    }
  }

  list(projectId: string): AgentRunDetail[] {
    this.options.projects.get(projectId);
    return this.options.repository
      .listByProject(projectId)
      .map((run) => ({ ...run, subagents: this.options.repository.children(run.id) }));
  }

  get(id: string): AgentRunDetail {
    const run = this.options.repository.get(id);
    if (!run) throw notFound("Execução de agente não encontrada.");
    return { ...run, subagents: this.options.repository.children(run.id) };
  }

  private apply(observation: Observation): void {
    const { snapshot, providerId, projectId } = observation;
    if (!snapshot.startedAt || !snapshot.lastEventAt) return;

    const state = deriveState(snapshot, this.now());
    const id = runId(
      providerId,
      snapshot.externalId,
      snapshot.kind === "subagent" ? snapshot.parentExternalId : null,
    );
    const run: AgentRun = {
      id,
      projectId,
      providerId,
      kind: snapshot.kind,
      parentRunId: snapshot.parentExternalId ? runId(providerId, snapshot.parentExternalId, null) : null,
      externalId: snapshot.externalId,
      title: snapshot.title,
      agentType: snapshot.agentType,
      model: snapshot.model,
      providerVersion: snapshot.providerVersion,
      state,
      startedAt: snapshot.startedAt,
      lastEventAt: snapshot.lastEventAt,
      endedAt: state === "completed" || state === "failed" ? snapshot.lastEventAt : null,
      tokens: snapshot.tokens ? { ...snapshot.tokens } : null,
      toolCalls: { ...snapshot.toolCalls },
      terminalId:
        snapshot.kind === "agent"
          ? (this.options.terminals?.terminalFor(
              providerId,
              projectId,
              snapshot.externalId,
              snapshot.startedAt,
            ) ?? null)
          : null,
      source: SOURCES[providerId],
      error: snapshot.error,
    };

    const fingerprint = JSON.stringify(run);
    const previous = this.last.get(id);
    if (previous === fingerprint) return;
    const previousState = previous ? (JSON.parse(previous) as AgentRun).state : null;
    this.last.set(id, fingerprint);

    this.options.repository.upsert(run);
    if (previousState !== state) {
      this.options.repository.addEvent(
        id,
        "state",
        { state, previous: previousState },
        run.source.description,
        new Date(this.now()).toISOString(),
      );
    }
    for (const listener of this.listeners) listener({ type: "agent.run.state", run });
  }
}

export function runId(
  providerId: LaunchableProviderId,
  externalId: string,
  parentExternalId: string | null,
): string {
  return parentExternalId ? `${providerId}:${parentExternalId}:${externalId}` : `${providerId}:${externalId}`;
}
