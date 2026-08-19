import type { PromoteGateEvidence, PromoteSeedPreparation } from './promote-evidence-types.ts';
import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';

type PreparationBindings = Readonly<{
  sourceSha: string | null;
  imageDigest: string | null;
  configRevision: string | null;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeEvidenceSeedPreparation = (
  value: unknown,
  gates: readonly PromoteGateEvidence[],
  bindings: PreparationBindings
): PromoteSeedPreparation | null => {
  const expectedGate =
    isRecord(value) && value.contract === 'production-live-config-label-prepare-v1'
      ? 'production-config-seed-preparation'
      : 'legacy-config-seed-preparation';
  const conflictingGate =
    expectedGate === 'production-config-seed-preparation'
      ? 'legacy-config-seed-preparation'
      : 'production-config-seed-preparation';
  const gatePassed = gates.some((gate) => gate.gate === expectedGate && gate.status === 'passed');
  const conflictingGatePassed = gates.some(
    (gate) => gate.gate === conflictingGate && gate.status === 'passed'
  );
  if (conflictingGatePassed) throw new Error('Seed-Vorbereitung hat mehrere autorisierende Gates.');
  if (!gatePassed && (value === null || value === undefined)) return null;
  if (!gatePassed || !isRecord(value)) {
    throw new Error('Seed-Vorbereitung widerspricht dem Gate-Vertrag.');
  }
  const staging = value.contract === 'staging-live-config-label-prepare-v1';
  const production = value.contract === 'production-live-config-label-prepare-v1';
  if (
    (!staging && !production) ||
    value.sourceSha !== bindings.sourceSha ||
    value.imageDigest !== bindings.imageDigest ||
    value.configRevision !== bindings.configRevision ||
    value.liveConfigRevisionState !== 'missing' ||
    value.backupExecutor !== 'agent' ||
    (production && value.shadowEquivalent !== true) ||
    (staging && Object.hasOwn(value, 'shadowEquivalent'))
  ) {
    throw new Error('Seed-Vorbereitung verletzt ihre Bindungen.');
  }
  return {
    contract: value.contract as PromoteSeedPreparation['contract'],
    sourceSha: value.sourceSha as string,
    imageDigest: value.imageDigest as string,
    configRevision: value.configRevision as string,
    liveConfigRevisionState: 'missing',
    backupExecutor: 'agent',
    ...(production ? { shadowEquivalent: true as const } : {}),
  };
};

export const validateProductionSeedPreparation = (
  value: unknown,
  bindings: PreparationBindings
): PromoteSeedPreparation => {
  const keys = [
    'backupExecutor',
    'configRevision',
    'contract',
    'imageDigest',
    'liveConfigRevisionState',
    'shadowEquivalent',
    'sourceSha',
  ];
  try {
    if (!isRecord(value) || Object.keys(value).sort().join() !== keys.join()) throw null;
    const preparation = normalizeEvidenceSeedPreparation(
      value,
      [
        {
          gate: 'production-config-seed-preparation',
          phase: 'static-preflight',
          status: 'passed',
          blocking: true,
        },
      ],
      bindings
    );
    if (!preparation || preparation.contract !== 'production-live-config-label-prepare-v1')
      throw null;
    return preparation;
  } catch {
    throw new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
        environment: 'prod',
        phase: 'static-preflight',
      })
    );
  }
};

export const validatePreSeedPreparation = (
  value: unknown,
  bindings: PreparationBindings
): PromoteSeedPreparation => {
  const keys = [
    'backupExecutor',
    'configRevision',
    'contract',
    'imageDigest',
    'liveConfigRevisionState',
    'sourceSha',
  ];
  try {
    if (!isRecord(value) || Object.keys(value).sort().join() !== keys.join()) throw null;
    const preparation = normalizeEvidenceSeedPreparation(
      value,
      [
        {
          gate: 'legacy-config-seed-preparation',
          phase: 'static-preflight',
          status: 'passed',
          blocking: true,
        },
      ],
      bindings
    );
    if (!preparation) throw null;
    return preparation;
  } catch {
    throw new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
        environment: 'staging',
        phase: 'static-preflight',
      })
    );
  }
};
