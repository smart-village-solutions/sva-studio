import { describe, expect, it } from 'vitest';

import {
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_LIMITS,
  normalizeSsfLocale,
  ssfRuntimeConfigurationSchema,
  ssfRuntimeConfigurationV1OpenApiDocument,
} from '../src/index.js';

describe('SSF runtime configuration V1 contract', () => {
  it('normalizes valid BCP-47 tags and rejects non-canonical response tags', () => {
    expect(normalizeSsfLocale('de-de')).toBe('de-DE');

    const result = ssfRuntimeConfigurationSchema.safeParse({
      contractVersion: '1.0',
      configurationRevision: `sha256:${'a'.repeat(64)}`,
      authorizationRevision: `sha256:${'b'.repeat(64)}`,
      tenant: { id: 'tenant-1', displayName: 'Tenant', timeZone: 'Europe/Berlin' },
      branding: { logo: null, icon: null },
      localization: {
        defaultLocale: 'de-de',
        locales: [
          {
            locale: 'de-de',
            authenticatedHomeExplanationHtml: '',
            guestExplanationHtml: '',
            conversationContentStorageQuestionHtml: null,
          },
        ],
      },
      conversationContentStorage: { mode: 'disabled' },
    });

    expect(result.success).toBe(false);
  });

  it('uses the same limits in the OpenAPI document', () => {
    const endpoint = ssfRuntimeConfigurationV1OpenApiDocument.paths[SSF_RUNTIME_ENDPOINT_PATH];
    const responseSchema =
      ssfRuntimeConfigurationV1OpenApiDocument.components.schemas.SsfRuntimeConfigurationV1;
    const localization = responseSchema.properties.localization;

    expect(endpoint.get.operationId).toBe('getSsfRuntimeConfigurationV1');
    expect(localization.properties.locales.maxItems).toBe(SSF_RUNTIME_LIMITS.activeLocales);
    expect(localization.properties.locales.description).toBe(
      'Locale entries are unique by their locale field.'
    );
    expect(localization.properties.locales).not.toHaveProperty('uniqueItems');
    expect(
      ssfRuntimeConfigurationV1OpenApiDocument.components.schemas.SsfMediaV1.properties.url
        .maxLength
    ).toBe(SSF_RUNTIME_LIMITS.urlCharacters);
  });

  it('measures HTML limits as UTF-8 bytes', () => {
    const oversized = '💬'.repeat(SSF_RUNTIME_LIMITS.htmlUtf8Bytes / 4 + 1);
    const base = {
      contractVersion: '1.0',
      configurationRevision: `sha256:${'a'.repeat(64)}`,
      authorizationRevision: `sha256:${'b'.repeat(64)}`,
      tenant: { id: 'tenant-1', displayName: 'Tenant', timeZone: 'UTC' },
      branding: { logo: null, icon: null },
      localization: {
        defaultLocale: 'en',
        locales: [
          {
            locale: 'en',
            authenticatedHomeExplanationHtml: oversized,
            guestExplanationHtml: '',
            conversationContentStorageQuestionHtml: null,
          },
        ],
      },
      conversationContentStorage: { mode: 'disabled' },
    };

    expect(ssfRuntimeConfigurationSchema.safeParse(base).success).toBe(false);
  });

  it('rejects duplicate locales, inactive defaults and storage questions in disabled mode', () => {
    const locale = {
      locale: 'en',
      authenticatedHomeExplanationHtml: '',
      guestExplanationHtml: '',
      conversationContentStorageQuestionHtml: '<p>Question</p>',
    };
    const result = ssfRuntimeConfigurationSchema.safeParse({
      contractVersion: '1.0',
      configurationRevision: `sha256:${'a'.repeat(64)}`,
      authorizationRevision: `sha256:${'b'.repeat(64)}`,
      tenant: { id: 'tenant-1', displayName: 'Tenant', timeZone: 'Europe/Berlin' },
      branding: { logo: null, icon: null },
      localization: {
        defaultLocale: 'de-DE',
        locales: [locale, locale],
      },
      conversationContentStorage: { mode: 'disabled' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'Locales must be unique.',
          'The default locale must be active.',
          'Storage questions must be null when conversation storage is disabled.',
        ])
      );
    }
  });
});
