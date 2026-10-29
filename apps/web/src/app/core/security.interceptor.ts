import { HttpErrorResponse } from "@angular/common/http";
import type { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthService } from "./auth.service";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Adiciona o token anti-CSRF em métodos com efeito colateral e trata sessão expirada. */
export const securityInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.csrfToken;
  const outgoing =
    token && UNSAFE.has(request.method) ? request.clone({ setHeaders: { "x-csrf-token": token } }) : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const isSessionCall = request.url.startsWith("/api/v1/session");
      if (error instanceof HttpErrorResponse && error.status === 401 && !isSessionCall) {
        auth.markAnonymous();
        void router.navigateByUrl("/acesso");
      }
      return throwError(() => error);
    }),
  );
};
