import { describe, expect, it } from 'vitest';

import {
  evaluateAuthorizeDecision,
  iamCorePackageRoles,
  iamCoreVersion,
  type AuthorizeRequest,
} from './index.js';

describe('@sva/iam-core package scaffold', () => {
  it('declares the target package role', () => {
    expect(iamCoreVersion).toBe('0.0.1');
    expect(iamCorePackageRoles).toContain('authorization-contracts');
  });

  it('exposes the authorization decision contract', () => {
    const request: AuthorizeRequest = {
      instanceId: 'inst-1',
      action: 'content.read',
      resource: { type: 'content', id: 'content-1' },
    };

    expect(evaluateAuthorizeDecision(request, [])).toMatchObject({
      allowed: false,
      reason: 'permission_missing',
    });
  });
});
