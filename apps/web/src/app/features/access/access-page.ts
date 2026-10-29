import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../core/auth.service";

@Component({
  selector: "dt-access-page",
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-full place-items-center px-4">
      <form class="card w-full max-w-sm p-6" (ngSubmit)="submit()" aria-labelledby="access-title">
        <h1 id="access-title" class="text-lg font-semibold">Acessar o dashboard</h1>
        <p class="mt-1 text-sm text-muted">
          Informe o código de acesso exibido no terminal onde você executou
          <code class="font-mono">devtools start</code>. Ele vale uma única vez e expira em 60 segundos.
        </p>
        <label class="mt-4 block text-sm font-medium" for="code">Código de acesso</label>
        <input
          id="code"
          name="code"
          class="input mt-1 font-mono tracking-widest uppercase"
          autocomplete="off"
          spellcheck="false"
          placeholder="XXXX-XXXX"
          [(ngModel)]="code"
          required
        />
        @if (error()) {
          <p class="mt-2 text-sm text-err" role="alert">{{ error() }}</p>
        }
        <button
          type="submit"
          class="btn btn-primary mt-4 w-full justify-center"
          [disabled]="busy() || !code.trim()"
        >
          {{ busy() ? "Verificando…" : "Entrar" }}
        </button>
        <p class="mt-4 text-xs text-muted">
          Código expirado? Execute <code class="font-mono">devtools start</code> novamente para gerar outro.
        </p>
      </form>
    </div>
  `,
})
export class AccessPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected code = "";
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const ok = await this.auth.exchange(this.code);
    this.busy.set(false);
    if (ok) await this.router.navigateByUrl("/projetos");
    else this.error.set("Código inválido ou expirado.");
  }
}
