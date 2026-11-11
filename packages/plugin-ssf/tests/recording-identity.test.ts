import { expect, it } from 'vitest';
import { createPluginServerHandlerRegistry } from '@sva/plugin-sdk';
import {
  createSsfAuthorizationProjection,
  areSsfAuthorizationProjectionsEqual,
  createSsfAuthorizationRevision,
} from '../src/authorization-projection.js';
import { ssfPlugin } from '../src/descriptor.js';

const grants = [
  'ssf.recording.request',
  'ssf.recording.review',
  'ssf.recording.review.sworn',
  'ssf.recording.supervise',
  'ssf.recording.recovery.custodian',
];
it('projects explicit recording grants and competence languages independently of role hints', () => {
  const projection = createSsfAuthorizationProjection({
    instanceId: 'tenant-a',
    subjects: [
      { subject: 'reviewer', roleNames: [], permissionIds: grants, languages: ['DE', 'en', 'de'] },
      {
        subject: 'admin',
        roleNames: ['system_admin'],
        permissionIds: ['ssf.configuration.tenant.manage'],
      },
    ],
  });
  expect(projection.subjects.find((s) => s.subject === 'reviewer')).toMatchObject({
    permissions: [...grants].sort(),
    languages: ['de', 'en'],
  });
  expect(new Set(ssfPlugin.moduleIam.systemRoles[0].permissionIds)).toEqual(
    new Set(ssfPlugin.moduleIam.permissionIds)
  );
  expect(ssfPlugin.moduleIam.permissionIds).toEqual(expect.arrayContaining(grants));
  const changed = {
    ...projection,
    subjects: projection.subjects.map((s) => ({ ...s, languages: ['fr'] })),
  };
  expect(areSsfAuthorizationProjectionsEqual(projection, changed)).toBe(false);
  expect(createSsfAuthorizationRevision(projection)).toBe(createSsfAuthorizationRevision(changed));
});

it('registers the exact live directory service endpoint in the generated handler registry', () => {
  const registry = createPluginServerHandlerRegistry([ssfPlugin]);
  expect(registry.get('ssf.recording-directory-v2')).toMatchObject({ path: '/internal/plugins/ssf/v2/recording-directory', method: 'GET', actionId: 'ssf.runtime-configuration.read', accessRequirement: { kind: 'service', serviceId: 'ssf-runtime', tenantBinding: { kind: 'header', headerName: 'X-Studio-Tenant-Id' } } });
});
