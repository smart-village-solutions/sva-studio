import { describe, expect, it, vi } from 'vitest';
import type { IamHttpError } from '../../../lib/iam-api';

vi.mock('../../../i18n', () => ({
  getActiveLocale: () => 'de',
  t: (key: string) =>
    ({
      'admin.legalTexts.messages.error': 'Allgemeiner Fehler',
      'admin.legalTexts.errors.forbidden': 'Keine Berechtigung',
      'admin.legalTexts.errors.csrfValidationFailed':
        'Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.',
      'admin.legalTexts.errors.rateLimited': 'Zu viele Anfragen',
      'admin.legalTexts.errors.conflict': 'Konflikt',
      'admin.legalTexts.errors.notFound': 'Nicht gefunden',
      'admin.legalTexts.errors.databaseUnavailable': 'Datenbank nicht verfügbar',
      'admin.legalTexts.errors.invalidRequest': 'Ungültige Anfrage',
      'admin.legalTexts.table.publishedUnset': 'Nicht veröffentlicht',
    })[key] ?? key,
}));

import { formatLegalTextDateTime, getLegalTextErrorMessage } from './-legal-texts-shared';

const createIamHttpError = (input: {
  code: string;
  status: number;
  message: string;
}): IamHttpError =>
  ({
    name: 'IamHttpError',
    code: input.code,
    status: input.status,
    message: input.message,
  }) as IamHttpError;

describe('legal texts shared helpers', () => {
  it('maps specific IAM error codes and falls back for missing or unknown errors', () => {
    expect(getLegalTextErrorMessage(null)).toBe('Allgemeiner Fehler');
    expect(getLegalTextErrorMessage(createIamHttpError({ code: 'forbidden', status: 403, message: 'http_403' }))).toBe(
      'Keine Berechtigung'
    );
    expect(
      getLegalTextErrorMessage(
        createIamHttpError({ code: 'csrf_validation_failed', status: 403, message: 'http_403' })
      )
    ).toBe('Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.');
    expect(getLegalTextErrorMessage(createIamHttpError({ code: 'rate_limited', status: 429, message: 'http_429' }))).toBe(
      'Zu viele Anfragen'
    );
    expect(getLegalTextErrorMessage(createIamHttpError({ code: 'conflict', status: 409, message: 'http_409' }))).toBe(
      'Konflikt'
    );
    expect(getLegalTextErrorMessage(createIamHttpError({ code: 'not_found', status: 404, message: 'http_404' }))).toBe(
      'Nicht gefunden'
    );
    expect(
      getLegalTextErrorMessage(
        createIamHttpError({ code: 'database_unavailable', status: 503, message: 'http_503' })
      )
    ).toBe('Datenbank nicht verfügbar');
    expect(
      getLegalTextErrorMessage(
        createIamHttpError({ code: 'invalid_request', status: 400, message: 'Eigene Fehlermeldung' })
      )
    ).toBe('Eigene Fehlermeldung');
    expect(
      getLegalTextErrorMessage(createIamHttpError({ code: 'invalid_request', status: 400, message: 'http_400' }))
    ).toBe('Ungültige Anfrage');
    expect(getLegalTextErrorMessage(createIamHttpError({ code: 'unknown', status: 500, message: 'boom' }))).toBe(
      'Allgemeiner Fehler'
    );
  });

  it('formats dates and keeps unset or invalid values fail-closed', () => {
    expect(formatLegalTextDateTime()).toBe('Nicht veröffentlicht');
    expect(formatLegalTextDateTime('not-a-date')).toBe('not-a-date');
    expect(formatLegalTextDateTime('2026-01-15T10:15:00.000Z')).toBe('15.01.2026, 11:15');
    expect(formatLegalTextDateTime('2026-05-15T10:15:00.000Z')).toBe('15.05.2026, 12:15');
  });
});
