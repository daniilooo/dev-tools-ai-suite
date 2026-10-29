import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import type { CodeGraphImpact, CodeGraphQueryResponse, KnowledgeStatus } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { fileRef, formatMs, GRAPH_STATE_LABEL, relationLabel } from "./knowledge-format";

/** Grafo de código via Graphify externo (ADR-0006): quem usa um símbolo e o impacto de mudá-lo. */
@Component({
  selector: "dt-knowledge-graph",
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = status().graph;
    <section class="card mb-4 p-4" aria-label="Grafo de código">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-sm font-semibold">Grafo de código</h2>
          <span class="chip" data-testid="graph-state">{{ label[g.state] }}</span>
          @if (g.builtAt) {
            <span class="text-xs text-muted">
              {{ g.nodes }} símbolos · {{ g.edges }} relações · {{ g.repos }}
              {{ g.repos === 1 ? "repositório" : "repositórios" }} · {{ g.builtAt | date: "dd/MM HH:mm" }}
              @if (g.durationMs !== null) {
                ({{ ms(g.durationMs) }})
              }
            </span>
          }
        </div>
        @if (g.available) {
          <div class="flex gap-2">
            <button type="button" class="btn" (click)="build()" [disabled]="busy() || g.state === 'building'">
              {{ g.state === "not_built" ? "Gerar grafo" : "Regenerar" }}
            </button>
            @if (g.state === "built" || g.state === "failed") {
              <button type="button" class="btn" (click)="remove()" [disabled]="busy()">Remover grafo</button>
            }
          </div>
        }
      </div>
      <p class="mt-2 text-sm text-muted">
        Mostra quem usa uma classe ou função e o que pode ser afetado ao mudá-la. Usa o Graphify instalado na
        máquina, só com análise do código (sem IA e sem rede).
      </p>
      @if (g.reason) {
        <p class="mt-2 text-sm text-warn">{{ g.reason }}</p>
      }
      @if (g.error) {
        <p class="mt-2 text-sm text-err">{{ g.error }}</p>
      }

      @if (g.state === "built") {
        <form class="mt-3 flex gap-2" (submit)="$event.preventDefault(); ask()">
          <input
            class="input"
            type="search"
            aria-label="Símbolo"
            placeholder="Classe, função ou arquivo (ex.: PedidoService)"
            [value]="symbol()"
            (input)="symbol.set($any($event.target).value)"
          />
          <button type="submit" class="btn" [disabled]="!symbol().trim() || busy()">Analisar</button>
        </form>
      }
      @if (error()) {
        <p class="mt-2 text-sm text-err" role="alert">{{ error() }}</p>
      }

      @if (result(); as r) {
        @if (r.node; as node) {
          <div class="mt-4 space-y-4 text-sm" data-testid="graph-result">
            <p>
              <span class="font-semibold">{{ node.label }}</span>
              <span class="ml-2 font-mono text-xs text-accent">{{ ref(node.filePath, node.line) }}</span>
            </p>
            <div>
              <h3 class="mb-1 text-xs font-semibold text-muted uppercase">
                Quem usa ({{ r.dependents.length }})
              </h3>
              <ul class="space-y-0.5">
                @for (d of r.dependents; track $index) {
                  <li data-testid="graph-dependent">
                    <span class="text-muted">{{ relation(d.relation) }}</span> · {{ d.node.label }}
                    <span class="font-mono text-xs text-accent">{{ ref(d.filePath, d.line) }}</span>
                  </li>
                } @empty {
                  <li class="text-muted">Ninguém usa diretamente.</li>
                }
              </ul>
            </div>
            <div>
              <h3 class="mb-1 text-xs font-semibold text-muted uppercase">
                Impacto de uma mudança ({{ r.impact.length }})
              </h3>
              @for (level of impactLevels(); track level.depth) {
                <p class="mt-1 text-xs text-muted">
                  {{ level.depth === 1 ? "Diretamente" : level.depth + " níveis acima" }}
                </p>
                <ul class="space-y-0.5">
                  @for (i of level.items; track i.node.id) {
                    <li data-testid="graph-impact">
                      {{ i.node.label }}
                      <span class="font-mono text-xs text-accent">{{
                        ref(i.node.filePath, i.node.line)
                      }}</span>
                    </li>
                  }
                </ul>
              } @empty {
                <p class="text-muted">Nenhum dependente encontrado.</p>
              }
            </div>
            <div>
              <h3 class="mb-1 text-xs font-semibold text-muted uppercase">
                Usa ({{ r.dependencies.length }})
              </h3>
              <ul class="space-y-0.5">
                @for (d of r.dependencies; track $index) {
                  <li>
                    <span class="text-muted">{{ relation(d.relation) }}</span> · {{ d.node.label }}
                    <span class="font-mono text-xs text-accent">{{ ref(d.node.filePath, d.node.line) }}</span>
                  </li>
                } @empty {
                  <li class="text-muted">Nenhuma dependência registrada.</li>
                }
              </ul>
            </div>
            @if (r.candidates.length > 0) {
              <p class="text-xs text-muted">
                Outros símbolos com esse nome:
                @for (c of r.candidates; track c.id) {
                  <button type="button" class="ml-1 text-accent hover:underline" (click)="ask(c.id)">
                    {{ ref(c.filePath, c.line) }}
                  </button>
                }
              </p>
            }
          </div>
        } @else {
          <p class="mt-3 text-sm text-muted">Nenhum símbolo chamado "{{ r.symbol }}" no grafo.</p>
        }
      }
    </section>
  `,
})
export class KnowledgeGraph {
  private readonly api = inject(ApiService);

  readonly projectId = input.required<string>();
  readonly status = input.required<KnowledgeStatus>();
  readonly changed = output<KnowledgeStatus | null>();

  protected readonly label = GRAPH_STATE_LABEL;
  protected readonly ref = fileRef;
  protected readonly relation = relationLabel;
  protected readonly ms = formatMs;
  protected readonly symbol = signal("");
  protected readonly result = signal<CodeGraphQueryResponse | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly impactLevels = computed(() => {
    const levels = new Map<number, CodeGraphImpact[]>();
    for (const item of this.result()?.impact ?? [])
      levels.set(item.depth, [...(levels.get(item.depth) ?? []), item]);
    return [...levels].map(([depth, items]) => ({ depth, items }));
  });

  constructor() {
    // Outro projeto: a análise anterior não vale mais.
    effect(() => {
      this.projectId();
      this.result.set(null);
    });
  }

  protected async build(): Promise<void> {
    await this.run(async () =>
      this.changed.emit(await firstValueFrom(this.api.buildGraph(this.projectId()))),
    );
  }

  protected async remove(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.removeGraph(this.projectId()));
      this.result.set(null);
      this.changed.emit(null);
    });
  }

  protected async ask(id?: string): Promise<void> {
    const symbol = id ?? this.symbol().trim();
    if (!symbol) return;
    await this.run(async () =>
      this.result.set(await firstValueFrom(this.api.queryGraph(this.projectId(), symbol))),
    );
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
