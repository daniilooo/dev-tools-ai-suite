import { spawn } from "node:child_process";
import { batchCommandLine, envValue, findExecutable, IS_WINDOWS, isBatchFile } from "./platform.js";

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  /** Limite de bytes capturados por stream. */
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
  /** Cancela a execução encerrando toda a árvore de processos. */
  signal?: AbortSignal;
}

export interface RunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Erro de inicialização (ex.: executável inexistente). */
  spawnError: string | null;
}

/**
 * Executa processos externos com segurança: argumentos em array (sem shell),
 * timeout, encerramento de toda a árvore de processos e saída limitada.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const { timeoutMs = 10_000, maxOutputBytes = 64 * 1024 } = options;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const env = options.env ?? process.env;
    let target: { file: string; args: readonly string[]; verbatim: boolean };
    try {
      target = resolveTarget(command, args, env);
    } catch (error) {
      resolve({
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        spawnError: (error as Error).message,
      });
      return;
    }

    const child = spawn(target.file, target.args, {
      cwd: options.cwd,
      env,
      shell: false,
      detached: !IS_WINDOWS,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: target.verbatim,
    });

    const append = (current: string, chunk: Buffer) =>
      current.length >= maxOutputBytes
        ? current
        : (current + chunk.toString("utf8")).slice(0, maxOutputBytes);
    child.stdout.on("data", (chunk: Buffer) => (stdout = append(stdout, chunk)));
    child.stderr.on("data", (chunk: Buffer) => (stderr = append(stderr, chunk)));

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    const abort = () => killTree(child.pid);
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });

    const finish = (result: Omit<RunResult, "stdout" | "stderr" | "timedOut">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve({ ...result, stdout, stderr, timedOut });
    };

    child.on("error", (error) => finish({ exitCode: null, signal: null, spawnError: error.message }));
    child.on("close", (exitCode, signal) => finish({ exitCode, signal, spawnError: null }));
  });
}

/**
 * No Windows, resolve o executável pelo PATH/PATHEXT (o `spawn` sem shell não acha `.cmd`)
 * e roda shims `.cmd`/`.bat` do npm via `cmd.exe` com argumentos validados (ADR-0015).
 */
function resolveTarget(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): { file: string; args: readonly string[]; verbatim: boolean } {
  if (!IS_WINDOWS) return { file: command, args, verbatim: false };
  const file = findExecutable(command, env);
  if (!file) throw new Error(`spawn ${command} ENOENT`);
  if (!isBatchFile(file)) return { file, args, verbatim: false };
  const comspec = envValue(env, "ComSpec") ?? process.env.ComSpec ?? "cmd.exe";
  return { file: comspec, args: ["/d", "/s", "/c", batchCommandLine(file, args)], verbatim: true };
}

function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    if (IS_WINDOWS) {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch {
    // processo já terminou
  }
}
