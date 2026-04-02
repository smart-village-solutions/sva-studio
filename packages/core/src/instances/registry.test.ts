import { describe, expect, it } from 'vitest';

import {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  classifyHost,
  isTrafficEnabledInstanceStatus,
  isValidHostname,
  isValidInstanceId,
  isValidParentDomain,
  normalizeHost,
} from './registry';

describe('instance registry core', () => {
  it('normalizes host casing, trailing dots and ports', () => {
    expect(normalizeHost('Foo.Studio.Example.org.:443')).toBe('foo.studio.example.org');
  });

  it('classifies root and tenant hosts', () => {
    expect(classifyHost('studio.example.org', 'studio.example.org')).toEqual({
      kind: 'root',
      normalizedHost: 'studio.example.org',
    });

    expect(classifyHost('hb.studio.example.org', 'studio.example.org')).toEqual({
      kind: 'tenant',
      normalizedHost: 'hb.studio.example.org',
      instanceId: 'hb',
    });
  });

  it('rejects invalid hosts deterministically', () => {
    expect(classifyHost('foo.bar.studio.example.org', 'studio.example.org')).toMatchObject({
      kind: 'invalid',
      reason: 'multi_level_subdomain',
    });
    expect(classifyHost('xn--demo.studio.example.org', 'studio.example.org')).toMatchObject({
      kind: 'invalid',
      reason: 'invalid_instance_id',
    });
  });

  it('validates identifiers and parent domains', () => {
    expect(isValidInstanceId('de-musterhausen')).toBe(true);
    expect(isValidInstanceId('xn--muster')).toBe(false);
    expect(isValidParentDomain('studio.example.org')).toBe(true);
    expect(isValidParentDomain('invalid_domain')).toBe(false);
    expect(isValidHostname('hb.studio.example.org')).toBe(true);
  });

  it('builds primary hostnames', () => {
    expect(buildPrimaryHostname('hb', 'Studio.Example.org')).toBe('hb.studio.example.org');
  });

  it('models status transitions and traffic states', () => {
    expect(canTransitionInstanceStatus('requested', 'validated')).toBe(true);
    expect(canTransitionInstanceStatus('active', 'validated')).toBe(false);
    expect(isTrafficEnabledInstanceStatus('active')).toBe(true);
    expect(isTrafficEnabledInstanceStatus('suspended')).toBe(false);
  });
});
