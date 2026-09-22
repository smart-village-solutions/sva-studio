import {
  compileAccountInvitationTemplate,
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
} from '@sva/core';
import { describe, expect, it, vi } from 'vitest';

import { assertAccountInvitationProjection } from './account-invitation-guard.js';

const template = { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 2 };

describe('assertAccountInvitationProjection', () => {
  it('keeps the legacy send path unchanged without a custom template', async () => {
    const readRealmLocalizationTexts = vi.fn();
    await expect(
      assertAccountInvitationProjection({
        instanceId: 'demo',
        readRealmLocalizationTexts,
      })
    ).resolves.toBeUndefined();
    expect(readRealmLocalizationTexts).not.toHaveBeenCalled();
  });

  it('accepts an exact custom projection', async () => {
    const expectedReader = vi.fn(async () => {
      return compileAccountInvitationTemplate({
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
      });
    });

    await expect(
      assertAccountInvitationProjection({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => 'sva-kern2'),
        readRealmLocalizationTexts: expectedReader,
      })
    ).resolves.toBeUndefined();
  });

  it('blocks delivery when a managed realm message differs', async () => {
    await expect(
      assertAccountInvitationProjection({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => 'sva-kern2'),
        readRealmLocalizationTexts: vi.fn(async () => ({})),
      })
    ).rejects.toMatchObject({ code: 'account_invitation_template_drift', retryable: true });
  });

  it('blocks delivery when the realm uses another email theme', async () => {
    await expect(
      assertAccountInvitationProjection({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => 'base'),
        readRealmLocalizationTexts: vi.fn(async () =>
          compileAccountInvitationTemplate({
            template,
            tenantName: 'Demo',
            tenantHomepageUrl: 'https://demo.example/',
          })
        ),
      })
    ).rejects.toMatchObject({ code: 'account_invitation_template_drift', retryable: true });
  });
});
