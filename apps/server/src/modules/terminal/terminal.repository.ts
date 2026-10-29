import type { TerminalSession } from "@devtools/shared";
import type { Db } from "../../core/database.js";

/** Histórico das sessões de terminal. O processo vivo existe só em memória. */
export class TerminalRepository {
  constructor(private readonly db: Db) {}

  insert(session: TerminalSession): void {
    this.db
      .prepare(
        `INSERT INTO terminal_sessions (id, project_id, title, shell, state, exit_code, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.projectId,
        session.title,
        session.shell,
        session.state,
        session.exitCode,
        session.startedAt,
        session.endedAt,
      );
  }

  updateState(session: TerminalSession): void {
    this.db
      .prepare("UPDATE terminal_sessions SET state = ?, exit_code = ?, ended_at = ? WHERE id = ?")
      .run(session.state, session.exitCode, session.endedAt, session.id);
  }

  /** Sessões que ficaram abertas quando o servidor parou: os processos não existem mais. */
  closeStale(now: string): number {
    return this.db
      .prepare("UPDATE terminal_sessions SET state = 'exited', ended_at = ? WHERE state != 'exited'")
      .run(now).changes;
  }
}
