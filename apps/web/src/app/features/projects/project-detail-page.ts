import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { AgentRunDetail, Project, ProviderInfo } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { ServerEventsService } from "../../core/server-events.service";
import { isActive, PROVIDER_LABEL } from "../agents/agent-format";
import { AgentStateChip } from "../agents/agent-state-chip";
import { StackChips } from "./stack-chips";

@Component({
  selector: "dt-project-detail-page",
  imports: [RouterLink, DatePipe, StackChips, AgentStateChip],
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
        <div class="flex flex-wrap gap-2">
          <a [routerLink]="['/projetos', p.id, 'terminal']" class="btn btn-primary">Abrir terminal</a>
          @for (provider of launchers(); track provider.id) {
            <a
              [routerLink]="['/projetos', p.id, 'terminal']"
              [queryParams]="{ abrir: provider.id }"
              class="btn"
              >Abrir {{ provider.label }}</a
            >
          }
          <button type="button" class="btn" (click)="redetect(p.id)" [disabled]="busy()">
            Detectar stack novamente
          </button>
        </div>
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
        <div class="card p-4 text-sm md:col-span-2" aria-label="Agentes do projeto">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 class="text-xs font-semibold tracking-wide text-muted uppercase">Agentes</h2>
            <a routerLink="/agentes" [queryParams]="{ projeto: p.id }" class="text-accent hover:underline"
              >Ver agentes</a
            >
          </div>
          @if (agents(); as runs) {
            @if (runs.length === 0) {
              <p class="text-muted">Nenhuma sessão do Claude Code ou do Codex nos últimos 30 dias.</p>
            } @else {
              <p class="mb-2 text-muted">
                {{ runs.length }} {{ runs.length === 1 ? "sessão" : "sessões" }} · {{ activeAgents() }} em
                andamento
              </p>
              <ul class="space-y-1">
                @for (run of runs.slice(0, 3); track run.id) {
                  <li class="flex items-center justify-between gap-2">
                    <span class="min-w-0 truncate">
                      <span class="text-muted">{{ providerLabel[run.providerId] }} ·</span>
                      {{ run.title ?? "Sessão " + run.externalId.slice(0, 8) }}
                    </span>
                    <dt-agent-state-chip [state]="run.state" />
                  </li>
                }
              </ul>
            }
          } @else if (agentsUnavailable()) {
            <p class="text-muted">Agentes: INDISPONÍVEL (falha ao consultar o servidor).</p>
          } @else {
            <p class="text-muted">Carregando…</p>
          }
        </div>
        <div class="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm md:col-span-2">
          <span class="text-muted">Índice local do projeto para consultas com arquivo e linhas.</span>
          <a class="btn" routerLink="/conhecimento" [queryParams]="{ projeto: p.id }"
            >Consultar conhecimento</a
          >
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
  /** Provedores instalados que podem ser abertos no terminal do projeto. */
  protected readonly launchers = signal<ProviderInfo[]>([]);
  protected readonly agents = signal<AgentRunDetail[] | null>(null);
  protected readonly agentsUnavailable = signal(false);
  private agentsLoading = false;
  private agentsStale = false;
  protected readonly providerLabel = PROVIDER_LABEL;
  protected readonly activeAgents = () => (this.agents() ?? []).filter(isActive).length;

  constructor() {
    effect(() => void this.load(this.id()));
    firstValueFrom(this.api.providers())
      .then(({ providers }) => this.launchers.set(providers.filter((p) => p.installed && p.launchable)))
      .catch(() => undefined);
    // Sessões novas ou mudanças de estado deste projeto chegam pelo canal de eventos.
    const unsubscribe = inject(ServerEventsService).subscribe((event) => {
      if (event.type === "agent.run.state" && event.run.projectId === this.id())
        void this.loadAgents(this.id());
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  private async load(id: string): Promise<void> {
    try {
      this.project.set(await firstValueFrom(this.api.project(id)));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
      return;
    }
    await this.loadAgents(id);
  }

  /** Uma consulta por vez: eventos que chegam durante a consulta geram só mais uma, no fim. */
  private async loadAgents(id: string): Promise<void> {
    if (this.agentsLoading) {
      this.agentsStale = true;
      return;
    }
    this.agentsLoading = true;
    try {
      do {
        this.agentsStale = false;
        try {
          this.agents.set(await firstValueFrom(this.api.agentRuns(id)));
          this.agentsUnavailable.set(false);
        } catch {
          this.agentsUnavailable.set(true);
        }
      } while (this.agentsStale);
    } finally {
      this.agentsLoading = false;
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
