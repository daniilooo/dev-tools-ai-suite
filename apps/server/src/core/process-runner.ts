import { spawn } from "node:child_process";

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  /** Limite de bytes capturados por stream. */
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
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

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
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

    const finish = (result: Omit<RunResult, "stdout" | "stderr" | "timedOut">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr, timedOut });
    };

    child.on("error", (error) => finish({ exitCode: null, signal: null, spawnError: error.message }));
    child.on("close", (exitCode, signal) => finish({ exitCode, signal, spawnError: null }));
  });
}

function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch {
    // processo já terminou
  }
}
