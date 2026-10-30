import { short } from "./claude-transcript.js";
import type { RunSnapshot } from "./run-snapshot.js";
import { emptySnapshot, num, touch } from "./run-snapshot.js";

export interface CodexSessionMeta {
  id: string;
  cwd: string | null;
  parentThreadId: string | null;
  nickname: string | null;
  cliVersion: string | null;
  startedAt: string | null;
}

/** Extrai o `session_meta` (primeira linha do rollout) sem guardar instruções do sistema. */
export function readCodexMeta(record: unknown): CodexSessionMeta | null {
  if (typeof record !== "object" || record === null) return null;
  const r = record as Record<string, unknown>;
  if (r.type !== "session_meta" || typeof r.payload !== "object" || r.payload === null) return null;
  const p = r.payload as Record<string, unknown>;
  const id = typeof p.id === "string" ? p.id : typeof p.session_id === "string" ? p.session_id : null;
  if (!id) return null;
  return {
    id,
    cwd: typeof p.cwd === "string" ? p.cwd : null,
    parentThreadId: typeof p.parent_thread_id === "string" && p.parent_thread_id ? p.parent_thread_id : null,
    nickname: typeof p.agent_nickname === "string" && p.agent_nickname ? p.agent_nickname : null,
    cliVersion: typeof p.cli_version === "string" ? p.cli_version : null,
    startedAt:
      typeof p.timestamp === "string" ? p.timestamp : typeof r.timestamp === "string" ? r.timestamp : null,
  };
}

const TOOL_ITEMS = new Set(["function_call", "custom_tool_call", "local_shell_call", "web_search_call"]);

/**
 * Parser incremental das sessões locais do Codex (`rollout-*.jsonl`, nível B, testado na 0.165.x).
 * Usa eventos de turno (`task_started`/`task_complete`), contagem de tokens e nomes de ferramentas.
 */
export class CodexSessionParser {
  snapshot: RunSnapshot;

  constructor(meta: CodexSessionMeta) {
    this.snapshot = emptySnapshot(meta.id, meta.parentThreadId ? "subagent" : "agent", meta.parentThreadId);
    this.snapshot.cwd = meta.cwd;
    this.snapshot.providerVersion = meta.cliVersion;
    if (meta.nickname) this.snapshot.title = short(meta.nickname, 80);
    touch(this.snapshot, meta.startedAt);
  }

  feed(records: unknown[]): void {
    for (const raw of records) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      const payload = (typeof r.payload === "object" && r.payload !== null ? r.payload : {}) as Record<
        string,
        unknown
      >;
      const s = this.snapshot;
      touch(s, r.timestamp);

      if (r.type === "turn_context" && typeof payload.model === "string") s.model = payload.model;

      if (r.type === "response_item" && TOOL_ITEMS.has(String(payload.type))) {
        const name = (typeof payload.name === "string" ? payload.name : String(payload.type)).slice(0, 60);
        s.toolCalls[name] = (s.toolCalls[name] ?? 0) + 1;
      }

      if (r.type !== "event_msg") continue;
      switch (payload.type) {
        case "task_started":
          s.phase = "turn";
          s.error = null;
          break;
        case "task_complete":
          if (payload.error) {
            s.phase = "error";
            s.error = "turno terminou com erro";
          } else {
            s.phase = s.kind === "subagent" ? "done" : "idle";
          }
          break;
        case "error":
          s.phase = "error";
          s.error = "erro registrado pelo Codex";
          break;
        case "token_count": {
          const info = payload.info as Record<string, unknown> | null | undefined;
          const total = info?.total_token_usage as Record<string, unknown> | undefined;
          // Valor acumulado da sessão: substitui, não soma.
          if (total) {
            s.tokens = {
              input: num(total.input_tokens),
              output: num(total.output_tokens),
              cacheRead: num(total.cached_input_tokens),
              cacheWrite: num(total.cache_write_input_tokens),
            };
          }
          break;
        }
      }
    }
  }
}
