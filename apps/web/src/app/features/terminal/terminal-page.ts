import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import type { LaunchableProviderId, Project, ProviderInfo, TerminalSession } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { TerminalView } from "./terminal-view";
import type { ConnectionState } from "./terminal-view";

interface Tab {
  session: TerminalSession;
  connection: ConnectionState;
}

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: "conectando",
  open: "conectado",
  reconnecting: "reconectando",
  exited: "encerrado",
  closed: "fechado",
};

/** Abas de terminal de um projeto. A aba ativa fica na URL (`?t=`) e sobrevive ao recarregar. */
@Component({
  selector: "dt-terminal-page",
  imports: [RouterLink, TerminalView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "flex h-[calc(100dvh-3rem)] min-h-96 flex-col md:h-[calc(100dvh-3rem)]" },
  template: `
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <a [routerLink]="['/projetos', id()]" class="text-sm text-muted hover:text-text">
          ← {{ project()?.name ?? "Projeto" }}
        </a>
        <div class="truncate font-mono text-xs text-muted">{{ project()?.path }}</div>
      </div>
    </div>

    @if (error()) {
      <p class="mb-2 text-sm text-err" role="alert">{{ error() }}</p>
    }

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div
        class="flex items-stretch overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Terminais"
      >
        @for (tab of tabs(); track tab.session.id) {
          <div
            class="group flex shrink-0 items-center border-r border-border"
            [class.bg-bg]="tab.session.id === activeId()"
          >
            <button
              type="button"
              role="tab"
              class="flex items-center gap-2 py-2 pr-1 pl-3 text-sm"
              [class.text-text]="tab.session.id === activeId()"
              [class.text-muted]="tab.session.id !== activeId()"
              [attr.aria-selected]="tab.session.id === activeId()"
              [title]="tab.session.title + ' — ' + stateLabel[tab.connection]"
              (click)="select(tab.session.id)"
            >
              <span
                class="size-2 rounded-full"
                [class.bg-ok]="tab.connection === 'open'"
                [class.bg-warn]="tab.connection === 'connecting' || tab.connection === 'reconnecting'"
                [class.bg-muted]="tab.connection === 'exited' || tab.connection === 'closed'"
                aria-hidden="true"
              ></span>
              {{ tab.session.title }}
            </button>
            <button
              type="button"
              class="mr-1 rounded px-1.5 text-muted hover:bg-surface-2 hover:text-text"
              [attr.aria-label]="'Fechar ' + tab.session.title"
              (click)="close(tab.session.id)"
            >
              ×
            </button>
          </div>
        }
        <button
          type="button"
          class="shrink-0 px-3 text-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
          (click)="create()"
          [disabled]="busy()"
          aria-label="Novo terminal"
          title="Novo terminal"
        >
          + Novo
        </button>
        @for (p of launchers(); track p.id) {
          <button
            type="button"
            class="shrink-0 px-3 text-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
            (click)="create(p.id)"
            [disabled]="busy()"
            [attr.aria-label]="'Abrir ' + p.label + ' neste projeto'"
            [title]="'Abrir ' + p.label + ' no diretório do projeto'"
          >
            + {{ shortName[p.id] }}
          </button>
        }
      </div>

      <div class="relative min-h-0 flex-1 bg-bg p-2">
        @for (tab of tabs(); track tab.session.id) {
          <div class="absolute inset-2" [class.invisible]="tab.session.id !== activeId()" role="tabpanel">
            <dt-terminal-view
              [sessionId]="tab.session.id"
              [active]="tab.session.id === activeId()"
              (connection)="setConnection(tab.session.id, $event)"
            />
          </div>
        } @empty {
          @if (loaded()) {
            <div class="grid h-full place-items-center text-center text-sm text-muted">
              <div>
                <p class="mb-3">Nenhum terminal aberto neste projeto.</p>
                <button type="button" class="btn btn-primary" (click)="create()" [disabled]="busy()">
                  Abrir terminal
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class TerminalPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  /** Aba ativa vinda da URL. */
  readonly t = input<string | undefined>();
  /** Provedor a abrir ao entrar na página (`?abrir=claude-code`), vindo do detalhe do projeto. */
  readonly abrir = input<string | undefined>();

  protected readonly project = signal<Project | null>(null);
  protected readonly tabs = signal<Tab[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly stateLabel = STATE_LABEL;
  /** Provedores instalados que podem ser abertos no terminal. */
  protected readonly launchers = signal<(ProviderInfo & { id: LaunchableProviderId })[]>([]);
  protected readonly shortName: Record<string, string> = { "claude-code": "Claude", codex: "Codex" };

  protected readonly activeId = computed(() => {
    const tabs = this.tabs();
    const wanted = this.t();
    return tabs.find((tab) => tab.session.id === wanted)?.session.id ?? tabs.at(-1)?.session.id ?? null;
  });

  constructor() {
    effect(() => void this.load(this.id()));
  }

  private async load(projectId: string): Promise<void> {
    try {
      const [project, sessions] = await Promise.all([
        firstValueFrom(this.api.project(projectId)),
        firstValueFrom(this.api.terminals(projectId)),
      ]);
      this.project.set(project);
      this.tabs.set(sessions.map((session) => ({ session, connection: "connecting" })));
      this.loaded.set(true);
      void this.loadLaunchers();
      const launch = this.abrir();
      if (launch === "claude-code" || launch === "codex") await this.create(launch);
      // Primeiro acesso: abre um terminal automaticamente.
      else if (sessions.length === 0) await this.create();
    } catch (error) {
      this.error.set(apiErrorMessage(error));
      this.loaded.set(true);
    }
  }

  private async loadLaunchers(): Promise<void> {
    try {
      const { providers } = await firstValueFrom(this.api.providers());
      this.launchers.set(providers.filter(isLaunchable));
    } catch {
      // sem a lista, só o terminal comum fica disponível
    }
  }

  protected select(id: string): void {
    // Remove `abrir` da URL: recarregar a página não deve abrir outro provedor.
    void this.router.navigate([], { queryParams: { t: id, abrir: null }, replaceUrl: true });
  }

  protected async create(launch?: LaunchableProviderId): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const session = await firstValueFrom(
        this.api.createTerminal(this.id(), { cols: 120, rows: 32, launch }),
      );
      this.tabs.update((tabs) => [...tabs, { session, connection: "connecting" }]);
      this.select(session.id);
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async close(id: string): Promise<void> {
    const tab = this.tabs().find((t) => t.session.id === id);
    if (tab && tab.connection === "open" && !confirmClose(tab.session.title)) return;
    try {
      await firstValueFrom(this.api.closeTerminal(id));
    } catch {
      // já encerrado no servidor: só remove a aba
    }
    this.tabs.update((tabs) => tabs.filter((t) => t.session.id !== id));
    if (this.activeId() !== this.t()) {
      const next = this.activeId();
      void this.router.navigate([], { queryParams: { t: next }, replaceUrl: true });
    }
  }

  protected setConnection(id: string, connection: ConnectionState): void {
    this.tabs.update((tabs) => tabs.map((t) => (t.session.id === id ? { ...t, connection } : t)));
  }
}

/** Fechar uma aba mata os processos dela: pede confirmação. */
function confirmClose(title: string): boolean {
  return window.confirm(`Encerrar ${title}? Os processos em execução nele serão finalizados.`);
}

function isLaunchable(provider: ProviderInfo): provider is ProviderInfo & { id: LaunchableProviderId } {
  return (
    provider.installed && provider.launchable && (provider.id === "claude-code" || provider.id === "codex")
  );
}
