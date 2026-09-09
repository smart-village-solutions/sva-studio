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
    expect(normalizeHost('Studio.Example.org')).toBe('studio.example.org');
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

  it('separates the configured Studio root from the tenant base domain', () => {
    const classify = (host: string) =>
      classifyHost(host, 'dialog.kassel.de', 'studio.dialog.kassel.de');
    expect(classify('STUDIO.dialog.kassel.de.:443').kind).toBe('root');
    expect(classify('smartcity.dialog.kassel.de')).toMatchObject({
      kind: 'tenant',
      instanceId: 'smartcity',
    });
    expect(classify('dialog.kassel.de').kind).toBe('invalid');
    expect(classify('auth.dialog.kassel.de')).toMatchObject({
      kind: 'invalid',
      reason: 'reserved_tenant_hostname',
    });
    expect(classify('smartcity.other.de').kind).toBe('invalid');
  });

  it.each(['studio', 'auth'])('reserves %s as a tenant hostname', (label) => {
    expect(classifyHost(`${label}.example.org`, 'example.org')).toMatchObject({
      kind: 'invalid',
      reason: 'reserved_tenant_hostname',
    });
  });

  it('rejects invalid hosts deterministically', () => {
    expect(classifyHost('hb.studio.example.org', 'invalid_domain')).toMatchObject({
      kind: 'invalid',
      reason: 'invalid_parent_domain',
    });
    expect(classifyHost('hb.other.example.org', 'studio.example.org')).toMatchObject({
      kind: 'invalid',
      reason: 'outside_parent_domain',
    });
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
