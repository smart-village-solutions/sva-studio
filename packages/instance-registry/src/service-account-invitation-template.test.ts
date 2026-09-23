import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';
import { describe, expect, it, vi } from 'vitest';

import {
  getServerAccountInvitationTemplate,
  updateServerAccountInvitationTemplate,
} from './service-account-invitation-template.js';

describe('server account invitation template service', () => {
  it('returns the built-in default when no server override exists', async () => {
    const repository = {
      getServerAccountInvitationTemplate: vi.fn(async () => ({ revision: 3 })),
    };

    await expect(getServerAccountInvitationTemplate(repository)).resolves.toEqual({
      revision: 3,
      effectiveTemplate: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 3 },
      source: 'sva_default',
    });
  });

  it('validates and stores an override with the next revision', async () => {
    const template = { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, subject: 'Server {{tenantName}}' };
    const repository = {
      updateServerAccountInvitationTemplate: vi.fn(async ({ template: stored }) => ({
        revision: 5,
        template: stored ?? undefined,
      })),
    };

    await expect(
      updateServerAccountInvitationTemplate({
        repository,
        expectedRevision: 4,
        template,
        actorId: 'admin-1',
      })
    ).resolves.toEqual({
      revision: 5,
      effectiveTemplate: { ...template, revision: 5 },
      source: 'server',
    });
    expect(repository.updateServerAccountInvitationTemplate).toHaveBeenCalledWith({
      expectedRevision: 4,
      template: { ...template, revision: 5 },
      actorId: 'admin-1',
    });
  });

  it('resets only the server override and advances the revision', async () => {
    const repository = {
      updateServerAccountInvitationTemplate: vi.fn(async () => ({ revision: 6 })),
    };

    await expect(
      updateServerAccountInvitationTemplate({
        repository,
        expectedRevision: 5,
        template: null,
      })
    ).resolves.toEqual({
      revision: 6,
      effectiveTemplate: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 6 },
      source: 'sva_default',
    });
  });
});
