import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import type { QuotaWindow } from "@devtools/shared";
import {
  barColor,
  CATEGORY_LABEL,
  formatClock,
  formatPercent,
  formatReset,
  FRESHNESS_HINT,
  FRESHNESS_LABEL,
  shownPercent,
} from "./quota-format";
import { QuotaStore } from "./quota-store";

/** AI Quota Monitor (SUG02): limites de uso como o provedor informou, com fonte e frescor. */
@Component({
  selector: "dt-quota-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Cotas</h1>
        <p class="max-w-3xl text-sm text-muted">
          Limites de uso do Claude Code e do Codex, exatamente como cada provedor informou. A suíte não
          calcula nem estima: sem leitura, mostra INDISPONÍVEL e o motivo.
        </p>
      </div>
      <span class="flex items-center gap-1.5 text-xs text-muted">
        <span class="size-1.5 rounded-full" [class]="store.connected() ? 'bg-ok' : 'bg-warn'"></span>
        {{ store.connected() ? "atualização ao vivo" : "sem conexão ao vivo — recarregue para atualizar" }}
      </span>
    </header>

    @if (store.error()) {
      <p class="mb-4 text-sm text-err" role="alert">{{ store.error() }}</p>
    }

    @if (store.quota(); as quota) {
      <div class="grid gap-4 lg:grid-cols-2">
        @for (provider of quota.providers; track provider.providerId) {
          <article
            class="card flex flex-col p-4"
            [attr.aria-label]="provider.label"
            data-testid="quota-provider"
          >
            <div class="mb-3 flex items-center gap-2">
              <h2 class="font-medium">{{ provider.label }}</h2>
              @if (provider.plan) {
                <span class="chip" title="Plano informado junto com os limites"
                  >plano {{ provider.plan }}</span
                >
              }
            </div>

            @if (provider.unavailableReason) {
              <p class="font-mono text-sm font-semibold text-muted">INDISPONÍVEL</p>
              <p class="mt-1 text-sm text-muted">{{ provider.unavailableReason }}</p>
            } @else {
              <ul class="space-y-4">
                @for (w of provider.windows; track w.id) {
                  <li data-testid="quota-window" [attr.aria-label]="w.label">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-sm">{{ w.label }}</span>
                      <span
                        class="text-sm font-semibold"
                        [class.text-err]="w.limitReached && w.freshness !== 'reset'"
                      >
                        {{ valueText(w) }}
                      </span>
                    </div>
                    @if (shown(w); as percent) {
                      <div
                        class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
                        role="progressbar"
                        [attr.aria-valuenow]="percent"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        [attr.aria-label]="w.label + ': ' + formatPercent(percent) + ' usado'"
                      >
                        <div
                          class="h-full rounded-full"
                          [class]="barColor(percent)"
                          [style.width.%]="percent"
                        ></div>
                      </div>
                    } @else if (shown(w) === 0) {
                      <div class="mt-1.5 h-2 rounded-full bg-surface-2"></div>
                    }
                    <p class="mt-1 text-xs text-muted">{{ reset(w) }}</p>
                    <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span
                        class="chip gap-1.5"
                        [title]="freshnessHint[w.freshness]"
                        data-testid="quota-freshness"
                      >
                        <span class="size-1.5 rounded-full" [class]="freshnessDot(w)"></span>
                        {{ freshnessLabel[w.freshness] }}
                      </span>
                      <span class="chip" title="Valor informado pelo provedor">{{
                        categoryLabel[w.category]
                      }}</span>
                      <span>medido {{ clock(w.observedAt) }}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted">
                      Fonte: nível {{ w.source.level }} — {{ w.source.description }}
                    </p>
                  </li>
                }
              </ul>
            }

            @for (note of provider.notes; track note) {
              <p class="mt-4 border-t border-border pt-3 text-xs text-muted">{{ note }}</p>
            }
          </article>
        }
      </div>
      <p class="mt-4 text-xs text-muted">Lido pela suíte {{ clock(quota.generatedAt) }}.</p>
    } @else if (!store.error()) {
      <p class="text-sm text-muted">Carregando…</p>
    }
  `,
})
export class QuotaPage {
  protected readonly store = inject(QuotaStore);
  private readonly now = signal(Date.now());

  protected readonly freshnessLabel = FRESHNESS_LABEL;
  protected readonly freshnessHint = FRESHNESS_HINT;
  protected readonly categoryLabel = CATEGORY_LABEL;
  protected readonly barColor = barColor;
  protected readonly formatPercent = formatPercent;
  protected readonly shown = shownPercent;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.store.connect());
    // "em X min" avança sem novas leituras.
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    destroyRef.onDestroy(() => clearInterval(clock));
  }

  protected valueText(w: QuotaWindow): string {
    if (w.freshness === "reset") return "renovada";
    if (w.usedPercent === null) return w.limitReached ? "limite atingido" : "—";
    return `${formatPercent(w.usedPercent)} usado`;
  }

  protected reset(w: QuotaWindow): string {
    return formatReset(w, this.now());
  }

  protected clock(iso: string): string {
    return formatClock(iso, this.now());
  }

  protected freshnessDot(w: QuotaWindow): string {
    return w.freshness === "fresh" ? "bg-ok" : w.freshness === "stale" ? "bg-warn" : "bg-muted";
  }
}
