import { closeSync, lstatSync, openSync, readdirSync, readSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";

/**
 * Único ponto do módulo `integrations` que lê arquivos (exceção de lint restrita a esta pasta).
 * Allowlist (INV-02, RN-03): só transcrições do Claude Code e sessões do Codex.
 * Credenciais e configurações (`.credentials.json`, `auth.json`, `settings.json`,
 * `config.toml`) nunca casam com os padrões abaixo.
 */
const CLAUDE_PATTERNS = [
  /^projects\/[^/]+\/[0-9a-f-]{36}\.jsonl$/,
  /^projects\/[^/]+\/[0-9a-f-]{36}\/subagents\/agent-[A-Za-z0-9_-]+\.(jsonl|meta\.json)$/,
];
const CODEX_PATTERNS = [/^sessions\/\d{4}\/\d{2}\/\d{2}\/rollout-[A-Za-z0-9T:._-]+\.jsonl$/];

export interface LocalSourceRoots {
  claude: string;
  codex: string;
}

export function defaultRoots(env: NodeJS.ProcessEnv = process.env): LocalSourceRoots {
  return {
    claude: env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    codex: env.CODEX_HOME || join(homedir(), ".codex"),
  };
}

export interface FileStat {
  size: number;
  mtimeMs: number;
}

export class LocalSourceFiles {
  constructor(readonly roots: LocalSourceRoots) {}

  /** O caminho está dentro de uma raiz e casa com um padrão permitido? Links simbólicos são recusados. */
  isAllowed(path: string): boolean {
    for (const [root, patterns] of [
      [this.roots.claude, CLAUDE_PATTERNS],
      [this.roots.codex, CODEX_PATTERNS],
    ] as const) {
      const rel = relative(root, path).split(sep).join("/");
      if (rel.startsWith("..") || rel.startsWith("/")) continue;
      if (!patterns.some((p) => p.test(rel))) continue;
      try {
        if (lstatSync(path).isSymbolicLink()) return false;
        const realRoot = realpathSync(root);
        return !relative(realRoot, realpathSync(path)).startsWith("..");
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Lista nomes de um diretório dentro das raízes (sem ler conteúdo). */
  list(dir: string): string[] {
    const inside = [this.roots.claude, this.roots.codex].some((root) => {
      const rel = relative(root, dir);
      return !rel.startsWith("..") && !rel.startsWith("/");
    });
    if (!inside) return [];
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  }

  stat(path: string): FileStat | null {
    if (!this.isAllowed(path)) return null;
    try {
      const stat = lstatSync(path);
      return stat.isFile() ? { size: stat.size, mtimeMs: stat.mtimeMs } : null;
    } catch {
      return null;
    }
  }

  /** Lê até `maxBytes` a partir de `offset`. Recusa caminhos fora da allowlist. */
  read(path: string, offset: number, maxBytes: number): Buffer {
    if (!this.isAllowed(path)) throw new Error(`caminho fora da allowlist: ${path}`);
    const fd = openSync(path, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const bytes = readSync(fd, buffer, 0, maxBytes, offset);
      return buffer.subarray(0, bytes);
    } finally {
      closeSync(fd);
    }
  }
}

/** Nome do diretório do Claude Code para um projeto: caracteres não alfanuméricos viram "-". */
export function claudeProjectDirName(projectPath: string): string {
  return projectPath.replace(/[^A-Za-z0-9]/g, "-");
}
