import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { createPluginModuleIamRegistry, createPluginRegistry } from '@sva/plugin-sdk';

import { ssfPlugin } from '../src/index.js';
import { SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID } from '../src/plugin.js';
import {
  SSF_RUNTIME_ENDPOINT_PATH,
  SSF_RUNTIME_TENANT_HEADER,
  SSF_RUNTIME_SERVER_HANDLER_ID,
  SSF_RUNTIME_SERVICE_ACTION,
  SSF_RUNTIME_SERVICE_ID,
} from '../src/constants.js';

describe('SSF plugin metadata', () => {
  it('registers tenant configuration permissions for the module IAM reconciliation', () => {
    const contract = createPluginModuleIamRegistry([ssfPlugin]).get('ssf');

    expect(contract).toMatchObject({
      moduleId: 'ssf',
      permissionIds: expect.arrayContaining([
        'ssf.configuration.tenant.read',
        'ssf.configuration.tenant.manage',
        'ssf.recording.request',
        'ssf.recording.review',
        'ssf.recording.review.sworn',
        'ssf.recording.supervise',
        'ssf.recording.recovery.custodian',
      ]),
      systemRoles: [
        {
          roleName: 'system_admin',
          permissionIds: expect.arrayContaining([
            'ssf.configuration.tenant.read',
            'ssf.configuration.tenant.manage',
            'ssf.recording.request',
            'ssf.recording.review',
            'ssf.recording.review.sworn',
            'ssf.recording.supervise',
            'ssf.recording.recovery.custodian',
          ]),
        },
      ],
    });
    expect(new Set(contract?.systemRoles[0]?.permissionIds)).toEqual(
      new Set(contract?.permissionIds)
    );
    expect(contract?.permissionIds).not.toContain('ssf.configuration.system.manage');
    expect(contract?.permissionIds).not.toContain('ssf.configuration.system.read');
  });

  it('keeps the runtime service and adds separated Root and Tenant administration', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../plugin.manifest.json', import.meta.url), 'utf8')
    ) as Record<string, unknown>;

    expect(ssfPlugin).toMatchObject({
      id: 'ssf',
      routes: expect.arrayContaining([
        expect.objectContaining({
          id: 'ssf-system-overview',
          accessRequirement: expect.objectContaining({ kind: 'platform' }),
        }),
        expect.objectContaining({
          id: 'ssf-tenant-overview',
          accessRequirement: expect.objectContaining({ kind: 'tenant', moduleId: 'ssf' }),
        }),
      ]),
      serverHandlers: expect.arrayContaining([
        {
          id: SSF_RUNTIME_SERVER_HANDLER_ID,
          path: SSF_RUNTIME_ENDPOINT_PATH,
          method: 'GET',
          actionId: SSF_RUNTIME_SERVICE_ACTION,
          accessRequirement: {
            kind: 'service',
            serviceId: SSF_RUNTIME_SERVICE_ID,
            tenantBinding: { kind: 'header', headerName: SSF_RUNTIME_TENANT_HEADER },
          },
        },
      ]),
      contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
      jobTypes: [expect.objectContaining({ jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID })],
      tenantLifecycle: {
        contractVersion: 1,
        operations: [
          { operation: 'provision', jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID },
          { operation: 'reconcile', jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID },
          { operation: 'readiness', jobTypeId: SSF_AUTHORIZATION_RECONCILE_JOB_TYPE_ID },
        ],
        readinessChecks: [
          {
            checkId: 'ssf.loginReady',
            titleKey: 'ssf.readiness.login',
            required: true,
            repairOperation: 'reconcile',
          },
        ],
      },
    });
    expect(manifest).toMatchObject({
      pluginId: 'ssf',
      manifestVersion: 1,
      extensionTier: 'admin',
      tenantActivationPolicy: 'optional',
    });
    expect(manifest['hostCompatibility']).toMatchObject({
      requiredCapabilities: ['iam', 'server', 'jobs'],
    });
    expect(manifest['entryPoints']).toEqual({
      descriptor: './dist/descriptor.js',
      browser: './dist/browser.js',
      server: './dist/server/index.js',
      jobs: './dist/server.js',
    });
    expect(manifest['runtimeRequirements']).toEqual({
      jobs: 'ssf.authorization-projection',
    });
    expect(ssfPlugin.translations).toMatchObject({
      de: { ssf: { navigation: { tenant: 'Smart Speech Flow' } } },
      en: { ssf: { navigation: { tenant: 'Smart Speech Flow' } } },
    });
  });
  it('registers eight addressable pages with six opt-in editor boundaries and V2 read guards', () => {
    expect(() =>
      createPluginRegistry([ssfPlugin], { extensionTiers: new Map([['ssf', 'admin']]) })
    ).not.toThrow();
    expect(ssfPlugin.routes).toHaveLength(8);
    expect(
      ssfPlugin.serverHandlers?.some((handler) =>
        /\/(system|tenant)-configuration$/u.test(handler.path)
      )
    ).toBe(false);
    expect(ssfPlugin.routes.filter((route) => route.editorLeaveGuard)).toHaveLength(6);
    expect(
      ssfPlugin.routes.every((route) => route.serverHandlerId?.includes('content-v2.read'))
    ).toBe(true);
    expect(
      ssfPlugin.navigation?.every((item) => item.section === 'applications' && item.group)
    ).toBe(true);
  });
  it('provides both languages for persistence scope labels used by the new root tabs', () => {
    for (const locale of ['de', 'en']) {
      const ssf = ssfPlugin.translations?.[locale]?.['ssf'] as {
        v2?: Record<string, unknown>;
        administration?: { pages?: Record<string, unknown> };
      };
      expect(ssf.v2?.['installation']).toEqual(expect.any(String));
      expect(ssf.v2?.['template']).toEqual(expect.any(String));
      expect(Object.keys(ssf.administration?.pages ?? {})).toHaveLength(8);
    }
  });
});
