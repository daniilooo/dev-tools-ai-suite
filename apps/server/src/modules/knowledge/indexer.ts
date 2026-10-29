import type { KnowledgeSkipped } from "@devtools/shared";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { open } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { runProcess } from "../../core/process-runner.js";
import { redact } from "../../core/redact.js";
import { exclusionFor, skipDirectory } from "./exclusions.js";
import type { Chunk, IndexedFile, KnowledgeIndexWriter } from "./knowledge-index.js";

export const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 50_000;
const CHUNK_LINES = 40;
const CHUNK_OVERLAP = 5;

export interface ListedFiles {
  files: IndexedFile[];
  skipped: KnowledgeSkipped;
}

/**
 * Arquivos indexáveis do projeto. Em repositórios git, a lista vem do próprio git
 * (rastreados + não rastreados não ignorados), respeitando o `.gitignore`; fora do git,
 * percorre o diretório sem seguir links. Depois aplica as exclusões padrão e o limite de 1 MiB.
 */
export async function listProjectFiles(root: string): Promise<ListedFiles> {
  const skipped: KnowledgeSkipped = { sensitive: 0, noise: 0, large: 0, binary: 0 };
  const candidates = await candidateFiles(root);
  const files: IndexedFile[] = [];
  for (const rel of candidates) {
    const reason = exclusionFor(rel);
    if (reason) {
      skipped[reason]++;
      continue;
    }
    let stat;
    try {
      stat = lstatSync(join(root, rel));
    } catch {
      continue; // removido entre a listagem e a leitura
    }
    if (!stat.isFile()) continue; // links simbólicos e submódulos ficam de fora
    if (stat.size > MAX_FILE_BYTES) {
      skipped.large++;
      continue;
    }
    files.push({ path: rel, size: stat.size, mtimeMs: stat.mtimeMs });
    if (files.length >= MAX_FILES) break;
  }
  return { files, skipped };
}

/**
 * Repositórios git aninhados (até 3 níveis: ex. `backend/api`, submódulos) entram com o
 * próprio `.gitignore`, mesmo que a raiz os ignore por serem versionados à parte.
 */
async function candidateFiles(root: string): Promise<string[]> {
  const own = await gitFiles(root);
  if (!own) return walk(root);
  const all = new Set(own);
  for (const nested of nestedRepos(root)) {
    const files = await gitFiles(join(root, nested));
    for (const file of files ?? []) all.add(`${nested}/${file}`);
  }
  return [...all].sort();
}

function nestedRepos(root: string, maxDepth = 3): string[] {
  const found: string[] = [];
  const visit = (rel: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(join(root, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || skipDirectory(entry.name)) continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (existsSync(join(root, child, ".git"))) found.push(child);
      visit(child, depth + 1);
    }
  };
  visit("", 1);
  return found;
}

async function gitFiles(root: string): Promise<string[] | null> {
  if (!existsSync(join(root, ".git"))) return null;
  const result = await runProcess(
    "git",
    ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { timeoutMs: 30_000, maxOutputBytes: 32 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } },
  );
  if (result.exitCode !== 0 || result.timedOut) return null;
  return result.stdout.split("\0").filter(Boolean);
}

function walk(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0 && out.length < MAX_FILES * 2) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirectory(entry.name)) stack.push(path);
      } else if (entry.isFile()) {
        out.push(relative(root, path).split(sep).join("/"));
      }
    }
  }
  return out.sort();
}

/** Lê, redige e divide um arquivo em trechos de linhas. null = binário. */
export async function chunkFile(root: string, file: IndexedFile): Promise<Chunk[] | null> {
  const handle = await open(join(root, file.path), "r");
  let buffer: Buffer;
  try {
    buffer = Buffer.alloc(Math.min(file.size, MAX_FILE_BYTES));
    await handle.read(buffer, 0, buffer.length, 0);
  } finally {
    await handle.close();
  }
  if (buffer.subarray(0, 8192).includes(0)) return null;
  // Segredos que escaparam das exclusões não entram no índice (RN-02).
  const lines = redact(buffer.toString("utf8")).split("\n");
  // Quebra de linha final não é uma linha a mais: as referências apontam linhas que existem.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const chunks: Chunk[] = [];
  for (let start = 0; start < lines.length; start += CHUNK_LINES - CHUNK_OVERLAP) {
    const slice = lines.slice(start, start + CHUNK_LINES);
    const body = slice.join("\n");
    if (body.trim()) {
      chunks.push({
        path: file.path,
        lineStart: start + 1,
        lineEnd: start + slice.length,
        body: `${file.path}\n${body}`,
      });
    }
    if (start + CHUNK_LINES >= lines.length) break;
  }
  return chunks;
}

/** Indexa a lista no escritor, cedendo o laço de eventos entre arquivos. */
export async function indexFiles(
  root: string,
  listed: ListedFiles,
  writer: KnowledgeIndexWriter,
): Promise<{ files: number; chunks: number; skipped: KnowledgeSkipped }> {
  const skipped = { ...listed.skipped };
  let files = 0;
  let chunks = 0;
  for (const file of listed.files) {
    let fileChunks: Chunk[] | null;
    try {
      fileChunks = await chunkFile(root, file);
    } catch {
      continue; // sem permissão ou removido no meio
    }
    if (fileChunks === null) {
      // Registrado sem trechos: detectar mudanças depois não confunde binário com arquivo novo.
      writer.add(file, []);
      skipped.binary++;
      continue;
    }
    writer.add(file, fileChunks);
    files++;
    chunks += fileChunks.length;
  }
  return { files, chunks, skipped };
}
