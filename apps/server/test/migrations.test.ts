import Database from "better-sqlite3";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDataDir } from "../src/core/data-dir.js";
import { migrate, openDatabase, SCHEMA_VERSION } from "../src/core/database.js";
import { createTestApp, HOST, login, tempDir } from "./helpers.js";
import type { TestContext } from "./helpers.js";

let ctx: TestContext | undefined;
afterEach(async () => ctx?.close());

const NOW = "2026-10-01T12:00:00.000Z";

/** Dados de uma instalação antiga, um por tabela existente até a versão `version`. */
function seed(db: Database.Database, version: number): void {
  db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)").run(
    "p1",
    "antigo",
    "/srv/antigo",
    '["angular"]',
    NOW,
    NOW,
  );
  if (version >= 2) {
    db.prepare(
      "INSERT INTO terminal_sessions (id, project_id, title, shell, state, started_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("t1", "p1", "bash", "/bin/bash", "exited", NOW);
  }
  if (version >= 3) {
    db.prepare(
      `INSERT INTO agent_runs (id, project_id, provider_id, kind, external_id, state, started_at, last_event_at,
        source_level, source_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("r1", "p1", "claude-code", "session", "ext-1", "completed", NOW, NOW, "B", "transcrições locais");
  }
  if (version >= 4) {
    db.prepare("INSERT INTO knowledge_indexes (project_id, state, files, chunks) VALUES (?, ?, ?, ?)").run(
      "p1",
      "indexed",
      10,
      20,
    );
  }
}

describe("migrações", () => {
  it.each(Array.from({ length: SCHEMA_VERSION - 1 }, (_, i) => i + 1))(
    "atualiza um banco da migração %i até a última sem perder dados",
    (version) => {
      const file = join(tempDir(), "devtools.db");
      const old = new Database(file);
      migrate(old, version);
      seed(old, version);
      old.close();

      const db = openDatabase(file);
      const { v } = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number };
      expect(v).toBe(SCHEMA_VERSION);
      expect(db.prepare("SELECT name, detected_stack FROM projects").all()).toEqual([
        { name: "antigo", detected_stack: '["angular"]' },
      ]);
      if (version >= 2)
        expect(db.prepare("SELECT COUNT(*) AS n FROM terminal_sessions").get()).toEqual({ n: 1 });
      if (version >= 3) expect(db.prepare("SELECT COUNT(*) AS n FROM agent_runs").get()).toEqual({ n: 1 });
      if (version >= 4) {
        expect(db.prepare("SELECT state, chunks FROM knowledge_indexes").get()).toEqual({
          state: "indexed",
          chunks: 20,
        });
      }
      // Aplicar de novo não muda nada.
      expect(migrate(db)).toBe(0);
      db.close();
    },
  );

  it("a suíte sobe com um banco antigo e mostra os projetos dele", async () => {
    const dataDir = tempDir();
    const layout = ensureDataDir(dataDir);
    const old = new Database(layout.database);
    migrate(old, 1);
    seed(old, 1);
    old.close();

    ctx = await createTestApp(dataDir);
    const { cookie } = await login(ctx);
    const list = await ctx.server.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: { host: HOST, cookie },
    });
    expect(list.json().map((p: { name: string }) => p.name)).toEqual(["antigo"]);
  });

  it("recusa banco de uma versão mais nova da suíte, sem alterá-lo", () => {
    const file = join(tempDir(), "devtools.db");
    const newer = new Database(file);
    migrate(newer);
    newer
      .prepare("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)")
      .run(SCHEMA_VERSION + 1, "do futuro", NOW);
    newer.close();

    expect(() => openDatabase(file)).toThrow(/mais nova que a desta versão/);
    const after = new Database(file);
    expect(after.prepare("SELECT MAX(version) AS v FROM schema_migrations").get()).toEqual({
      v: SCHEMA_VERSION + 1,
    });
    after.close();
  });
});
