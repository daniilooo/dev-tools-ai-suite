import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

interface ProcInfo {
  pid: number;
  ppid: number;
  /** ID de sessão POSIX (só no Linux; null nos demais). */
  sid: number | null;
}

/**
 * Processos que pertencem à árvore de `rootPid`, sem incluir o próprio:
 * descendentes diretos e, no Linux, todo processo da mesma sessão POSIX
 * (o PTY cria uma sessão nova; filhos órfãos continuam nela mesmo após o shell sair).
 */
export function treeMembers(rootPid: number): number[] {
  const processes = process.platform === "linux" ? fromProc() : fromPs();
  const children = new Map<number, number[]>();
  for (const { pid, ppid } of processes) {
    const list = children.get(ppid) ?? [];
    list.push(pid);
    children.set(ppid, list);
  }
  const result = new Set<number>();
  for (const { pid, sid } of processes) {
    if (sid === rootPid && pid !== rootPid) result.add(pid);
  }
  const queue = [rootPid, ...result];
  while (queue.length > 0) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return [...result];
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Encerra o processo e toda a sua árvore: SIGHUP (como ao fechar um terminal) e
 * SIGKILL nos sobreviventes após `graceMs`. Processos que se desligaram de propósito
 * (`setsid`, daemons) não são alcançados — decisão do usuário.
 */
export function killProcessTree(
  rootPid: number,
  { graceMs = 1500, includeRoot = true }: { graceMs?: number; includeRoot?: boolean } = {},
): Promise<void> {
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(rootPid), "/T", "/F"], { windowsHide: true });
    return Promise.resolve();
  }
  // Sem a raiz quando ela já saiu: o PID pode ter sido reutilizado por outro processo.
  const pids = includeRoot ? [rootPid, ...treeMembers(rootPid)] : treeMembers(rootPid);
  signalAll(pids, "SIGHUP");
  return new Promise((resolve) => {
    const deadline = Date.now() + graceMs;
    const check = () => {
      const alive = pids.filter(isAlive);
      if (alive.length === 0) return resolve();
      if (Date.now() >= deadline) {
        signalAll(alive, "SIGKILL");
        return resolve();
      }
      setTimeout(check, 50);
    };
    check();
  });
}

function signalAll(pids: number[], signal: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // já terminou
    }
  }
}

function fromProc(): ProcInfo[] {
  const result: ProcInfo[] = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      // O nome (campo 2) pode ter espaços e parênteses: os campos seguintes vêm após o último ")".
      // Depois dele: estado, ppid, pgrp, sessão.
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      result.push({ pid: Number(entry), ppid: Number(fields[1]), sid: Number(fields[3]) });
    } catch {
      // processo terminou durante a leitura
    }
  }
  return result;
}

function fromPs(): ProcInfo[] {
  const output = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" }).stdout ?? "";
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([pid, ppid]) => !!pid && ppid !== undefined)
    .map(([pid, ppid]) => ({ pid: pid!, ppid: ppid!, sid: null }));
}
