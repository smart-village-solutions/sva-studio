import { afterEach, describe, expect, it } from 'vitest';

import {
  getEnabledMainserverMutationCapabilities,
  getMainserverMutationCapabilityEnvironmentName,
  isMainserverMutationCapabilityEnabled,
} from './mainserver-mutation-capabilities.js';

const environmentName = getMainserverMutationCapabilityEnvironmentName();
const originalValue = process.env[environmentName];

afterEach(() => {
  if (originalValue === undefined) delete process.env[environmentName];
  else process.env[environmentName] = originalValue;
});

describe('Mainserver mutation capabilities', () => {
  it('keeps confirmed adapters enabled by default', () => {
    expect(isMainserverMutationCapabilityEnabled('news.update')).toBe(true);
    expect(isMainserverMutationCapabilityEnabled('surveys.create')).toBe(true);
  });

  it('fails closed for unconfirmed survey mutations', () => {
    delete process.env[environmentName];
    expect(isMainserverMutationCapabilityEnabled('surveys.update')).toBe(false);
    expect(isMainserverMutationCapabilityEnabled('surveys.delete')).toBe(false);
    expect(isMainserverMutationCapabilityEnabled('surveys.moderate')).toBe(false);
  });

  it('enables only explicitly named valid capabilities', () => {
    process.env[environmentName] = 'surveys.update, invalid, surveys.delete';
    expect(isMainserverMutationCapabilityEnabled('surveys.update')).toBe(true);
    expect(isMainserverMutationCapabilityEnabled('surveys.delete')).toBe(true);
    expect(isMainserverMutationCapabilityEnabled('surveys.moderate')).toBe(false);
    expect(getEnabledMainserverMutationCapabilities()).toEqual(
      expect.arrayContaining(['news.update', 'surveys.create', 'surveys.delete', 'surveys.update'])
    );
    expect(getEnabledMainserverMutationCapabilities()).not.toContain('invalid');
  });
});
