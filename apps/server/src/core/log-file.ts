import { createWriteStream, existsSync, renameSync, statSync } from "node:fs";
import type { WriteStream } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Abre `logs/server.log` (0600) para acrescentar. Na inicialização, se passou de 10 MiB,
 * vira `server.log.1` (substituindo o anterior): no máximo ~20 MiB de log no disco (TD-03).
 */
export function openLogFile(dir: string, maxBytes = MAX_BYTES): WriteStream {
  const file = join(dir, "server.log");
  if (existsSync(file) && statSync(file).size > maxBytes) renameSync(file, `${file}.1`);
  return createWriteStream(file, { flags: "a", mode: 0o600 });
}
