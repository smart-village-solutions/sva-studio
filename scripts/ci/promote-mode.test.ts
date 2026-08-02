import { describe, expect, it } from 'vitest';

import { validatePromoteMode } from './promote-mode.ts';

describe('promote mode', () => {
  it('defaults to standard and requires a reason for recovery', () => {
    expect(validatePromoteMode({ environment: 'prod', mode: undefined, recoveryReason: undefined })).toBe('standard');
    expect(() => validatePromoteMode({ environment: 'prod', mode: 'recovery', recoveryReason: '  ' })).toThrow(/PROMOTE_RECOVERY_REASON_REQUIRED/u);
    expect(validatePromoteMode({ environment: 'prod', mode: 'recovery', recoveryReason: 'Production ist degradiert' })).toBe('recovery');
    expect(() => validatePromoteMode({ environment: 'prod', mode: 'other', recoveryReason: undefined })).toThrow(/PROMOTE_MODE_INVALID/u);
  });
});
