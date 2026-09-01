import { describe, expect, it } from 'vitest';

import { addSsfConfigurationRevisions, createSsfConfigurationRevision } from '../src/runtime.js';
import type { SsfRuntimeConfigurationWithoutRevisions } from '../src/index.js';

const baseConfiguration: SsfRuntimeConfigurationWithoutRevisions = {
  contractVersion: '1.0',
  tenant: { id: 'tenant-1', displayName: 'Ärger', timeZone: 'Europe/Berlin' },
  branding: { logo: null, icon: null },
  localization: {
    defaultLocale: 'de-DE',
    locales: [
      {
        locale: 'en',
        authenticatedHomeExplanationHtml: '<p>Hello</p>',
        guestExplanationHtml: '<p>Guest</p>',
        conversationContentStorageQuestionHtml: null,
      },
      {
        locale: 'de-DE',
        authenticatedHomeExplanationHtml: '<p>Hallo</p>',
        guestExplanationHtml: '<p>Gast</p>',
        conversationContentStorageQuestionHtml: null,
      },
    ],
  },
  conversationContentStorage: { mode: 'disabled' },
};

describe('SSF configuration revision', () => {
  it('is stable across locale and object key order', () => {
    const reordered: SsfRuntimeConfigurationWithoutRevisions = {
      conversationContentStorage: { mode: 'disabled' },
      localization: {
        locales: [...baseConfiguration.localization.locales].reverse(),
        defaultLocale: 'de-DE',
      },
      branding: { icon: null, logo: null },
      tenant: { timeZone: 'Europe/Berlin', displayName: 'Ärger', id: 'tenant-1' },
      contractVersion: '1.0',
    };

    expect(createSsfConfigurationRevision(reordered)).toBe(
      createSsfConfigurationRevision(baseConfiguration)
    );
  });

  it('matches the V1 JCS golden vector and excludes authorization revision', () => {
    const revision = createSsfConfigurationRevision(baseConfiguration);
    const first = addSsfConfigurationRevisions(baseConfiguration, `sha256:${'a'.repeat(64)}`);
    const second = addSsfConfigurationRevisions(baseConfiguration, `sha256:${'b'.repeat(64)}`);

    expect(revision).toBe(
      'sha256:0f9e3397609a884ea2d3d4e1236dfacce9622c71996d151bae4ec93e946ca942'
    );
    expect(first.configurationRevision).toBe(second.configurationRevision);
    expect(first.authorizationRevision).not.toBe(second.authorizationRevision);
  });

  it('changes when effective content changes', () => {
    const changed = structuredClone(baseConfiguration);
    changed.tenant.displayName = 'Andere Kommune';

    expect(createSsfConfigurationRevision(changed)).not.toBe(
      createSsfConfigurationRevision(baseConfiguration)
    );
  });
});
