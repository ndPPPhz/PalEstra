import { ZodError, type z } from 'zod';
import { AppError } from '@/core/errors';
import type { Endpoint } from '@/api/contract';
import type { SessionUser } from '@/core/auth';
import { requireUser } from './session';

/**
 * The thin REST adapter.
 *
 * A handler here does three mechanical things — identify the caller,
 * validate the input, delegate to src/core — and holds no rules of its
 * own. Permissions, parsing and business logic live in the domain, which
 * server components call directly; this layer only exposes the same
 * services over HTTP, for the native client that will come later.
 */

function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return Response.json(
      {
        error: {
          code: 'invalid_body',
          message: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Richiesta non valida.',
        },
      },
      { status: 400 },
    );
  }
  console.error('Errore non gestito nella API', error);
  return Response.json({ error: { code: 'internal', message: 'Errore interno.' } }, { status: 500 });
}

type Body<E extends Endpoint> = E['body'] extends z.ZodTypeAny ? z.infer<E['body']> : undefined;

interface Ctx<E extends Endpoint, P> {
  user: SessionUser;
  params: P;
  body: Body<E>;
  request: Request;
}

async function readBody<E extends Endpoint>(endpoint: E, request: Request): Promise<Body<E>> {
  if (!endpoint.body) return undefined as Body<E>;
  const raw = await request.json().catch(() => ({}));
  return endpoint.body.parse(raw) as Body<E>;
}

/** For endpoints that require a session (cookie or bearer token). */
export function authed<E extends Endpoint, P extends Record<string, string> = Record<string, never>>(
  endpoint: E,
  handler: (ctx: Ctx<E, P>) => Promise<unknown>,
) {
  return async (request: Request, context: { params: Promise<P> }): Promise<Response> => {
    try {
      const user = await requireUser(request);
      const params = ((await context?.params) ?? {}) as P;
      const result = await handler({ user, params, body: await readBody(endpoint, request), request });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** For the handful of endpoints reachable before logging in. */
export function open<E extends Endpoint, P extends Record<string, string> = Record<string, never>>(
  endpoint: E,
  handler: (ctx: Omit<Ctx<E, P>, 'user'>) => Promise<unknown>,
) {
  return async (request: Request, context: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = ((await context?.params) ?? {}) as P;
      const result = await handler({ params, body: await readBody(endpoint, request), request });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
