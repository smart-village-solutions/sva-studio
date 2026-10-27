import { describe, expect, it } from 'vitest';

import { resolveMainserverPrincipalControl } from './mainserver-principal-control';

describe('resolveMainserverPrincipalControl', () => {
  it('binds local readiness to the organization and personal principal choices', () => {
    const result = resolveMainserverPrincipalControl({
      contextAvailable: true,
      activeOrganizationId: 'org-1',
      organizations: [
        {
          organizationId: 'org-1' as never,
          organizationKey: 'alpha',
          displayName: 'Testgemeinde',
          organizationType: 'municipality',
          contentAuthorPolicy: 'org_or_personal',
          isActive: true,
          isDefaultContext: true,
          mainserverReadiness: 'verification_pending',
        },
      ],
      personalMainserverReadiness: 'ready',
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.control.readinessByPrincipal).toEqual({
      organization: 'verification_pending',
      user: 'ready',
    });
  });

  it('fails closed when an older context response has no readiness projection', () => {
    const result = resolveMainserverPrincipalControl({
      contextAvailable: true,
      organizations: [],
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.control.readinessByPrincipal?.user).toBe('unavailable');
  });
});
