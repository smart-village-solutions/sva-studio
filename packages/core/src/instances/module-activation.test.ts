import { describe, expect, it } from 'vitest';

import {
  canDisableTenantModule,
  resolveTenantModuleEffectiveActivation,
} from './module-activation.js';

describe('tenant module activation', () => {
  it.each([
    ['optional', undefined, false],
    ['automatic', undefined, true],
    ['required', undefined, true],
    ['optional', 'enabled', true],
    ['automatic', 'disabled', false],
    ['required', 'disabled', true],
  ] as const)(
    'resolves %s with override %s to %s',
    (activationPolicy, manualOverride, expected) => {
      expect(resolveTenantModuleEffectiveActivation({ activationPolicy, manualOverride })).toBe(
        expected
      );
    }
  );

  it('allows deactivation except for required modules', () => {
    expect(canDisableTenantModule('optional')).toBe(true);
    expect(canDisableTenantModule('automatic')).toBe(true);
    expect(canDisableTenantModule('required')).toBe(false);
  });
});
