import { chmodSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DataDirLayout {
  root: string;
  secretFile: string;
  database: string;
  logs: string;
  indexes: string;
  backups: string;
}

/** Cria (se necessário) o diretório de dados com permissão 0700 e retorna o layout. */
export function ensureDataDir(root: string): DataDirLayout {
  const layout: DataDirLayout = {
    root,
    secretFile: join(root, "secret"),
    database: join(root, "devtools.db"),
    logs: join(root, "logs"),
    indexes: join(root, "indexes"),
    backups: join(root, "backups"),
  };
  for (const dir of [layout.root, layout.logs, layout.indexes, layout.backups]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  restrictPermissions(root, 0o700);
  return layout;
}

/** Garante que apenas o usuário atual acesse o caminho (sem efeito no Windows). */
export function restrictPermissions(path: string, mode: number): boolean {
  if (process.platform === "win32") return false;
  const current = statSync(path).mode & 0o777;
  if ((current & ~mode) !== 0) {
    chmodSync(path, mode);
    return true;
  }
  return false;
}

export function permissionsOf(path: string): number {
  return statSync(path).mode & 0o777;
}
