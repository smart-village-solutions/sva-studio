import { describe, expect, it } from 'vitest';

import {
  ssfSystemConfigurationInputSchema,
  ssfTenantConfigurationInputSchema,
} from '../src/admin-contracts.js';
import { SSF_PRODUCT_DEFAULTS_V1 } from '../src/defaults.js';

const systemInput = {
  defaultLocale: 'de-DE',
  conversationContentStorageMode: 'ask',
  locales: SSF_PRODUCT_DEFAULTS_V1.locales.map((entry) => ({ ...entry, available: true })),
} as const;

describe('SSF administration contracts', () => {
  it('accepts the complete branding-free system contract', () => {
    expect(ssfSystemConfigurationInputSchema.parse(systemInput)).toEqual(systemInput);
    expect(systemInput).not.toHaveProperty('branding');
  });

  it('rejects unknown administration fields', () => {
    expect(() =>
      ssfSystemConfigurationInputSchema.parse({ ...systemInput, branding: {} })
    ).toThrow();
  });

  it('rejects an inactive default language', () => {
    expect(() =>
      ssfSystemConfigurationInputSchema.parse({
        ...systemInput,
        locales: systemInput.locales.map((entry) => ({
          ...entry,
          available: entry.locale !== 'de-DE',
        })),
      })
    ).toThrow();
  });

  it('uses null as the explicit tenant inheritance marker', () => {
    const input = {
      defaultLocale: null,
      conversationContentStorageMode: null,
      locales: SSF_PRODUCT_DEFAULTS_V1.locales.map((entry) => ({
        locale: entry.locale,
        enabled: null,
        authenticatedHomeExplanationHtml: null,
        guestExplanationHtml: null,
        conversationContentStorageQuestionHtml: null,
      })),
    };
    expect(ssfTenantConfigurationInputSchema.parse(input)).toEqual(input);
  });
});
