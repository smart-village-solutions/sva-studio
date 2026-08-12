import { beforeEach, describe, expect, it } from 'vitest';

import { setActiveLocale } from '../i18n';
import { getStudioPermissionDenialMessage } from './studio-permission-denial-message';

describe('getStudioPermissionDenialMessage', () => {
  beforeEach(() => setActiveLocale('de'));

  it('formats a preserved IAM denial with title and action id', () => {
    expect(
      getStudioPermissionDenialMessage({
        permissionDenial: {
          required_permissions: ['iam.org.write'],
          requirement_mode: 'allOf',
          denial_reason: 'permission_missing',
        },
      })
    ).toBe('Fehlende Berechtigung: Organisationen bearbeiten (iam.org.write).');
  });

  it('keeps generic errors on their existing fallback path', () => {
    expect(getStudioPermissionDenialMessage({ code: 'forbidden' })).toBeUndefined();
  });
});
