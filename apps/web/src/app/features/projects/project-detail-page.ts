import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { Project } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { StackChips } from "./stack-chips";

@Component({
  selector: "dt-project-detail-page",
  imports: [RouterLink, DatePipe, StackChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/projetos" class="text-sm text-muted hover:text-text">← Projetos</a>
    @if (error()) {
      <p class="mt-4 text-sm text-err" role="alert">{{ error() }}</p>
    }
    @if (project(); as p) {
      <header class="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold">{{ p.name }}</h1>
          <div class="font-mono text-xs break-all text-muted">{{ p.path }}</div>
        </div>
        <button type="button" class="btn" (click)="redetect(p.id)" [disabled]="busy()">
          Detectar stack novamente
        </button>
      </header>
      <section class="grid gap-3 md:grid-cols-2">
        <div class="card p-4">
          <h2 class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Stack detectada</h2>
          <dt-stack-chips [stack]="p.detectedStack" />
        </div>
        <div class="card p-4 text-sm">
          <h2 class="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Cadastro</h2>
          <div>Criado em {{ p.createdAt | date: "dd/MM/yyyy HH:mm" }}</div>
          <div class="text-muted">Atualizado em {{ p.updatedAt | date: "dd/MM/yyyy HH:mm" }}</div>
        </div>
        <div class="card p-4 text-sm text-muted md:col-span-2">
          Terminal, agentes e conhecimento deste projeto ficam disponíveis a partir das fases 3, 5 e 7.
        </div>
      </section>
    }
  `,
})
export class ProjectDetailPage {
  private readonly api = inject(ApiService);
  readonly id = input.required<string>();
  protected readonly project = signal<Project | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => void this.load(this.id()));
  }

  private async load(id: string): Promise<void> {
    try {
      this.project.set(await firstValueFrom(this.api.project(id)));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }

  protected async redetect(id: string): Promise<void> {
    this.busy.set(true);
    try {
      this.project.set(await firstValueFrom(this.api.redetectProject(id)));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
