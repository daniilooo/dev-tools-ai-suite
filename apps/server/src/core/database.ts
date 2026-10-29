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
