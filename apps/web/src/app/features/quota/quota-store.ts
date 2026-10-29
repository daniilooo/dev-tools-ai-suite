import { Injectable, inject, signal } from "@angular/core";
import type { QuotaResponse } from "@devtools/shared";
import { firstValueFrom } from "rxjs";
import { apiErrorMessage } from "../../core/api-error";
import { ApiService } from "../../core/api.service";
import { ServerEventsService } from "../../core/server-events.service";

/**
 * Cotas atuais, compartilhadas entre a tela de Cotas e o resumo da barra lateral.
 * Carrega ao primeiro assinante e segue os avisos `quota.updated` de `/ws/events`.
 */
@Injectable({ providedIn: "root" })
export class QuotaStore {
  private readonly api = inject(ApiService);
  private readonly events = inject(ServerEventsService);
  readonly quota = signal<QuotaResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly connected = this.events.connected;
  private users = 0;
  private unsubscribe: (() => void) | null = null;

  /** Começa a acompanhar; a função devolvida encerra quando ninguém mais usa. */
  connect(): () => void {
    if (this.users++ === 0) {
      this.unsubscribe = this.events.subscribe((event) => {
        if (event.type === "quota.updated") this.quota.set(event.quota);
      });
      void this.load();
    }
    return () => {
      if (--this.users === 0) {
        this.unsubscribe?.();
        this.unsubscribe = null;
      }
    };
  }

  async load(): Promise<void> {
    try {
      this.quota.set(await firstValueFrom(this.api.quota()));
      this.error.set(null);
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }
}
