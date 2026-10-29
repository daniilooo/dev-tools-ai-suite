import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { ProviderQuota } from "@devtools/shared";
import { barColor, formatPercent, shownPercent } from "./quota-format";
import { QuotaStore } from "./quota-store";

interface SummaryRow {
  id: string;
  label: string;
  text: string;
  percent: number | null;
  title: string;
}

/** Resumo compacto das cotas na barra lateral: a janela mais usada de cada provedor. */
@Component({
  selector: "dt-quota-summary",
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/cotas"
      class="block rounded-md px-3 py-2 hover:bg-surface-2"
      aria-label="Resumo das cotas"
      data-testid="quota-summary"
    >
      @for (row of rows(); track row.id) {
        <div class="py-1" [title]="row.title">
          <div class="flex items-baseline justify-between gap-2 text-xs">
            <span class="text-muted">{{ row.label }}</span>
            <span class="font-mono" [class.text-muted]="row.percent === null">{{ row.text }}</span>
          </div>
          @if (row.percent !== null) {
            <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                class="h-full rounded-full"
                [class]="color(row.percent)"
                [style.width.%]="row.percent"
              ></div>
            </div>
          }
        </div>
      }
    </a>
  `,
})
export class QuotaSummary {
  private readonly store = inject(QuotaStore);
  protected readonly color = barColor;

  protected readonly rows = computed<SummaryRow[]>(() =>
    (this.store.quota()?.providers ?? []).map((p) => summarize(p)),
  );

  constructor() {
    inject(DestroyRef).onDestroy(this.store.connect());
  }
}

function summarize(provider: ProviderQuota): SummaryRow {
  const base = { id: provider.providerId, label: provider.label };
  if (provider.unavailableReason) {
    return { ...base, text: "INDISPONÍVEL", percent: null, title: provider.unavailableReason };
  }
  const reached = provider.windows.find((w) => w.limitReached && w.freshness !== "reset");
  if (reached)
    return { ...base, text: "limite atingido", percent: 100, title: `${reached.label}: limite atingido` };
  const measured = provider.windows
    .map((w) => ({ w, percent: shownPercent(w) }))
    .filter((x): x is { w: (typeof provider.windows)[number]; percent: number } => x.percent !== null)
    .sort((a, b) => b.percent - a.percent)[0];
  if (!measured)
    return { ...base, text: "renovada", percent: null, title: "Janelas renovadas desde a última medida" };
  return {
    ...base,
    text: formatPercent(Math.round(measured.percent)),
    percent: measured.percent,
    title: `${measured.w.label}: ${formatPercent(measured.percent)} usado`,
  };
}
