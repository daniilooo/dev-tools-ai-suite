import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import type { ProviderInfo, ProvidersResponse, SupportLevel } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { AuthChip } from "./auth-chip";

@Component({
  selector: "dt-providers-page",
  imports: [DatePipe, AuthChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Provedores</h1>
        <p class="text-sm text-muted">
          Detectados executando apenas comandos oficiais. A suíte não lê nem guarda credenciais.
        </p>
      </div>
      <button type="button" class="btn" (click)="load(true)" [disabled]="loading()">
        {{ loading() ? "Atualizando…" : "Atualizar" }}
      </button>
    </header>
    @if (error()) {
      <p class="text-sm text-err" role="alert">{{ error() }}</p>
    }
    @if (data(); as d) {
      <section class="grid gap-4 lg:grid-cols-3">
        @for (p of d.providers; track p.id) {
          <article class="card flex flex-col p-4" [attr.aria-label]="p.label">
            <div class="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 class="font-semibold">{{ p.label }}</h2>
                <div class="text-xs text-muted">
                  @if (p.installed) {
                    v{{ p.version ?? "?" }}
                    @if (p.versionSupport === "tested") {
                      · versão testada
                    } @else if (p.versionSupport === "untested") {
                      · <span class="text-warn">versão não testada</span>
                    }
                  } @else {
                    não instalado
                  }
                </div>
              </div>
              <span
                class="size-2.5 shrink-0 rounded-full"
                [class]="p.installed ? 'bg-ok' : 'bg-muted'"
              ></span>
            </div>

            @if (p.installed && p.launchable) {
              <div class="mb-3"><dt-auth-chip [auth]="p.auth" /></div>
            }

            <h3 class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Capacidades</h3>
            <ul class="mb-3 space-y-1 text-sm">
              @for (c of p.capabilities; track c.id) {
                <li class="flex items-center justify-between gap-2">
                  <span [class.text-muted]="c.phase">{{ c.label }}</span>
                  <span class="chip" [title]="levelLabel[c.level]">
                    {{ c.level }}{{ c.phase ? " · Fase " + c.phase : "" }}
                  </span>
                </li>
              }
            </ul>

            @for (note of p.notes; track note) {
              <p class="text-xs text-muted">{{ note }}</p>
            }
            @if (!p.installed) {
              <p class="mt-auto pt-2 text-xs text-muted">{{ installHint(p) }}</p>
            }
          </article>
        }
      </section>
      <p class="mt-4 text-xs text-muted">
        Atualizado em {{ d.generatedAt | date: "dd/MM/yyyy HH:mm:ss" }} · níveis: A documentado, B arquivo
        local observável, C indisponível.
      </p>
    }
  `,
})
export class ProvidersPage {
  private readonly api = inject(ApiService);
  protected readonly data = signal<ProvidersResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly levelLabel: Record<SupportLevel, string> = {
    A: "Fonte documentada e estável",
    B: "Arquivo local observável, sem contrato de estabilidade",
    C: "Sem fonte permitida: exibido como INDISPONÍVEL",
  };

  constructor() {
    void this.load(false);
  }

  protected async load(refresh: boolean): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.data.set(await firstValueFrom(this.api.providers(refresh)));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected installHint(provider: ProviderInfo): string {
    switch (provider.id) {
      case "claude-code":
        return "Instale o Claude Code seguindo a documentação oficial da Anthropic.";
      case "codex":
        return "Instale o Codex CLI seguindo a documentação oficial da OpenAI.";
      default:
        return "Opcional. Usado para embeddings locais a partir da Fase 7.";
    }
  }
}
