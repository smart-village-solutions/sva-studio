import { describe, expect, it } from 'vitest';

import {
  createPermissionDenialDetails,
  createPermissionDenialDetailsForAction,
  isPermissionActionId,
  parsePermissionDenialDetails,
} from './permission-denial.js';

describe('permission denial contract', () => {
  it('creates a normalized all-of denial by default', () => {
    expect(
      createPermissionDenialDetails({
        requiredPermissions: ['iam.user.write', 'iam.user.write', 'media.read'],
      })
    ).toEqual({
      required_permissions: ['iam.user.write', 'media.read'],
      requirement_mode: 'allOf',
      denial_reason: 'permission_missing',
    });
  });

  it('preserves any-of and contextual denial semantics', () => {
    expect(
      createPermissionDenialDetails({
        requiredPermissions: ['news.update', 'news.publish'],
        requirementMode: 'anyOf',
        denialReason: 'abac_condition_unmet',
      })
    ).toEqual({
      required_permissions: ['news.update', 'news.publish'],
      requirement_mode: 'anyOf',
      denial_reason: 'abac_condition_unmet',
    });
  });

  it('creates action details only for public denial reasons', () => {
    expect(createPermissionDenialDetailsForAction('iam.user.write', 'permission_missing')).toEqual({
      required_permissions: ['iam.user.write'],
      requirement_mode: 'allOf',
      denial_reason: 'permission_missing',
    });
    expect(
      createPermissionDenialDetailsForAction('iam.user.write', 'legal_acceptance_required')
    ).toBeUndefined();
  });

  it('accepts fully-qualified host and plugin action ids', () => {
    expect(isPermissionActionId('iam.legalText.write')).toBe(true);
    expect(isPermissionActionId('waste-management.settings.manage')).toBe(true);
    expect(isPermissionActionId('read')).toBe(false);
    expect(isPermissionActionId('IAM.user.write')).toBe(false);
  });

  it('rejects a trusted denial without a valid action', () => {
    expect(() => createPermissionDenialDetails({ requiredPermissions: ['read', ''] })).toThrow(
      'permission_denial_requires_valid_permission'
    );
  });

  it('parses, deduplicates and limits untrusted details', () => {
    const values = Array.from({ length: 20 }, (_, index) => `plugin.action${index}`);
    expect(
      parsePermissionDenialDetails({
        required_permissions: [...values, values[0], 'invalid'],
        requirement_mode: 'allOf',
        denial_reason: 'permission_missing',
      })?.required_permissions
    ).toEqual(values.slice(0, 16));
  });

  it.each([
    undefined,
    {},
    { required_permissions: [], requirement_mode: 'allOf', denial_reason: 'permission_missing' },
    {
      required_permissions: ['iam.user.write'],
      requirement_mode: 'someOf',
      denial_reason: 'permission_missing',
    },
    {
      required_permissions: ['iam.user.write'],
      requirement_mode: 'allOf',
      denial_reason: 'internal_error',
    },
  ])('fails closed for malformed public details %#', (value) => {
    expect(parsePermissionDenialDetails(value)).toBeUndefined();
  });
});
