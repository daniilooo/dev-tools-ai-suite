import type { DetectedStack, Project } from "@devtools/shared";
import { randomUUID } from "node:crypto";
import type { Db } from "../../core/database.js";

interface ProjectRow {
  id: string;
  name: string;
  path: string;
  detected_stack: string;
  created_at: string;
  updated_at: string;
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  path: row.path,
  detectedStack: JSON.parse(row.detected_stack) as DetectedStack[],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ProjectsRepository {
  constructor(private readonly db: Db) {}

  list(): Project[] {
    return (this.db.prepare("SELECT * FROM projects ORDER BY name COLLATE NOCASE").all() as ProjectRow[]).map(
      toProject,
    );
  }

  findById(id: string): Project | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    return row ? toProject(row) : null;
  }

  findByPath(path: string): Project | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE path = ?").get(path) as ProjectRow | undefined;
    return row ? toProject(row) : null;
  }

  create(input: { name: string; path: string; detectedStack: DetectedStack[] }): Project {
    const now = new Date().toISOString();
    const row: ProjectRow = {
      id: randomUUID(),
      name: input.name,
      path: input.path,
      detected_stack: JSON.stringify(input.detectedStack),
      created_at: now,
      updated_at: now,
    };
    this.db
      .prepare(
        "INSERT INTO projects (id, name, path, detected_stack, created_at, updated_at) VALUES (@id, @name, @path, @detected_stack, @created_at, @updated_at)",
      )
      .run(row);
    return toProject(row);
  }

  updateStack(id: string, detectedStack: DetectedStack[]): Project | null {
    this.db
      .prepare("UPDATE projects SET detected_stack = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(detectedStack), new Date().toISOString(), id);
    return this.findById(id);
  }

  /** Remove apenas o cadastro; nunca toca nos arquivos do projeto. */
  delete(id: string): boolean {
    return this.db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  }
}
