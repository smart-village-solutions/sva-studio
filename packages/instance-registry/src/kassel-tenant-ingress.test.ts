import { mkdtemp, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildKasselTenantIngress, publishKasselTenantIngress } from './kassel-tenant-ingress.js';

describe('buildKasselTenantIngress', () => {
  it('renders one deterministic explicit tenant router', () => {
    const result = buildKasselTenantIngress({
      instanceId: 'tenant-havelland',
      hostname: 'Tenant-Havelland.Dialog.Kassel.DE.',
      service: 'sva-studio-ssf@docker',
    });
    expect(result).toEqual({
      configHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      filename: 'studio-tenant-tenant-havelland.yml',
      hostname: 'tenant-havelland.dialog.kassel.de',
      routerName: 'studio-tenant-tenant-havelland',
      source: [
        'http:',
        '  routers:',
        '    studio-tenant-tenant-havelland:',
        '      rule: "Host(`tenant-havelland.dialog.kassel.de`) && !PathPrefix(`/internal/`)"',
        '      entryPoints:',
        '        - websecure',
        '      priority: 200',
        '      service: "sva-studio-ssf@docker"',
        '      middlewares:',
        '        - studio-tenant-tenant-havelland-verification',
        '      tls:',
        '        certResolver: le',
        '  middlewares:',
        '    studio-tenant-tenant-havelland-verification:',
        '      headers:',
        '        customResponseHeaders:',
        '          X-SVA-Tenant-Router: "studio-tenant-tenant-havelland"',
        `          X-SVA-Tenant-Config: "${result.configHash}"`,
        '',
      ].join('\n'),
    });
  });

  it.each([
    ['studio.dialog.kassel.de', 'tenant_ingress_hostname_reserved'],
    ['auth.dialog.kassel.de', 'tenant_ingress_hostname_reserved'],
    ['dialog.kassel.de', 'tenant_ingress_hostname_outside_parent_domain'],
    ['a.b.dialog.kassel.de', 'tenant_ingress_hostname_invalid_label_count'],
    ['xn--bcher-kva.dialog.kassel.de', 'tenant_ingress_hostname_punycode_rejected'],
    ['tenant.example.org', 'tenant_ingress_hostname_outside_parent_domain'],
    ['bad_label.dialog.kassel.de', 'tenant_ingress_hostname_invalid_label'],
    ['bad`rule.dialog.kassel.de', 'tenant_ingress_hostname_invalid_label'],
  ])('rejects unsafe hostname %s', (hostname, errorCode) => {
    expect(() =>
      buildKasselTenantIngress({
        instanceId: 'tenant-a',
        hostname,
        service: 'sva-studio-ssf@docker',
      })
    ).toThrow(errorCode);
  });

  it.each(['service', 'service@file', '../service@docker', 'service`@docker'])(
    'rejects unsafe provider service %s',
    (service) => {
      expect(() =>
        buildKasselTenantIngress({
          instanceId: 'tenant-a',
          hostname: 'tenant-a.dialog.kassel.de',
          service,
        })
      ).toThrow('tenant_ingress_service_invalid');
    }
  );

  it('requires the instance id to match the hostname label', () => {
    expect(() =>
      buildKasselTenantIngress({
        instanceId: 'tenant-b',
        hostname: 'tenant-a.dialog.kassel.de',
        service: 'sva-studio-ssf@docker',
      })
    ).toThrow('tenant_ingress_instance_hostname_mismatch');
  });
});

describe('publishKasselTenantIngress', () => {
  it('atomically publishes the validated router file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sva-kassel-ingress-'));

    const result = await publishKasselTenantIngress({
      directory,
      instanceId: 'tenant-a',
      hostname: 'tenant-a.dialog.kassel.de',
      service: 'sva-studio-ssf@docker',
    });

    expect(result.filename).toBe('studio-tenant-tenant-a.yml');
    await expect(readFile(result.path, 'utf8')).resolves.toBe(result.source);
  });

  it('replaces a symlink without writing through it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sva-kassel-ingress-'));
    const outside = join(directory, '..', 'outside-ingress.yml');
    const target = join(directory, 'studio-tenant-tenant-a.yml');
    await symlink(outside, target);

    const result = await publishKasselTenantIngress({
      directory,
      instanceId: 'tenant-a',
      hostname: 'tenant-a.dialog.kassel.de',
      service: 'sva-studio-ssf@docker',
    });

    await expect(readFile(result.path, 'utf8')).resolves.toBe(result.source);
    await expect(readFile(outside, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
