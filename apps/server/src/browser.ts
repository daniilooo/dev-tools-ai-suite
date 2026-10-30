import { runProcess } from "./core/process-runner.js";

/** Abre a URL no navegador padrão. Retorna false se não for possível (o usuário usa o código curto). */
export async function openBrowser(url: string): Promise<boolean> {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", '""', url]]
        : ["xdg-open", [url]];
  const result = await runProcess(command, args, { timeoutMs: 5_000 });
  return result.spawnError === null && !result.timedOut && result.exitCode === 0;
}
