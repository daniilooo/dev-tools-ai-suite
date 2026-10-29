import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import type { DoctorReport, DoctorStatus, DoctorTool } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dt-doctor-page",
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Diagnóstico</h1>
        <p class="text-sm text-muted">Equivalente a <code class="font-mono">devtools doctor</code>.</p>
      </div>
      <button type="button" class="btn" (click)="load()" [disabled]="loading()">Atualizar</button>
    </header>
    @if (error()) {
      <p class="text-sm text-err" role="alert">{{ error() }}</p>
    }
    @if (report(); as r) {
      <section class="grid gap-6 lg:grid-cols-2">
        <div class="card">
          <h2 class="border-b border-border px-4 py-3 text-sm font-semibold">Verificações</h2>
          <ul>
            @for (check of r.checks; track check.id) {
              <li class="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <span
                  class="mt-1.5 size-2 shrink-0 rounded-full"
                  [class]="dot[check.status]"
                  [attr.aria-label]="label[check.status]"
                ></span>
                <div class="min-w-0 text-sm">
                  <div class="font-medium">{{ check.label }}</div>
                  <div class="font-mono text-xs break-all text-muted">{{ check.detail }}</div>
                  @if (check.hint) {
                    <div class="mt-1 text-xs text-warn">{{ check.hint }}</div>
                  }
                </div>
              </li>
            }
          </ul>
        </div>
        <div class="card">
          <h2 class="border-b border-border px-4 py-3 text-sm font-semibold">
            Ferramentas de IA e desenvolvimento
          </h2>
          <ul>
            @for (tool of r.tools; track tool.id) {
              <li class="flex items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
                <span
                  class="size-2 shrink-0 rounded-full"
                  [class]="tool.installed ? 'bg-ok' : tool.optional ? 'bg-muted' : 'bg-err'"
                ></span>
                <div class="flex-1">
                  <div class="font-medium">{{ tool.label }}</div>
                  <div class="text-xs text-muted">
                    {{
                      tool.installed
                        ? "v" + tool.version
                        : tool.optional
                          ? "não encontrado (opcional)"
                          : "não encontrado"
                    }}
                  </div>
                </div>
                @if (providers.has(tool.id)) {
                  <span
                    class="chip"
                    title="Verificação de autenticação por mecanismos documentados chega na Fase 4"
                  >
                    autenticação: INDISPONÍVEL
                  </span>
                }
              </li>
            }
          </ul>
        </div>
      </section>
      <p class="mt-4 text-xs text-muted">Gerado em {{ r.generatedAt | date: "dd/MM/yyyy HH:mm:ss" }}</p>
    }
  `,
})
export class DoctorPage {
  private readonly api = inject(ApiService);
  protected readonly report = signal<DoctorReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Provedores de IA com autenticação própria (verificada a partir da Fase 4). */
  protected readonly providers = new Set<DoctorTool["id"]>(["claude", "codex"]);
  protected readonly dot: Record<DoctorStatus, string> = {
    ok: "bg-ok",
    warning: "bg-warn",
    error: "bg-err",
    unavailable: "bg-muted",
  };
  protected readonly label: Record<DoctorStatus, string> = {
    ok: "OK",
    warning: "Atenção",
    error: "Erro",
    unavailable: "Indisponível",
  };

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.report.set(await firstValueFrom(this.api.doctor()));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
