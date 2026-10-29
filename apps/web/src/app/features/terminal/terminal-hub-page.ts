import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import type { Project } from "@devtools/shared";
import { catchError, map, of } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";

/** Entrada do menu "Terminal": escolhe o projeto em que o terminal vai abrir. */
@Component({
  selector: "dt-terminal-hub-page",
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-1 text-xl font-semibold">Terminal</h1>
    <p class="mb-6 text-sm text-muted">O terminal abre no diretório do projeto escolhido.</p>
    @if (state(); as s) {
      @if (s.error) {
        <p class="text-sm text-err" role="alert">{{ s.error }}</p>
      } @else if (s.projects.length === 0) {
        <div class="card p-6 text-sm text-muted">
          Nenhum projeto cadastrado.
          <a routerLink="/projetos" class="text-accent hover:underline">Cadastre um projeto</a>
          para abrir um terminal.
        </div>
      } @else {
        <ul class="grid gap-2 md:grid-cols-2">
          @for (project of s.projects; track project.id) {
            <li>
              <a
                [routerLink]="['/projetos', project.id, 'terminal']"
                class="card flex items-center justify-between gap-3 p-4 hover:border-accent"
              >
                <span class="min-w-0">
                  <span class="block font-medium">{{ project.name }}</span>
                  <span class="block truncate font-mono text-xs text-muted">{{ project.path }}</span>
                </span>
                <span class="btn shrink-0">Abrir</span>
              </a>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class TerminalHubPage {
  protected readonly state = toSignal(
    inject(ApiService)
      .projects()
      .pipe(
        map((projects: Project[]) => ({ projects, error: null as string | null })),
        catchError((error: unknown) => of({ projects: [] as Project[], error: apiErrorMessage(error) })),
      ),
  );
}
