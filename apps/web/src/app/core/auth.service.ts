import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import type { SessionResponse } from "@devtools/shared";
import { firstValueFrom } from "rxjs";

export type AuthState = "checking" | "authenticated" | "anonymous";

/**
 * Sessão do navegador (ADR-0007). O código de uso único chega no fragmento `#code=`,
 * que não é enviado ao servidor em requisições nem gravado em logs de acesso;
 * ele é trocado por cookie HttpOnly e removido da barra de endereço.
 * O token anti-CSRF fica apenas em memória.
 */
@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly state = signal<AuthState>("checking");
  private csrf: string | null = null;

  get csrfToken(): string | null {
    return this.csrf;
  }

  async init(location: Location = window.location, history: History = window.history): Promise<void> {
    const code = new URLSearchParams(location.hash.slice(1)).get("code");
    if (code) {
      history.replaceState(null, "", location.pathname + location.search);
      if (await this.exchange(code)) return;
    }
    await this.refresh();
  }

  async exchange(code: string): Promise<boolean> {
    try {
      const session = await firstValueFrom(
        this.http.post<SessionResponse>("/api/v1/session/exchange", { code: code.trim() }),
      );
      this.authenticated(session);
      return true;
    } catch {
      this.markAnonymous();
      return false;
    }
  }

  async refresh(): Promise<void> {
    try {
      this.authenticated(await firstValueFrom(this.http.get<SessionResponse>("/api/v1/session")));
    } catch {
      this.markAnonymous();
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post("/api/v1/session/logout", {}));
    } finally {
      this.markAnonymous();
    }
  }

  markAnonymous(): void {
    this.csrf = null;
    this.state.set("anonymous");
  }

  private authenticated(session: SessionResponse): void {
    this.csrf = session.csrfToken;
    this.state.set("authenticated");
  }
}
