import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from "@angular/core";
import type { KnowledgeStatus, SemanticProviderId, SemanticProviderInfo } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { percent, SEMANTIC_STATE_LABEL } from "./knowledge-format";

/** Busca semântica opcional (ADR-0006): o humano escolhe o mecanismo e liga por projeto. */
@Component({
  selector: "dt-knowledge-semantic",
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = status().semantic;
    <section class="card mb-4 p-4" aria-label="Busca semântica">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold">Busca semântica</h2>
          <span class="chip" data-testid="semantic-state">{{ label[s.state] }}</span>
          @if (s.enabled) {
            <span class="text-xs text-muted">{{ s.model }} · {{ providerLabel(s.provider) }}</span>
          }
        </div>
        @if (s.enabled) {
          <button type="button" class="btn" (click)="disable()" [disabled]="busy()">Desligar</button>
        }
      </div>

      @if (s.enabled) {
        @if (s.state === "indexing" || s.embedded < s.total) {
          <div class="mt-3">
            <div class="h-1.5 overflow-hidden rounded-full bg-border">
              <div class="h-full bg-accent transition-all" [style.width.%]="progress()"></div>
            </div>
            <p class="mt-1 text-xs text-muted">
              {{ s.embedded }} de {{ s.total }} trechos com vetor ({{ progress() }}%). A busca semântica já
              usa o que estiver pronto.
            </p>
          </div>
        } @else if (s.updatedAt) {
          <p class="mt-2 text-xs text-muted">
            {{ s.embedded }} trechos com vetor · atualizado em {{ s.updatedAt | date: "dd/MM HH:mm" }}
          </p>
        }
        @if (s.error) {
          <p class="mt-2 text-sm text-err">{{ s.error }}</p>
        }
        @if (s.reason) {
          <p class="mt-2 text-sm text-warn">{{ s.reason }}</p>
        }
      } @else {
        <p class="mt-2 text-sm text-muted">
          Procura trechos pelo significado, não só pelas palavras. Os vetores são calculados nesta máquina e o
          código não sai dela. Indexar um projeto grande pode levar dezenas de minutos na CPU.
        </p>
        @if (status().state === "not_indexed") {
          <p class="mt-2 text-xs text-muted">Indexe o projeto antes de ligar.</p>
        }
        <fieldset class="mt-3 space-y-2">
          <legend class="sr-only">Mecanismo de embeddings</legend>
          @for (p of providers(); track p.id) {
            <label class="flex items-start gap-2 text-sm" [class.opacity-60]="!p.available">
              <input
                type="radio"
                name="semantic-provider"
                class="mt-1"
                [value]="p.id"
                [checked]="choice() === p.id"
                [disabled]="!p.available"
                (change)="choice.set(p.id)"
              />
              <span>
                <span class="font-medium">{{ p.label }}</span>
                <span class="text-muted"> · {{ p.model }}</span>
                @if (p.reason) {
                  <span class="block text-xs text-muted">{{ p.reason }}</span>
                }
              </span>
            </label>
          }
        </fieldset>
        @if (chosen()?.downloadsModel) {
          <label class="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" class="mt-1" [checked]="consent()" (change)="consent.set(!consent())" />
            <span>
              Autorizo baixar o modelo <span class="font-mono">{{ chosen()?.model }}</span> do Hugging Face
              (cerca de 130 MB, uma vez). Só o modelo é baixado; o código não é enviado.
            </span>
          </label>
        }
        <button type="button" class="btn mt-3" (click)="enable()" [disabled]="!canEnable()">
          Ligar busca semântica
        </button>
      }
      @if (error()) {
        <p class="mt-2 text-sm text-err" role="alert">{{ error() }}</p>
      }
    </section>
  `,
})
export class KnowledgeSemantic {
  private readonly api = inject(ApiService);

  readonly projectId = input.required<string>();
  readonly status = input.required<KnowledgeStatus>();
  readonly changed = output<KnowledgeStatus>();

  protected readonly label = SEMANTIC_STATE_LABEL;
  protected readonly providers = signal<SemanticProviderInfo[]>([]);
  protected readonly choice = signal<SemanticProviderId | null>(null);
  protected readonly consent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly chosen = computed(() => this.providers().find((p) => p.id === this.choice()) ?? null);
  protected readonly progress = computed(() =>
    percent(this.status().semantic.embedded, this.status().semantic.total),
  );
  protected readonly canEnable = computed(() => {
    const p = this.chosen();
    return (
      !this.busy() &&
      this.status().state !== "not_indexed" &&
      !!p?.available &&
      (!p.downloadsModel || this.consent())
    );
  });

  constructor() {
    void this.loadProviders();
  }

  protected providerLabel(id: SemanticProviderId | null): string {
    return this.providers().find((p) => p.id === id)?.label ?? id ?? "";
  }

  protected async enable(): Promise<void> {
    const provider = this.choice();
    if (!provider) return;
    await this.run(() =>
      this.api.configureSemantic(this.projectId(), {
        enabled: true,
        provider,
        consentModelDownload: this.chosen()?.downloadsModel ? this.consent() : undefined,
      }),
    );
  }

  protected async disable(): Promise<void> {
    await this.run(() => this.api.configureSemantic(this.projectId(), { enabled: false }));
    this.consent.set(false);
  }

  private async loadProviders(): Promise<void> {
    try {
      const list = await firstValueFrom(this.api.semanticProviders());
      this.providers.set(list);
      this.choice.set(list.find((p) => p.available)?.id ?? null);
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }

  private async run(action: () => ReturnType<ApiService["configureSemantic"]>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.changed.emit(await firstValueFrom(action()));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
