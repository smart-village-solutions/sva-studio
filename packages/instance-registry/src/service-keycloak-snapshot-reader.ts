import type { InstanceRegistryRepository } from '@sva/data-repositories';

type ProvisioningRuns = readonly Awaited<
  ReturnType<InstanceRegistryRepository['listKeycloakProvisioningRuns']>
>[number][];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const readSnapshotFromRuns = <T>(
  runs: ProvisioningRuns,
  stepKeys: readonly string[],
  field: 'status' | 'preflight' | 'plan',
  policyVersion: number,
  inputFingerprint: string
): T | null => {
  for (const run of runs) {
    for (const stepKey of stepKeys) {
      const step = run.steps.find((candidate) => candidate.stepKey === stepKey);
      if (
        isRecord(step?.details) &&
        step.details.policyVersion === policyVersion &&
        step.details.inputFingerprint === inputFingerprint &&
        step.details[field]
      ) {
        return step.details[field] as T;
      }
    }
  }
  return null;
};
