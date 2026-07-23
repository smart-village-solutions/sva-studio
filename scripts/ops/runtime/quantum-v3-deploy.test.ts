import { describe, expect, it } from 'vitest';

import { buildQuantumDeployArgs as buildBootstrapDeployArgs } from './bootstrap-job.ts';
import { buildQuantumDeployArgs as buildMigrationDeployArgs } from './migration-job.ts';
import { buildQuantumBackupDeployArgs } from '../../ci/promote-backup-job.ts';

describe('Quantum CLI v3 deploy contract', () => {
  const expectedArgs = [
    'stacks',
    'deploy',
    '-f',
    '/tmp/one-shot-compose.json',
    '--stack',
    'studio-staging-job',
    '--endpoint',
    'sva',
  ];

  it.each([
    ['migration', buildMigrationDeployArgs],
    ['bootstrap', buildBootstrapDeployArgs],
    ['backup', buildQuantumBackupDeployArgs],
  ])('deploys the %s job with the Quantum CLI v3 file contract', (_job, buildArgs) => {
    expect(buildArgs('sva', 'studio-staging-job', '/tmp/one-shot-compose.json')).toEqual(expectedArgs);
  });
});
