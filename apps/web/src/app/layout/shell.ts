import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { catchError, of } from "rxjs";
import { ApiService } from "../core/api.service";
import { AuthService } from "../core/auth.service";
import { ThemeService } from "../core/theme.service";

interface NavItem {
  label: string;
  route?: string;
  phase?: string;
}

@Component({
  selector: "dt-shell",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-full flex-col md:flex-row">
      <aside
        class="flex shrink-0 flex-col border-b border-border bg-surface md:w-60 md:border-r md:border-b-0"
      >
        <div class="flex items-center gap-2 px-4 py-4">
          <span
            class="grid size-7 place-items-center rounded-md bg-accent font-mono text-xs font-bold text-accent-contrast"
            >DT</span
          >
          <div class="leading-tight">
            <div class="text-sm font-semibold">Dev Tools AI Suite</div>
            <div class="text-xs text-muted">v{{ health()?.version ?? "…" }}</div>
          </div>
        </div>
        <nav
          class="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-0"
          aria-label="Navegação principal"
        >
          @for (item of nav; track item.label) {
            @if (item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-surface-2 text-text"
                class="flex items-center justify-between rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted hover:bg-surface-2 hover:text-text"
                >{{ item.label }}</a
              >
            } @else {
              <span
                class="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted/60"
                [attr.aria-disabled]="true"
                [title]="'Disponível na ' + item.phase"
              >
                {{ item.label }} <span class="chip">{{ item.phase }}</span>
              </span>
            }
          }
        </nav>
        <div class="mt-auto flex gap-2 border-t border-border p-3">
          <button
            type="button"
            class="btn flex-1 justify-center"
            (click)="theme.toggle()"
            aria-label="Alternar tema"
          >
            {{ theme.theme() === "dark" ? "Tema claro" : "Tema escuro" }}
          </button>
          <button type="button" class="btn" (click)="logout()" aria-label="Encerrar sessão">Sair</button>
        </div>
      </aside>
      <main class="min-w-0 flex-1 px-4 py-6 md:px-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly health = toSignal(
    inject(ApiService)
      .health()
      .pipe(catchError(() => of(null))),
  );

  protected readonly nav: NavItem[] = [
    { label: "Projetos", route: "/projetos" },
    { label: "Terminal", route: "/terminal" },
    { label: "Provedores", route: "/provedores" },
    { label: "Agentes", route: "/agentes" },
    { label: "Cotas", phase: "Fase 6" },
    { label: "Conhecimento", phase: "Fase 7" },
    { label: "Diagnóstico", route: "/diagnostico" },
  ];

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl("/acesso");
  }
}
