import type { LaunchableProviderId } from "@devtools/shared";
import { join, sep } from "node:path";
import { ClaudeTranscriptParser } from "./claude-transcript.js";
import type { CodexSessionMeta } from "./codex-session.js";
import { CodexSessionParser, readCodexMeta } from "./codex-session.js";
import { JsonlTail } from "./jsonl-tail.js";
import type { LocalSourceFiles } from "./local-files.js";
import { claudeProjectDirName } from "./local-files.js";
import type { RunSnapshot } from "./run-snapshot.js";

/** Arquivos sem alteração há mais que isso só são lidos se já estavam sendo acompanhados. */
const MAX_AGE_MS = 30 * 24 * 60 * 60_000;
const SESSION_FILE = /^[0-9a-f-]{36}\.jsonl$/;
const SUBAGENT_FILE = /^agent-([A-Za-z0-9_-]+)\.jsonl$/;
const ROLLOUT_FILE = /^rollout-.+\.jsonl$/;
const META_MAX_BYTES = 64 * 1024;
const CODEX_FIRST_LINE_MAX_BYTES = 2 * 1024 * 1024;

export interface ProjectRef {
  id: string;
  path: string;
}

export interface Observation {
  projectId: string;
  providerId: LaunchableProviderId;
  snapshot: RunSnapshot;
  changed: boolean;
}

interface Tracked {
  projectId: string;
  providerId: LaunchableProviderId;
  tail: JsonlTail;
  feed(records: unknown[]): void;
  snapshot(): RunSnapshot;
  /** Para subagentes do Claude: arquivo `.meta.json` ainda não aplicado e como aplicá-lo. */
  metaPath?: string;
  applyMeta?: (meta: unknown) => void;
  /** Recria o parser quando o arquivo é reescrito. */
  reset(): void;
}

/**
 * Descobre e acompanha as fontes de eventos de agentes dos projetos cadastrados:
 * transcrições do Claude Code (`~/.claude/projects/<projeto>/`) e sessões do Codex
 * (`~/.codex/sessions/AAAA/MM/DD/`). Leitura incremental; só metadados.
 */
export class AgentSources {
  private readonly tracked = new Map<string, Tracked>();
  /** Metadados da primeira linha de cada rollout do Codex (null = não é sessão válida). */
  private readonly codexMeta = new Map<string, CodexSessionMeta | null>();
  /** Transcrições de outro diretório com o mesmo nome codificado: não releem a cada varredura. */
  private readonly ignored = new Set<string>();

  constructor(
    private readonly files: LocalSourceFiles,
    private readonly now: () => number = Date.now,
  ) {}

  scan(projects: ProjectRef[]): Observation[] {
    const projectIds = new Set(projects.map((p) => p.id));
    for (const [path, item] of this.tracked) {
      if (!projectIds.has(item.projectId)) this.tracked.delete(path);
    }
    for (const project of projects) this.discoverClaude(project);
    this.discoverCodex(projects);

    const observations: Observation[] = [];
    for (const [path, item] of this.tracked) {
      const { records, reset, changed } = item.tail.poll();
      if (reset) item.reset();
      if (item.metaPath) this.applyClaudeMeta(item);
      if (records.length > 0) item.feed(records);
      if (!this.tracked.has(path)) continue;
      observations.push({
        projectId: item.projectId,
        providerId: item.providerId,
        snapshot: item.snapshot(),
        changed: changed || reset,
      });
    }
    return observations;
  }

  private isRecent(path: string): boolean {
    const stat = this.files.stat(path);
    return !!stat && this.now() - stat.mtimeMs <= MAX_AGE_MS;
  }

  private discoverClaude(project: ProjectRef): void {
    const dir = join(this.files.roots.claude, "projects", claudeProjectDirName(project.path));
    for (const name of this.files.list(dir)) {
      if (!SESSION_FILE.test(name)) continue;
      const sessionId = name.slice(0, -".jsonl".length);
      const path = join(dir, name);
      if (this.ignored.has(path)) continue;
      if (!this.tracked.has(path) && this.isRecent(path)) {
        this.trackClaude(path, project, () => new ClaudeTranscriptParser(sessionId, "agent"));
      }
      if (!this.tracked.has(path)) continue;
      const subDir = join(dir, sessionId, "subagents");
      for (const subName of this.files.list(subDir)) {
        const match = SUBAGENT_FILE.exec(subName);
        if (!match) continue;
        const subPath = join(subDir, subName);
        if (this.tracked.has(subPath)) continue;
        const agentId = match[1]!;
        this.trackClaude(
          subPath,
          project,
          () => new ClaudeTranscriptParser(agentId, "subagent", sessionId),
          join(subDir, `agent-${agentId}.meta.json`),
        );
      }
    }
  }

