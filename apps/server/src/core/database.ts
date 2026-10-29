import Database from "better-sqlite3";
import { restrictPermissions } from "./data-dir.js";

export type Db = Database.Database;

interface Migration {
  version: number;
  description: string;
  up: string;
}

/**
 * Migrações versionadas e somente aditivas (G-09). Alterações destrutivas exigem
 * gate humano HG-10. Nunca editar uma migração já publicada: criar uma nova.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "cria tabela de projetos",
    up: `
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        detected_stack TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    description: "cria tabela de sessões de terminal",
    up: `
      CREATE TABLE terminal_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        shell TEXT NOT NULL,
        state TEXT NOT NULL,
        exit_code INTEGER,
        started_at TEXT NOT NULL,
        ended_at TEXT
      );
      CREATE INDEX idx_terminal_sessions_project ON terminal_sessions(project_id);
    `,
  },
  {
    version: 3,
    description: "cria tabelas de execuções e eventos de agentes",
    up: `
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        parent_run_id TEXT,
        external_id TEXT NOT NULL,
        title TEXT,
        agent_type TEXT,
        model TEXT,
        provider_version TEXT,
        state TEXT NOT NULL,
        started_at TEXT NOT NULL,
        last_event_at TEXT NOT NULL,
        ended_at TEXT,
        tokens_json TEXT,
        tool_calls_json TEXT NOT NULL DEFAULT '{}',
        terminal_id TEXT,
        source_level TEXT NOT NULL,
        source_description TEXT NOT NULL,
        error TEXT
      );
      CREATE INDEX idx_agent_runs_project ON agent_runs(project_id, last_event_at);
      CREATE INDEX idx_agent_runs_parent ON agent_runs(parent_run_id);
      CREATE TABLE agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        payload_redacted_json TEXT NOT NULL,
        source TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX idx_agent_events_run ON agent_events(run_id);
    `,
  },
  {
    version: 4,
    description: "cria tabela de estado dos índices de conhecimento",
    up: `
      CREATE TABLE knowledge_indexes (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        state TEXT NOT NULL,
        files INTEGER NOT NULL DEFAULT 0,
        chunks INTEGER NOT NULL DEFAULT 0,
        skipped_json TEXT NOT NULL DEFAULT '{}',
        indexed_at TEXT,
        duration_ms INTEGER,
        error TEXT
      );
    `,
  },
  {
    version: 5,
    description: "cria tabelas da busca semântica e do grafo de código",
    up: `
      CREATE TABLE knowledge_semantic (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        state TEXT NOT NULL,
        embedded INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT,
        error TEXT
      );
      CREATE TABLE knowledge_graphs (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        state TEXT NOT NULL,
        nodes INTEGER NOT NULL DEFAULT 0,
        edges INTEGER NOT NULL DEFAULT 0,
        repos INTEGER NOT NULL DEFAULT 0,
        built_at TEXT,
        duration_ms INTEGER,
        error TEXT
      );
    `,
  },
];

export function openDatabase(file: string): Db {
  const db = new Database(file);
  if (file !== ":memory:") restrictPermissions(file, 0o600);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Db): number {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const current =
    (db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null }).v ?? 0;
  const pending = MIGRATIONS.filter((m) => m.version > current);
  const apply = db.transaction((migration: Migration) => {
    db.exec(migration.up);
    db.prepare("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)").run(
      migration.version,
      migration.description,
      new Date().toISOString(),
    );
  });
  for (const migration of pending) apply(migration);
  return pending.length;
}
