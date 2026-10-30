import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { AgentRunDetail } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { ServerEventsService } from "../../core/server-events.service";
import { TerminalView } from "../terminal/terminal-view";
import type { ConnectionState } from "../terminal/terminal-view";
import { PROVIDER_LABEL } from "./agent-format";
import { AgentStateChip } from "./agent-state-chip";

/** Só o terminal em que um agente roda, sem as outras abas do projeto. */
@Component({
  selector: "dt-agent-terminal-page",
  imports: [RouterLink, TerminalView, AgentStateChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "flex h-[calc(100dvh-3rem)] min-h-96 flex-col" },
  template: `
    <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <a
          routerLink="/agentes"
          [queryParams]="run() ? { projeto: run()!.projectId } : {}"
          class="text-sm text-muted hover:text-text"
          >← Agentes</a
        >
        @if (run(); as r) {
          <h1 class="flex flex-wrap items-center gap-2 font-medium">
            <span class="chip">{{ providerLabel[r.providerId] }}</span>
            <span class="truncate">{{ r.title ?? "Sessão " + r.externalId.slice(0, 8) }}</span>
          </h1>
        }
      </div>
      @if (run(); as r) {
        <div class="flex items-center gap-2">
          <a
            class="btn"
            [routerLink]="['/projetos', r.projectId, 'terminal']"
            [queryParams]="{ t: r.terminalId }"
            title="Abrir junto com os outros terminais do projeto"
            >Ver com as abas do projeto</a
          >
          <dt-agent-state-chip [state]="r.state" />
        </div>
      }
    </div>

    @if (error()) {
      <p class="text-sm text-err" role="alert">{{ error() }}</p>
    } @else if (run(); as r) {
      @if (!r.terminalId) {
        <div class="card p-6 text-sm text-muted">
          Esta sessão não foi aberta por um terminal da suíte, então não há terminal para mostrar.
        </div>
      } @else if (connection() === "closed") {
        <div class="card p-6 text-sm text-muted">
          O terminal deste agente não existe mais: foi fechado ou o servidor reiniciou.
        </div>
      } @else {
        <div class="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-bg p-2">
          <div class="absolute inset-2">
            <dt-terminal-view [sessionId]="r.terminalId" (connection)="connection.set($event)" />
          </div>
        </div>
      }
    }
  `,
})
export class AgentTerminalPage {
  private readonly api = inject(ApiService);
  /** Id da execução, do caminho `/agentes/:runId/terminal`. */
  readonly runId = input.required<string>();

  protected readonly run = signal<AgentRunDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly connection = signal<ConnectionState>("connecting");
  protected readonly providerLabel = PROVIDER_LABEL;

  constructor() {
    effect(() => void this.load(this.runId()));
    // Estado do agente ao vivo, sem recarregar o terminal.
    const unsubscribe = inject(ServerEventsService).subscribe((event) => {
      const current = this.run();
      if (event.type === "agent.run.state" && current && event.run.id === current.id) {
        this.run.set({ ...event.run, subagents: current.subagents });
      }
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  private async load(id: string): Promise<void> {
    try {
      this.run.set(await firstValueFrom(this.api.agentRun(id)));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }
}
