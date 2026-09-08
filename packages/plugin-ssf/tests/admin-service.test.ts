import { describe, expect, it } from 'vitest';

import { createSsfTenantConfigurationView } from '../src/admin-service.js';

describe('SSF administration view', () => {
  it('resolves tenant overrides over system defaults without branding fields', () => {
    const view = createSsfTenantConfigurationView({
      serverSettings: {
        defaultLocale: 'de-DE',
        conversationContentStorageAllowed: true,
        conversationContentStorageMode: 'ask',
      },
      serverLocales: [
        { locale: 'de-DE', available: true, authenticatedHomeExplanationHtml: '<p>System</p>' },
      ],
      tenantSettings: { defaultLocale: null, conversationContentStorageMode: null },
      tenantLocales: [
        { locale: 'de-DE', enabled: true, authenticatedHomeExplanationHtml: '<p>Tenant</p>' },
      ],
    });

    expect(view.effective.defaultLocale).toBe('de-DE');
    expect(view.effective.locales[0]?.authenticatedHomeExplanationHtml).toBe('<p>Tenant</p>');
    expect(view.overrides.locales[0]?.guestExplanationHtml).toBeNull();
    expect(view).not.toHaveProperty('branding');
  });
});
