/**
 * Interface mínima de PTY (ADR-0012): isola a biblioteca nativa do resto do módulo.
 * Backend principal `@lydell/node-pty` (binários prontos, versão exata); fallback
 * para `node-pty` oficial, se estiver instalado e o binário pré-compilado não carregar.
 */
export interface PtyProcess {
  readonly pid: number;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
}

export interface PtySpawnOptions {
  cwd: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
}

export interface PtyBackend {
  readonly name: string;
  spawn(file: string, args: string[], options: PtySpawnOptions): PtyProcess;
}

export interface PtyBackendStatus {
  backend: PtyBackend | null;
  /** Motivo da falha ao carregar, quando nenhum backend está disponível. */
  error: string | null;
}

interface NodePtyModule {
  spawn(
    file: string,
    args: string[],
    options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> },
  ): PtyProcess;
}

const CANDIDATES = ["@lydell/node-pty", "node-pty"] as const;

export async function loadPtyBackend(): Promise<PtyBackendStatus> {
  const errors: string[] = [];
  for (const name of CANDIDATES) {
    try {
      const imported = (await import(name)) as { default?: NodePtyModule } & NodePtyModule;
      const module = imported.default ?? imported;
      return {
        backend: {
          name,
          spawn: (file, args, options) =>
            module.spawn(file, args, { name: options.env.TERM ?? "xterm-256color", ...options }),
        },
        error: null,
      };
    } catch (error) {
      errors.push(`${name}: ${(error as Error).message.split("\n")[0]}`);
    }
  }
  return { backend: null, error: errors.join("; ") };
}
