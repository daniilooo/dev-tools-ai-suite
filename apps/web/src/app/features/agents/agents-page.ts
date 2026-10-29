import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import type { AgentRun, AgentRunDetail, AgentRunState, Project, ServerEvent } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { ServerEventsService } from "../../core/server-events.service";
import {
  formatAgo,
  formatDuration,
  formatTokens,
  isActive,
  PROVIDER_LABEL,
  STATE_LABEL,
  toolTotal,
  topTools,
  totalTokens,
} from "./agent-format";
import { AgentStateChip } from "./agent-state-chip";

const STATE_ORDER: AgentRunState[] = ["running", "waiting", "detected", "failed", "unknown", "completed"];

/** Agent Monitor (SUG01): sessões e subagentes do projeto, com estado e telemetria observados. */
@Component({
  selector: "dt-agents-page",
  imports: [DatePipe, RouterLink, AgentStateChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Agentes</h1>
        <p class="text-sm text-muted">
          Sessões do Claude Code e do Codex neste projeto, lidas das transcrições locais. Só metadados: nenhum
          prompt, código ou resposta é guardado.
        </p>
      </div>
      @if (projects().length > 0) {
        <label class="flex items-center gap-2 text-sm">
          <span class="text-muted">Projeto</span>
          <select
            class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            [value]="selectedId() ?? ''"
            (change)="select($any($event.target).value)"
          >
            @for (p of projects(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
      }
    </header>

    @if (error()) {
      <p class="mb-4 text-sm text-err" role="alert">{{ error() }}</p>
    }

    @if (loaded() && projects().length === 0) {
      <div class="card p-6 text-sm text-muted">
        Nenhum projeto cadastrado.
        <a routerLink="/projetos" class="text-accent hover:underline">Cadastre um projeto</a>
        para acompanhar os agentes que rodam nele.
      </div>
    } @else if (runs(); as list) {
      <div class="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Resumo">
        @for (s of summary(); track s.state) {
          <span class="chip">{{ s.count }} {{ stateLabel[s.state] }}</span>
        }
        <span class="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <span class="size-1.5 rounded-full" [class]="events.connected() ? 'bg-ok' : 'bg-warn'"></span>
          {{ events.connected() ? "atualização ao vivo" : "sem conexão ao vivo — recarregue para atualizar" }}
        </span>
      </div>

      @if (list.length === 0) {
        <div class="card p-6 text-sm text-muted">
          Nenhuma sessão encontrada nos últimos 30 dias para este projeto. Abra o Claude Code ou o Codex no
          @if (selectedId(); as id) {
            <a [routerLink]="['/projetos', id, 'terminal']" class="text-accent hover:underline"
              >terminal do projeto</a
            >
          }
          e ela aparece aqui em poucos segundos.
        </div>
      }

      <ul class="space-y-3">
        @for (run of list; track run.id) {
          <li>
            <article class="card p-4" [attr.aria-label]="titleOf(run)">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="chip">{{ providerLabel[run.providerId] }}</span>
                    <h2 class="truncate font-medium" [class.text-muted]="!run.title">{{ titleOf(run) }}</h2>
                  </div>
                  <div class="mt-1 text-xs text-muted">
                    {{ run.model ?? "modelo desconhecido" }}
                    @if (run.providerVersion) {
                      · v{{ run.providerVersion }}
                    }
                    · iniciada {{ run.startedAt | date: "dd/MM HH:mm" }} · último evento
                    {{ ago(run.lastEventAt) }} · duração {{ duration(run) }}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  @if (run.terminalId) {
                    <a class="btn" [routerLink]="['/agentes', run.id, 'terminal']">Ver terminal</a>
                  }
                  <dt-agent-state-chip [state]="run.state" />
                </div>
              </div>

              @if (run.error) {
                <p class="mt-2 text-sm text-err">{{ run.error }}</p>
              }

              <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt class="text-xs text-muted" title="Somado dos registros do provedor (valor calculado)">
                    Tokens · calculado
                  </dt>
                  <dd>
                    @if (run.tokens; as t) {
                      {{ fmt(totalTokens(t)) }}
                      <span class="text-xs text-muted">
                        (entrada {{ fmt(t.input) }} · saída {{ fmt(t.output) }} · cache lido
                        {{ fmt(t.cacheRead) }} · cache gravado {{ fmt(t.cacheWrite) }})
                      </span>
                    } @else {
                      <span class="text-muted">INDISPONÍVEL</span>
                    }
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Ferramentas · {{ toolTotal(run.toolCalls) }} chamadas</dt>
                  <dd class="mt-0.5 flex flex-wrap gap-1">
                    @for (tool of topTools(run.toolCalls); track tool.name) {
                      <span class="chip font-mono">{{ tool.name }} {{ tool.count }}</span>
                    } @empty {
                      <span class="text-muted">nenhuma</span>
                    }
                  </dd>
                </div>
              </dl>

              @if (run.subagents.length > 0) {
                <details class="mt-3 border-t border-border pt-3" [open]="hasActive(run.subagents)">
                  <summary class="cursor-pointer text-sm">
                    {{ run.subagents.length }} {{ run.subagents.length === 1 ? "subagente" : "subagentes" }}
                    @if (activeCount(run.subagents); as n) {
                      <span class="text-muted">· {{ n }} em andamento</span>
                    }
                  </summary>
                  <ul class="mt-2 divide-y divide-border">
                    @for (sub of run.subagents; track sub.id) {
                      <li class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div class="min-w-0">
                          <div class="truncate">
                            @if (sub.agentType) {
                              <span class="font-mono text-xs text-accent">{{ sub.agentType }}</span>
                            }
                            {{ sub.title ?? "subagente" }}
                          </div>
                          <div class="text-xs text-muted">
                            {{ sub.model ?? "modelo desconhecido" }} · {{ duration(sub) }} ·
                            @if (sub.tokens; as t) {
                              {{ fmt(totalTokens(t)) }} tokens
                            } @else {
                              tokens INDISPONÍVEL
                            }
                            · {{ toolTotal(sub.toolCalls) }} ferramentas
                          </div>
                        </div>
                        <dt-agent-state-chip [state]="sub.state" />
                      </li>
                    }
                  </ul>
                </details>
              }

              <p class="mt-3 text-xs text-muted">
                Fonte: nível {{ run.source.level }} — {{ run.source.description }}
              </p>
            </article>
          </li>
        }
      </ul>
    }
  `,
})
export class AgentsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly events = inject(ServerEventsService);

  /** Projeto escolhido (`?projeto=<id>`). */
  readonly projeto = input<string | undefined>();

  protected readonly projects = signal<Project[]>([]);
  protected readonly loaded = signal(false);
  protected readonly runs = signal<AgentRunDetail[] | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly now = signal(Date.now());

  protected readonly selectedId = computed(() => {
    const list = this.projects();
    const wanted = this.projeto();
    return list.find((p) => p.id === wanted)?.id ?? list[0]?.id ?? null;
  });

  protected readonly summary = computed(() => {
    const counts = new Map<AgentRunState, number>();
    for (const run of this.runs() ?? []) counts.set(run.state, (counts.get(run.state) ?? 0) + 1);
    return STATE_ORDER.filter((s) => counts.has(s)).map((state) => ({ state, count: counts.get(state)! }));
  });

  protected readonly providerLabel = PROVIDER_LABEL;
  protected readonly stateLabel = STATE_LABEL;
  protected readonly fmt = formatTokens;
  protected readonly totalTokens = totalTokens;
  protected readonly toolTotal = toolTotal;
  protected readonly topTools = topTools;

  constructor() {
    void this.loadProjects();
    effect(() => {
      const id = this.selectedId();
      if (id) void this.loadRuns(id);
    });

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.events.subscribe((event) => this.onEvent(event)));
    // "há X min" e durações de sessões ativas avançam sem novos eventos.
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    destroyRef.onDestroy(() => clearInterval(clock));
  }

  protected select(id: string): void {
    void this.router.navigate([], { queryParams: { projeto: id }, replaceUrl: true });
  }

  protected titleOf(run: AgentRun): string {
    return run.title ?? `Sessão ${run.externalId.slice(0, 8)}`;
  }

  protected ago(iso: string): string {
    return formatAgo(iso, this.now());
  }

  protected duration(run: AgentRun): string {
    return formatDuration(Date.parse(run.lastEventAt) - Date.parse(run.startedAt));
  }

  protected hasActive(runs: AgentRun[]): boolean {
    return runs.some(isActive);
  }

  protected activeCount(runs: AgentRun[]): number {
    return runs.filter(isActive).length;
  }

  private async loadProjects(): Promise<void> {
    try {
      this.projects.set(await firstValueFrom(this.api.projects()));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.loaded.set(true);
    }
  }

  private async loadRuns(projectId: string, reset = true): Promise<void> {
    if (reset) this.runs.set(null);
    try {
      const runs = await firstValueFrom(this.api.agentRuns(projectId));
      if (this.selectedId() === projectId) this.runs.set(runs);
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }

  /** Aplica um evento do servidor na lista atual, sem recarregar tudo. */
  private onEvent(event: ServerEvent): void {
    if (event.type !== "agent.run.state") return;
    const run = event.run;
    const current = this.runs();
    if (!current || run.projectId !== this.selectedId()) return;
    this.now.set(Date.now());

    if (run.kind === "agent") {
      const existing = current.find((r) => r.id === run.id);
      const next = existing
        ? current.map((r) => (r.id === run.id ? { ...run, subagents: r.subagents } : r))
        : [{ ...run, subagents: [] }, ...current];
      this.runs.set(next.sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt)));
      return;
    }

    const parent = current.find((r) => r.id === run.parentRunId);
    if (!parent) {
      // Subagente chegou antes da sessão principal: busca o estado consolidado.
      void this.loadRuns(run.projectId, false);
      return;
    }
    const subagents = parent.subagents.some((s) => s.id === run.id)
      ? parent.subagents.map((s) => (s.id === run.id ? run : s))
      : [...parent.subagents, run];
    this.runs.set(current.map((r) => (r.id === parent.id ? { ...r, subagents } : r)));
  }
}
