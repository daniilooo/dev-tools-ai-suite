import type { QuotaWindow } from "@devtools/shared";
import { barColor, formatClock, formatPercent, formatReset, shownPercent } from "./quota-format";

const window = (over: Partial<QuotaWindow> = {}): QuotaWindow => ({
  id: "five_hour",
  label: "Janela de 5 h",
  usedPercent: 42,
  limitReached: false,
  resetsAt: null,
  freshness: "fresh",
  category: "official",
  observedAt: "2026-10-28T11:00:00.000Z",
  source: { level: "B", description: "teste" },
  ...over,
});

describe("quota-format", () => {
  // Horários locais: o teste não depende do fuso da máquina.
  const now = new Date(2026, 9, 28, 11, 0).getTime();
  const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();

  it("descreve horários relativos ao dia", () => {
    expect(formatClock(local(28, 14), now)).toBe("hoje às 14:00");
    expect(formatClock(local(29, 9, 5), now)).toBe("amanhã às 09:05");
    expect(formatClock(local(27, 23), now)).toBe("ontem às 23:00");
    expect(formatClock(local(30, 18), now)).toBe("sex 30/10 às 18:00");
  });

  it("mostra a renovação e esconde percentual de janela já renovada", () => {
    expect(formatReset(window({ resetsAt: local(28, 13, 30) }), now)).toBe(
      "renova hoje às 13:30 (em 2 h 30 min)",
    );
    expect(formatReset(window({ resetsAt: local(28, 10) }), now)).toBe("renovou hoje às 10:00");
    expect(formatReset(window(), now)).toBe("renovação não informada");
    expect(shownPercent(window())).toBe(42);
    expect(shownPercent(window({ freshness: "reset" }))).toBeNull();
    expect(shownPercent(window({ usedPercent: null, limitReached: true }))).toBeNull();
  });

  it("formata percentuais e cores por faixa", () => {
    expect(formatPercent(42)).toBe("42%");
    expect(formatPercent(23.5)).toBe("23,5%");
    expect([barColor(10), barColor(75), barColor(95)]).toEqual(["bg-accent", "bg-warn", "bg-err"]);
  });
});
