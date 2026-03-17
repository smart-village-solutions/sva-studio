/* eslint-disable @nx/enforce-module-boundaries */
import { describe, expect, it } from 'vitest';

import {
  requiredOperations,
  requiredPaths,
  requiredSchemas,
  validateOpenApiDocument,
} from '../../../scripts/ci/check-openapi-iam.ts';

describe('check-openapi-iam', () => {
  const validDocument = [
    'openapi: 3.1.0',
    'paths:',
    ...requiredPaths.flatMap((path) => {
      const methods = requiredOperations[path as keyof typeof requiredOperations] ?? [];
      return [
        `  ${path}:`,
        ...methods.flatMap((method) => {
          const responseCode =
            path === '/iam/me/data-export' && method === 'get'
              ? '405'
              : path === '/iam/admin/data-subject-rights/export' && method === 'get'
                ? '405'
                : '200';
          return [
            `    ${method}:`,
            '      responses:',
            `        '${responseCode}':`,
            '          description: ok',
          ];
        }),
      ];
    }),
    'components:',
    '  schemas:',
    ...requiredSchemas.map((schema) => `    ${schema}:`),
  ].join('\n');

  it('accepts a document with the required version, paths and schemas', () => {
    expect(validateOpenApiDocument(validDocument)).toEqual([]);
  });

  it('reports missing version, path and schema entries', () => {
    const errors = validateOpenApiDocument('openapi: 3.0.0\npaths:\n  /health/live:\ncomponents:\n  schemas:\n');

    expect(errors).toContain('OpenAPI-Version 3.1.0 fehlt.');
    expect(errors).toContain('Pfad fehlt: /health/ready');
    expect(errors).toContain('Schema fehlt: ApiErrorResponse');
  });

  it('reports missing methods and legacy 405 documentation for export GET routes', () => {
    const errors = validateOpenApiDocument([
      'openapi: 3.1.0',
      'paths:',
      '  /iam/me/data-export:',
      '    get:',
      '      responses:',
      "        '200':",
      '          description: wrong',
      '  /iam/admin/data-subject-rights/export:',
      '    get:',
      '      responses:',
      "        '200':",
      '          description: wrong',
      'components:',
      '  schemas:',
      '    ApiErrorResponse:',
    ].join('\n'));

    expect(errors).toContain('HTTP-Methode fehlt: POST /iam/me/data-export');
    expect(errors).toContain('HTTP-Methode fehlt: POST /iam/admin/data-subject-rights/export');
    expect(errors).toContain('Antwortcode fehlt: GET /iam/me/data-export -> 405');
    expect(errors).toContain('Antwortcode fehlt: GET /iam/admin/data-subject-rights/export -> 405');
  });
});
