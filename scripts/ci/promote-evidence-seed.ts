import { projectSeedAuthorization } from './staging-live-config-seed-contract.ts';
import { projectProductionSeedAuthorization } from './production-live-config-seed-contract.ts';
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
  const stagingGatePassed = gates.some(
    (gate) => gate.gate === 'legacy-config-seed' && gate.status === 'passed'
  );
  const productionGatePassed = gates.some(
    (gate) => gate.gate === 'production-config-seed' && gate.status === 'passed'
  );
  if (stagingGatePassed && productionGatePassed) {
    throw new Error('Seed-Autorisierung hat mehrere autorisierende Gates.');
  }
  if (value && !stagingGatePassed && !productionGatePassed) {
    throw new Error('Seed-Autorisierung widerspricht dem Gate-Vertrag.');
  }
  if (productionGatePassed) return projectProductionSeedAuthorization(value, bindings);
  return projectSeedAuthorization(stagingGatePassed ? value : null, bindings);
};
