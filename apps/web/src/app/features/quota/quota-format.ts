import type { QuotaFreshness, QuotaWindow } from "@devtools/shared";
import { formatDuration } from "../agents/agent-format";

export const FRESHNESS_LABEL: Record<QuotaFreshness, string> = {
  fresh: "atualizado",
  stale: "pode ter mudado",
  reset: "janela renovada",
};

export const FRESHNESS_HINT: Record<QuotaFreshness, string> = {
  fresh: "Medido nos últimos 15 minutos.",
  stale: "Medido há mais de 15 minutos: o uso pode ter mudado desde então.",
  reset:
    "A janela renovou depois da medida: o percentual medido não vale mais. O uso atual aparece na próxima leitura.",
};

export const CATEGORY_LABEL = {
  official: "oficial",
  calculated: "calculado",
  estimated: "estimado",
} as const;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Percentual mostrado só quando ainda vale (janela não renovou desde a medida). */
export function shownPercent(w: QuotaWindow): number | null {
  return w.freshness === "reset" ? null : w.usedPercent;
}

/** "hoje às 14:00", "amanhã às 09:00" ou "sex 01/11 às 18:00", no fuso do navegador. */
export function formatClock(iso: string, now: number): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((day(date) - day(new Date(now))) / 86_400_000);
  if (diffDays === 0) return `hoje às ${time}`;
  if (diffDays === 1) return `amanhã às ${time}`;
  if (diffDays === -1) return `ontem às ${time}`;
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${time}`;
}

/** Texto da renovação: "renova hoje às 14:00 (em 2 h 59 min)" ou "renovou hoje às 13:00". */
export function formatReset(w: QuotaWindow, now: number): string {
  if (!w.resetsAt) return "renovação não informada";
  const ms = Date.parse(w.resetsAt) - now;
  const clock = formatClock(w.resetsAt, now);
  return ms <= 0 ? `renovou ${clock}` : `renova ${clock} (em ${formatDuration(ms)})`;
}

/** Cor da barra conforme o uso. */
export function barColor(percent: number): string {
  if (percent >= 90) return "bg-err";
  if (percent >= 70) return "bg-warn";
  return "bg-accent";
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}%`;
}
