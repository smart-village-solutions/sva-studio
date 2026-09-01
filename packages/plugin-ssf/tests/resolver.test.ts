import { describe, expect, it, vi } from 'vitest';

import { resolveSsfRuntimeConfiguration } from '../src/runtime.js';

const tenant = {
  id: 'tenant-1',
  displayName: 'Beispielkommune',
  timeZone: 'Europe/Berlin',
};

const createMediaResolver = () => ({
  resolve: vi.fn(async ({ reference, purpose }: { reference: string; purpose: string }) => ({
    url: `https://media.example/${reference}`,
    alternativeText: purpose,
  })),
});

describe('resolveSsfRuntimeConfiguration', () => {
  it('resolves each text as tenant, server, then product default', async () => {
    const configuration = await resolveSsfRuntimeConfiguration({
      tenant,
      serverLocales: [
        {
          locale: 'de-DE',
          authenticatedHomeExplanationHtml: '<p>Server home</p>',
          guestExplanationHtml: '<p>Server guest</p>',
        },
      ],
      tenantLocales: [
        {
          locale: 'de-DE',
          authenticatedHomeExplanationHtml: '<p>Tenant home</p>',
        },
      ],
      mediaResolver: createMediaResolver(),
    });

    const german = configuration.localization.locales.find((entry) => entry.locale === 'de-DE');
    expect(german).toEqual({
      locale: 'de-DE',
      authenticatedHomeExplanationHtml: '<p>Tenant home</p>',
      guestExplanationHtml: '<p>Server guest</p>',
      conversationContentStorageQuestionHtml: null,
    });
  });

  it('limits tenant branding and storage mode after override resolution', async () => {
    const mediaResolver = createMediaResolver();
    const configuration = await resolveSsfRuntimeConfiguration({
      tenant,
      serverSettings: { logoMediaReference: 'server-logo' },
      tenantSettings: {
        customBrandingAllowed: false,
        conversationContentStorageAllowed: false,
        conversationContentStorageMode: 'ask',
        logoMediaReference: 'tenant-logo',
      },
      tenantLocales: [
        {
          locale: 'de-DE',
          conversationContentStorageQuestionHtml: '<script>hidden()</script>',
        },
      ],
      mediaResolver,
    });

    expect(configuration.branding.logo?.url).toBe('https://media.example/server-logo');
    expect(configuration.conversationContentStorage.mode).toBe('disabled');
    expect(
      configuration.localization.locales.every(
        (entry) => entry.conversationContentStorageQuestionHtml === null
      )
    ).toBe(true);
    expect(mediaResolver.resolve).not.toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'tenant-logo' })
    );
  });

  it('allows tenant branding and the localized consent question when policies permit it', async () => {
    const configuration = await resolveSsfRuntimeConfiguration({
      tenant,
      tenantSettings: {
        customBrandingAllowed: true,
        conversationContentStorageAllowed: true,
        conversationContentStorageMode: 'ask',
        logoMediaReference: 'tenant-logo',
      },
      mediaResolver: createMediaResolver(),
    });

    expect(configuration.branding.logo?.url).toBe('https://media.example/tenant-logo');
    expect(configuration.branding.logo?.alternativeText).toBe('logo');
    expect(configuration.conversationContentStorage.mode).toBe('ask');
    expect(
      configuration.localization.locales.every(
        (entry) => entry.conversationContentStorageQuestionHtml !== null
      )
    ).toBe(true);
  });

  it('binds media resolution to the current tenant and fails closed for missing media', async () => {
    const mediaResolver = {
      resolve: vi.fn(async () => {
        throw new Error('media_not_found');
      }),
    };

    await expect(
      resolveSsfRuntimeConfiguration({
        tenant,
        tenantSettings: {
          customBrandingAllowed: true,
          logoMediaReference: 'foreign-or-missing',
        },
        mediaResolver,
      })
    ).rejects.toThrow('media_not_found');
    expect(mediaResolver.resolve).toHaveBeenCalledWith({
      instanceId: 'tenant-1',
      reference: 'foreign-or-missing',
      purpose: 'logo',
    });
  });

  it('keeps unspecified locales active but rejects an inactive default locale', async () => {
    await expect(
      resolveSsfRuntimeConfiguration({
        tenant,
        serverLocales: [{ locale: 'de-DE', available: false }],
        tenantSettings: { defaultLocale: 'de-DE' },
        tenantLocales: [{ locale: 'en', enabled: true }],
        mediaResolver: createMediaResolver(),
      })
    ).rejects.toThrow('default locale de-DE is not active');
  });
});
