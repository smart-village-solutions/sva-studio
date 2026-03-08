/* eslint-disable @nx/enforce-module-boundaries */
import { describe, expect, it } from 'vitest';

import { requiredPaths, requiredSchemas, validateOpenApiDocument } from '../../../scripts/ci/check-openapi-iam.ts';

describe('check-openapi-iam', () => {
  const validDocument = [
    'openapi: 3.1.0',
    'paths:',
    ...requiredPaths.map((path) => `  ${path}`),
    'components:',
    '  schemas:',
    ...requiredSchemas.map((schema) => `    ${schema}`),
  ].join('\n');

  it('accepts a document with the required version, paths and schemas', () => {
    expect(validateOpenApiDocument(validDocument)).toEqual([]);
  });

  it('reports missing version, path and schema entries', () => {
    const errors = validateOpenApiDocument('openapi: 3.0.0\npaths:\n  /health/live:\ncomponents:\n  schemas:\n');

    expect(errors).toContain('OpenAPI-Version 3.1.0 fehlt.');
    expect(errors).toContain('Pfad fehlt: /health/ready:');
    expect(errors).toContain('Schema fehlt: ApiErrorResponse:');
  });
});
