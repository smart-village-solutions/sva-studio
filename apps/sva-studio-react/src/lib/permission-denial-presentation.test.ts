import { describe, expect, it } from 'vitest';

import {
  formatPermissionDenialMessage,
  readPermissionDenialFromError,
  readPermissionDenialFromSearch,
} from './permission-denial-presentation';

const translate = (key: string, variables: Readonly<Record<string, string>>) =>
  `${key}:${key.endsWith('.single') ? variables.permission : variables.permissions}`;
const resolveTitle = (permissionId: string) =>
  permissionId === 'iam.user.write' ? 'Benutzer bearbeiten' : undefined;

describe('permission denial presentation', () => {
  it('formats a known permission with title and technical id', () => {
    expect(
      formatPermissionDenialMessage(
        {
          required_permissions: ['iam.user.write'],
          requirement_mode: 'allOf',
          denial_reason: 'permission_missing',
        },
        { resolveTitle, translate }
      )
    ).toBe('permissionDenial.missing.single:Benutzer bearbeiten (iam.user.write)');
  });

  it('falls back to the validated technical id', () => {
    expect(
      formatPermissionDenialMessage(
        {
          required_permissions: ['custom.read'],
          requirement_mode: 'allOf',
          denial_reason: 'permission_missing',
        },
        { resolveTitle, translate }
      )
    ).toBe('permissionDenial.missing.single:custom.read');
  });

  it('distinguishes any-of and contextual denials', () => {
    expect(
      formatPermissionDenialMessage(
        {
          required_permissions: ['news.update', 'news.publish'],
          requirement_mode: 'anyOf',
          denial_reason: 'permission_missing',
        },
        { resolveTitle, translate }
      )
    ).toBe('permissionDenial.missing.anyOf:news.update, news.publish');
    expect(
      formatPermissionDenialMessage(
        {
          required_permissions: ['news.update'],
          requirement_mode: 'allOf',
          denial_reason: 'abac_condition_unmet',
        },
        { resolveTitle, translate }
      )
    ).toBe('permissionDenial.context.single:news.update');
  });

  it('reads the shared details from API errors and route search params', () => {
    const details = {
      required_permissions: ['media.update'],
      requirement_mode: 'allOf',
      denial_reason: 'permission_missing',
    } as const;
    expect(readPermissionDenialFromError({ error: { details } })).toEqual(details);
    expect(
      readPermissionDenialFromSearch(
        new URLSearchParams(
          'requiredPermission=media.update&permissionMode=allOf&permissionReason=permission_missing'
        )
      )
    ).toEqual(details);
  });

  it('does not infer a permission from a generic forbidden response', () => {
    expect(
      readPermissionDenialFromError({ error: { code: 'forbidden', message: 'Keine Berechtigung.' } })
    ).toBeUndefined();
  });

  it('reads permission details preserved directly on an API error', () => {
    expect(
      readPermissionDenialFromError({
        permissionDenial: {
          required_permissions: ['news.publish'],
          requirement_mode: 'allOf',
          denial_reason: 'permission_missing',
        },
      })
    ).toEqual({
      required_permissions: ['news.publish'],
      requirement_mode: 'allOf',
      denial_reason: 'permission_missing',
    });
  });
});
