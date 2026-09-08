import { mkdirSync, writeFileSync } from 'node:fs';
import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { contract, type Endpoint } from '../src/api/contract';
import { ErrorDto } from '../src/api/dto';

extendZodWithOpenApi(z);

/**
 * Turns the contract into openapi/openapi.json.
 *
 * That file is what Apple's swift-openapi-generator compiles into a typed
 * Swift client, so the iOS app never hand-writes a request or a model: if a
 * field is renamed here, the Swift build fails instead of the app crashing
 * at runtime in someone's gym.
 */
function pathParameters(path: string) {
  return [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name: name!,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' as const },
  }));
}

function main() {
  const registry = new OpenAPIRegistry();
  const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description:
      'Token di sessione. Il browser lo riceve come cookie httpOnly e non deve inviare questo header; un client nativo lo tiene nel Keychain e lo manda qui.',
  });

  for (const [operationId, endpoint] of Object.entries(contract as Record<string, Endpoint>)) {
    registry.registerPath({
      method: endpoint.method,
      path: `/api/v1${endpoint.path}`,
      operationId,
      summary: endpoint.summary,
      security: endpoint.auth ? [{ [bearer.name]: [] }] : [],
      parameters: pathParameters(endpoint.path),
      request: endpoint.body
        ? { body: { required: true, content: { 'application/json': { schema: endpoint.body } } } }
        : undefined,
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: endpoint.response } },
        },
        400: { description: 'Richiesta non valida', content: { 'application/json': { schema: ErrorDto } } },
        ...(endpoint.auth
          ? { 401: { description: 'Non autenticato', content: { 'application/json': { schema: ErrorDto } } } }
          : {}),
      },
    });
  }

  const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'PalEstra API',
      version: '1.0.0',
      description:
        'API di PalEstra. Generata da src/api/contract.ts: non modificare a mano, rigenerare con `npm run openapi`.',
    },
    servers: [{ url: process.env.APP_URL ?? 'http://localhost:3000' }],
  });

  mkdirSync('openapi', { recursive: true });
  writeFileSync('openapi/openapi.json', `${JSON.stringify(document, null, 2)}\n`);
  console.info(`openapi/openapi.json aggiornato — ${Object.keys(contract).length} operazioni.`);
}

main();
