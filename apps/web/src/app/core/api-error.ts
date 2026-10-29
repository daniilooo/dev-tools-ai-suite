import { HttpErrorResponse } from "@angular/common/http";
import type { ApiErrorBody } from "@devtools/shared";

/** Extrai a mensagem PT-BR do corpo de erro padronizado da API. */
export function apiErrorMessage(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiErrorBody> | null;
    if (body?.error?.message) return body.error.message;
    if (error.status === 0)
      return "Servidor local indisponível. Verifique se `devtools start` está em execução.";
  }
  return fallback;
}
