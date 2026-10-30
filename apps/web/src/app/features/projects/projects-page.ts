import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { Project } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { StackChips } from "./stack-chips";

@Component({
  selector: "dt-projects-page",
  imports: [RouterLink, StackChips],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-xl font-semibold">Projetos</h1>
      <p class="text-sm text-muted">
        Cadastre diretórios locais. A suíte apenas lê manifestos para detectar a stack; nenhum arquivo do
        projeto é alterado.
      </p>
    </header>

    <!-- Signals com [value]/(input), não ngModel: o valor inicial assíncrono do ngModel apagava o que era
         digitado logo após a navegação. -->
    <form
      class="card mb-6 grid gap-3 p-4 md:grid-cols-[2fr_1fr_auto] md:items-end"
      (submit)="$event.preventDefault(); add()"
    >
      <div>
        <label class="text-sm font-medium" for="path">Caminho absoluto</label>
        <input
          id="path"
          name="path"
          class="input mt-1 font-mono"
          placeholder="/home/voce/projetos/app"
          [value]="path()"
          (input)="path.set($any($event.target).value)"
          required
        />
      </div>
      <div>
        <label class="text-sm font-medium" for="name">Nome (opcional)</label>
        <input
          id="name"
          name="name"
          class="input mt-1"
          placeholder="Nome da pasta"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
      </div>
      <button type="submit" class="btn btn-primary justify-center" [disabled]="busy() || !path().trim()">
        Adicionar projeto
      </button>
      @if (error()) {
        <p class="text-sm text-err md:col-span-3" role="alert">{{ error() }}</p>
      }
    </form>

    @if (loading()) {
      <p class="text-sm text-muted">Carregando…</p>
    } @else if (projects().length === 0) {
      <div class="card p-8 text-center text-sm text-muted">Nenhum projeto cadastrado ainda.</div>
    } @else {
      <ul class="grid gap-3" aria-label="Projetos cadastrados">
        @for (project of projects(); track project.id) {
          <li class="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div class="min-w-0 flex-1">
              <a [routerLink]="['/projetos', project.id]" class="font-medium hover:text-accent">{{
                project.name
              }}</a>
              <div class="truncate font-mono text-xs text-muted" [title]="project.path">
                {{ project.path }}
              </div>
              <dt-stack-chips class="mt-2" [stack]="project.detectedStack" />
            </div>
            @if (confirming() === project.id) {
              <div class="flex items-center gap-2 text-sm">
                <span class="text-muted">Remover apenas o cadastro?</span>
                <button type="button" class="btn btn-danger" (click)="remove(project)">Remover</button>
                <button type="button" class="btn" (click)="confirming.set(null)">Cancelar</button>
              </div>
            } @else {
              <button
                type="button"
                class="btn"
                (click)="confirming.set(project.id)"
                [attr.aria-label]="'Remover ' + project.name"
              >
                Remover
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class ProjectsPage {
  private readonly api = inject(ApiService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirming = signal<string | null>(null);
  protected readonly path = signal("");
  protected readonly name = signal("");

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.projects.set(await firstValueFrom(this.api.projects()));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.createProject({ path: this.path().trim(), name: this.name().trim() || undefined }),
      );
      this.path.set("");
      this.name.set("");
      await this.load();
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(project: Project): Promise<void> {
    this.confirming.set(null);
    try {
      await firstValueFrom(this.api.deleteProject(project.id));
      await this.load();
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }
}
