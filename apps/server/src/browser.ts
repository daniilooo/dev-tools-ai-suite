import { win32 } from "node:path";
import { runProcess } from "./core/process-runner.js";

/** Abre a URL no navegador padrão. Retorna false se não for possível (o usuário usa o código curto). */
export async function openBrowser(url: string): Promise<boolean> {
  const [command, args] = browserCommand(url);
  const result = await runProcess(command, args, { timeoutMs: 5_000 });
  return result.spawnError === null && !result.timedOut && result.exitCode === 0;
}

/**
 * Comando sem shell por plataforma. No Windows usa o manipulador de protocolos do sistema
 * (`rundll32 url.dll`), e não `cmd /c start`, que quebraria a URL em `&`.
 */
export function browserCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): [string, string[]] {
  if (platform === "darwin") return ["open", [url]];
  if (platform === "win32") {
    const system32 = win32.join(process.env.SystemRoot ?? "C:\\Windows", "System32");
    return [win32.join(system32, "rundll32.exe"), ["url.dll,FileProtocolHandler", url]];
  }
  return ["xdg-open", [url]];
}
