/** Erro de aplicação com código estável e mensagem em PT-BR para o usuário. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError("UNAUTHORIZED", 401, "Sessão ausente ou inválida.");
export const forbidden = (message = "Requisição não permitida.") => new AppError("FORBIDDEN", 403, message);
export const notFound = (message = "Recurso não encontrado.") => new AppError("NOT_FOUND", 404, message);
export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new AppError("BAD_REQUEST", 400, message, details);
