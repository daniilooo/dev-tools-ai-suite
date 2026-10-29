import { redact } from "../../../core/redact.js";
import type { RunSnapshot } from "./run-snapshot.js";
import { addTokens, emptySnapshot, num, touch } from "./run-snapshot.js";

/**
 * Parser incremental das transcrições locais do Claude Code (nível B, testado na 2.1.x).
 * Lê só campos de metadados; conteúdo de mensagens, prompts e resultados de
 * ferramentas é ignorado. Registros de uma mesma mensagem (um por bloco de conteúdo)
 * repetem o `usage`: os tokens são somados uma vez por `message.id`.
 */
export class ClaudeTranscriptParser {
  readonly snapshot: RunSnapshot;
  private readonly seenMessages = new Set<string>();
  private readonly seenTools = new Set<string>();

  constructor(externalId: string, kind: "agent" | "subagent", parentExternalId: string | null = null) {
    this.snapshot = emptySnapshot(externalId, kind, parentExternalId);
  }

  /** Metadados do subagente (`agent-<id>.meta.json`). */
  applyMeta(meta: unknown): void {
    if (typeof meta !== "object" || meta === null) return;
    const record = meta as Record<string, unknown>;
    if (typeof record.agentType === "string") this.snapshot.agentType = record.agentType.slice(0, 80);
    if (typeof record.description === "string") this.snapshot.title = short(record.description, 160);
  }

  feed(records: unknown[]): void {
    for (const raw of records) {
      if (typeof raw !== "object" || raw === null) continue;
      this.apply(raw as Record<string, unknown>);
    }
  }

  private apply(record: Record<string, unknown>): void {
    const s = this.snapshot;
    switch (record.type) {
      case "ai-title":
        if (typeof record.aiTitle === "string" && s.kind === "agent") s.title = short(record.aiTitle, 120);
        return;
      case "assistant":
        this.base(record);
        this.assistant(record.message);
        return;
      case "user":
        this.base(record);
        if (record.isMeta === true || record.isCompactSummary === true) return;
        s.phase = isInterruption(record.message) ? "idle" : "turn";
        return;
      case "system":
        this.base(record);
        if (record.level === "error") {
          s.phase = "error";
          s.error = "erro registrado pelo Claude Code";
        }
        return;
      default:
        return;
    }
  }

  private base(record: Record<string, unknown>): void {
    touch(this.snapshot, record.timestamp);
    if (typeof record.version === "string") this.snapshot.providerVersion = record.version;
    if (typeof record.cwd === "string" && !this.snapshot.cwd) this.snapshot.cwd = record.cwd;
  }

  private assistant(message: unknown): void {
    if (typeof message !== "object" || message === null) return;
    const s = this.snapshot;
    const m = message as Record<string, unknown>;
    if (typeof m.model === "string" && !m.model.startsWith("<")) s.model = m.model;

    const id = typeof m.id === "string" ? m.id : null;
    if (id && !this.seenMessages.has(id) && typeof m.usage === "object" && m.usage !== null) {
      this.seenMessages.add(id);
      const u = m.usage as Record<string, unknown>;
      addTokens(s, {
        input: num(u.input_tokens),
        output: num(u.output_tokens),
        cacheRead: num(u.cache_read_input_tokens),
        cacheWrite: num(u.cache_creation_input_tokens),
      });
    }

    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (typeof block !== "object" || block === null) continue;
        const b = block as Record<string, unknown>;
        if (b.type === "tool_use" && typeof b.name === "string" && typeof b.id === "string") {
          if (this.seenTools.has(b.id)) continue;
          this.seenTools.add(b.id);
          const name = b.name.slice(0, 60);
          s.toolCalls[name] = (s.toolCalls[name] ?? 0) + 1;
        }
      }
    }

    if (m.stop_reason === "end_turn" || m.stop_reason === "stop_sequence") {
      s.phase = s.kind === "subagent" ? "done" : "idle";
    } else {
      s.phase = "turn";
    }
  }
}

function isInterruption(message: unknown): boolean {
  if (typeof message !== "object" || message === null) return false;
  const content = (message as Record<string, unknown>).content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c) => (typeof c === "object" && c && "text" in c ? String(c.text) : "")).join("")
        : "";
  return text.startsWith("[Request interrupted");
}

/** Texto curto e redigido para exibição (títulos, descrições). */
export function short(text: string, max: number): string {
  const clean = redact(text.replace(/\s+/g, " ").trim());
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
