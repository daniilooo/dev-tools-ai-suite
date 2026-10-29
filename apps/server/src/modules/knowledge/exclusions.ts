/**
 * Exclusões padrão da indexação (vault/07_SECURITY/INDEXING_EXCLUSIONS.md), aplicadas
 * ao caminho relativo antes de qualquer leitura de conteúdo. Além delas, projetos git
 * respeitam o `.gitignore` (a listagem vem de `git ls-files --exclude-standard`).
 */
export type ExclusionReason = "sensitive" | "noise";

const SENSITIVE_DIRS = new Set(["secrets", ".secrets", ".claude", ".codex"]);
const SENSITIVE_FILES = [
  /^\.env$/,
  /^\.env\..+$/,
  /\.(pem|key|p12|pfx|kdbx)$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)/,
  /^\.(npmrc|pypirc|netrc)$/,
  /^credentials/i,
  /token.*\.json$/i,
];
const SENSITIVE_ALLOWED = [/^\.env\.example$/];

const NOISE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".angular",
  "target",
  "out",
  ".next",
  ".venv",
  "__pycache__",
]);
const NOISE_FILES = [
  /\.min\.(js|css)$/i,
  /\.map$/i,
  /\.lock$/i,
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/,
  // Binários e mídia: nunca viram texto útil.
  /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|mp[34]|mov|avi|wav|ogg|webm|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|class|so|dylib|dll|exe|bin|o|a|woff2?|ttf|otf|eot|sqlite3?|db)$/i,
];

/** Motivo para não indexar `relPath` (separador `/`), ou null quando pode ser lido. */
export function exclusionFor(relPath: string): ExclusionReason | null {
  const parts = relPath.split("/");
  const name = parts[parts.length - 1]!;
  const dirs = parts.slice(0, -1);
  // Sensível vence ruído: entra na contagem que o usuário precisa ver.
  if (dirs.some((d) => SENSITIVE_DIRS.has(d))) return "sensitive";
  if (!SENSITIVE_ALLOWED.some((p) => p.test(name)) && SENSITIVE_FILES.some((p) => p.test(name))) {
    return "sensitive";
  }
  if (dirs.some((d) => NOISE_DIRS.has(d))) return "noise";
  if (NOISE_FILES.some((p) => p.test(name))) return "noise";
  return null;
}

/** Diretórios que nem precisam ser percorridos quando o projeto não usa git. */
export function skipDirectory(name: string): boolean {
  return NOISE_DIRS.has(name) || SENSITIVE_DIRS.has(name);
}
