import type { DetectedStack } from "@devtools/shared";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Pastas que nunca têm o manifesto do projeto (dependências, build, ocultas). */
const SKIP = new Set(["node_modules", "dist", "build", "target", "out", "vendor", "coverage", "bin", "obj"]);
const MAX_DEPTH = 2;
const MAX_DIRS = 200;

/**
 * Detecção de stack por arquivos de manifesto na raiz e em até 2 níveis abaixo
 * (`backend/pom.xml`, `frontend/app/angular.json`): projetos guarda-chuva com
 * backend e frontend em subpastas são comuns. Lê somente manifestos públicos —
 * nunca arquivos de configuração sensíveis.
 */
export function detectStack(projectPath: string): DetectedStack[] {
  const stack = new Set<DetectedStack>();
  for (const dir of candidateDirs(projectPath)) detectIn(dir, stack);
  return [...stack].sort();
}

/** Raiz e subpastas em largura, até `MAX_DEPTH` níveis e `MAX_DIRS` pastas. */
function candidateDirs(root: string): string[] {
  const queue = [{ dir: root, depth: 0 }];
  for (let i = 0; i < queue.length && queue.length < MAX_DIRS; i++) {
    const { dir, depth } = queue[i]!;
    if (depth >= MAX_DEPTH) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
      queue.push({ dir: join(dir, entry.name), depth: depth + 1 });
      if (queue.length >= MAX_DIRS) break;
    }
  }
  return queue.map((q) => q.dir);
}

function detectIn(dir: string, stack: Set<DetectedStack>): void {
  const has = (file: string) => existsSync(join(dir, file));
  if (has("package.json")) {
    stack.add("node");
    const deps = readPackageDeps(join(dir, "package.json"));
    if (has("tsconfig.json") || deps.has("typescript")) stack.add("typescript");
    if (has("angular.json") || deps.has("@angular/core")) stack.add("angular");
    if (deps.has("react")) stack.add("react");
  }
  if (has("angular.json")) stack.add("angular");
  if (has("pom.xml")) {
    stack.add("java-maven");
    if (fileContains(join(dir, "pom.xml"), "spring-boot")) stack.add("spring-boot");
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    if (has(gradle)) {
      stack.add("java-gradle");
      if (fileContains(join(dir, gradle), "org.springframework.boot")) stack.add("spring-boot");
    }
  }
  if (has("pyproject.toml") || has("requirements.txt")) stack.add("python");
  if (has("go.mod")) stack.add("go");
  if (has("Cargo.toml")) stack.add("rust");
  if (has("global.json") || has("Directory.Build.props")) stack.add("dotnet");
}

function readPackageDeps(file: string): Set<string> {
  try {
    const pkg = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string> | undefined>;
    return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  } catch {
    return new Set();
  }
}

function fileContains(file: string, needle: string): boolean {
  try {
    return readFileSync(file, "utf8")
      .slice(0, 512 * 1024)
      .includes(needle);
  } catch {
    return false;
  }
}
