#!/usr/bin/env node
/**
 * Status line das sessões do Claude Code abertas pela suíte (ADR-0014).
 *
 * O Claude Code executa este script a cada atualização e envia, pela entrada padrão,
 * o JSON documentado da status line. Daqui só sai o campo `rate_limits` (percentual
 * usado e renovação de cada janela), gravado em `<arquivo de saída>` no diretório de
 * dados da suíte. Modelo, caminhos, custo e transcrição são descartados.
 *
 * Arquivo autocontido (só `node:`): roda direto com `node`, inclusive em desenvolvimento.
 * Nunca falha de forma visível: em erro, imprime só o que conseguir.
 *
 * Uso: node statusline.js <arquivo de saída>
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const MAX_INPUT_BYTES = 1024 * 1024;

interface SavedWindow {
  usedPercent: number;
  resetsAt: string | null;
}

export interface StatusLineSnapshot {
  observedAt: string;
  version: string | null;
  rateLimits: Record<string, SavedWindow>;
}

/** Extrai só as janelas de limite (`used_percentage` numérico) da entrada da status line. */
export function extractRateLimits(input: unknown, now: Date): StatusLineSnapshot | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  const limits = record.rate_limits;
  if (typeof limits !== "object" || limits === null) return null;
  const rateLimits: Record<string, SavedWindow> = {};
  for (const [key, value] of Object.entries(limits as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,40}$/.test(key) || typeof value !== "object" || value === null) continue;
    const w = value as Record<string, unknown>;
    if (typeof w.used_percentage !== "number" || !Number.isFinite(w.used_percentage)) continue;
    rateLimits[key] = {
      usedPercent: Math.min(100, Math.max(0, w.used_percentage)),
      resetsAt: toIso(w.resets_at),
    };
  }
  if (Object.keys(rateLimits).length === 0) return null;
  return {
    observedAt: now.toISOString(),
    version: typeof record.version === "string" ? record.version.slice(0, 40) : null,
    rateLimits,
  };
}

/** `resets_at` em segundos Unix (documentado); aceita também milissegundos e ISO. */
function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

/** Linha exibida no rodapé do Claude Code. */
export function renderLine(input: unknown, snapshot: StatusLineSnapshot | null): string {
  const record = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const model = record.model as Record<string, unknown> | undefined;
  const parts: string[] = [];
  if (typeof model?.display_name === "string") parts.push(model.display_name.slice(0, 40));
  const labels: Record<string, string> = { five_hour: "5 h", seven_day: "semana" };
  for (const [key, window] of Object.entries(snapshot?.rateLimits ?? {})) {
    parts.push(`${labels[key] ?? key.replace(/_/g, " ")}: ${Math.round(window.usedPercent)}%`);
  }
  return parts.join(" · ");
}

function save(path: string, snapshot: StatusLineSnapshot): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // Várias sessões podem gravar ao mesmo tempo: escreve em temporário e renomeia.
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(snapshot), { mode: 0o600 });
  renameSync(temp, path);
}

async function main(): Promise<void> {
  const output = process.argv[2];
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += (chunk as Buffer).length;
    if (size > MAX_INPUT_BYTES) return;
    chunks.push(chunk as Buffer);
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return;
  }
  const snapshot = extractRateLimits(input, new Date());
  if (snapshot && output) {
    try {
      save(output, snapshot);
    } catch {
      // diretório de dados indisponível: a linha continua aparecendo
    }
  }
  process.stdout.write(renderLine(input, snapshot));
}

if (process.argv[1] && /statusline\.(js|ts)$/.test(process.argv[1])) void main();
