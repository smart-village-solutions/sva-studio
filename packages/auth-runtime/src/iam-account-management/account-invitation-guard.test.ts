import { compileAccountInvitationTemplate, DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';
import { describe, expect, it, vi } from 'vitest';

import { ensureAccountInvitationRealmValues } from './account-invitation-guard.js';

const template = { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 2 };

describe('ensureAccountInvitationRealmValues', () => {
  it('keeps the legacy send path unchanged without a custom template', async () => {
    const readRealmLocalizationTexts = vi.fn();
    await expect(
      ensureAccountInvitationRealmValues({
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
      ensureAccountInvitationRealmValues({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => 'sva-kern2'),
        readRealmLocalizationTexts: expectedReader,
      })
    ).resolves.toBeUndefined();
  });

  it('updates only the managed messages and confirms them by readback', async () => {
    const expected = compileAccountInvitationTemplate({
      template,
      tenantName: 'Demo',
      tenantHomepageUrl: 'https://demo.example/',
    });
    let actual: Readonly<Record<string, string>> = { unrelated: 'bleibt' };
    const updateRealmLocalizationTexts = vi.fn(async (_locale, values) => {
      actual = { ...actual, ...values };
    });

    await expect(
      ensureAccountInvitationRealmValues({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => 'sva-kern2'),
        readRealmLocalizationTexts: vi.fn(async () => actual),
        updateRealmEmailTheme: vi.fn(async () => undefined),
        updateRealmLocalizationTexts,
      })
    ).resolves.toBeUndefined();
    expect(updateRealmLocalizationTexts).toHaveBeenCalledWith('de', expected);
    expect(updateRealmLocalizationTexts.mock.calls[0]?.[1]).toEqual(expected);
  });

  it('updates the email theme before confirming the projection', async () => {
    const expected = compileAccountInvitationTemplate({
      template,
      tenantName: 'Demo',
      tenantHomepageUrl: 'https://demo.example/',
    });
    let emailTheme = 'base';
    const updateRealmEmailTheme = vi.fn(async (value: string) => {
      emailTheme = value;
    });
    await expect(
      ensureAccountInvitationRealmValues({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => emailTheme),
        readRealmLocalizationTexts: vi.fn(async () => expected),
        updateRealmEmailTheme,
        updateRealmLocalizationTexts: vi.fn(async () => undefined),
      })
    ).resolves.toBeUndefined();
    expect(updateRealmEmailTheme).toHaveBeenCalledWith('sva-kern2');
  });

  it('blocks delivery when the write cannot be confirmed', async () => {
    await expect(
      ensureAccountInvitationRealmValues({
        instanceId: 'demo',
        template,
        tenantName: 'Demo',
        tenantHomepageUrl: 'https://demo.example/',
        readRealmEmailTheme: vi.fn(async () => 'sva-kern2'),
        readRealmLocalizationTexts: vi.fn(async () => ({})),
        updateRealmEmailTheme: vi.fn(async () => undefined),
        updateRealmLocalizationTexts: vi.fn(async () => undefined),
      })
    ).rejects.toMatchObject({ code: 'account_invitation_template_drift', retryable: true });
  });
});
