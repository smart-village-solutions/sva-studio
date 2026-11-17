import { describe, expect, it, vi } from 'vitest';

import { KEYCLOAK_UNCLASSIFIED_ERROR_CODE } from './errors.js';
import { buildErrorDetails } from './transport-error.js';

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

const READ_ONLY = 'error-user-attribute-read-only';
const FALLBACK_MESSAGE = 'Keycloak update_user failed with HTTP 400';

const parse = (body: string | null, status = 400) =>
  buildErrorDetails(new Response(body, { status }), 'update_user', 1_000);

const parseJson = (payload: unknown) => parse(JSON.stringify(payload));

describe('buildErrorDetails', () => {
  it('keeps fully classified name-only read-only errors as structured field errors', async () => {
    await expect(
      parseJson({
        errors: [
          { field: 'firstName', errorMessage: READ_ONLY, params: ['firstName'] },
          { field: 'lastName', errorMessage: READ_ONLY, params: ['lastName'] },
        ],
      })
    ).resolves.toEqual({
      message: `Keycloak update_user failed: firstName: ${READ_ONLY} (firstName); lastName: ${READ_ONLY} (lastName)`,
      fieldErrors: [
        { field: 'firstName', code: READ_ONLY },
        { field: 'lastName', code: READ_ONLY },
      ],
    });
  });

  it.each([
    { name: 'without errorMessage', entry: { field: 'email' }, expected: { field: 'email' } },
    {
      name: 'with a blank errorMessage',
      entry: { field: 'email', errorMessage: '' },
      expected: { field: 'email' },
    },
    { name: 'with a non-string errorMessage', entry: { errorMessage: 42 }, expected: {} },
    { name: 'as an empty object', entry: {}, expected: {} },
    { name: 'as null', entry: null, expected: {} },
    { name: 'as a primitive', entry: 'error-invalid-email', expected: {} },
  ])('preserves a nested error $name as unclassified', async ({ entry, expected }) => {
    const details = await parseJson({
      errors: [{ field: 'firstName', errorMessage: READ_ONLY }, entry],
    });

    expect(details.fieldErrors).toEqual([
      { field: 'firstName', code: READ_ONLY },
      { ...expected, code: KEYCLOAK_UNCLASSIFIED_ERROR_CODE },
    ]);
  });

  it('preserves a malformed non-array errors value as unclassified', async () => {
    const details = await parseJson({ errors: 'boom' });

    expect(details.fieldErrors).toEqual([{ code: KEYCLOAK_UNCLASSIFIED_ERROR_CODE }]);
  });

  it('parses a single nested error object instead of dropping it', async () => {
    const details = await parseJson({
      errors: { field: 'email', errorMessage: 'error-invalid-email' },
    });

    expect(details.fieldErrors).toEqual([{ field: 'email', code: 'error-invalid-email' }]);
  });

  it('keeps top-level field and parameter context next to nested errors', async () => {
    const details = await parseJson({
      field: 'email',
      errorMessage: 'error-invalid-email',
      params: ['email'],
      errors: [{ field: 'firstName', errorMessage: READ_ONLY }],
    });

    expect(details).toEqual({
      message: `Keycloak update_user failed: email: error-invalid-email (email); firstName: ${READ_ONLY}`,
      fieldErrors: [
        { field: 'email', code: 'error-invalid-email' },
        { field: 'firstName', code: READ_ONLY },
      ],
    });
  });

  it('treats a top-level field without errorMessage as unclassified', async () => {
    const details = await parseJson({
      field: 'email',
      errors: [{ field: 'firstName', errorMessage: READ_ONLY }],
    });

    expect(details.fieldErrors).toEqual([
      { field: 'email', code: KEYCLOAK_UNCLASSIFIED_ERROR_CODE },
      { field: 'firstName', code: READ_ONLY },
    ]);
  });

  it('keeps a top-level errorMessage as a structured error so it cannot be hidden by nested errors', async () => {
    const details = await parseJson({
      errorMessage: 'User exists with same username',
      errors: [{ field: 'firstName', errorMessage: READ_ONLY }],
    });

    expect(details.fieldErrors).toEqual([
      { code: 'User exists with same username' },
      { field: 'firstName', code: READ_ONLY },
    ]);
  });

  it('keeps OAuth error descriptions together with structured errors', async () => {
    const details = await parseJson({
      error: 'invalid_request',
      error_description: 'Invalid profile',
      field: 'lastName',
      errorMessage: READ_ONLY,
    });

    expect(details).toEqual({
      message: `Keycloak update_user failed: Invalid profile; lastName: ${READ_ONLY}`,
      fieldErrors: [{ field: 'lastName', code: READ_ONLY }],
    });
  });

  it.each([
    [{ error: 'invalid_grant' }, 'Keycloak update_user failed: invalid_grant'],
    [
      { error: 'invalid_grant', error_description: 'Token expired' },
      'Keycloak update_user failed: Token expired',
    ],
    [
      { errorMessage: 'error-user-attribute-required', params: ['email'] },
      'Keycloak update_user failed: error-user-attribute-required ([REDACTED])',
    ],
  ])('builds a readable message for %j', async (payload, message) => {
    await expect(parseJson(payload)).resolves.toMatchObject({ message });
  });

  it('keeps field-name and numeric parameters but redacts every other value', async () => {
    const details = await parseJson({
      field: 'email',
      errorMessage: 'error-invalid-email',
      params: ['email', 'person@example.test', 255, '0151234567', null],
    });

    expect(details.message).toBe(
      'Keycloak update_user failed: email: error-invalid-email (email, [REDACTED], 255, [REDACTED], [REDACTED])'
    );
    expect(details.message).not.toContain('person@example.test');
    expect(details.message).not.toContain('0151234567');
    expect(details.fieldErrors).toEqual([{ field: 'email', code: 'error-invalid-email' }]);
  });

  it('does not duplicate a single nested error that Keycloak mirrors on the container', async () => {
    const mirrored = { field: 'firstName', errorMessage: READ_ONLY, params: ['firstName'] };

    await expect(parseJson({ ...mirrored, errors: [mirrored] })).resolves.toEqual({
      message: `Keycloak update_user failed: firstName: ${READ_ONLY} (firstName)`,
      fieldErrors: [{ field: 'firstName', code: READ_ONLY }],
    });
  });

  it('does not invent an unclassified error from an empty field or empty params', async () => {
    await expect(
      parseJson({ error: 'invalid_request', error_description: 'Bad', field: '', params: [] })
    ).resolves.toEqual({ message: 'Keycloak update_user failed: Bad', fieldErrors: [] });
  });

  it('caps the diagnostic message while keeping every structured field error', async () => {
    const errors = Array.from({ length: 12 }, (_, index) => ({
      field: `attribute${index}`,
      errorMessage: 'error-invalid-value',
    }));

    const details = await parseJson({ errors });

    expect(details.fieldErrors).toHaveLength(12);
    expect(details.message).toContain('attribute9: error-invalid-value; +2 more');
    expect(details.message).not.toContain('attribute10');
  });

  it.each([
    { name: 'an empty body', body: null },
    { name: 'a non-JSON body', body: '<html>Bad Request</html>' },
    { name: 'a JSON null', body: 'null' },
    { name: 'a JSON array', body: '[{"field":"firstName","errorMessage":"x"}]' },
    { name: 'a JSON primitive', body: '"error-invalid-email"' },
    { name: 'an empty JSON object', body: '{}' },
    { name: 'an empty errors array', body: '{"errors":[]}' },
    {
      name: 'only null members',
      body: '{"field":null,"errorMessage":null,"params":null,"errors":null}',
    },
  ])('falls back to a stable message without field errors for $name', async ({ body }) => {
    await expect(parse(body)).resolves.toEqual({ message: FALLBACK_MESSAGE, fieldErrors: [] });
  });

  it('falls back when reading the body fails', async () => {
    const response = new Response('{}', { status: 502 });
    vi.spyOn(response, 'text').mockRejectedValueOnce(new Error('socket hang up'));

    await expect(buildErrorDetails(response, 'update_user', 1_000)).resolves.toEqual({
      message: 'Keycloak update_user failed with HTTP 502',
      fieldErrors: [],
    });
  });
});
