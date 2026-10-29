import type { DetectedStack } from "@devtools/shared";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Detecção de stack por arquivos de manifesto na raiz do projeto.
 * Lê somente manifestos públicos — nunca arquivos de configuração sensíveis.
 */
export function detectStack(projectPath: string): DetectedStack[] {
  const has = (file: string) => existsSync(join(projectPath, file));
  const stack = new Set<DetectedStack>();

  if (has("package.json")) {
    stack.add("node");
    const deps = readPackageDeps(join(projectPath, "package.json"));
    if (has("tsconfig.json") || deps.has("typescript")) stack.add("typescript");
    if (has("angular.json") || deps.has("@angular/core")) stack.add("angular");
    if (deps.has("react")) stack.add("react");
  }
  if (has("angular.json")) stack.add("angular");
  if (has("pom.xml")) {
    stack.add("java-maven");
    if (fileContains(join(projectPath, "pom.xml"), "spring-boot")) stack.add("spring-boot");
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    if (has(gradle)) {
      stack.add("java-gradle");
      if (fileContains(join(projectPath, gradle), "org.springframework.boot")) stack.add("spring-boot");
    }
  }
  if (has("pyproject.toml") || has("requirements.txt")) stack.add("python");
  if (has("go.mod")) stack.add("go");
  if (has("Cargo.toml")) stack.add("rust");
  if (has("global.json") || has("Directory.Build.props")) stack.add("dotnet");

  return [...stack].sort();
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
