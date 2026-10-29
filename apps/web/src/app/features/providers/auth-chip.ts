import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import type { ProviderAuth } from "@devtools/shared";

/** Estado de login de um provedor, sempre com a origem do dado (RN-03). */
@Component({
  selector: "dt-auth-chip",
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip gap-1.5" [title]="tooltip()">
      <span class="size-1.5 rounded-full" [class]="dot()"></span>
      {{ text() }}
    </span>
  `,
})
export class AuthChip {
  readonly auth = input.required<ProviderAuth>();

  protected readonly text = computed(() => {
    const auth = this.auth();
    if (auth.state === "authenticated") {
      const details = [auth.method, auth.plan ? `plano ${auth.plan}` : null].filter(Boolean).join(", ");
      return details ? `conectado · ${details}` : "conectado";
    }
    if (auth.state === "unauthenticated") return "não conectado";
    return "login: INDISPONÍVEL";
  });

  protected readonly dot = computed(() => {
    const state = this.auth().state;
    return state === "authenticated" ? "bg-ok" : state === "unauthenticated" ? "bg-warn" : "bg-muted";
  });

  protected readonly tooltip = computed(() => {
    const auth = this.auth();
    const when = new Date(auth.fetchedAt).toLocaleString("pt-BR");
    if (auth.state === "unavailable") return `Indisponível: ${auth.reason ?? "sem fonte permitida"}`;
    return `Fonte oficial: ${auth.source} · ${when}`;
  });
}
