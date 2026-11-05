import { statSync } from "node:fs";
import { delimiter, extname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * Diferenças de plataforma concentradas num só lugar (ADR-0015). O Windows é suportado
 * nativamente (x64): executáveis resolvidos pelo PATH/PATHEXT, shims `.cmd` do npm,
 * PowerShell nos terminais e caminhos sem distinção de maiúsculas.
 */
export const IS_WINDOWS = process.platform === "win32";

/** Extensões executáveis quando PATHEXT não está definido (padrão do Windows). */
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** Valor de uma variável de ambiente; no Windows o nome não distingue maiúsculas (`Path`). */
export function envValue(
  env: NodeJS.ProcessEnv,
  name: string,
  platformIsWindows = IS_WINDOWS,
): string | undefined {
  if (!platformIsWindows) return env[name];
  const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
  return key === undefined ? undefined : env[key];
}

/**
 * Caminho absoluto do executável que o sistema rodaria para `command`, ou null.
 * No Windows procura no PATH com as extensões do PATHEXT, na ordem (`.exe` antes de `.cmd`),
 * e ignora scripts `.ps1` (bloqueados pela política de execução padrão). Nos demais
 * sistemas devolve o próprio nome: quem resolve é o `spawn`, como sempre.
 */
export function findExecutable(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  platformIsWindows = IS_WINDOWS,
): string | null {
  if (!platformIsWindows) return command;
  const extensions = (envValue(env, "PATHEXT", true) ?? DEFAULT_PATHEXT)
    .split(";")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.startsWith(".") && e !== ".ps1");
  const candidates = (base: string) =>
    extname(base) && extensions.includes(extname(base).toLowerCase())
      ? [base]
      : extensions.map((ext) => base + ext);
  if (isAbsolute(command) || /[\\/]/.test(command)) {
    return candidates(resolve(command)).find(isFile) ?? null;
  }
  for (const dir of (envValue(env, "PATH", true) ?? "").split(delimiter)) {
    if (!dir) continue;
    const found = candidates(join(dir.replace(/^"(.*)"$/, "$1"), command)).find(isFile);
    if (found) return found;
  }
  return null;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Shims do npm e scripts de lote: no Windows só rodam por meio do `cmd.exe`. */
export function isBatchFile(path: string): boolean {
  return /\.(cmd|bat)$/i.test(path);
}

/**
 * Caracteres que o `cmd.exe` interpreta mesmo entre aspas (expansão de variáveis, escapes,
 * redirecionamento). Argumentos com eles nunca são repassados a um `.cmd` (sem injeção).
 */
const CMD_UNSAFE = /["%!^&|<>\r\n]/;

/**
 * Linha de comando para executar um `.cmd`/`.bat` com argumentos fixos via
 * `cmd.exe /d /s /c "<linha>"` (com `windowsVerbatimArguments`). Recusa argumentos que o
 * cmd poderia interpretar; cada um vai entre aspas.
 */
export function batchCommandLine(file: string, args: readonly string[]): string {
  for (const value of [file, ...args]) {
    if (CMD_UNSAFE.test(value)) {
      throw new Error(`argumento recusado para script .cmd (caractere especial do cmd): ${value}`);
    }
  }
  return `"${[file, ...args].map((v) => `"${v}"`).join(" ")}"`;
}

/** Normaliza para comparação: no Windows, caminhos não distinguem maiúsculas nem `/` de `\`. */
function comparable(path: string, platformIsWindows: boolean): string {
  return platformIsWindows ? path.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase() : path;
}

export function samePath(a: string, b: string, platformIsWindows = IS_WINDOWS): boolean {
  return comparable(a, platformIsWindows) === comparable(b, platformIsWindows);
}

/** `child` é `parent` ou está dentro dele? */
export function isPathWithin(child: string, parent: string, platformIsWindows = IS_WINDOWS): boolean {
  const c = comparable(child, platformIsWindows);
  const p = comparable(parent, platformIsWindows);
  const separator = platformIsWindows ? "\\" : "/";
  return c === p || c.startsWith(p.endsWith(separator) ? p : p + separator);
}

/** Um caminho relativo (de `path.relative`) aponta para fora da base? Inclui outro drive no Windows. */
export function escapesBase(rel: string): boolean {
  return rel === ".." || rel.startsWith(".." + "/") || rel.startsWith("..\\") || isAbsolute(rel);
}

/** Relativo de `base` até `path` com `/`, ou null se estiver fora da base. */
export function relativeInside(base: string, path: string): string | null {
  const rel = relative(base, path);
  return escapesBase(rel) ? null : rel.split(/[\\/]/).join("/");
}

/**
 * Argumento para digitar no shell dos terminais da suíte: aspas simples POSIX ou, no
 * Windows, do PowerShell (onde `'` se escapa como `''`). O shell é escolhido pela suíte
 * (`defaultShell`), então a regra de aspas é conhecida.
 */
export function quoteForTerminal(value: string, platformIsWindows = IS_WINDOWS): string {
  // O PowerShell também aceita as aspas tipográficas como aspas simples.
  return platformIsWindows ? `'${value.replace(/['‘’‚‛]/g, "$&$&")}'` : `'${value.replace(/'/g, `'\\''`)}'`;
}
