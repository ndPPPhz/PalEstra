/**
 * Domain errors carry the HTTP status they should become, so the REST
 * adapter stays a translation layer with no rules of its own.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string) => new AppError(400, 'bad_request', message);
export const unauthorized = (message = 'Devi effettuare l’accesso.') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'Non hai i permessi per questa operazione.') =>
  new AppError(403, 'forbidden', message);
export const notFound = (message = 'Non trovato.') => new AppError(404, 'not_found', message);
export const conflict = (message: string) => new AppError(409, 'conflict', message);
export const tooManyRequests = (message: string) => new AppError(429, 'too_many_requests', message);