  private trackClaude(
    path: string,
    project: ProjectRef,
    create: () => ClaudeTranscriptParser,
    metaPath?: string,
  ): void {
    let parser = create();
    const item: Tracked = {
      projectId: project.id,
      providerId: "claude-code",
      tail: new JsonlTail(this.files, path),
      metaPath,
      applyMeta: (meta) => parser.applyMeta(meta),
      feed: (records) => {
        parser.feed(records);
        // O nome do diretório é ambíguo ("/a-b" e "/a/b"): confirma pelo cwd registrado.
        if (parser.snapshot.kind === "agent" && parser.snapshot.cwd && parser.snapshot.cwd !== project.path) {
          this.ignored.add(path);
          // A sessão e seus subagentes (`<sessão>/subagents/…`) saem do acompanhamento.
          const sessionDir = path.slice(0, -".jsonl".length) + sep;
          for (const key of this.tracked.keys()) {
            if (key === path || key.startsWith(sessionDir)) this.tracked.delete(key);
          }
        }
      },
      snapshot: () => parser.snapshot,
      reset: () => {
        parser = create();
        item.metaPath = metaPath;
      },
    };
    this.tracked.set(path, item);
  }

  private applyClaudeMeta(item: Tracked): void {
    const stat = this.files.stat(item.metaPath!);
    if (!stat || stat.size > META_MAX_BYTES) return;
    try {
      item.applyMeta?.(JSON.parse(this.files.read(item.metaPath!, 0, stat.size).toString("utf8")));
      item.metaPath = undefined;
    } catch {
      // meta ainda sendo escrita: tenta na próxima varredura
    }
  }

  private discoverCodex(projects: ProjectRef[]): void {
    if (projects.length === 0) return;
    const root = join(this.files.roots.codex, "sessions");
    const today = new Date(this.now());
    for (let daysAgo = 0; daysAgo <= 30; daysAgo++) {
      const day = new Date(today.getTime() - daysAgo * 24 * 60 * 60_000);
      const dir = join(
        root,
        String(day.getFullYear()),
        String(day.getMonth() + 1).padStart(2, "0"),
        String(day.getDate()).padStart(2, "0"),
      );
      for (const name of this.files.list(dir)) {
        if (!ROLLOUT_FILE.test(name)) continue;
        const path = join(dir, name);
        if (this.tracked.has(path)) continue;
        const meta = this.codexMetaOf(path);
        if (!meta?.cwd) continue;
        const project = projects.find((p) => meta.cwd === p.path || meta.cwd!.startsWith(p.path + sep));
        if (!project) continue;
        let parser = new CodexSessionParser(meta);
        this.tracked.set(path, {
          projectId: project.id,
          providerId: "codex",
          tail: new JsonlTail(this.files, path),
          feed: (records) => parser.feed(records),
          snapshot: () => parser.snapshot,
          reset: () => (parser = new CodexSessionParser(meta)),
        });
      }
    }
  }

  private codexMetaOf(path: string): CodexSessionMeta | null {
    if (this.codexMeta.has(path)) return this.codexMeta.get(path)!;
    const stat = this.files.stat(path);
    if (!stat || stat.size === 0) return null;
    const head = this.files.read(path, 0, Math.min(stat.size, CODEX_FIRST_LINE_MAX_BYTES)).toString("utf8");
    const newline = head.indexOf("\n");
    if (newline === -1 && stat.size > head.length) {
      this.codexMeta.set(path, null);
      return null;
    }
    let meta: CodexSessionMeta | null;
    try {
      meta = readCodexMeta(JSON.parse(newline === -1 ? head : head.slice(0, newline)));
    } catch {
      meta = null;
    }
    // Primeira linha incompleta (arquivo sendo criado): tenta de novo depois.
    if (meta || newline !== -1) this.codexMeta.set(path, meta);
    return meta;
  }
}
