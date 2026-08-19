import { projectSeedAuthorization } from './staging-live-config-seed-contract.ts';
import type { PromoteGateEvidence } from './promote-evidence-types.ts';

type SeedBindings = Readonly<{
  sourceSha: string | null;
  imageDigest: string | null;
  configRevision: string | null;
}>;

export const normalizeEvidenceSeedAuthorization = (
  value: unknown,
  gates: readonly PromoteGateEvidence[],
  bindings: SeedBindings
) => {
  const seedGatePassed = gates.some(
    (gate) => gate.gate === 'legacy-config-seed' && gate.status === 'passed'
  );
  if (value && !seedGatePassed) {
    throw new Error('Seed-Autorisierung widerspricht dem Gate-Vertrag.');
  }
  return projectSeedAuthorization(seedGatePassed ? value : null, bindings);
};
