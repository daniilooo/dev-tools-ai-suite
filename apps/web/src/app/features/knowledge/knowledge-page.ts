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
import type { KnowledgeQueryMode, KnowledgeQueryResponse, KnowledgeStatus, Project } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { formatMs, INDEX_STATE_DOT, INDEX_STATE_LABEL, snippetParts } from "./knowledge-format";
import { KnowledgeGraph } from "./knowledge-graph";
import { KnowledgeSemantic } from "./knowledge-semantic";

const MODE_LABEL: Record<KnowledgeQueryMode, string> = {
  lexical: "busca textual",
  semantic: "busca semântica",
  hybrid: "busca híbrida (textual + semântica)",
};

/** Conhecimento local (RAG): índice do projeto e consulta com arquivo e linhas. */
@Component({
  selector: "dt-knowledge-page",
  imports: [DatePipe, RouterLink, KnowledgeGraph, KnowledgeSemantic],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Conhecimento</h1>
        <p class="max-w-3xl text-sm text-muted">
          Índice local do projeto para consultas com referência a arquivo e linhas, busca semântica opcional e
          grafo de código. Nada sai da máquina; segredos, dependências e arquivos ignorados pelo git ficam de
          fora.
        </p>
      </div>
      @if (projects().length > 0) {
        <label class="flex items-center gap-2 text-sm">
          <span class="text-muted">Projeto</span>
          <select
            class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            (change)="select($any($event.target).value)"
          >
            <!-- [selected] na opção: [value] no select chega antes das opções e o navegador fica na primeira. -->
            @for (p of projects(); track p.id) {
              <option [value]="p.id" [selected]="p.id === selectedId()">{{ p.name }}</option>
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
        para indexá-lo.
      </div>
    } @else if (status(); as s) {
      <section class="card mb-4 p-4" aria-label="Índice do projeto">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="chip gap-1.5" data-testid="index-state">
              <span class="size-1.5 rounded-full" [class]="dot[s.state]"></span>
              {{ label[s.state] }}
            </span>
            @if (s.indexedAt) {
              <span class="text-xs text-muted">
                {{ s.files }} arquivos · {{ s.chunks }} trechos · indexado em
                {{ s.indexedAt | date: "dd/MM HH:mm" }}
                @if (s.durationMs !== null) {
                  ({{ ms(s.durationMs) }})
                }
              </span>
            }
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn" (click)="index()" [disabled]="s.state === 'indexing'">
              {{ s.state === "not_indexed" ? "Indexar projeto" : "Reindexar" }}
            </button>
            @if (s.state !== "not_indexed" && s.state !== "indexing") {
              <button type="button" class="btn" (click)="remove()">Remover índice</button>
            }
          </div>
        </div>
        @if (s.state === "outdated") {
          <p class="mt-2 text-sm text-warn">
            {{ s.changedFiles }} {{ s.changedFiles === 1 ? "arquivo mudou" : "arquivos mudaram" }} desde a
            indexação. Reindexe para refletir o código atual.
          </p>
        }
        @if (s.error) {
          <p class="mt-2 text-sm text-err">{{ s.error }}</p>
        }
        @if (s.indexedAt) {
          <p class="mt-2 text-xs text-muted" data-testid="skipped">
            Fora do índice: {{ s.skipped.sensitive }} sensíveis ·
            {{ s.skipped.noise }} dependências/build/mídia · {{ s.skipped.large }} maiores que 1 MiB ·
            {{ s.skipped.binary }} binários.
          </p>
        }
      </section>

      @if (s.state === "indexed" || s.state === "outdated") {
        <form class="mb-4 flex gap-2" (submit)="$event.preventDefault(); search()">
          <input
            class="input"
            type="search"
            aria-label="Consulta"
            placeholder="Nome de classe, função ou termos (ex.: calcularTotal pedido)"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
          @if (semanticUsable()) {
            <select
              class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              aria-label="Tipo de busca"
              [value]="mode()"
              (change)="mode.set($any($event.target).value)"
            >
              <option value="hybrid">Híbrida</option>
              <option value="lexical">Textual</option>
              <option value="semantic">Semântica</option>
            </select>
          }
          <button type="submit" class="btn" [disabled]="!query().trim()">Buscar</button>
        </form>
      }

      @if (result(); as r) {
        <p class="mb-2 text-xs text-muted">
          {{ r.hits.length }} {{ r.hits.length === 1 ? "trecho" : "trechos" }} para "{{ r.query }}" ·
          {{ modeLabel[r.mode] }}
        </p>
        <ul class="space-y-2">
          @for (hit of r.hits; track hit.filePath + hit.lineStart) {
            <li class="card p-3" data-testid="knowledge-hit">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-sm text-accent"
                  >{{ hit.filePath }}:{{ hit.lineStart }}–{{ hit.lineEnd }}</span
                >
                @if (r.mode === "hybrid") {
                  @for (m of hit.matchedBy; track m) {
                    <span class="chip text-xs">{{ m === "lexical" ? "textual" : "semântica" }}</span>
                  }
                }
                @if (hit.stale) {
                  <span class="chip text-warn" title="O arquivo mudou desde a indexação"
                    >pode estar desatualizado</span
                  >
                }
              </div>
              <!-- Espaços só de formatação entre os spans são descartados pelo Angular. -->
              <code class="mt-2 block overflow-x-auto font-mono text-xs whitespace-pre-wrap text-muted">
                @for (part of parts(hit.snippet); track $index) {
                  <span [class]="part.match ? 'rounded bg-accent/20 text-text' : ''">{{ part.text }}</span>
                }
              </code>
            </li>
          } @empty {
            <li class="text-sm text-muted">
              Nada encontrado. Tente outros termos ou o nome exato de um identificador.
            </li>
          }
        </ul>
      }

      <div class="mt-6">
        <dt-knowledge-semantic
          [projectId]="s.projectId"
          [status]="s"
          (changed)="apply(s.projectId, $event)"
        />
        <dt-knowledge-graph [projectId]="s.projectId" [status]="s" (changed)="refresh(s.projectId, $event)" />
      </div>
    }
  `,
})
export class KnowledgePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /** Projeto escolhido (`?projeto=<id>`). */
  readonly projeto = input<string | undefined>();

  protected readonly projects = signal<Project[]>([]);
  protected readonly loaded = signal(false);
  protected readonly status = signal<KnowledgeStatus | null>(null);
  protected readonly result = signal<KnowledgeQueryResponse | null>(null);
  protected readonly query = signal("");
  protected readonly mode = signal<KnowledgeQueryMode>("hybrid");
  protected readonly modeLabel = MODE_LABEL;
  protected readonly error = signal<string | null>(null);
  protected readonly label = INDEX_STATE_LABEL;
  protected readonly dot = INDEX_STATE_DOT;
  protected readonly parts = snippetParts;
  protected readonly ms = formatMs;
  private poll: ReturnType<typeof setTimeout> | null = null;

  protected readonly semanticUsable = computed(() => (this.status()?.semantic.embedded ?? 0) > 0);

  protected readonly selectedId = computed(() => {
    const list = this.projects();
    return list.find((p) => p.id === this.projeto())?.id ?? list[0]?.id ?? null;
  });

  constructor() {
    void this.loadProjects();
    effect(() => {
      const id = this.selectedId();
      this.result.set(null);
      if (id) void this.loadStatus(id);
    });
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  protected select(id: string): void {
    void this.router.navigate([], { queryParams: { projeto: id }, replaceUrl: true });
  }

  protected async index(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.run(async () => this.apply(id, await firstValueFrom(this.api.indexKnowledge(id))));
  }

  protected async remove(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.run(async () => {
      await firstValueFrom(this.api.removeKnowledge(id));
      this.result.set(null);
      await this.loadStatus(id);
    });
  }

  protected async search(): Promise<void> {
    const id = this.selectedId();
    const text = this.query().trim();
    if (!id || !text) return;
    const mode = this.semanticUsable() ? this.mode() : "lexical";
    await this.run(async () =>
      this.result.set(await firstValueFrom(this.api.queryKnowledge(id, text, mode))),
    );
  }

  private async loadProjects(): Promise<void> {
    await this.run(async () => this.projects.set(await firstValueFrom(this.api.projects())));
    this.loaded.set(true);
  }

  private async loadStatus(id: string): Promise<void> {
    await this.run(async () => this.apply(id, await firstValueFrom(this.api.knowledge(id))));
  }

  /** Enquanto indexa, calcula vetores ou gera o grafo, acompanha o estado a cada segundo. */
  protected apply(id: string, status: KnowledgeStatus): void {
    if (this.selectedId() !== id) return;
    this.status.set(status);
    this.stopPolling();
    const busy =
      status.state === "indexing" ||
      status.semantic.state === "indexing" ||
      status.graph.state === "building";
    if (busy) this.poll = setTimeout(() => void this.loadStatus(id), 1000);
  }

  /** Componentes filhos mandam o estado novo, ou null para recarregar. */
  protected refresh(id: string, status: KnowledgeStatus | null): void {
    if (status) this.apply(id, status);
    else void this.loadStatus(id);
  }

  private stopPolling(): void {
    if (this.poll) clearTimeout(this.poll);
    this.poll = null;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      this.error.set(null);
      await action();
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }
}
