import type { AgentRun } from "@devtools/shared";
import type { Db } from "../../core/database.js";

interface Row {
  id: string;
  project_id: string;
  provider_id: AgentRun["providerId"];
  kind: AgentRun["kind"];
  parent_run_id: string | null;
  external_id: string;
  title: string | null;
  agent_type: string | null;
  model: string | null;
  provider_version: string | null;
  state: AgentRun["state"];
  started_at: string;
  last_event_at: string;
  ended_at: string | null;
  tokens_json: string | null;
  tool_calls_json: string;
  terminal_id: string | null;
  source_level: AgentRun["source"]["level"];
  source_description: string;
  error: string | null;
}

/** Histórico de execuções de agentes. Só metadados redigidos: nenhum prompt ou saída. */
export class AgentsRepository {
  constructor(private readonly db: Db) {}

  upsert(run: AgentRun): void {
    this.db
      .prepare(
        `INSERT INTO agent_runs (id, project_id, provider_id, kind, parent_run_id, external_id, title, agent_type,
           model, provider_version, state, started_at, last_event_at, ended_at, tokens_json, tool_calls_json,
           terminal_id, source_level, source_description, error)
         VALUES (@id, @project_id, @provider_id, @kind, @parent_run_id, @external_id, @title, @agent_type,
           @model, @provider_version, @state, @started_at, @last_event_at, @ended_at, @tokens_json, @tool_calls_json,
           @terminal_id, @source_level, @source_description, @error)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, agent_type = excluded.agent_type, model = excluded.model,
           provider_version = excluded.provider_version, state = excluded.state, started_at = excluded.started_at,
           last_event_at = excluded.last_event_at, ended_at = excluded.ended_at, tokens_json = excluded.tokens_json,
           tool_calls_json = excluded.tool_calls_json,
           terminal_id = COALESCE(excluded.terminal_id, agent_runs.terminal_id), error = excluded.error`,
      )
      .run(toRow(run));
  }

  addEvent(
    runId: string,
    type: string,
    payload: Record<string, unknown>,
    source: string,
    occurredAt: string,
  ): void {
    this.db
      .prepare(
        "INSERT INTO agent_events (run_id, type, payload_redacted_json, source, occurred_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(runId, type, JSON.stringify(payload), source, occurredAt);
  }

  get(id: string): AgentRun | null {
    const row = this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  listByProject(projectId: string, limit = 100): AgentRun[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM agent_runs WHERE project_id = ? AND kind = 'agent' ORDER BY last_event_at DESC LIMIT ?",
        )
        .all(projectId, limit) as Row[]
    ).map(fromRow);
  }

  children(parentRunId: string): AgentRun[] {
    return (
      this.db
        .prepare("SELECT * FROM agent_runs WHERE parent_run_id = ? ORDER BY started_at ASC")
        .all(parentRunId) as Row[]
    ).map(fromRow);
  }

  /** Ao iniciar: execuções que pareciam ativas não têm mais evidência até a releitura (INV-03). */
  markStaleUnknown(): void {
    this.db
      .prepare("UPDATE agent_runs SET state = 'unknown' WHERE state IN ('running', 'waiting', 'detected')")
      .run();
  }
}

function toRow(run: AgentRun): Row {
  return {
    id: run.id,
    project_id: run.projectId,
    provider_id: run.providerId,
    kind: run.kind,
    parent_run_id: run.parentRunId,
    external_id: run.externalId,
    title: run.title,
    agent_type: run.agentType,
    model: run.model,
    provider_version: run.providerVersion,
    state: run.state,
    started_at: run.startedAt,
    last_event_at: run.lastEventAt,
    ended_at: run.endedAt,
    tokens_json: run.tokens ? JSON.stringify(run.tokens) : null,
    tool_calls_json: JSON.stringify(run.toolCalls),
    terminal_id: run.terminalId,
    source_level: run.source.level,
    source_description: run.source.description,
    error: run.error,
  };
}

function fromRow(row: Row): AgentRun {
  return {
    id: row.id,
    projectId: row.project_id,
    providerId: row.provider_id,
    kind: row.kind,
    parentRunId: row.parent_run_id,
    externalId: row.external_id,
    title: row.title,
    agentType: row.agent_type,
    model: row.model,
    providerVersion: row.provider_version,
    state: row.state,
    startedAt: row.started_at,
    lastEventAt: row.last_event_at,
    endedAt: row.ended_at,
    tokens: row.tokens_json ? (JSON.parse(row.tokens_json) as AgentRun["tokens"]) : null,
    toolCalls: JSON.parse(row.tool_calls_json) as Record<string, number>,
    terminalId: row.terminal_id,
    source: { level: row.source_level, description: row.source_description },
    error: row.error,
  };
}
