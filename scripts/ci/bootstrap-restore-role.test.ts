import { describe, expect, it } from 'vitest';

import { buildMigrationJobComposeDocument } from '../ops/runtime/migration-job.ts';
import { restoreRoleSecretNames } from './bootstrap-restore-role.ts';

describe('restoreRoleSecretNames', () => {
  it('binds staging only to the staging restore and admin secrets', () => {
    expect(restoreRoleSecretNames('staging')).toEqual({
      admin: 'backup_staging_postgres_password_v3',
      restore: 'restore_staging_postgres_password',
    });
  });

  it('binds production only to the production restore and admin secrets', () => {
    expect(restoreRoleSecretNames('prod')).toEqual({
      admin: 'backup_prod_postgres_password_v2',
      restore: 'restore_prod_postgres_password',
    });
  });

  it('preserves external secrets in the isolated one-shot stack', () => {
    const result = buildMigrationJobComposeDocument(
      {
        secrets: {
          postgres_admin_password: { external: true },
          restore_postgres_password: { external: true },
        },
        services: {
          migrate: {
            image: 'postgres:16-alpine',
            secrets: ['postgres_admin_password', 'restore_postgres_password'],
          },
        },
      },
      {
        internalNetworkName: 'studio-staging_default',
        jobStackName: 'studio-staging-migrate-test',
        sourceStackName: 'studio-staging',
        targetReplicas: 1,
      }
    );

    expect(result.secrets).toEqual({
      postgres_admin_password: { external: true },
      restore_postgres_password: { external: true },
    });
  });
});
