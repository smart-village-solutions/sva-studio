import { describe, expect, it } from 'vitest';

import {
  allowReasonCodes,
  evaluateAuthorizeDecision,
  iamCorePackageRoles,
  iamCoreVersion,
  type AuthorizeRequest,
} from './index.js';

describe('@sva/iam-core', () => {
  it('declares the target package role', () => {
    expect(iamCoreVersion).toBe('0.0.1');
    expect(iamCorePackageRoles).toContain('authorization-contracts');
    expect(iamCorePackageRoles).toContain('permission-engine');
  });

  it('owns authorization reason codes and decision engine', () => {
    const request: AuthorizeRequest = {
      instanceId: 'inst-1',
      action: 'content.read',
      resource: { type: 'content', id: 'content-1' },
    };

    expect(allowReasonCodes).toEqual(['allowed_by_rbac', 'allowed_by_abac']);
    expect(evaluateAuthorizeDecision(request, [])).toMatchObject({
      allowed: false,
      reason: 'permission_missing',
    });
  });
});
